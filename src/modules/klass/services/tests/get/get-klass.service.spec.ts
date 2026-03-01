jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { GetKlassService } from '../../get/get-klass.service';

describe('GetKlassService', () => {
   let prisma: { klass: { findFirst: jest.Mock } };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      warn: jest.Mock;
   };
   let rules: { extractKlassId: jest.Mock };
   let service: GetKlassService;

   beforeEach(() => {
      prisma = { klass: { findFirst: jest.fn() } };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
      };
      rules = { extractKlassId: jest.fn().mockReturnValue('klass-1') };

      service = new GetKlassService(prisma as any, logger as any, rules as any);
   });

   it('deve retornar turma ativa', async () => {
      prisma.klass.findFirst.mockResolvedValue({ id: 'klass-1' });

      const result = await service.run({
         where: { id: 'klass-1' },
      } as any);

      expect(prisma.klass.findFirst).toHaveBeenCalledWith({
         where: { id: 'klass-1', isActive: true },
      });
      expect(result).toEqual({ id: 'klass-1' });
   });

   it('deve falhar quando turma nao existir ou estiver inativa', async () => {
      prisma.klass.findFirst.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'klass-404' } } as any),
      ).rejects.toThrow(NotFoundException);
   });
});
