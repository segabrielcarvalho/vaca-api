jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { GetCourseService } from '../../get/get-course.service';

describe('GetCourseService', () => {
   let prisma: { course: { findFirst: jest.Mock } };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      warn: jest.Mock;
   };
   let rules: { extractCourseId: jest.Mock };
   let service: GetCourseService;

   beforeEach(() => {
      prisma = { course: { findFirst: jest.fn() } };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
      };
      rules = { extractCourseId: jest.fn().mockReturnValue('course-1') };

      service = new GetCourseService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve retornar curso ativo', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });

      const result = await service.run({
         where: { id: 'course-1' },
      } as any);

      expect(prisma.course.findFirst).toHaveBeenCalledWith({
         where: { id: 'course-1', isActive: true },
      });
      expect(result).toEqual({ id: 'course-1' });
   });

   it('deve falhar quando curso nao existir ou estiver inativo', async () => {
      prisma.course.findFirst.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'course-404' } } as any),
      ).rejects.toThrow(NotFoundException);
   });
});
