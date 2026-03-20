import { KlassFieldsResolver } from '../klass-fields.resolver';

describe('KlassFieldsResolver', () => {
   let prisma: {
      course: {
         findUniqueOrThrow: jest.Mock;
      };
   };
   let resolver: KlassFieldsResolver;

   beforeEach(() => {
      prisma = {
         course: {
            findUniqueOrThrow: jest.fn(),
         },
      };

      resolver = new KlassFieldsResolver(prisma as any);
   });

   it('deve reutilizar a relacao Course quando ela ja vier hidratada no parent', async () => {
      const course = {
         id: 'course-1',
         name: 'Engenharia de Software',
      };

      const result = await resolver.Course({
         courseId: 'course-1',
         Course: course as any,
      });

      expect(prisma.course.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(result).toBe(course);
   });

   it('deve carregar Course a partir de courseId quando a relacao nao vier no parent', async () => {
      const course = {
         id: 'course-1',
         name: 'Engenharia de Software',
      };
      prisma.course.findUniqueOrThrow.mockResolvedValue(course);

      const result = await resolver.Course({
         courseId: 'course-1',
      });

      expect(prisma.course.findUniqueOrThrow).toHaveBeenCalledWith({
         where: {
            id: 'course-1',
         },
      });
      expect(result).toEqual(course);
   });
});
