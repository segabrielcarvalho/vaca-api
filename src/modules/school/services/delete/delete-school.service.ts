import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { DeleteOneSchoolArgs } from '../../../graphql/@generated/school/delete-one-school.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolRulesService } from '../shared/school-rules.service';

@Injectable()
export class DeleteSchoolService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(DeleteSchoolService.name);
   }

   async run(args: DeleteOneSchoolArgs, user?: AuthCurrentUser) {
      const schoolId = this.rules.extractSchoolId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'school.delete',
            scopeType: AclScopeType.school,
            scopeId: schoolId,
         });
      }

      const school = await this.prisma.school.findUnique({
         where: { id: schoolId },
      });
      if (!school) {
         this.logger.warn(`Escola "${schoolId}" nao encontrada.`);
         throw new NotFoundException('Escola nao encontrada.');
      }

      if (!school.isActive) {
         this.logger.log(
            `Escola "${schoolId}" ja estava inativa. Operacao idempotente.`,
         );
         return school;
      }

      const updated = await this.prisma.school.update({
         where: { id: schoolId },
         data: { isActive: false },
      });

      this.logger.log(`Escola "${schoolId}" inativada com sucesso.`);
      return updated;
   }
}
