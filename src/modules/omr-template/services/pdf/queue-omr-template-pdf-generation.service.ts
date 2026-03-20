import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
   OmrTemplatePdfGenerationStatus,
   OmrTemplatePdfGenerationTrigger,
} from '../../../../../.prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { QUEUES } from '../../../queue/constants/queue.constants';
import type { OmrTemplatePdfJobPayload } from '../../objects/omr-template-pdf-job-payload.object';

type EnqueueTemplateVersionPdfInput = {
   templateVersionId: string;
   trigger: OmrTemplatePdfGenerationTrigger;
   requestedByAgentId?: string;
};

@Injectable()
export class QueueOmrTemplatePdfGenerationService {
   constructor(
      private readonly prisma: PrismaService,
      @InjectQueue(QUEUES.OMR_TEMPLATE_PDF)
      private readonly pdfQueue: Queue<OmrTemplatePdfJobPayload>,
   ) {}

   async enqueue(input: EnqueueTemplateVersionPdfInput) {
      const asset = await this.prisma.$transaction(async (tx) => {
         const latest = await tx.omrTemplateVersionPdfAsset.findFirst({
            where: { templateVersionId: input.templateVersionId },
            orderBy: { generationIndex: 'desc' },
            select: { generationIndex: true },
         });

         const generationIndex = (latest?.generationIndex ?? 0) + 1;
         const created = await tx.omrTemplateVersionPdfAsset.create({
            data: {
               templateVersionId: input.templateVersionId,
               generationIndex,
               trigger: input.trigger,
               status: OmrTemplatePdfGenerationStatus.queued,
               triggeredByAgentId: input.requestedByAgentId,
            },
         });

         await tx.omrTemplateVersion.update({
            where: { id: input.templateVersionId },
            data: {
               pdfGenerationStatus: OmrTemplatePdfGenerationStatus.queued,
               pdfGenerationError: null,
               pdfGenerationUpdatedAt: new Date(),
            },
         });

         return created;
      });

      try {
         await this.pdfQueue.add(
            'omr-template-pdf-generate',
            {
               templateVersionId: input.templateVersionId,
               assetId: asset.id,
               trigger: input.trigger,
               requestedByAgentId: input.requestedByAgentId,
            },
            {
               attempts: 3,
               backoff: {
                  type: 'exponential',
                  delay: 1500,
               },
               removeOnComplete: true,
               removeOnFail: false,
            },
         );
      } catch (queueError) {
         const message =
            (queueError as Error).message ||
            'Falha ao enfileirar geração de PDF.';
         const failedAt = new Date();

         await this.prisma.$transaction(async (tx) => {
            await tx.omrTemplateVersionPdfAsset.update({
               where: { id: asset.id },
               data: {
                  status: OmrTemplatePdfGenerationStatus.failed,
                  errorMessage: message,
                  finishedAt: failedAt,
               },
            });

            await tx.omrTemplateVersion.update({
               where: { id: input.templateVersionId },
               data: {
                  pdfGenerationStatus: OmrTemplatePdfGenerationStatus.failed,
                  pdfGenerationError: message,
                  pdfGenerationUpdatedAt: failedAt,
               },
            });
         });

         throw queueError;
      }

      return asset;
   }
}
