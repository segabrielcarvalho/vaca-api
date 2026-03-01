import { BadRequestException, ConflictException } from '@nestjs/common';
import { KlassRulesService } from '../../shared/klass-rules.service';

describe('KlassRulesService', () => {
   let prisma: {
      klass: { findFirst: jest.Mock };
   };
   let service: KlassRulesService;

   beforeEach(() => {
      prisma = {
         klass: { findFirst: jest.fn() },
      };
      service = new KlassRulesService(prisma as any);
   });

   it('deve normalizar nome com trim e espacos colapsados', () => {
      expect(service.normalizeName('  Turma   Alpha  ')).toBe('Turma Alpha');
   });

   it('deve falhar quando nome e vazio', () => {
      expect(() => service.normalizeName('   ')).toThrow(BadRequestException);
   });

   it('deve extrair course id do connect', () => {
      expect(
         service.extractCourseConnectId({ connect: { id: 'course-1' } }),
      ).toBe('course-1');
   });

   it('deve falhar quando Course.connect nao informar id', () => {
      expect(() => service.extractCourseConnectId({ connect: {} })).toThrow(
         BadRequestException,
      );
   });

   it('deve aplicar filtro de ativos quando nao houver isActive explicito', () => {
      const where = {
         name: { equals: 'Turma Alpha' },
      } as any;

      const result = service.applyDefaultActiveFilter(where) as any;

      expect(result.AND).toBeDefined();
      expect(result.AND).toHaveLength(2);
      expect(result.AND[0]).toEqual(where);
      expect(result.AND[1]).toEqual({ isActive: { equals: true } });
   });

   it('deve manter where original quando isActive foi definido', () => {
      const where = {
         AND: [
            { name: { equals: 'Turma Alpha' } },
            { isActive: { equals: false } },
         ],
      } as any;

      const result = service.applyDefaultActiveFilter(where);
      expect(result).toBe(where);
   });

   it('deve detectar conflito para nome ativo duplicado num curso', async () => {
      prisma.klass.findFirst.mockResolvedValue({ id: 'klass-1' });

      await expect(
         service.assertActiveNameUniqueness('course-1', 'Turma Alpha'),
      ).rejects.toThrow(ConflictException);
   });
});
