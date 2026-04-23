import {
   BadRequestException,
   ConflictException,
   Injectable,
} from '@nestjs/common';
import { RoleEnum } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { CreateKlassStudentInput } from '../../inputs/create-klass-student.input';
import { KlassStudentObject } from '../../objects/klass-student.object';
import { StudentRulesService } from '../shared/student-rules.service';

export type CreateKlassStudentResultStatus =
   | 'created'
   | 'linked'
   | 'reactivated'
   | 'already_active';

export type CreateKlassStudentDetailedResult = {
   status: CreateKlassStudentResultStatus;
   student: KlassStudentObject;
};

@Injectable()
export class CreateKlassStudentService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(input: CreateKlassStudentInput, user: AuthCurrentUser) {
      const result = await this.runDetailed(input, user);
      return result.student;
   }

   async runDetailed(
      input: CreateKlassStudentInput,
      user: AuthCurrentUser,
   ): Promise<CreateKlassStudentDetailedResult> {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.student.manage',
      });

      const klassContext = await this.rules.resolveKlassContext(input.klassId);
      const name = this.rules.normalizeName(input.name);
      const registrationNumber = this.rules.normalizeRegistration(
         input.registrationNumber,
      );
      const email = this.rules.normalizeOptionalEmail(input.email);

      const existingStudent =
         await this.rules.findStudentBySchoolAndRegistration(
            klassContext.schoolId,
            registrationNumber,
         );

      if (existingStudent) {
         await this.syncExistingStudentIdentity({
            studentId: existingStudent.id,
            userId: existingStudent.User.id,
            currentEmail: existingStudent.User.email,
            currentName: existingStudent.User.Profile?.name ?? null,
            name,
            email,
         });

         const activeEnrollment = existingStudent.Enrollments.find(
            (enrollment) =>
               enrollment.klassId === input.klassId && !enrollment.endedAt,
         );

         if (activeEnrollment) {
            return {
               status: 'already_active',
               student: await this.rules.getStudentInKlass(
                  existingStudent.id,
                  input.klassId,
                  klassContext.schoolId,
               ),
            };
         }

         const latestEnrollment = existingStudent.Enrollments.find(
            (enrollment) => enrollment.klassId === input.klassId,
         );

         if (latestEnrollment) {
            await this.rules.prisma.studentKlass.update({
               where: {
                  id: latestEnrollment.id,
               },
               data: {
                  endedAt: null,
               },
            });

            return {
               status: 'reactivated',
               student: await this.rules.getStudentInKlass(
                  existingStudent.id,
                  input.klassId,
                  klassContext.schoolId,
               ),
            };
         }

         await this.rules.prisma.studentKlass.create({
            data: {
               studentId: existingStudent.id,
               klassId: input.klassId,
            },
         });

         return {
            status: 'linked',
            student: await this.rules.getStudentInKlass(
               existingStudent.id,
               input.klassId,
               klassContext.schoolId,
            ),
         };
      }

      let userId: string | undefined;
      let resolvedEmail = email;

      if (email) {
         const existingUser = await this.rules.findUserByEmail(email);
         if (existingUser) {
            await this.rules.assertUserCanBeStudent(existingUser);
            if (existingUser.Student) {
               throw new ConflictException(
                  'O e-mail informado já está vinculado a outro aluno.',
               );
            }
            userId = existingUser.id;
         }
      }

      if (!resolvedEmail) {
         resolvedEmail = await this.rules.generateTechnicalEmail(
            registrationNumber,
            klassContext.schoolId,
         );
      }

      const createdStudentId = await this.rules.prisma.$transaction(
         async (tx) => {
            const ensuredUserId =
               userId ??
               (
                  await tx.user.create({
                     data: {
                        email: resolvedEmail!,
                        role: RoleEnum.user,
                     },
                     select: {
                        id: true,
                     },
                  })
               ).id;

            const student = await tx.student.create({
               data: {
                  schoolId: klassContext.schoolId,
                  registrationNumber,
                  userId: ensuredUserId,
               },
               select: {
                  id: true,
               },
            });

            await tx.studentKlass.create({
               data: {
                  studentId: student.id,
                  klassId: input.klassId,
               },
            });

            return {
               studentId: student.id,
               userId: ensuredUserId,
            };
         },
      );

      await this.rules.upsertProfileName(createdStudentId.userId, name);

      return {
         status: 'created',
         student: await this.rules.getStudentInKlass(
            createdStudentId.studentId,
            input.klassId,
            klassContext.schoolId,
         ),
      };
   }

   private async syncExistingStudentIdentity(input: {
      studentId: string;
      userId: string;
      currentEmail: string;
      currentName: string | null;
      name: string;
      email: string | null | undefined;
   }) {
      const nextEmail =
         input.email && input.email !== input.currentEmail
            ? input.email
            : null;

      if (nextEmail) {
         const emailOwner = await this.rules.findUserByEmail(nextEmail);
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

            if (emailOwner.id !== input.userId) {
               throw new BadRequestException(
                  'Não é possível transferir o vínculo do aluno para outro usuário existente.',
               );
            }
         }

         await this.rules.prisma.user.update({
            where: {
               id: input.userId,
            },
            data: {
               email: nextEmail,
            },
         });
      }

      if (input.name !== input.currentName) {
         await this.rules.upsertProfileName(input.userId, input.name);
      }
   }
}
