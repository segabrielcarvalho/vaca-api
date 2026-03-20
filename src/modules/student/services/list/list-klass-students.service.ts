import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassStudentEnrollmentStatusEnum } from '../../enums/klass-student-enrollment-status.enum';
import { ListKlassStudentsInput } from '../../inputs/list-klass-students.input';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class ListKlassStudentsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly rules: StudentRulesService,
   ) {}

   async run(input: ListKlassStudentsInput, user: AuthCurrentUser) {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.student.read',
      });

      const klassContext = await this.rules.resolveKlassContext(input.klassId);
      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const normalizedSearch = input.search?.trim() ?? '';
      const status = input.status ?? KlassStudentEnrollmentStatusEnum.active;

      const students = await this.prisma.student.findMany({
         where: {
            Enrollments: {
               some: {
                  klassId: input.klassId,
               },
            },
            OR:
               normalizedSearch.length > 0
                  ? [
                       {
                          registrationNumber: {
                             contains: normalizedSearch,
                             mode: 'insensitive',
                          },
                       },
                       {
                          User: {
                             email: {
                                contains: normalizedSearch,
                                mode: 'insensitive',
                             },
                          },
                       },
                       {
                          User: {
                             Profile: {
                                name: {
                                   contains: normalizedSearch,
                                   mode: 'insensitive',
                                },
                             },
                          },
                       },
                    ]
                  : undefined,
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  Agent: {
                     select: {
                        id: true,
                     },
                  },
                  Profile: {
                     select: {
                        name: true,
                     },
                  },
               },
            },
            Enrollments: {
               where: {
                  klassId: input.klassId,
               },
               select: {
                  startedAt: true,
                  endedAt: true,
               },
               orderBy: {
                  startedAt: 'desc',
               },
            },
         },
         orderBy: {
            updatedAt: 'desc',
         },
      });

      const rows = students
         .map((student) =>
            this.rules.mapKlassStudentObject(
               student,
               klassContext.klassId,
               klassContext.schoolId,
            ),
         )
         .filter((student) => {
            if (status === KlassStudentEnrollmentStatusEnum.all) {
               return true;
            }

            if (status === KlassStudentEnrollmentStatusEnum.active) {
               return student.enrollmentActive;
            }

            return !student.enrollmentActive;
         });

      const count = rows.length;

      return {
         count,
         rows: rows.slice(skip, skip + take),
      };
   }
}
