import { RoleEnum } from '../../../../../../.prisma/client';
import { CreateKlassStudentService } from '../../create/create-klass-student.service';

describe('CreateKlassStudentService', () => {
   let transactionClient: {
      user: { create: jest.Mock };
      student: { create: jest.Mock };
      studentKlass: { create: jest.Mock };
   };
   let rules: {
      assertKlassPermission: jest.Mock;
      resolveKlassContext: jest.Mock;
      normalizeName: jest.Mock;
      normalizeRegistration: jest.Mock;
      normalizeOptionalEmail: jest.Mock;
      findStudentBySchoolAndRegistration: jest.Mock;
      getStudentInKlass: jest.Mock;
      findUserByEmail: jest.Mock;
      assertUserCanBeStudent: jest.Mock;
      generateTechnicalEmail: jest.Mock;
      upsertProfileName: jest.Mock;
      prisma: {
         user: {
            update: jest.Mock;
         };
         studentKlass: {
            update: jest.Mock;
            create: jest.Mock;
         };
         $transaction: jest.Mock;
      };
   };
   let service: CreateKlassStudentService;

   beforeEach(() => {
      transactionClient = {
         user: { create: jest.fn() },
         student: { create: jest.fn() },
         studentKlass: { create: jest.fn() },
      };

      rules = {
         assertKlassPermission: jest.fn().mockResolvedValue(undefined),
         resolveKlassContext: jest.fn().mockResolvedValue({
            klassId: 'klass-1',
            courseId: 'course-1',
            schoolId: 'school-1',
         }),
         normalizeName: jest.fn((value: string) => value.trim()),
         normalizeRegistration: jest.fn((value: string) =>
            value.trim().toUpperCase(),
         ),
         normalizeOptionalEmail: jest.fn((value?: string | null) => {
            if (value === undefined) return undefined;
            if (value === null) return null;
            const normalized = value.trim().toLowerCase();
            return normalized.length > 0 ? normalized : null;
         }),
         findStudentBySchoolAndRegistration: jest.fn(),
         getStudentInKlass: jest.fn().mockResolvedValue({
            studentId: 'student-1',
            enrollmentActive: true,
         }),
         findUserByEmail: jest.fn().mockResolvedValue(null),
         assertUserCanBeStudent: jest.fn().mockResolvedValue(undefined),
         generateTechnicalEmail: jest
            .fn()
            .mockResolvedValue('student.reg.school.123456@no-login.local'),
         upsertProfileName: jest.fn().mockResolvedValue(undefined),
         prisma: {
            user: {
               update: jest.fn().mockResolvedValue(undefined),
            },
            studentKlass: {
               update: jest.fn().mockResolvedValue(undefined),
               create: jest.fn().mockResolvedValue(undefined),
            },
            $transaction: jest.fn(async (callback) =>
               callback(transactionClient),
            ),
         },
      };

      service = new CreateKlassStudentService(rules as never);
   });

   it('retorna sucesso idempotente quando o aluno ja esta ativo na turma', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'alice@example.com',
            Profile: {
               name: 'Alice',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-1',
               klassId: 'klass-1',
               endedAt: null,
            },
         ],
      });
      rules.getStudentInKlass.mockResolvedValue({
         studentId: 'student-1',
         enrollmentActive: true,
      });

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: ' Alice ',
            registrationNumber: ' reg-001 ',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('already_active');
      expect(rules.prisma.studentKlass.update).not.toHaveBeenCalled();
      expect(rules.prisma.studentKlass.create).not.toHaveBeenCalled();
      expect(rules.prisma.user.update).not.toHaveBeenCalled();
      expect(rules.upsertProfileName).not.toHaveBeenCalled();
      expect(rules.getStudentInKlass).toHaveBeenCalledWith(
         'student-1',
         'klass-1',
         'school-1',
      );
   });

   it('reativa o vinculo quando o aluno ja existia com matricula na mesma turma', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'alice@example.com',
            Profile: {
               name: 'Alice',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-1',
               klassId: 'klass-1',
               endedAt: new Date('2026-03-01T00:00:00.000Z'),
            },
         ],
      });

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: 'Alice',
            registrationNumber: 'reg-001',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('reactivated');
      expect(rules.prisma.studentKlass.update).toHaveBeenCalledWith({
         where: {
            id: 'enrollment-1',
         },
         data: {
            endedAt: null,
         },
      });
      expect(rules.prisma.studentKlass.create).not.toHaveBeenCalled();
   });

   it('vincula aluno existente da mesma escola quando ainda nao ha matricula na turma', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'alice@example.com',
            Profile: {
               name: 'Alice',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-2',
               klassId: 'klass-2',
               endedAt: null,
            },
         ],
      });

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: 'Alice',
            registrationNumber: 'reg-001',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('linked');
      expect(rules.prisma.studentKlass.create).toHaveBeenCalledWith({
         data: {
            studentId: 'student-1',
            klassId: 'klass-1',
         },
      });
      expect(rules.prisma.studentKlass.update).not.toHaveBeenCalled();
   });

   it('atualiza nome e email do aluno existente quando a matricula bate', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'student.reg.school.123456@no-login.local',
            Profile: {
               name: 'Nome Antigo',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-2',
               klassId: 'klass-2',
               endedAt: null,
            },
         ],
      });
      rules.findUserByEmail.mockResolvedValue(null);

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: ' Alice Atualizada ',
            registrationNumber: 'reg-001',
            email: 'ALICE@EXAMPLE.COM',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('linked');
      expect(rules.prisma.user.update).toHaveBeenCalledWith({
         where: {
            id: 'student-user-1',
         },
         data: {
            email: 'alice@example.com',
         },
      });
      expect(rules.upsertProfileName).toHaveBeenCalledWith(
         'student-user-1',
         'Alice Atualizada',
      );
      expect(rules.prisma.studentKlass.create).toHaveBeenCalledWith({
         data: {
            studentId: 'student-1',
            klassId: 'klass-1',
         },
      });
   });

   it('mantem idempotente o mesmo aluno importado novamente e sincroniza dados do csv', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'old@example.com',
            Profile: {
               name: 'Nome Antigo',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-1',
               klassId: 'klass-1',
               endedAt: null,
            },
         ],
      });
      rules.findUserByEmail.mockResolvedValue(null);

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: 'Nome Novo',
            registrationNumber: 'reg-001',
            email: 'novo@example.com',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('already_active');
      expect(rules.prisma.studentKlass.create).not.toHaveBeenCalled();
      expect(rules.prisma.studentKlass.update).not.toHaveBeenCalled();
      expect(rules.prisma.user.update).toHaveBeenCalledWith({
         where: {
            id: 'student-user-1',
         },
         data: {
            email: 'novo@example.com',
         },
      });
      expect(rules.upsertProfileName).toHaveBeenCalledWith(
         'student-user-1',
         'Nome Novo',
      );
   });

   it('bloqueia atualizacao de email quando pertence a outro aluno', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue({
         id: 'student-1',
         User: {
            id: 'student-user-1',
            email: 'old@example.com',
            Profile: {
               name: 'Alice',
            },
         },
         Enrollments: [
            {
               id: 'enrollment-2',
               klassId: 'klass-2',
               endedAt: null,
            },
         ],
      });
      rules.findUserByEmail.mockResolvedValue({
         id: 'other-user',
         Agent: null,
         Student: {
            id: 'other-student',
            schoolId: 'school-1',
            registrationNumber: 'REG-999',
         },
      });

      await expect(
         service.runDetailed(
            {
               klassId: 'klass-1',
               name: 'Alice',
               registrationNumber: 'reg-001',
               email: 'other@example.com',
            },
            { id: 'user-1', role: RoleEnum.user } as never,
         ),
      ).rejects.toThrow('O e-mail informado já está vinculado a outro aluno.');

      expect(rules.prisma.user.update).not.toHaveBeenCalled();
      expect(rules.prisma.studentKlass.create).not.toHaveBeenCalled();
   });

   it('cria aluno novo com email tecnico quando ele nao existe na escola', async () => {
      rules.findStudentBySchoolAndRegistration.mockResolvedValue(null);
      transactionClient.user.create.mockResolvedValue({
         id: 'user-created-1',
      });
      transactionClient.student.create.mockResolvedValue({
         id: 'student-created-1',
      });

      rules.getStudentInKlass.mockResolvedValue({
         studentId: 'student-created-1',
         enrollmentActive: true,
      });

      const result = await service.runDetailed(
         {
            klassId: 'klass-1',
            name: '  Bruno Lima  ',
            registrationNumber: '  reg-002  ',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.status).toBe('created');
      expect(rules.generateTechnicalEmail).toHaveBeenCalledWith(
         'REG-002',
         'school-1',
      );
      expect(transactionClient.user.create).toHaveBeenCalledWith({
         data: {
            email: 'student.reg.school.123456@no-login.local',
            role: RoleEnum.user,
         },
         select: {
            id: true,
         },
      });
      expect(transactionClient.student.create).toHaveBeenCalledWith({
         data: {
            schoolId: 'school-1',
            registrationNumber: 'REG-002',
            userId: 'user-created-1',
         },
         select: {
            id: true,
         },
      });
      expect(transactionClient.studentKlass.create).toHaveBeenCalledWith({
         data: {
            studentId: 'student-created-1',
            klassId: 'klass-1',
         },
      });
      expect(rules.upsertProfileName).toHaveBeenCalledWith(
         'user-created-1',
         'Bruno Lima',
      );
      expect(rules.getStudentInKlass).toHaveBeenCalledWith(
         'student-created-1',
         'klass-1',
         'school-1',
      );
   });
});
