import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { GetKlassStudentInput } from '../../inputs/get-klass-student.input';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class GetKlassStudentService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(input: GetKlassStudentInput, user: AuthCurrentUser) {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.student.read',
      });

      const klassContext = await this.rules.resolveKlassContext(input.klassId);
      return this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );
   }
}
