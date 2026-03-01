import {
   BadRequestException,
   ConflictException,
   Injectable,
} from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { SchoolWhereInput } from '../../../graphql/@generated/school/school-where.input';
import { PrismaService } from '../../../prisma/prisma.service';

type MaybeRecord = Record<string, unknown>;
const BRANDING_PATH_REGEX = /^(?:\/)?[a-zA-Z0-9][a-zA-Z0-9/_\-.]*$/;
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

@Injectable()
export class SchoolRulesService {
   constructor(private readonly prisma: PrismaService) {}

   normalizeName(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException('Nome da escola deve ser uma string.');
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      if (normalized.length === 0) {
         throw new BadRequestException('Nome da escola e obrigatorio.');
      }

      return normalized;
   }

   normalizeOptional(value: unknown): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;

      if (typeof value !== 'string') {
         throw new BadRequestException(
            'Campo opcional da escola deve ser uma string.',
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

   normalizeInstitutionCode(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException(
            'Codigo institucional deve ser uma string.',
         );
      }

      const normalized = value
         .normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .replace(/[^a-zA-Z0-9]+/g, '')
         .toUpperCase();

      if (normalized.length === 0) {
         throw new BadRequestException(
            'Nao foi possivel gerar um codigo institucional valido para a escola.',
         );
      }

      return normalized;
   }

   async generateUniqueInstitutionCode(name: string): Promise<string> {
      const baseCode = this.normalizeInstitutionCode(name);
      let suffix = 0;

      while (suffix <= 9999) {
         const suffixStr = suffix === 0 ? '' : String(suffix);
         const maxBaseLength = 32 - suffixStr.length;
         const candidateBase = baseCode.slice(0, Math.max(1, maxBaseLength));
         const candidate = `${candidateBase}${suffixStr}`;

         const exists = await this.prisma.school.findUnique({
            where: { institutionCode: candidate },
            select: { id: true },
         });

         if (!exists) {
            return candidate;
         }

         suffix += 1;
      }

      throw new ConflictException(
         'Nao foi possivel gerar um codigo institucional unico.',
      );
   }

   extractSchoolId(where: { id?: string | null } | undefined | null): string {
      const id = where?.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
         throw new BadRequestException(
            'Identificador da escola e obrigatorio.',
         );
      }

      return id.trim();
   }

   applyDefaultActiveFilter(
      where?: SchoolWhereInput,
   ): Prisma.SchoolWhereInput | undefined {
      if (this.hasExplicitIsActiveFilter(where)) return where;

      const onlyActiveFilter: Prisma.SchoolWhereInput = {
         isActive: { equals: true },
      };
      if (!where) return onlyActiveFilter;

      return {
         AND: [where as Prisma.SchoolWhereInput, onlyActiveFilter],
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
               `Operacao nao suportada para School: "${path}".`,
            );
         }
      }
   }

   async assertActiveNameUniqueness(
      name: string,
      ignoreSchoolId?: string,
   ): Promise<void> {
      const duplicate = await this.prisma.school.findFirst({
         where: {
            isActive: true,
            name: { equals: name, mode: 'insensitive' },
            ...(ignoreSchoolId ? { id: { not: ignoreSchoolId } } : {}),
         },
         select: { id: true },
      });

      if (duplicate) {
         throw new ConflictException(
            'Ja existe uma escola ativa com este nome.',
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

   private isHttpUrl(value: string): boolean {
      try {
         const parsed = new URL(value);
         return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
         return false;
      }
   }
}
