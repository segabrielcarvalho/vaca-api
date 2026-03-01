import { Injectable } from '@nestjs/common';
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
      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.read',
         scopeType: AclScopeType.course,
         scopeId: input.courseId,
      });

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
}
