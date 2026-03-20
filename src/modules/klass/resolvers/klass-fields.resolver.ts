import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Course } from '../../graphql/@generated/course/course.model';
import { Klass } from '../../graphql/@generated/klass/klass.model';
import { PrismaService } from '../../prisma/prisma.service';

@Resolver(() => Klass)
export class KlassFieldsResolver {
   constructor(private readonly prisma: PrismaService) {}

   @ResolveField(() => Course)
   async Course(
      @Parent() klass: { courseId: string; Course?: Course | null },
   ): Promise<Course> {
      if (klass.Course) {
         return klass.Course;
      }

      return this.prisma.course.findUniqueOrThrow({
         where: {
            id: klass.courseId,
         },
      });
   }
}
