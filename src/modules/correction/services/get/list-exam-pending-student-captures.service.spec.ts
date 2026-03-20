import { RoleEnum } from '../../../../../.prisma/client';
import { ListExamPendingStudentCapturesService } from './list-exam-pending-student-captures.service';

describe('ListExamPendingStudentCapturesService', () => {
   let prisma: {
      correctionCapture: {
         count: jest.Mock;
         findMany: jest.Mock;
      };
      student: {
         findMany: jest.Mock;
      };
   };
   let access: {
      assertExamPermission: jest.Mock;
   };
   let service: ListExamPendingStudentCapturesService;

   beforeEach(() => {
      prisma = {
         correctionCapture: {
            count: jest.fn(),
            findMany: jest.fn(),
         },
         student: {
            findMany: jest.fn(),
         },
      };
      access = {
         assertExamPermission: jest.fn(),
      };

      service = new ListExamPendingStudentCapturesService(
         prisma as never,
         access as never,
      );
   });

   it('lista pendencias e encontra aluno da mesma escola pela matricula reconhecida', async () => {
      access.assertExamPermission.mockResolvedValue({
         id: 'exam-1',
         Klass: {
            Course: {
               schoolId: 'school-1',
            },
         },
      });
      prisma.correctionCapture.count.mockResolvedValue(1);
      prisma.correctionCapture.findMany.mockResolvedValue([
         {
            id: 'capture-1',
            sessionId: 'session-1',
            status: 'needs_review',
            registrationNumber: 'REG-001',
            reviewReasons: ['student_not_found'],
            reviewNotes: 'Aluno não localizado na base.',
            createdAt: new Date('2026-03-12T18:00:00.000Z'),
         },
      ]);
      prisma.student.findMany.mockResolvedValue([
         {
            id: 'student-1',
            registrationNumber: 'REG-001',
            User: {
               email: 'alice@example.com',
               Profile: {
                  name: 'Alice Lima',
               },
            },
         },
      ]);

      const result = await service.run(
         {
            examId: 'exam-1',
            skip: 0,
            take: 20,
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(access.assertExamPermission).toHaveBeenCalledWith(
         'exam-1',
         { id: 'user-1', role: RoleEnum.user },
         'klass.correction.read',
      );
      expect(prisma.student.findMany).toHaveBeenCalledWith({
         where: {
            schoolId: 'school-1',
            registrationNumber: {
               in: ['REG-001'],
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
      expect(result).toEqual({
         count: 1,
         rows: [
            {
               captureId: 'capture-1',
               sessionId: 'session-1',
               status: 'needs_review',
               registrationNumber: 'REG-001',
               reviewReasons: ['student_not_found'],
               reviewNotes: 'Aluno não localizado na base.',
               createdAt: new Date('2026-03-12T18:00:00.000Z'),
               matchedStudentId: 'student-1',
               matchedStudentName: 'Alice Lima',
               matchedStudentEmail: 'alice@example.com',
               matchedStudentRegistrationNumber: 'REG-001',
            },
         ],
      });
   });

   it('nao consulta alunos quando nao ha capturas pendentes retornadas', async () => {
      access.assertExamPermission.mockResolvedValue({
         id: 'exam-1',
         Klass: {
            Course: {
               schoolId: 'school-1',
            },
         },
      });
      prisma.correctionCapture.count.mockResolvedValue(0);
      prisma.correctionCapture.findMany.mockResolvedValue([]);

      const result = await service.run(
         {
            examId: 'exam-1',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(prisma.student.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({
         count: 0,
         rows: [],
      });
   });
});
