import { Injectable, NotFoundException } from '@nestjs/common';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetSchoolAdminSettingsInput } from '../../input/get-school-admin-settings.input';
import { SchoolRulesService } from '../shared/school-rules.service';

@Injectable()
export class GetSchoolAdminSettingsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
   ) {
      this.logger.setContext(GetSchoolAdminSettingsService.name);
   }

   async run(input: GetSchoolAdminSettingsInput) {
      const schoolId = this.rules.extractSchoolId({ id: input.schoolId });

      const school = await this.prisma.school.findUnique({
         where: {
            id: schoolId,
         },
      });

      if (!school) {
         this.logger.warn(`Escola "${schoolId}" nao encontrada.`);
         throw new NotFoundException('Escola nao encontrada.');
      }

      return school;
   }
}
