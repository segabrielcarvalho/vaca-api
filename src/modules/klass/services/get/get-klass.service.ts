import { Injectable, NotFoundException } from '@nestjs/common';
import { FindUniqueKlassArgs } from '../../../graphql/@generated/klass/find-unique-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class GetKlassService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
   ) {
      this.logger.setContext(GetKlassService.name);
   }

   async run(args: FindUniqueKlassArgs) {
      const id = this.rules.extractKlassId(args.where);

      const klass = await this.prisma.klass.findFirst({
         where: {
            id,
            isActive: true,
         },
      });

      if (!klass) {
         this.logger.warn(`Turma "${id}" nao encontrada ou inativa.`);
         throw new NotFoundException('Turma nao encontrada.');
      }

      return klass;
   }
}
