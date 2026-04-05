import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
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

   async run(args: FindManyCourseArgs, user: AuthCurrentUser) {
      let where = this.rules.applyDefaultActiveFilter(args.where);

      if (user.role !== RoleEnum.admin) {
         if (!user.selectedSchoolId) {
            throw new ForbiddenException('Nenhuma escola selecionada.');
         }

         where = {
            AND: [where ?? {}, { schoolId: user.selectedSchoolId }],
         };
      }

      const [count, courses] = await Promise.all([
         this.prisma.course.count({ where }),
         this.prisma.course.findMany({ ...args, where }),
      ]);

      return { count, rows: courses };
   }
}
