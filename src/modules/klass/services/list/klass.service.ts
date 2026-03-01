import { Injectable } from '@nestjs/common';
import { FindManyKlassArgs } from '../../../graphql/@generated/klass/find-many-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class ListKlassesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
   ) {
      this.logger.setContext(ListKlassesService.name);
   }

   async run(args: FindManyKlassArgs) {
      const where = this.rules.applyDefaultActiveFilter(args.where);

      const [count, klasses] = await Promise.all([
         this.prisma.klass.count({ where }),
         this.prisma.klass.findMany({ ...args, where }),
      ]);

      return { count, rows: klasses };
   }
}
