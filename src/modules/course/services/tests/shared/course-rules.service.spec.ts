import { BadRequestException, ConflictException } from '@nestjs/common';
import { CourseRulesService } from '../../shared/course-rules.service';

describe('CourseRulesService', () => {
   let prisma: {
      course: { findFirst: jest.Mock };
   };
   let service: CourseRulesService;

   beforeEach(() => {
      prisma = {
         course: { findFirst: jest.fn() },
      };
      service = new CourseRulesService(prisma as any);
   });

   it('deve normalizar nome com trim e espacos colapsados', () => {
      expect(service.normalizeName('  Curso   Alpha  ')).toBe('Curso Alpha');
   });

   it('deve falhar quando nome e vazio', () => {
      expect(() => service.normalizeName('   ')).toThrow(BadRequestException);
   });

   it('deve extrair school id do connect', () => {
      expect(
         service.extractSchoolConnectId({ connect: { id: 'school-1' } }),
      ).toBe('school-1');
   });

   it('deve falhar quando School.connect nao informar id', () => {
      expect(() => service.extractSchoolConnectId({ connect: {} })).toThrow(
         BadRequestException,
      );
   });

   it('deve aplicar filtro de ativos quando nao houver isActive explicito', () => {
      const where = {
         name: { equals: 'Curso Alpha' },
      } as any;

      const result = service.applyDefaultActiveFilter(where) as any;

      expect(result.AND).toBeDefined();
      expect(result.AND).toHaveLength(2);
      expect(result.AND[0]).toEqual(where);
      expect(result.AND[1]).toEqual({ isActive: { equals: true } });
   });

   it('deve detectar conflito para nome ativo duplicado na escola', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });

      await expect(
         service.assertActiveNameUniqueness('school-1', 'Curso Alpha'),
      ).rejects.toThrow(ConflictException);
   });
});
