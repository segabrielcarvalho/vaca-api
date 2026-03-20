import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { DeleteKlassStudentInput } from '../../inputs/delete-klass-student.input';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class DeleteKlassStudentService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(input: DeleteKlassStudentInput, user: AuthCurrentUser) {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.student.manage',
      });

      const klassContext = await this.rules.resolveKlassContext(input.klassId);
      await this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );

      await this.rules.prisma.studentKlass.updateMany({
         where: {
            studentId: input.studentId,
            klassId: input.klassId,
            endedAt: null,
         },
         data: {
            endedAt: new Date(),
         },
      });

      return this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );
   }
}
