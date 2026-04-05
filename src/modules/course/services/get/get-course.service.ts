import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { FindUniqueCourseArgs } from '../../../graphql/@generated/course/find-unique-course.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseRulesService } from '../shared/course-rules.service';

@Injectable()
export class GetCourseService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
   ) {
      this.logger.setContext(GetCourseService.name);
   }

   async run(args: FindUniqueCourseArgs, user: AuthCurrentUser) {
      const id = this.rules.extractCourseId(args.where);

      const course = await this.prisma.course.findFirst({
         where: {
            id,
            isActive: true,
            ...(user.role === RoleEnum.admin
               ? {}
               : { schoolId: user.selectedSchoolId }),
         },
      });

      if (!course) {
         this.logger.warn(`Curso "${id}" nao encontrado ou inativo.`);
         throw new NotFoundException('Curso nao encontrado.');
      }

      return course;
   }
}
