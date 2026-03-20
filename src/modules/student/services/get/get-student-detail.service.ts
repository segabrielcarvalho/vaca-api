import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { GetStudentDetailInput } from '../../inputs/get-student-detail.input';
import { StudentDetailObject } from '../../objects/student-detail.object';
import { StudentRulesService } from '../shared/student-rules.service';

@Injectable()
export class GetStudentDetailService {
   constructor(private readonly rules: StudentRulesService) {}

   async run(
      input: GetStudentDetailInput,
      user: AuthCurrentUser,
   ): Promise<StudentDetailObject> {
      const student = await this.rules.prisma.student.findUnique({
         where: {
            id: input.studentId,
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  Profile: {
                     select: {
                        name: true,
                     },
                  },
               },
            },
            Enrollments: {
               include: {
                  Klass: {
                     include: {
                        Course: true,
                     },
                  },
               },
               orderBy: {
                  startedAt: 'desc',
               },
            },
            Corrections: {
               where: {
                  isActive: true,
               },
               include: {
                  Exam: {
                     include: {
                        Klass: {
                           include: {
                              Course: true,
                           },
                        },
                     },
                  },
                  Items: true,
               },
               orderBy: {
                  createdAt: 'desc',
               },
            },
         },
      });

      if (!student) {
         throw new NotFoundException('Aluno não encontrado.');
      }

      if (user.selectedSchoolId && student.schoolId !== user.selectedSchoolId) {
         throw new NotFoundException('Aluno não encontrado.');
      }

      const studentAccessibleKlassIds =
         await this.rules.resolveAccessibleKlassIds(
            student.Enrollments.map((enrollment) => enrollment.klassId),
            user,
            'klass.student.read',
         );
      const examAccessibleKlassIds = await this.rules.resolveAccessibleKlassIds(
         student.Corrections.map((correction) => correction.Exam.klassId),
         user,
         'klass.exam.read',
      );
      const correctionAccessibleKlassIds =
         await this.rules.resolveAccessibleKlassIds(
            student.Corrections.map((correction) => correction.Exam.klassId),
            user,
            'klass.correction.read',
         );

      const klasses = student.Enrollments.filter((enrollment) =>
         studentAccessibleKlassIds.has(enrollment.klassId),
      ).map((enrollment) => ({
         klassId: enrollment.klassId,
         klassName: enrollment.Klass.name,
         courseId: enrollment.Klass.courseId,
         courseName: enrollment.Klass.Course.name,
         startedAt: enrollment.startedAt,
         endedAt: enrollment.endedAt,
         active: !enrollment.endedAt,
      }));

      if (klasses.length === 0) {
         throw new NotFoundException(
            'Aluno não encontrado no escopo selecionado.',
         );
      }

      const examMap = new Map<string, StudentDetailObject['exams'][number]>();

      for (const correction of student.Corrections) {
         if (!examAccessibleKlassIds.has(correction.Exam.klassId)) {
            continue;
         }

         const current = examMap.get(correction.examId);
         const nextBestScore =
            current?.bestScore == null
               ? (correction.score ?? null)
               : correction.score == null
                 ? current.bestScore
                 : Math.max(current.bestScore, correction.score);

         examMap.set(correction.examId, {
            examId: correction.examId,
            title: correction.Exam.title,
            klassId: correction.Exam.klassId,
            klassName: correction.Exam.Klass.name,
            courseId: correction.Exam.Klass.courseId,
            courseName: correction.Exam.Klass.Course.name,
            isActive: correction.Exam.isActive,
            attemptCount: (current?.attemptCount ?? 0) + 1,
            bestScore: nextBestScore,
            lastCorrectionAt:
               current?.lastCorrectionAt &&
               current.lastCorrectionAt > correction.createdAt
                  ? current.lastCorrectionAt
                  : correction.createdAt,
         });
      }

      const results = student.Corrections.filter((correction) =>
         correctionAccessibleKlassIds.has(correction.Exam.klassId),
      ).map((correction) => ({
         correctionId: correction.id,
         examId: correction.examId,
         examTitle: correction.Exam.title,
         klassId: correction.Exam.klassId,
         klassName: correction.Exam.Klass.name,
         courseId: correction.Exam.Klass.courseId,
         courseName: correction.Exam.Klass.Course.name,
         attempt: correction.attempt,
         score: correction.score,
         status: correction.status,
         correctAnswersCount: correction.Items.filter((item) => item.isCorrect)
            .length,
         questionCount: correction.Items.length,
         submittedAt: correction.createdAt,
      }));

      const averageScore =
         results.length > 0
            ? results.reduce((sum, row) => sum + (row.score ?? 0), 0) /
              results.length
            : null;
      const currentKlass =
         klasses.find((klass) => klass.active) ?? klasses[0] ?? null;

      return {
         studentId: student.id,
         userId: student.User.id,
         schoolId: student.schoolId,
         registrationNumber: student.registrationNumber,
         name: student.User.Profile?.name ?? null,
         email: student.User.email,
         createdAt: student.createdAt,
         updatedAt: student.updatedAt,
         activeEnrollmentCount: klasses.filter((klass) => klass.active).length,
         examCount: examMap.size,
         resultCount: results.length,
         averageScore,
         currentKlassId: currentKlass?.klassId ?? null,
         currentKlassName: currentKlass?.klassName ?? null,
         klasses,
         exams: [...examMap.values()].sort((left, right) =>
            left.title.localeCompare(right.title),
         ),
         results,
      };
   }
}
