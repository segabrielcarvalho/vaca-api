import { Injectable, NotFoundException } from '@nestjs/common';
import { FindUniqueSchoolArgs } from '../../../graphql/@generated/school/find-unique-school.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolRulesService } from '../shared/school-rules.service';

@Injectable()
export class GetSchoolService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
   ) {
      this.logger.setContext(GetSchoolService.name);
   }

   async run(args: FindUniqueSchoolArgs) {
      const id = this.rules.extractSchoolId(args.where);

      const school = await this.prisma.school.findFirst({
         where: {
            id,
            isActive: true,
         },
      });

      if (!school) {
         this.logger.warn(`Escola "${id}" nao encontrada ou inativa.`);
         throw new NotFoundException('Escola nao encontrada.');
      }

      return school;
   }
}
