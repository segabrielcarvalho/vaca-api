import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSchoolArgs } from '../../args/create-school.args';
import { SchoolRulesService } from '../shared/school-rules.service';

const DEFAULT_SCHOOL_PRIMARY_COLOR = '#FACC15';
const DEFAULT_SCHOOL_SECONDARY_COLOR = '#000000';

@Injectable()
export class CreateSchoolService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
   ) {
      this.logger.setContext(CreateSchoolService.name);
   }

   async run(args: CreateSchoolArgs, user: AuthCurrentUser) {
      this.rules.detectUnsupportedNestedOperations(args.data, [
         'id',
         'createdAt',
         'updatedAt',
         'Courses',
         'Memberships',
      ]);

      const normalizedName = this.rules.normalizeName(args.data.name);
      const institutionCode = await this.resolveInstitutionCode(
         args.data.institutionCode,
         normalizedName,
      );
      const isActive = args.data.isActive ?? true;

      if (isActive) {
         await this.rules.assertActiveNameUniqueness(normalizedName);
      }

      const data: Prisma.SchoolCreateInput = {
         name: normalizedName,
         institutionCode,
         isActive,
      };
      const description = this.rules.normalizeOptional(args.data.description);
      const bannerPath = this.rules.normalizeBrandingPath(
         args.data.bannerPath,
         'bannerPath',
      );
      const logoFullPath = this.rules.normalizeBrandingPath(
         args.data.logoFullPath,
         'logoFullPath',
      );
      const logoMarkPath = this.rules.normalizeBrandingPath(
         args.data.logoMarkPath,
         'logoMarkPath',
      );
      const faviconPath = this.rules.normalizeBrandingPath(
         args.data.faviconPath,
         'faviconPath',
      );
      const primaryColor = this.rules.normalizeHexColor(
         args.data.primaryColor,
         'primaryColor',
      );
      const secondaryColor = this.rules.normalizeHexColor(
         args.data.secondaryColor,
         'secondaryColor',
      );
      const resolvedPrimaryColor = primaryColor ?? DEFAULT_SCHOOL_PRIMARY_COLOR;
      const resolvedSecondaryColor =
         secondaryColor ?? DEFAULT_SCHOOL_SECONDARY_COLOR;

      if (description !== undefined) data.description = description;
      if (bannerPath !== undefined) data.bannerPath = bannerPath;
      if (logoFullPath !== undefined) data.logoFullPath = logoFullPath;
      if (logoMarkPath !== undefined) data.logoMarkPath = logoMarkPath;
      if (faviconPath !== undefined) data.faviconPath = faviconPath;
      data.primaryColor = resolvedPrimaryColor;
      data.secondaryColor = resolvedSecondaryColor;

      const school = await this.prisma.school.create({ data });
      await this.assignOwnerMembership(user.id, school.id);
      this.logger.log(`Escola "${school.id}" criada com sucesso.`);

      return school;
   }

   private async resolveInstitutionCode(
      value: string | null | undefined,
      normalizedName: string,
   ): Promise<string> {
      if (value == null || value.trim().length === 0) {
         return this.rules.generateUniqueInstitutionCode(normalizedName);
      }

      const institutionCode = this.rules.normalizeInstitutionCode(value);
      await this.rules.assertInstitutionCodeUniqueness(institutionCode);
      return institutionCode;
   }

   private async assignOwnerMembership(
      userId: string,
      schoolId: string,
   ): Promise<void> {
      const [role, agent] = await Promise.all([
         this.prisma.aclRole.findUnique({
            where: { code: 'school_owner' },
            select: { id: true },
         }),
         this.prisma.agent.findUnique({
            where: { userId },
            select: { id: true },
         }),
      ]);

      if (!role) {
         throw new BadRequestException('Role ACL school_owner nao encontrada.');
      }
      if (!agent) {
         throw new BadRequestException(
            'Usuario autenticado nao possui Agent para ownership.',
         );
      }

      await this.prisma.aclMembership.upsert({
         where: {
            schoolId_agentId: {
               schoolId,
               agentId: agent.id,
            },
         },
         update: { roleId: role.id },
         create: {
            schoolId,
            agentId: agent.id,
            roleId: role.id,
         },
      });
   }
}
