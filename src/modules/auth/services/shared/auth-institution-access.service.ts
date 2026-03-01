import { RoleEnum } from '../../../../../.prisma/client';
import {
   BadRequestException,
   Injectable,
   UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

type LoginSchoolContext = {
   id: string;
   institutionCode: string;
   isActive: boolean;
};

type AccessMode = 'start' | 'challenge';

@Injectable()
export class AuthInstitutionAccessService {
   constructor(private readonly prisma: PrismaService) {}

   normalizeInstitutionCode(value: unknown): string {
      if (typeof value !== 'string' || value.trim().length === 0) {
         throw new BadRequestException('Codigo da instituicao e obrigatorio.');
      }

      const normalized = value.trim().toUpperCase();
      if (!/^[A-Z0-9]+$/.test(normalized)) {
         throw new BadRequestException(
            'Codigo da instituicao invalido. Use apenas letras e numeros.',
         );
      }

      return normalized;
   }

   async assertStartAccess(input: {
      institutionCode: unknown;
      userId: string;
      role: RoleEnum;
   }): Promise<LoginSchoolContext> {
      const institutionCode = this.normalizeInstitutionCode(
         input.institutionCode,
      );
      const school = await this.resolveSchoolByInstitutionCodeOrThrow(
         institutionCode,
         'start',
      );
      await this.assertMembershipEligibility({
         userId: input.userId,
         role: input.role,
         schoolId: school.id,
         mode: 'start',
      });
      return school;
   }

   async assertChallengeAccess(input: {
      schoolId: unknown;
      institutionCode?: unknown;
      userId: string;
      role: RoleEnum;
   }): Promise<LoginSchoolContext> {
      const schoolId = this.readChallengeSchoolId(input.schoolId);
      const school = await this.resolveSchoolByIdOrThrow(schoolId, 'challenge');

      if (input.institutionCode !== undefined) {
         const challengeCode = this.normalizeChallengeInstitutionCode(
            input.institutionCode,
         );
         if (challengeCode !== school.institutionCode) {
            throw new UnauthorizedException(
               'Desafio com codigo institucional invalido.',
            );
         }
      }

      await this.assertMembershipEligibility({
         userId: input.userId,
         role: input.role,
         schoolId: school.id,
         mode: 'challenge',
      });

      return school;
   }

   private async assertMembershipEligibility(input: {
      userId: string;
      role: RoleEnum;
      schoolId: string;
      mode: AccessMode;
   }): Promise<void> {
      if (input.role === RoleEnum.admin) {
         return;
      }

      const agent = await this.prisma.agent.findUnique({
         where: { userId: input.userId },
         select: { id: true },
      });
      if (!agent) {
         this.throwByMode(
            input.mode,
            'Usuario sem Agent vinculado para login institucional.',
         );
      }

      const hasSchoolMembership = await this.prisma.aclMembership.findFirst({
         where: {
            agentId: agent.id,
            schoolId: input.schoolId,
         },
         select: { id: true },
      });
      if (hasSchoolMembership) {
         return;
      }

      const hasCourseMembership = await this.prisma.course.findFirst({
         where: {
            schoolId: input.schoolId,
            Memberships: {
               some: {
                  agentId: agent.id,
               },
            },
         },
         select: { id: true },
      });
      if (hasCourseMembership) {
         return;
      }

      const hasKlassMembership = await this.prisma.klass.findFirst({
         where: {
            Course: {
               schoolId: input.schoolId,
            },
            Memberships: {
               some: {
                  agentId: agent.id,
               },
            },
         },
         select: { id: true },
      });

      if (!hasKlassMembership) {
         this.throwByMode(
            input.mode,
            'Usuario sem vinculo com a instituicao informada.',
         );
      }
   }

   private async resolveSchoolByInstitutionCodeOrThrow(
      institutionCode: string,
      mode: AccessMode,
   ): Promise<LoginSchoolContext> {
      const school = await this.prisma.school.findUnique({
         where: { institutionCode },
         select: {
            id: true,
            institutionCode: true,
            isActive: true,
         },
      });
      if (!school) {
         this.throwByMode(mode, 'Codigo da instituicao nao encontrado.');
      }
      if (!school.isActive) {
         this.throwByMode(mode, 'Instituicao inativa.');
      }
      return school;
   }

   private async resolveSchoolByIdOrThrow(
      schoolId: string,
      mode: AccessMode,
   ): Promise<LoginSchoolContext> {
      const school = await this.prisma.school.findUnique({
         where: { id: schoolId },
         select: {
            id: true,
            institutionCode: true,
            isActive: true,
         },
      });
      if (!school) {
         this.throwByMode(mode, 'Instituicao do desafio nao encontrada.');
      }
      if (!school.isActive) {
         this.throwByMode(mode, 'Instituicao inativa.');
      }
      return school;
   }

   private readChallengeSchoolId(value: unknown): string {
      if (typeof value !== 'string' || value.trim().length === 0) {
         throw new UnauthorizedException('Desafio sem contexto institucional.');
      }
      return value.trim();
   }

   private normalizeChallengeInstitutionCode(value: unknown): string {
      if (typeof value !== 'string' || value.trim().length === 0) {
         throw new UnauthorizedException('Desafio com codigo invalido.');
      }
      const normalized = value.trim().toUpperCase();
      if (!/^[A-Z0-9]+$/.test(normalized)) {
         throw new UnauthorizedException('Desafio com codigo invalido.');
      }
      return normalized;
   }

   private throwByMode(mode: AccessMode, message: string): never {
      if (mode === 'challenge') {
         throw new UnauthorizedException(message);
      }
      throw new BadRequestException(message);
   }
}
