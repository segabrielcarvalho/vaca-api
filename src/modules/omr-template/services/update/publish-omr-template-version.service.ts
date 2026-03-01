import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublishOmrTemplateVersionInput } from '../../inputs/publish-omr-template-version.input';

@Injectable()
export class PublishOmrTemplateVersionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(PublishOmrTemplateVersionService.name);
   }

   async run(input: PublishOmrTemplateVersionInput, user: AuthCurrentUser) {
      const version = await this.prisma.omrTemplateVersion.findUnique({
         where: { id: input.templateVersionId },
         select: {
            id: true,
            templateId: true,
            Template: {
               select: {
                  courseId: true,
               },
            },
         },
      });

      if (!version) {
         throw new NotFoundException('Versão de template não encontrada.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.manage',
         scopeType: AclScopeType.course,
         scopeId: version.Template.courseId,
      });

      await this.prisma.$transaction([
         this.prisma.omrTemplateVersion.updateMany({
            where: {
               templateId: version.templateId,
               status: 'published',
            },
            data: {
               status: 'archived',
            },
         }),
         this.prisma.omrTemplateVersion.update({
            where: { id: version.id },
            data: {
               status: 'published',
               publishedAt: new Date(),
            },
         }),
         this.prisma.omrTemplate.update({
            where: { id: version.templateId },
            data: {
               publishedVersionId: version.id,
            },
         }),
      ]);

      return this.prisma.omrTemplateVersion.findUniqueOrThrow({
         where: { id: version.id },
      });
   }
}
