import { Injectable } from '@nestjs/common';
import { FindManyCourseArgs } from '../../../graphql/@generated/course/find-many-course.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseRulesService } from '../shared/course-rules.service';

@Injectable()
export class ListCoursesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
   ) {
      this.logger.setContext(ListCoursesService.name);
   }

   async run(args: FindManyCourseArgs) {
      const where = this.rules.applyDefaultActiveFilter(args.where);

      const [count, courses] = await Promise.all([
         this.prisma.course.count({ where }),
         this.prisma.course.findMany({ ...args, where }),
      ]);

      return { count, rows: courses };
   }
}
