import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { UpdateOneCourseArgs } from '../../../graphql/@generated/course/update-one-course.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseRulesService } from '../shared/course-rules.service';

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
   schoolConnectId?: string;
};

type Dictionary = Record<string, unknown>;

@Injectable()
export class UpdateCourseService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(UpdateCourseService.name);
   }

   async run(args: UpdateOneCourseArgs, user?: AuthCurrentUser) {
      const courseId = this.rules.extractCourseId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'course.update',
            scopeType: AclScopeType.course,
            scopeId: courseId,
         });
      }

      const currentCourse = await this.prisma.course.findUnique({
         where: { id: courseId },
      });
      if (!currentCourse) {
         this.logger.warn(`Curso "${courseId}" nao encontrado.`);
         throw new NotFoundException('Curso nao encontrado.');
      }

      const parsed = await this.parseAndSanitizeData(args.data);
      if (Object.keys(parsed).length === 0) {
         throw new BadRequestException(
            'Nenhum campo valido foi informado para atualizacao.',
         );
      }

      if (!currentCourse.isActive) {
         this.assertInactiveCourseUpdatePolicy(parsed);
      }

      const nextName = parsed.name ?? currentCourse.name;
      const nextSchoolId = parsed.schoolConnectId ?? currentCourse.schoolId;
      const nextIsActive = parsed.isActive ?? currentCourse.isActive;
      if (nextIsActive) {
         await this.rules.assertActiveNameUniqueness(
            nextSchoolId,
            nextName,
            currentCourse.id,
         );
      }

      const updatedCourse = await this.prisma.course.update({
         where: { id: courseId },
         data: this.toPrismaUpdateInput(parsed),
      });

      this.logger.log(`Curso "${updatedCourse.id}" atualizado com sucesso.`);
      return updatedCourse;
   }

   private async parseAndSanitizeData(
      input: UpdateOneCourseArgs['data'],
   ): Promise<ParsedUpdateData> {
      this.rules.detectUnsupportedNestedOperations(input, [
         'id',
         'createdAt',
         'updatedAt',
         'Klasses',
         'Memberships',
         'School.create',
         'School.connectOrCreate',
         'School.upsert',
         'School.delete',
         'School.update',
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

      if (input.School !== undefined) {
         parsed.schoolConnectId = this.rules.extractSchoolConnectId(
            input.School,
         );

         const schoolExists = await this.prisma.school.findUnique({
            where: { id: parsed.schoolConnectId },
            select: { id: true },
         });
         if (!schoolExists) {
            throw new NotFoundException('School nao encontrada.');
         }
      }

      return parsed;
   }

   private toPrismaUpdateInput(
      parsed: ParsedUpdateData,
   ): Prisma.CourseUpdateInput {
      const data: Prisma.CourseUpdateInput = {};

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
      if (parsed.schoolConnectId) {
         data.School = {
            connect: {
               id: parsed.schoolConnectId,
            },
         };
      }

      return data;
   }

   private assertInactiveCourseUpdatePolicy(parsed: ParsedUpdateData): void {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && parsed.isActive === true) {
         return;
      }

      throw new BadRequestException(
         'Curso inativo so pode ser atualizado para isActive=true.',
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
