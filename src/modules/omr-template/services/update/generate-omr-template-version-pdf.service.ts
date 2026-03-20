import { Injectable, NotFoundException } from '@nestjs/common';
import {
   AclScopeType,
   OmrTemplatePdfGenerationTrigger,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateOmrTemplateVersionPdfInput } from '../../inputs/generate-omr-template-version-pdf.input';
import { QueueOmrTemplatePdfGenerationService } from '../pdf/queue-omr-template-pdf-generation.service';

@Injectable()
export class GenerateOmrTemplateVersionPdfService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly queueService: QueueOmrTemplatePdfGenerationService,
   ) {}

   async run(input: GenerateOmrTemplateVersionPdfInput, user: AuthCurrentUser) {
      const templateVersion = await this.prisma.omrTemplateVersion.findUnique({
         where: { id: input.templateVersionId },
         include: {
            Template: {
               select: {
                  id: true,
                  courseId: true,
               },
            },
         },
      });

      if (!templateVersion?.Template) {
         throw new NotFoundException('Versão de template não encontrada.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.manage',
         scopeType: AclScopeType.course,
         scopeId: templateVersion.Template.courseId,
      });

      const requestedByAgentId =
         await this.scopedAccessService.getAgentIdByUserId(user.id);

      return this.queueService.enqueue({
         templateVersionId: templateVersion.id,
         trigger: OmrTemplatePdfGenerationTrigger.manual,
         requestedByAgentId,
      });
   }
}
