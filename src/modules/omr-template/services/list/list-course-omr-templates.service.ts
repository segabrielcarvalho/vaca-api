import { ForbiddenException, Injectable } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListCourseOmrTemplatesInput } from '../../inputs/list-course-omr-templates.input';

@Injectable()
export class ListCourseOmrTemplatesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async run(input: ListCourseOmrTemplatesInput, user: AuthCurrentUser) {
      await this.assertCanReadCourseTemplates(input.courseId, user);

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const where = {
         courseId: input.courseId,
         isActive: input.isActive ?? undefined,
         name:
            input.nameSearch && input.nameSearch.trim().length > 0
               ? {
                    contains: input.nameSearch.trim(),
                    mode: 'insensitive' as const,
                 }
               : undefined,
      };

      const [count, rows] = await Promise.all([
         this.prisma.omrTemplate.count({ where }),
         this.prisma.omrTemplate.findMany({
            where,
            skip,
            take,
            orderBy: [{ updatedAt: 'desc' }],
            include: {
               PublishedVersion: true,
               Versions: {
                  orderBy: { version: 'desc' },
               },
            },
         }),
      ]);

      return { count, rows };
   }

   private async assertCanReadCourseTemplates(
      courseId: string,
      user: AuthCurrentUser,
   ) {
      try {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'course.template.read',
            scopeType: AclScopeType.course,
            scopeId: courseId,
         });
         return;
      } catch (error) {
         if (!(error instanceof ForbiddenException)) {
            throw error;
         }

         const activeKlasses = await this.prisma.klass.findMany({
            where: {
               courseId,
               isActive: true,
            },
            select: { id: true },
         });

         if (activeKlasses.length === 0) {
            throw error;
         }

         const checks = await Promise.allSettled(
            activeKlasses.map((klass) =>
               this.scopedAccessService.assertPermission({
                  user,
                  permissionCode: 'klass.exam.manage',
                  scopeType: AclScopeType.klass,
                  scopeId: klass.id,
               }),
            ),
         );

         const nonForbiddenError = checks.find(
            (check) =>
               check.status === 'rejected' &&
               !(check.reason instanceof ForbiddenException),
         );
         if (nonForbiddenError && nonForbiddenError.status === 'rejected') {
            throw nonForbiddenError.reason;
         }

         const hasKlassAccess = checks.some(
            (check) => check.status === 'fulfilled',
         );
         if (!hasKlassAccess) {
            throw error;
         }
      }
   }
}
