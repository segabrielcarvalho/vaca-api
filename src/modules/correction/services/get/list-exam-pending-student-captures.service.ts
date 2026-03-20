import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ListExamPendingStudentCapturesInput } from '../../inputs/list-exam-pending-student-captures.input';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ListExamPendingStudentCapturesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
   ) {}

   async run(
      input: ListExamPendingStudentCapturesInput,
      user: AuthCurrentUser,
   ) {
      const exam = await this.access.assertExamPermission(
         input.examId,
         user,
         'klass.correction.read',
      );

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const where = {
         examId: input.examId,
         status: 'needs_review' as const,
         studentId: null,
         registrationNumber: {
            not: null,
         },
      };

      const [count, captures] = await Promise.all([
         this.prisma.correctionCapture.count({ where }),
         this.prisma.correctionCapture.findMany({
            where,
            skip,
            take,
            orderBy: [{ createdAt: 'desc' }],
            select: {
               id: true,
               sessionId: true,
               status: true,
               registrationNumber: true,
               reviewReasons: true,
               reviewNotes: true,
               createdAt: true,
            },
         }),
      ]);

      const registrationNumbers = [
         ...new Set(
            captures
               .map((capture) => capture.registrationNumber)
               .filter((value): value is string => Boolean(value)),
         ),
      ];

      const matchedStudents =
         registrationNumbers.length === 0
            ? []
            : await this.prisma.student.findMany({
                 where: {
                    schoolId: exam.Klass.Course.schoolId,
                    registrationNumber: {
                       in: registrationNumbers,
                    },
                 },
                 select: {
                    id: true,
                    registrationNumber: true,
                    User: {
                       select: {
                          email: true,
                          Profile: {
                             select: {
                                name: true,
                             },
                          },
                       },
                    },
                 },
              });

      const matchedStudentMap = new Map(
         matchedStudents.map((student) => [
            student.registrationNumber,
            student,
         ]),
      );

      return {
         count,
         rows: captures.map((capture) => {
            const matchedStudent =
               capture.registrationNumber != null
                  ? matchedStudentMap.get(capture.registrationNumber)
                  : null;

            return {
               captureId: capture.id,
               sessionId: capture.sessionId,
               status: capture.status,
               registrationNumber: capture.registrationNumber,
               reviewReasons: capture.reviewReasons,
               reviewNotes: capture.reviewNotes,
               createdAt: capture.createdAt,
               matchedStudentId: matchedStudent?.id ?? null,
               matchedStudentName: matchedStudent?.User.Profile?.name ?? null,
               matchedStudentEmail: matchedStudent?.User.email ?? null,
               matchedStudentRegistrationNumber:
                  matchedStudent?.registrationNumber ?? null,
            };
         }),
      };
   }
}
