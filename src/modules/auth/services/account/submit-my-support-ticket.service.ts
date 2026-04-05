import { AuthChannelEnum, Prisma } from '../../../../../.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SubmitMySupportTicketInput } from '../../input';
import type { ActionResultObject } from '../../objects';
import type { AuthCurrentUser } from '../auth-context.service';

type SubmitMySupportTicketMeta = {
   ip?: string | null;
   userAgent?: string | null;
};

@Injectable()
export class SubmitMySupportTicketService {
   constructor(private readonly prisma: PrismaService) {}

   async run(
      user: AuthCurrentUser,
      input: SubmitMySupportTicketInput,
      meta?: SubmitMySupportTicketMeta,
   ): Promise<ActionResultObject> {
      const contactPhone = input.contactPhone.trim();
      const message = input.message.trim();

      if (!contactPhone) {
         throw new BadRequestException('Telefone para contato obrigatorio.');
      }

      if (!message) {
         throw new BadRequestException('Mensagem obrigatoria.');
      }

      await this.prisma.supportTicket.create({
         data: {
            userId: user.id,
            category: input.category,
            channel: AuthChannelEnum.expo_mobile,
            contactPhone,
            message,
            metadataJson: {
               ip: meta?.ip ?? null,
               userAgent: meta?.userAgent ?? null,
            } as Prisma.InputJsonValue,
         },
      });

      return {
         message: 'Ticket aberto com sucesso.',
         statusCode: 201,
      };
   }
}
