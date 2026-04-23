import { BadRequestException, ConflictException } from '@nestjs/common';
import { SchoolRulesService } from '../../shared/school-rules.service';

describe('SchoolRulesService', () => {
   let prisma: {
      school: { findFirst: jest.Mock; findUnique: jest.Mock };
   };
   let service: SchoolRulesService;

   beforeEach(() => {
      prisma = {
         school: { findFirst: jest.fn(), findUnique: jest.fn() },
      };
      service = new SchoolRulesService(prisma as any);
   });

   it('deve normalizar nome com trim e espacos colapsados', () => {
      expect(service.normalizeName('  Escola   Alpha  ')).toBe('Escola Alpha');
   });

   it('deve falhar quando nome e vazio', () => {
      expect(() => service.normalizeName('   ')).toThrow(BadRequestException);
   });

   it('deve normalizar institutionCode para A-Z0-9 sem especiais', () => {
      expect(service.normalizeInstitutionCode(' Éscola- 01 * ')).toBe(
         'ESCOLA01',
      );
   });

   it('deve aplicar filtro de ativos quando nao houver isActive explicito', () => {
      const where = {
         name: { equals: 'Escola Alpha' },
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
            { name: { equals: 'Escola Alpha' } },
            { isActive: { equals: false } },
         ],
      } as any;

      const result = service.applyDefaultActiveFilter(where);
      expect(result).toBe(where);
   });

   it('deve detectar conflito para nome ativo duplicado', async () => {
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });

      await expect(
         service.assertActiveNameUniqueness('Escola Alpha'),
      ).rejects.toThrow(ConflictException);
   });

   it('deve detectar conflito para institutionCode manual duplicado', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });

      await expect(
         service.assertInstitutionCodeUniqueness('ESCOLAALPHA'),
      ).rejects.toThrow(ConflictException);
   });

   it('deve gerar institutionCode unico com sufixo incremental em colisao', async () => {
      prisma.school.findUnique
         .mockResolvedValueOnce({ id: 'school-1' })
         .mockResolvedValueOnce({ id: 'school-2' })
         .mockResolvedValueOnce(null);

      const code = await service.generateUniqueInstitutionCode('Escola Alpha');

      expect(code).toBe('ESCOLAALPHA2');
   });
});
