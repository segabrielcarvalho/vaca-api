import {
   BadRequestException,
   ConflictException,
   Injectable,
} from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { KlassWhereInput } from '../../../graphql/@generated/klass/klass-where.input';
import { PrismaService } from '../../../prisma/prisma.service';

type MaybeRecord = Record<string, unknown>;

@Injectable()
export class KlassRulesService {
   constructor(private readonly prisma: PrismaService) {}

   normalizeName(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException('Nome da turma deve ser uma string.');
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      if (normalized.length === 0) {
         throw new BadRequestException('Nome da turma e obrigatorio.');
      }

      return normalized;
   }

   normalizeOptional(value: unknown): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;

      if (typeof value !== 'string') {
         throw new BadRequestException(
            'Campo opcional da turma deve ser uma string.',
         );
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      return normalized.length > 0 ? normalized : null;
   }

   extractKlassId(where: { id?: string | null } | undefined | null): string {
      const id = where?.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
         throw new BadRequestException('Identificador da turma e obrigatorio.');
      }

      return id.trim();
   }

   extractCourseConnectId(value: unknown): string {
      const course = this.asRecord(value, 'Course');
      const unsupportedKeys = Object.keys(course).filter(
         (key) => key !== 'connect' && course[key] !== undefined,
      );
      if (unsupportedKeys.length > 0) {
         throw new BadRequestException(
            'Course aceita apenas operacao connect neste modulo.',
         );
      }

      const connect = this.asRecord(course.connect, 'Course.connect');
      const unsupportedConnectKeys = Object.keys(connect).filter(
         (key) => key !== 'id' && connect[key] !== undefined,
      );
      if (unsupportedConnectKeys.length > 0) {
         throw new BadRequestException('Course.connect aceita apenas id.');
      }

      const id = connect.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
         throw new BadRequestException('Course.connect.id e obrigatorio.');
      }

      return id.trim();
   }

   applyDefaultActiveFilter(
      where?: KlassWhereInput,
   ): Prisma.KlassWhereInput | undefined {
      if (this.hasExplicitIsActiveFilter(where)) return where;

      const onlyActiveFilter: Prisma.KlassWhereInput = {
         isActive: { equals: true },
      };
      if (!where) return onlyActiveFilter;

      return {
         AND: [where as Prisma.KlassWhereInput, onlyActiveFilter],
      };
   }

   detectUnsupportedNestedOperations(
      input: unknown,
      unsupportedPaths: string[],
   ): void {
      for (const path of unsupportedPaths) {
         const value = this.readPath(input, path);
         if (value !== undefined) {
            throw new BadRequestException(
               `Operacao nao suportada para Klass: "${path}".`,
            );
         }
      }
   }

   async assertActiveNameUniqueness(
      courseId: string,
      name: string,
      ignoreKlassId?: string,
   ): Promise<void> {
      const duplicate = await this.prisma.klass.findFirst({
         where: {
            courseId,
            isActive: true,
            name: { equals: name, mode: 'insensitive' },
            ...(ignoreKlassId ? { id: { not: ignoreKlassId } } : {}),
         },
         select: { id: true },
      });

      if (duplicate) {
         throw new ConflictException(
            'Ja existe uma turma ativa com este nome neste curso.',
         );
      }
   }

   private hasExplicitIsActiveFilter(where?: unknown): boolean {
      if (!where || typeof where !== 'object') return false;
      const record = where as MaybeRecord;
      if (record.isActive !== undefined) return true;

      return (
         this.branchHasIsActive(record.AND) ||
         this.branchHasIsActive(record.OR) ||
         this.branchHasIsActive(record.NOT)
      );
   }

   private branchHasIsActive(branch: unknown): boolean {
      if (Array.isArray(branch)) {
         return branch.some((item) => this.hasExplicitIsActiveFilter(item));
      }
      if (branch && typeof branch === 'object') {
         return this.hasExplicitIsActiveFilter(branch);
      }
      return false;
   }

   private readPath(input: unknown, path: string): unknown {
      const parts = path.split('.');
      let current: unknown = input;

      for (const part of parts) {
         if (!current || typeof current !== 'object') return undefined;
         current = (current as MaybeRecord)[part];
      }

      return current;
   }

   private asRecord(value: unknown, fieldName: string): MaybeRecord {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
         throw new BadRequestException(`${fieldName} deve ser um objeto.`);
      }

      return value as MaybeRecord;
   }
}
