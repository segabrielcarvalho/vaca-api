import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { UpdateOneKlassArgs } from '../../../graphql/@generated/klass/update-one-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

type ParsedUpdateData = {
   name?: string;
   description?: string | null;
   bannerPath?: string | null;
   isActive?: boolean;
   courseConnectId?: string;
};

type Dictionary = Record<string, unknown>;

@Injectable()
export class UpdateKlassService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(UpdateKlassService.name);
   }

   async run(args: UpdateOneKlassArgs, user?: AuthCurrentUser) {
      const klassId = this.rules.extractKlassId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'klass.update',
            scopeType: AclScopeType.klass,
            scopeId: klassId,
         });
      }

      const currentKlass = await this.prisma.klass.findUnique({
         where: { id: klassId },
      });
      if (!currentKlass) {
         this.logger.warn(`Turma "${klassId}" nao encontrada.`);
         throw new NotFoundException('Turma nao encontrada.');
      }

      const parsed = await this.parseAndSanitizeData(args.data);
      if (Object.keys(parsed).length === 0) {
         throw new BadRequestException(
            'Nenhum campo valido foi informado para atualizacao.',
         );
      }

      if (!currentKlass.isActive) {
         this.assertInactiveKlassUpdatePolicy(parsed);
      }

      const nextName = parsed.name ?? currentKlass.name;
      const nextCourseId = parsed.courseConnectId ?? currentKlass.courseId;
      const nextIsActive = parsed.isActive ?? currentKlass.isActive;
      if (nextIsActive) {
         await this.rules.assertActiveNameUniqueness(
            nextCourseId,
            nextName,
            currentKlass.id,
         );
      }

      const updatedKlass = await this.prisma.klass.update({
         where: { id: klassId },
         data: this.toPrismaUpdateInput(parsed),
      });

      this.logger.log(`Turma "${updatedKlass.id}" atualizada com sucesso.`);
      return updatedKlass;
   }

   private async parseAndSanitizeData(
      input: UpdateOneKlassArgs['data'],
   ): Promise<ParsedUpdateData> {
      this.rules.detectUnsupportedNestedOperations(input, [
         'id',
         'createdAt',
         'updatedAt',
         'Exams',
         'Enrollments',
         'Memberships',
         'Course.create',
         'Course.connectOrCreate',
         'Course.upsert',
         'Course.delete',
         'Course.update',
         'Course.disconnect',
         'Course.set',
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
         parsed.bannerPath = this.rules.normalizeOptional(
            this.readSetOperation(input.bannerPath, 'bannerPath'),
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

      if (input.Course !== undefined) {
         parsed.courseConnectId = this.rules.extractCourseConnectId(
            input.Course,
         );

         const courseExists = await this.prisma.course.findUnique({
            where: { id: parsed.courseConnectId },
            select: { id: true },
         });
         if (!courseExists) {
            throw new NotFoundException('Curso nao encontrado.');
         }
      }

      return parsed;
   }

   private toPrismaUpdateInput(
      parsed: ParsedUpdateData,
   ): Prisma.KlassUpdateInput {
      const data: Prisma.KlassUpdateInput = {};

      if (parsed.name !== undefined) data.name = parsed.name;
      if (parsed.description !== undefined)
         data.description = parsed.description;
      if (parsed.bannerPath !== undefined) data.bannerPath = parsed.bannerPath;
      if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
      if (parsed.courseConnectId !== undefined) {
         data.Course = {
            connect: {
               id: parsed.courseConnectId,
            },
         };
      }

      return data;
   }

   private assertInactiveKlassUpdatePolicy(parsed: ParsedUpdateData): void {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && parsed.isActive === true) {
         return;
      }

      throw new BadRequestException(
         'Turma inativa so pode ser atualizada para isActive=true.',
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
