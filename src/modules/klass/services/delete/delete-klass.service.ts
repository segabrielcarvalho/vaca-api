import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { DeleteOneKlassArgs } from '../../../graphql/@generated/klass/delete-one-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class DeleteKlassService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(DeleteKlassService.name);
   }

   async run(args: DeleteOneKlassArgs, user?: AuthCurrentUser) {
      const klassId = this.rules.extractKlassId(args.where);

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'klass.delete',
            scopeType: AclScopeType.klass,
            scopeId: klassId,
         });
      }

      const klass = await this.prisma.klass.findUnique({
         where: { id: klassId },
      });
      if (!klass) {
         this.logger.warn(`Turma "${klassId}" nao encontrada.`);
         throw new NotFoundException('Turma nao encontrada.');
      }

      if (!klass.isActive) {
         this.logger.log(
            `Turma "${klassId}" ja estava inativa. Operacao idempotente.`,
         );
         return klass;
      }

      const updated = await this.prisma.klass.update({
         where: { id: klassId },
         data: { isActive: false },
      });

      this.logger.log(`Turma "${klassId}" inativada com sucesso.`);
      return updated;
   }
}
