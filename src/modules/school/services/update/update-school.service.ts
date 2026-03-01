import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { UpdateOneSchoolArgs } from '../../../graphql/@generated/school/update-one-school.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolRulesService } from '../shared/school-rules.service';

type ParsedUpdateData = {
   name?: string;
   description?: string | null;
   bannerPath?: string | null;
   logoFullPath?: string | null;
   logoMarkPath?: string | null;
   faviconPath?: string | null;
   primaryColor?: string | null;
   secondaryColor?: string | null;
   isActive?: boolean;
};

type Dictionary = Record<string, unknown>;

@Injectable()
export class UpdateSchoolService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(UpdateSchoolService.name);
   }

   async run(args: UpdateOneSchoolArgs, user?: AuthCurrentUser) {
      const schoolId = this.rules.extractSchoolId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'school.update',
            scopeType: AclScopeType.school,
            scopeId: schoolId,
         });
      }

      const currentSchool = await this.prisma.school.findUnique({
         where: { id: schoolId },
      });
      if (!currentSchool) {
         this.logger.warn(`Escola "${schoolId}" nao encontrada.`);
         throw new NotFoundException('Escola nao encontrada.');
      }

      const parsed = this.parseAndSanitizeData(args.data);
      if (Object.keys(parsed).length === 0) {
         throw new BadRequestException(
            'Nenhum campo valido foi informado para atualizacao.',
         );
      }

      if (!currentSchool.isActive) {
         this.assertInactiveSchoolUpdatePolicy(parsed);
      }

      const nextName = parsed.name ?? currentSchool.name;
      const nextIsActive = parsed.isActive ?? currentSchool.isActive;
      if (nextIsActive) {
         await this.rules.assertActiveNameUniqueness(
            nextName,
            currentSchool.id,
         );
      }

      const updatedSchool = await this.prisma.school.update({
         where: { id: schoolId },
         data: this.toPrismaUpdateInput(parsed),
      });

      this.logger.log(`Escola "${updatedSchool.id}" atualizada com sucesso.`);
      return updatedSchool;
   }

   private parseAndSanitizeData(
      input: UpdateOneSchoolArgs['data'],
   ): ParsedUpdateData {
      if (
         input &&
         typeof input === 'object' &&
         Object.prototype.hasOwnProperty.call(input, 'institutionCode')
      ) {
         throw new BadRequestException(
            'institutionCode e imutavel e nao pode ser alterado.',
         );
      }

      this.rules.detectUnsupportedNestedOperations(input, [
         'id',
         'createdAt',
         'updatedAt',
         'institutionCode',
         'Courses',
         'Memberships',
      ]);

      const parsed: ParsedUpdateData = {};
      if (input.name !== undefined) {
         parsed.name = this.rules.normalizeName(
            this.readSetOperation(input.name, 'name'),
         );
      }

      if (input.description !== undefined) {
         parsed.description = this.rules.normalizeOptional(
            this.readSetOperation(input.description, 'description'),
         );
      }

      if (input.bannerPath !== undefined) {
         parsed.bannerPath = this.rules.normalizeBrandingPath(
            this.readSetOperation(input.bannerPath, 'bannerPath'),
            'bannerPath',
         );
      }

      if (input.logoFullPath !== undefined) {
         parsed.logoFullPath = this.rules.normalizeBrandingPath(
            this.readSetOperation(input.logoFullPath, 'logoFullPath'),
            'logoFullPath',
         );
      }

      if (input.logoMarkPath !== undefined) {
         parsed.logoMarkPath = this.rules.normalizeBrandingPath(
            this.readSetOperation(input.logoMarkPath, 'logoMarkPath'),
            'logoMarkPath',
         );
      }

      if (input.faviconPath !== undefined) {
         parsed.faviconPath = this.rules.normalizeBrandingPath(
            this.readSetOperation(input.faviconPath, 'faviconPath'),
            'faviconPath',
         );
      }

      if (input.primaryColor !== undefined) {
         parsed.primaryColor = this.rules.normalizeHexColor(
            this.readSetOperation(input.primaryColor, 'primaryColor'),
            'primaryColor',
         );
      }

      if (input.secondaryColor !== undefined) {
         parsed.secondaryColor = this.rules.normalizeHexColor(
            this.readSetOperation(input.secondaryColor, 'secondaryColor'),
            'secondaryColor',
         );
      }

      if (input.isActive !== undefined) {
         const isActive = this.readSetOperation(input.isActive, 'isActive');
         if (typeof isActive !== 'boolean') {
            throw new BadRequestException(
               'Campo isActive deve receber um boolean em "set".',
            );
         }
         parsed.isActive = isActive;
      }

      return parsed;
   }

   private toPrismaUpdateInput(
      parsed: ParsedUpdateData,
   ): Prisma.SchoolUpdateInput {
      const data: Prisma.SchoolUpdateInput = {};

      if (parsed.name !== undefined) data.name = parsed.name;
      if (parsed.description !== undefined)
         data.description = parsed.description;
      if (parsed.bannerPath !== undefined) data.bannerPath = parsed.bannerPath;
      if (parsed.logoFullPath !== undefined)
         data.logoFullPath = parsed.logoFullPath;
      if (parsed.logoMarkPath !== undefined)
         data.logoMarkPath = parsed.logoMarkPath;
      if (parsed.faviconPath !== undefined)
         data.faviconPath = parsed.faviconPath;
      if (parsed.primaryColor !== undefined)
         data.primaryColor = parsed.primaryColor;
      if (parsed.secondaryColor !== undefined)
         data.secondaryColor = parsed.secondaryColor;
      if (parsed.isActive !== undefined) data.isActive = parsed.isActive;

      return data;
   }

   private assertInactiveSchoolUpdatePolicy(parsed: ParsedUpdateData): void {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && parsed.isActive === true) {
         return;
      }

      throw new BadRequestException(
         'Escola inativa so pode ser atualizada para isActive=true.',
      );
   }

   private readSetOperation(value: unknown, fieldName: string): unknown {
      const operation = this.asRecord(value, fieldName);
      const usedKeys = Object.keys(operation).filter(
         (key) => operation[key] !== undefined,
      );
      if (usedKeys.length !== 1 || usedKeys[0] !== 'set') {
         throw new BadRequestException(
            `Campo ${fieldName} aceita apenas a operacao "set".`,
         );
      }

      return operation.set;
   }

   private asRecord(value: unknown, fieldName: string): Dictionary {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
         throw new BadRequestException(`${fieldName} deve ser um objeto.`);
      }

      return value as Dictionary;
   }
}
