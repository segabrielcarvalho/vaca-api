import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ReactivateKlassStudentInput } from '../../inputs/reactivate-klass-student.input';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class ReactivateKlassStudentService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(input: ReactivateKlassStudentInput, user: AuthCurrentUser) {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.student.manage',
      });

      const klassContext = await this.rules.resolveKlassContext(input.klassId);
      const current = await this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );

      if (current.enrollmentActive) {
         return current;
      }

      const latestEnrollment = await this.rules.prisma.studentKlass.findFirst({
         where: {
            studentId: input.studentId,
            klassId: input.klassId,
            endedAt: {
               not: null,
            },
         },
         orderBy: {
            startedAt: 'desc',
         },
      });

      if (latestEnrollment) {
         await this.rules.prisma.studentKlass.update({
            where: {
               id: latestEnrollment.id,
            },
            data: {
               endedAt: null,
            },
         });
      }

      return this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );
   }
}
