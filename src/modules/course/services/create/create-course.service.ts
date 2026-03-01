import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { CreateOneCourseArgs } from '../../../graphql/@generated/course/create-one-course.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseRulesService } from '../shared/course-rules.service';

@Injectable()
export class CreateCourseService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
   ) {
      this.logger.setContext(CreateCourseService.name);
   }

   async run(args: CreateOneCourseArgs, user: AuthCurrentUser) {
      this.rules.detectUnsupportedNestedOperations(args.data, [
         'id',
         'createdAt',
         'updatedAt',
         'Klasses',
         'Memberships',
         'School.create',
         'School.connectOrCreate',
      ]);

      const schoolId = this.rules.extractSchoolConnectId(args.data.School);
      const school = await this.prisma.school.findUnique({
         where: { id: schoolId },
         select: { id: true },
      });
      if (!school) {
         throw new NotFoundException('School nao encontrada.');
      }

      const normalizedName = this.rules.normalizeName(args.data.name);
      const isActive = args.data.isActive ?? true;

      if (isActive) {
         await this.rules.assertActiveNameUniqueness(schoolId, normalizedName);
      }

      const data: Prisma.CourseCreateInput = {
         name: normalizedName,
         isActive,
         School: {
            connect: { id: schoolId },
         },
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

      if (description !== undefined) data.description = description;
      if (bannerPath !== undefined) data.bannerPath = bannerPath;
      if (logoFullPath !== undefined) data.logoFullPath = logoFullPath;
      if (logoMarkPath !== undefined) data.logoMarkPath = logoMarkPath;
      if (faviconPath !== undefined) data.faviconPath = faviconPath;
      if (primaryColor !== undefined) data.primaryColor = primaryColor;
      if (secondaryColor !== undefined) data.secondaryColor = secondaryColor;

      const course = await this.prisma.course.create({ data });
      await this.assignOwnerMembership(user.id, course.id);
      this.logger.log(`Curso "${course.id}" criado com sucesso.`);

      return course;
   }

   private async assignOwnerMembership(
      userId: string,
      courseId: string,
   ): Promise<void> {
      const [role, agent] = await Promise.all([
         this.prisma.aclRole.findUnique({
            where: { code: 'course_owner' },
            select: { id: true },
         }),
         this.prisma.agent.findUnique({
            where: { userId },
            select: { id: true },
         }),
      ]);

      if (!role) {
         throw new BadRequestException('Role ACL course_owner nao encontrada.');
      }
      if (!agent) {
         throw new BadRequestException(
            'Usuario autenticado nao possui Agent para ownership.',
         );
      }

      await this.prisma.aclMembership.upsert({
         where: {
            courseId_agentId: {
               courseId,
               agentId: agent.id,
            },
         },
         update: { roleId: role.id },
         create: {
            courseId,
            agentId: agent.id,
            roleId: role.id,
         },
      });
   }
}
