import { RoleEnum } from '../../../../../../.prisma/client';
import { ListKlassExamsService } from '../../list/list-klass-exams.service';

describe('ListKlassExamsService', () => {
   let prisma: {
      exam: {
         count: jest.Mock;
         findMany: jest.Mock;
      };
   };
   let rules: {
      assertKlassPermission: jest.Mock;
   };
   let service: ListKlassExamsService;

   beforeEach(() => {
      prisma = {
         exam: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
         },
      };
      rules = {
         assertKlassPermission: jest.fn().mockResolvedValue(undefined),
      };

      service = new ListKlassExamsService(prisma as any, rules as any);
   });

   it('deve listar apenas provas ativas por padrao', async () => {
      await service.run({ klassId: 'klass-1' }, {
         id: 'user-1',
         role: RoleEnum.user,
      } as any);

      expect(rules.assertKlassPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         klassId: 'klass-1',
         permissionCode: 'klass.exam.read',
      });
      expect(prisma.exam.count).toHaveBeenCalledWith({
         where: {
            klassId: 'klass-1',
            isActive: true,
            OR: undefined,
         },
      });
      expect(prisma.exam.findMany).toHaveBeenCalledWith({
         where: {
            klassId: 'klass-1',
            isActive: true,
            OR: undefined,
         },
         skip: 0,
         take: 20,
         orderBy: [{ updatedAt: 'desc' }],
         include: {
            _count: {
               select: {
                  Questions: true,
                  Corrections: true,
                  CorrectionSessions: true,
                  Captures: true,
               },
            },
            TemplateVersion: {
               include: {
                  Template: true,
               },
            },
         },
      });
   });

   it('deve aplicar filtro de status e busca', async () => {
      await service.run(
         {
            klassId: 'klass-1',
            isActive: false,
            search: ' simuladO ',
            skip: 10,
            take: 5,
         },
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(prisma.exam.count).toHaveBeenCalledWith({
         where: {
            klassId: 'klass-1',
            isActive: false,
            OR: [
               {
                  title: {
                     contains: 'simuladO',
                     mode: 'insensitive',
                  },
               },
               {
                  description: {
                     contains: 'simuladO',
                     mode: 'insensitive',
                  },
               },
            ],
         },
      });
      expect(prisma.exam.findMany).toHaveBeenCalledWith({
         where: {
            klassId: 'klass-1',
            isActive: false,
            OR: [
               {
                  title: {
                     contains: 'simuladO',
                     mode: 'insensitive',
                  },
               },
               {
                  description: {
                     contains: 'simuladO',
                     mode: 'insensitive',
                  },
               },
            ],
         },
         skip: 10,
         take: 5,
         orderBy: [{ updatedAt: 'desc' }],
         include: {
            _count: {
               select: {
                  Questions: true,
                  Corrections: true,
                  CorrectionSessions: true,
                  Captures: true,
               },
            },
            TemplateVersion: {
               include: {
                  Template: true,
               },
            },
         },
      });
   });
});
