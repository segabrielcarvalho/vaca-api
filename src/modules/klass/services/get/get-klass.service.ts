import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { FindUniqueKlassArgs } from '../../../graphql/@generated/klass/find-unique-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class GetKlassService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
      private readonly scopedAccess: ScopedAccessService,
   ) {
      this.logger.setContext(GetKlassService.name);
   }

   async run(args: FindUniqueKlassArgs, user: AuthCurrentUser) {
      const id = this.rules.extractKlassId(args.where);

      const klass = await this.prisma.klass.findFirst({
         where: {
            id,
            isActive: true,
         },
         select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            name: true,
            description: true,
            bannerPath: true,
            courseId: true,
            Course: { select: { schoolId: true } },
         },
      });

      if (!klass) {
         this.logger.warn(`Turma "${id}" nao encontrada ou inativa.`);
         throw new NotFoundException('Turma nao encontrada.');
      }

      if (user.role !== RoleEnum.admin) {
         if (klass.Course.schoolId !== user.selectedSchoolId) {
            throw new NotFoundException('Turma nao encontrada.');
         }

         await this.scopedAccess.assertPermission({
            user,
            permissionCode: 'klass.exam.read',
            scopeType: AclScopeType.klass,
            scopeId: klass.id,
         });
      }

      return {
         id: klass.id,
         createdAt: klass.createdAt,
         updatedAt: klass.updatedAt,
         isActive: klass.isActive,
         name: klass.name,
         description: klass.description,
         bannerPath: klass.bannerPath,
         courseId: klass.courseId,
      };
   }
}
