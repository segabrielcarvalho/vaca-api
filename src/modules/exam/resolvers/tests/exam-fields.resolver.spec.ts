import { ExamFieldsResolver } from '../exam-fields.resolver';

describe('ExamFieldsResolver', () => {
   let prisma: {
      exam: {
         findUniqueOrThrow: jest.Mock;
      };
   };
   let resolver: ExamFieldsResolver;

   beforeEach(() => {
      prisma = {
         exam: {
            findUniqueOrThrow: jest.fn(),
         },
      };

      resolver = new ExamFieldsResolver(prisma as any);
   });

   it('deve reutilizar _count quando ele ja vier completo no parent', async () => {
      const count = {
         Questions: 10,
         Corrections: 2,
         CorrectionSessions: 1,
         Captures: 3,
      };

      const result = await resolver._count({
         id: 'exam-1',
         _count: count,
      });

      expect(prisma.exam.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(result).toEqual(count);
   });

   it('deve carregar _count pelo prisma quando o parent nao vier completo', async () => {
      prisma.exam.findUniqueOrThrow.mockResolvedValue({
         _count: {
            Questions: 10,
            Corrections: 2,
            CorrectionSessions: 1,
            Captures: 3,
         },
      });

      const result = await resolver._count({
         id: 'exam-1',
         _count: {
            Questions: 10,
         },
      });

      expect(prisma.exam.findUniqueOrThrow).toHaveBeenCalledWith({
         where: { id: 'exam-1' },
         select: {
            _count: {
               select: {
                  Questions: true,
                  Corrections: true,
                  CorrectionSessions: true,
                  Captures: true,
               },
            },
         },
      });
      expect(result).toEqual({
         Questions: 10,
         Corrections: 2,
         CorrectionSessions: 1,
         Captures: 3,
      });
   });
});
