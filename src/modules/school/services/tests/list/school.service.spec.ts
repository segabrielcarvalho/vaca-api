import { ListSchoolsService } from '../../list/school.service';

jest.mock('winston-logsene', () => jest.fn());

describe('ListSchoolsService', () => {
   let prisma: {
      school: {
         count: jest.Mock;
         findMany: jest.Mock;
      };
   };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      log: jest.Mock;
   };
   let rules: { applyDefaultActiveFilter: jest.Mock };
   let service: ListSchoolsService;

   beforeEach(() => {
      prisma = {
         school: {
            count: jest.fn(),
            findMany: jest.fn(),
         },
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         log: jest.fn(),
      };
      rules = {
         applyDefaultActiveFilter: jest
            .fn()
            .mockReturnValue({ isActive: { equals: true } }),
      };

      service = new ListSchoolsService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve aplicar filtro padrao de ativos e retornar rows', async () => {
      prisma.school.count.mockResolvedValue(2);
      prisma.school.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      const result = await service.run({
         where: { name: { equals: 'Alpha' } },
         take: 10,
      } as any);

      expect(rules.applyDefaultActiveFilter).toHaveBeenCalledWith({
         name: { equals: 'Alpha' },
      });
      expect(prisma.school.count).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
      });
      expect(prisma.school.findMany).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
         take: 10,
      });
      expect(result).toEqual({
         count: 2,
         rows: [{ id: 's1' }, { id: 's2' }],
      });
   });
});
