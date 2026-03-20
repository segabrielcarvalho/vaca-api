import { RoleEnum } from '../../../../../../.prisma/client';
import { DeleteExamService } from '../../delete/delete-exam.service';

describe('DeleteExamService', () => {
   let prisma: {
      exam: {
         update: jest.Mock;
      };
   };
   let rules: {
      assertExamPermission: jest.Mock;
   };
   let service: DeleteExamService;

   beforeEach(() => {
      prisma = {
         exam: {
            update: jest.fn(),
         },
      };
      rules = {
         assertExamPermission: jest.fn(),
      };

      service = new DeleteExamService(prisma as any, rules as any);
   });

   it('deve inativar prova ativa', async () => {
      rules.assertExamPermission.mockResolvedValue({
         id: 'exam-1',
         klassId: 'klass-1',
         isActive: true,
      });
      prisma.exam.update.mockResolvedValue({
         id: 'exam-1',
         isActive: false,
      });

      const result = await service.run({ examId: 'exam-1' }, {
         id: 'user-1',
         role: RoleEnum.user,
      } as any);

      expect(rules.assertExamPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         examId: 'exam-1',
         permissionCode: 'klass.exam.manage',
      });
      expect(prisma.exam.update).toHaveBeenCalledWith({
         where: { id: 'exam-1' },
         data: { isActive: false },
      });
      expect(result).toEqual({ id: 'exam-1', isActive: false });
   });

   it('deve manter retorno idempotente quando prova ja estiver inativa', async () => {
      rules.assertExamPermission.mockResolvedValue({
         id: 'exam-1',
         klassId: 'klass-1',
         isActive: false,
      });

      const result = await service.run({ examId: 'exam-1' }, {
         id: 'user-1',
         role: RoleEnum.user,
      } as any);

      expect(prisma.exam.update).not.toHaveBeenCalled();
      expect(result).toEqual({
         id: 'exam-1',
         klassId: 'klass-1',
         isActive: false,
      });
   });
});
