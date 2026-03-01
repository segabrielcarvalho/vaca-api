import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
   AclScopeType,
   OmrTemplatePdfGenerationStatus,
   OmrTemplatePdfGenerationTrigger,
   Prisma,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import { CreateOmrTemplateVersionInput } from '../../inputs/create-omr-template-version.input';
import { QueueOmrTemplatePdfGenerationService } from '../pdf/queue-omr-template-pdf-generation.service';
import { OmrTemplateRulesService } from '../shared/omr-template-rules.service';

@Injectable()
export class CreateOmrTemplateVersionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly rules: OmrTemplateRulesService,
      private readonly queuePdfGenerationService: QueueOmrTemplatePdfGenerationService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
   ) {
      this.logger.setContext(CreateOmrTemplateVersionService.name);
   }

   async run(input: CreateOmrTemplateVersionInput, user: AuthCurrentUser) {
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

      const layout = this.rules.parseLayoutJson(input.layoutJson);
      const questionCount = this.rules.resolveQuestionCount(layout);
      const compiledGeometryJson = this.rules.compileGeometry(layout, questionCount);

      const [lastVersion, createdByAgentId] = await Promise.all([
         this.prisma.omrTemplateVersion.findFirst({
            where: { templateId: template.id },
            orderBy: { version: 'desc' },
            select: { version: true },
         }),
         this.scopedAccessService.getAgentIdByUserId(user.id),
      ]);

      const version = (lastVersion?.version ?? 0) + 1;

      const baseFolder = `omr/templates/${template.id}/v${version}`;
      const [pdfPath, previewImagePath] = await Promise.all([
         this.saveBase64Asset(input.pdfBase64, `${baseFolder}/pdf`),
         this.saveBase64Asset(input.previewImageBase64, `${baseFolder}/preview`),
      ]);
      const hasLegacyPdf = Boolean(pdfPath);
      const now = new Date();

      try {
         const createdVersion = await this.prisma.omrTemplateVersion.create({
            data: {
               templateId: template.id,
               version,
               status: 'draft',
               layoutJson: this.toJson(layout),
               compiledGeometryJson: this.toJson(compiledGeometryJson),
               pdfPath,
               previewImagePath,
               pdfGenerationStatus: hasLegacyPdf
                  ? OmrTemplatePdfGenerationStatus.ready
                  : OmrTemplatePdfGenerationStatus.queued,
               pdfGenerationError: null,
               pdfGenerationUpdatedAt: now,
               createdByAgentId,
            },
         });

         if (hasLegacyPdf) {
            await this.prisma.omrTemplateVersionPdfAsset.create({
               data: {
                  templateVersionId: createdVersion.id,
                  generationIndex: 1,
                  trigger: OmrTemplatePdfGenerationTrigger.create_auto,
                  status: OmrTemplatePdfGenerationStatus.ready,
                  pdfPath,
                  previewImagePath,
                  startedAt: now,
                  finishedAt: now,
                  triggeredByAgentId: createdByAgentId,
               },
            });
            return createdVersion;
         }

         this.queuePdfGenerationService
            .enqueue({
               templateVersionId: createdVersion.id,
               trigger: OmrTemplatePdfGenerationTrigger.create_auto,
               requestedByAgentId: createdByAgentId,
            })
            .catch((queueError) => {
               this.logger.error(
                  `Falha ao enfileirar geração automática de PDF para versão ${createdVersion.id}`,
                  queueError as Error,
               );
            });

         return createdVersion;
      } catch (error) {
         this.logger.error('Falha ao criar versão de template OMR', error as Error);
         throw new BadRequestException('Não foi possível criar a versão do template.');
      }
   }

   private async saveBase64Asset(
      base64: string | undefined,
      folder: string,
   ): Promise<string | undefined> {
      if (!base64 || base64.trim().length === 0) {
         return undefined;
      }

      return this.storage.saveFileFromBase64(base64, folder);
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }
}
