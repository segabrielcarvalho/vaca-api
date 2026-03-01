import { Injectable } from '@nestjs/common';
import { FindManySchoolArgs } from '../../../graphql/@generated/school/find-many-school.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolRulesService } from '../shared/school-rules.service';

@Injectable()
export class ListSchoolsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
   ) {
      this.logger.setContext(ListSchoolsService.name);
   }

   async run(args: FindManySchoolArgs) {
      const where = this.rules.applyDefaultActiveFilter(args.where);

      const [count, schools] = await Promise.all([
         this.prisma.school.count({ where }),
         this.prisma.school.findMany({ ...args, where }),
      ]);

      return { count, rows: schools };
   }
}
