import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { DeleteOneCourseArgs } from '../../../graphql/@generated/course/delete-one-course.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseRulesService } from '../shared/course-rules.service';

@Injectable()
export class DeleteCourseService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: CourseRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(DeleteCourseService.name);
   }

   async run(args: DeleteOneCourseArgs, user?: AuthCurrentUser) {
      const courseId = this.rules.extractCourseId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'course.delete',
            scopeType: AclScopeType.course,
            scopeId: courseId,
         });
      }

      const course = await this.prisma.course.findUnique({
         where: { id: courseId },
      });
      if (!course) {
         this.logger.warn(`Curso "${courseId}" nao encontrado.`);
         throw new NotFoundException('Curso nao encontrado.');
      }

      if (!course.isActive) {
         this.logger.log(
            `Curso "${courseId}" ja estava inativo. Operacao idempotente.`,
         );
         return course;
      }

      const updated = await this.prisma.course.update({
         where: { id: courseId },
         data: { isActive: false },
      });

      this.logger.log(`Curso "${courseId}" inativado com sucesso.`);
      return updated;
   }
}
