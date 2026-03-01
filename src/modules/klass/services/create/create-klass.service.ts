import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { CreateOneKlassArgs } from '../../../graphql/@generated/klass/create-one-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class CreateKlassService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
   ) {
      this.logger.setContext(CreateKlassService.name);
   }

   async run(args: CreateOneKlassArgs, user: AuthCurrentUser) {
      this.rules.detectUnsupportedNestedOperations(args.data, [
         'id',
         'createdAt',
         'updatedAt',
         'Exams',
         'Enrollments',
         'Memberships',
         'Course.create',
         'Course.connectOrCreate',
      ]);

      const courseId = this.rules.extractCourseConnectId(args.data.Course);
      const course = await this.prisma.course.findUnique({
         where: { id: courseId },
         select: { id: true },
      });
      if (!course) {
         throw new NotFoundException('Curso nao encontrado.');
      }

      const normalizedName = this.rules.normalizeName(args.data.name);
      const isActive = args.data.isActive ?? true;

      if (isActive) {
         await this.rules.assertActiveNameUniqueness(courseId, normalizedName);
      }

      const data: Prisma.KlassCreateInput = {
         name: normalizedName,
         description: this.rules.normalizeOptional(args.data.description),
         bannerPath: this.rules.normalizeOptional(args.data.bannerPath),
         isActive,
         Course: {
            connect: { id: courseId },
         },
      };

      const klass = await this.prisma.klass.create({ data });
      await this.assignOwnerMembership(user.id, klass.id);
      this.logger.log(`Turma "${klass.id}" criada com sucesso.`);

      return klass;
   }

   private async assignOwnerMembership(
      userId: string,
      klassId: string,
   ): Promise<void> {
      const [role, agent] = await Promise.all([
         this.prisma.aclRole.findUnique({
            where: { code: 'klass_owner' },
            select: { id: true },
         }),
         this.prisma.agent.findUnique({
            where: { userId },
            select: { id: true },
         }),
      ]);

      if (!role) {
         throw new BadRequestException('Role ACL klass_owner nao encontrada.');
      }
      if (!agent) {
         throw new BadRequestException(
            'Usuario autenticado nao possui Agent para ownership.',
         );
      }

      await this.prisma.aclMembership.upsert({
         where: {
            klassId_agentId: {
               klassId,
               agentId: agent.id,
            },
         },
         update: { roleId: role.id },
         create: {
            klassId,
            agentId: agent.id,
            roleId: role.id,
         },
      });
   }
}
