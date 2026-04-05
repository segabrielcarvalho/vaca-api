import { AuthChannelEnum, Prisma } from '../../../../../.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ActionResultObject } from '../../objects';
import type { SubmitMyFeedbackInput } from '../../input';
import type { AuthCurrentUser } from '../auth-context.service';

type SubmitMyFeedbackMeta = {
   ip?: string | null;
   userAgent?: string | null;
};

@Injectable()
export class SubmitMyFeedbackService {
   constructor(private readonly prisma: PrismaService) {}

   async run(
      user: AuthCurrentUser,
      input: SubmitMyFeedbackInput,
      meta?: SubmitMyFeedbackMeta,
   ): Promise<ActionResultObject> {
      const message = input.message.trim();
      if (!message) {
         throw new BadRequestException('Mensagem obrigatoria.');
      }

      await this.prisma.appFeedback.create({
         data: {
            userId: user.id,
            category: input.category,
            channel: AuthChannelEnum.expo_mobile,
            message,
            metadataJson: {
               ip: meta?.ip ?? null,
               userAgent: meta?.userAgent ?? null,
            } as Prisma.InputJsonValue,
         },
      });

      return {
         message: 'Feedback enviado com sucesso.',
         statusCode: 201,
      };
   }
}
