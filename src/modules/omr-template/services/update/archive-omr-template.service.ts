import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ArchiveOmrTemplateInput } from '../../inputs/archive-omr-template.input';

@Injectable()
export class ArchiveOmrTemplateService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async run(input: ArchiveOmrTemplateInput, user: AuthCurrentUser) {
      const template = await this.prisma.omrTemplate.findUnique({
         where: { id: input.templateId },
         select: { id: true, courseId: true },
      });

      if (!template) {
         throw new NotFoundException('Template não encontrado.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.manage',
         scopeType: AclScopeType.course,
         scopeId: template.courseId,
      });

      await this.prisma.$transaction([
         this.prisma.omrTemplateVersion.updateMany({
            where: { templateId: template.id },
            data: { status: 'archived', isActive: false },
         }),
         this.prisma.omrTemplate.update({
            where: { id: template.id },
            data: { isActive: false, publishedVersionId: null },
         }),
      ]);

      return this.prisma.omrTemplate.findUniqueOrThrow({
         where: { id: template.id },
      });
   }
}
