import {
   BadRequestException,
   ConflictException,
   Injectable,
} from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { UpdateKlassStudentInput } from '../../inputs/update-klass-student.input';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class UpdateKlassStudentService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(input: UpdateKlassStudentInput, user: AuthCurrentUser) {
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

      const name =
         input.name === undefined
            ? undefined
            : this.rules.normalizeName(input.name);
      const registrationNumber =
         input.registrationNumber === undefined
            ? undefined
            : this.rules.normalizeRegistration(input.registrationNumber);
      const email =
         input.email === undefined
            ? undefined
            : this.rules.normalizeOptionalEmail(input.email);

      if (
         registrationNumber &&
         registrationNumber !== current.registrationNumber
      ) {
         await this.rules.assertRegistrationAvailable(
            klassContext.schoolId,
            registrationNumber,
            input.studentId,
         );
      }

      if (email && email !== current.email) {
         const emailOwner = await this.rules.findUserByEmail(email);
         if (emailOwner) {
            await this.rules.assertUserCanBeStudent(emailOwner);
            if (
               emailOwner.Student &&
               emailOwner.Student.id !== input.studentId
            ) {
               throw new ConflictException(
                  'O e-mail informado já está vinculado a outro aluno.',
               );
            }

            if (emailOwner.id !== current.userId) {
               throw new BadRequestException(
                  'Não é possível transferir o vínculo do aluno para outro usuário existente.',
               );
            }
         }
      }

      await this.rules.prisma.$transaction(async (tx) => {
         if (registrationNumber) {
            await tx.student.update({
               where: {
                  id: input.studentId,
               },
               data: {
                  registrationNumber,
               },
            });
         }

         if (email && email !== current.email) {
            await tx.user.update({
               where: {
                  id: current.userId,
               },
               data: {
                  email,
               },
            });
         }
      });

      if (name && name !== current.name) {
         await this.rules.upsertProfileName(current.userId, name);
      }

      return this.rules.getStudentInKlass(
         input.studentId,
         input.klassId,
         klassContext.schoolId,
      );
   }
}
