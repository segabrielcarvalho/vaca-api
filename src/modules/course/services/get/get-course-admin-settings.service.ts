import { Injectable, NotFoundException } from '@nestjs/common';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetCourseAdminSettingsInput } from '../../inputs/get-course-admin-settings.input';
import { CourseRulesService } from '../shared/course-rules.service';

@Injectable()
export class GetCourseAdminSettingsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
   ) {
      this.logger.setContext(GetCourseAdminSettingsService.name);
   }

   async run(input: GetCourseAdminSettingsInput) {
      const courseId = this.rules.extractCourseId({ id: input.courseId });

      const course = await this.prisma.course.findUnique({
         where: {
            id: courseId,
         },
      });

      if (!course) {
         this.logger.warn(`Curso "${courseId}" nao encontrado.`);
         throw new NotFoundException('Curso nao encontrado.');
      }

      return course;
   }
}
