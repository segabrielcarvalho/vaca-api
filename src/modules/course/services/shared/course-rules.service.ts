import {
   BadRequestException,
   ConflictException,
   Injectable,
} from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { CourseWhereInput } from '../../../graphql/@generated/course/course-where.input';
import { PrismaService } from '../../../prisma/prisma.service';

type MaybeRecord = Record<string, unknown>;
const BRANDING_PATH_REGEX = /^(?:\/)?[a-zA-Z0-9][a-zA-Z0-9/_\-.]*$/;
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

@Injectable()
export class CourseRulesService {
   constructor(private readonly prisma: PrismaService) {}

   normalizeName(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException('Nome do curso deve ser uma string.');
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      if (normalized.length === 0) {
         throw new BadRequestException('Nome do curso e obrigatorio.');
      }

      return normalized;
   }

   normalizeOptional(value: unknown): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;

      if (typeof value !== 'string') {
         throw new BadRequestException(
            'Campo opcional do curso deve ser uma string.',
         );
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      return normalized.length > 0 ? normalized : null;
   }

   normalizeBrandingPath(
      value: unknown,
      fieldName: string,
   ): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;

      if (typeof value !== 'string') {
         throw new BadRequestException(
            `${fieldName} deve ser uma string de caminho ou URL.`,
         );
      }

      const normalized = value.trim();
      if (normalized.length === 0) {
         return null;
      }

      if (this.isHttpUrl(normalized) || BRANDING_PATH_REGEX.test(normalized)) {
         return normalized;
      }

      throw new BadRequestException(
         `${fieldName} deve ser URL http(s) ou caminho valido.`,
      );
   }

   normalizeHexColor(
      value: unknown,
      fieldName: string,
   ): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;

      if (typeof value !== 'string') {
         throw new BadRequestException(
            `${fieldName} deve ser uma string hexadecimal.`,
         );
      }

      const normalized = value.trim();
      if (normalized.length === 0) {
         return null;
      }

      if (!HEX_COLOR_REGEX.test(normalized)) {
         throw new BadRequestException(
            `${fieldName} deve estar no formato #RGB ou #RRGGBB.`,
         );
      }

      return normalized.toUpperCase();
   }

   extractCourseId(where: { id?: string | null } | undefined | null): string {
      const id = where?.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
         throw new BadRequestException('Identificador do curso e obrigatorio.');
      }

      return id.trim();
   }

   extractSchoolConnectId(value: unknown): string {
      const school = this.asRecord(value, 'School');
      const unsupportedKeys = Object.keys(school).filter(
         (key) => key !== 'connect' && school[key] !== undefined,
      );
      if (unsupportedKeys.length > 0) {
         throw new BadRequestException(
            'School aceita apenas operacao connect neste modulo.',
         );
      }

      const connect = this.asRecord(school.connect, 'School.connect');
      const unsupportedConnectKeys = Object.keys(connect).filter(
         (key) => key !== 'id' && connect[key] !== undefined,
      );
      if (unsupportedConnectKeys.length > 0) {
         throw new BadRequestException('School.connect aceita apenas id.');
      }

      const id = connect.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
         throw new BadRequestException('School.connect.id e obrigatorio.');
      }

      return id.trim();
   }

   applyDefaultActiveFilter(
      where?: CourseWhereInput,
   ): Prisma.CourseWhereInput | undefined {
      if (this.hasExplicitIsActiveFilter(where)) return where;

      const onlyActiveFilter: Prisma.CourseWhereInput = {
         isActive: { equals: true },
      };
      if (!where) return onlyActiveFilter;

      return {
         AND: [where as Prisma.CourseWhereInput, onlyActiveFilter],
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
               `Operacao nao suportada para Course: "${path}".`,
            );
         }
      }
   }

   async assertActiveNameUniqueness(
      schoolId: string,
      name: string,
      ignoreCourseId?: string,
   ): Promise<void> {
      const duplicate = await this.prisma.course.findFirst({
         where: {
            schoolId,
            isActive: true,
            name: { equals: name, mode: 'insensitive' },
            ...(ignoreCourseId ? { id: { not: ignoreCourseId } } : {}),
         },
         select: { id: true },
      });

      if (duplicate) {
         throw new ConflictException(
            'Ja existe um curso ativo com este nome nesta escola.',
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

   private isHttpUrl(value: string): boolean {
      try {
         const parsed = new URL(value);
         return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
         return false;
      }
   }
}
