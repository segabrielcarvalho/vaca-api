import { ListCoursesService } from '../../list/course.service';

jest.mock('winston-logsene', () => jest.fn());

describe('ListCoursesService', () => {
   let prisma: {
      course: {
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
   let service: ListCoursesService;

   beforeEach(() => {
      prisma = {
         course: {
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

      service = new ListCoursesService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve aplicar filtro padrao de ativos e retornar rows', async () => {
      prisma.course.count.mockResolvedValue(2);
      prisma.course.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      const result = await service.run({
         where: { name: { equals: 'Alpha' } },
         take: 10,
      } as any);

      expect(rules.applyDefaultActiveFilter).toHaveBeenCalledWith({
         name: { equals: 'Alpha' },
      });
      expect(prisma.course.count).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
      });
      expect(prisma.course.findMany).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
         take: 10,
      });
      expect(result).toEqual({
         count: 2,
         rows: [{ id: 'c1' }, { id: 'c2' }],
      });
   });
});
