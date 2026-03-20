import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
   Prisma,
   OmrTemplatePdfGenerationStatus,
} from '../../../../../.prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { QUEUES } from '../../../queue/constants/queue.constants';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import type { OmrTemplatePdfJobPayload } from '../../objects/omr-template-pdf-job-payload.object';
import { OmrTemplateRulesService } from '../shared/omr-template-rules.service';
import { OmrTemplatePdfRendererService } from './omr-template-pdf-renderer.service';

@Processor(QUEUES.OMR_TEMPLATE_PDF)
@Injectable()
export class OmrTemplatePdfGenerationProcessor extends WorkerHost {
   private readonly logger = new Logger(OmrTemplatePdfGenerationProcessor.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly renderer: OmrTemplatePdfRendererService,
      private readonly rules: OmrTemplateRulesService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
   ) {
      super();
   }

   async process(job: Job<OmrTemplatePdfJobPayload>): Promise<void> {
      const { assetId } = job.data;
      const startedAt = new Date();

      const asset = await this.prisma.omrTemplateVersionPdfAsset.findUnique({
         where: { id: assetId },
         include: {
            TemplateVersion: {
               include: {
                  Template: true,
               },
            },
         },
      });

      if (!asset || !asset.TemplateVersion?.Template) {
         return;
      }

      await this.prisma.$transaction(async (tx) => {
         await tx.omrTemplateVersionPdfAsset.update({
            where: { id: asset.id },
            data: {
               status: OmrTemplatePdfGenerationStatus.processing,
               startedAt,
               finishedAt: null,
               errorMessage: null,
            },
         });

         await tx.omrTemplateVersion.update({
            where: { id: asset.templateVersionId },
            data: {
               pdfGenerationStatus: OmrTemplatePdfGenerationStatus.processing,
               pdfGenerationError: null,
               pdfGenerationUpdatedAt: startedAt,
            },
         });
      });

      try {
         const normalizedLayout = JSON.parse(
            JSON.stringify(asset.TemplateVersion.layoutJson ?? {}),
         ) as Record<string, unknown>;
         const typedLayout = normalizedLayout as Parameters<
            OmrTemplateRulesService['resolveQuestionCount']
         >[0];
         const questionCount = this.rules.resolveQuestionCount(typedLayout);
         const compiledGeometryJson = this.rules.compileGeometry(
            typedLayout,
            questionCount,
         );

         const rendered = await this.renderer.render({
            templateName: asset.TemplateVersion.Template.name,
            layoutJson: normalizedLayout,
            compiledGeometryJson: compiledGeometryJson as unknown,
         });

         const folder = `omr/templates/${asset.TemplateVersion.Template.id}/v${asset.TemplateVersion.version}/pdf/g${asset.generationIndex}`;
         const [pdfPath, previewImagePath] = await Promise.all([
            this.storage.saveFileFromBuffer(rendered.pdfBuffer, folder),
            rendered.previewImageBuffer
               ? this.storage.saveFileFromBuffer(
                    rendered.previewImageBuffer,
                    `${folder}/preview`,
                 )
               : Promise.resolve<string | null>(null),
         ]);

         const finishedAt = new Date();
         await this.prisma.$transaction(async (tx) => {
            await tx.omrTemplateVersionPdfAsset.update({
               where: { id: asset.id },
               data: {
                  status: OmrTemplatePdfGenerationStatus.ready,
                  pdfPath,
                  previewImagePath,
                  finishedAt,
                  errorMessage: null,
               },
            });

            await tx.omrTemplateVersion.update({
               where: { id: asset.templateVersionId },
               data: {
                  compiledGeometryJson: this.toJson(compiledGeometryJson),
                  pdfPath,
                  previewImagePath:
                     previewImagePath ?? asset.TemplateVersion.previewImagePath,
                  pdfGenerationStatus: OmrTemplatePdfGenerationStatus.ready,
                  pdfGenerationError: null,
                  pdfGenerationUpdatedAt: finishedAt,
               },
            });
         });
      } catch (error) {
         const message =
            (error as Error).message || 'Falha desconhecida na geração do PDF.';
         const failedAt = new Date();

         await this.prisma.$transaction(async (tx) => {
            await tx.omrTemplateVersionPdfAsset.update({
               where: { id: asset.id },
               data: {
                  status: OmrTemplatePdfGenerationStatus.failed,
                  finishedAt: failedAt,
                  errorMessage: message,
               },
            });

            await tx.omrTemplateVersion.update({
               where: { id: asset.templateVersionId },
               data: {
                  pdfGenerationStatus: OmrTemplatePdfGenerationStatus.failed,
                  pdfGenerationError: message,
                  pdfGenerationUpdatedAt: failedAt,
               },
            });
         });

         this.logger.error(
            `Falha ao gerar PDF para templateVersion=${asset.templateVersionId} asset=${asset.id}`,
            (error as Error).stack,
         );

         throw error;
      }
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }
}
