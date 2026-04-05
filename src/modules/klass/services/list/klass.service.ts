import { ForbiddenException, Injectable } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { FindManyKlassArgs } from '../../../graphql/@generated/klass/find-many-klass.args';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassRulesService } from '../shared/klass-rules.service';

@Injectable()
export class ListKlassesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: KlassRulesService,
      private readonly scopedAccess: ScopedAccessService,
   ) {
      this.logger.setContext(ListKlassesService.name);
   }

   async run(args: FindManyKlassArgs, user: AuthCurrentUser) {
      const baseWhere = this.rules.applyDefaultActiveFilter(args.where);
      const where = baseWhere;

      if (user.role !== RoleEnum.admin) {
         if (!user.selectedSchoolId) {
            throw new ForbiddenException('Nenhuma escola selecionada.');
         }

         const scopedWhere = {
            AND: [
               baseWhere ?? {},
               { Course: { schoolId: user.selectedSchoolId } },
            ],
         };
         const candidateRows = await this.prisma.klass.findMany({
            ...args,
            where: scopedWhere,
            cursor: undefined,
            skip: undefined,
            take: undefined,
         });

         const accessMatrix = await Promise.all(
            candidateRows.map((klass) =>
               this.scopedAccess.hasPermission({
                  user,
                  permissionCode: 'klass.exam.read',
                  scopeType: AclScopeType.klass,
                  scopeId: klass.id,
               }),
            ),
         );

         const accessibleRows = candidateRows.filter(
            (_, index) => accessMatrix[index],
         );
         let pagedRows = accessibleRows;

         if (args.cursor) {
            const cursorIndex = pagedRows.findIndex((row) =>
               Object.entries(args.cursor ?? {}).every(
                  ([key, value]) =>
                     (row as Record<string, unknown>)[key] === value,
               ),
            );

            if (cursorIndex >= 0) {
               pagedRows = pagedRows.slice(cursorIndex + 1);
            }
         }

         const skip = args.skip ?? 0;
         const take = args.take ?? pagedRows.length;

         return {
            count: accessibleRows.length,
            rows: pagedRows.slice(skip, skip + take),
         };
      }

      const [count, rows] = await Promise.all([
         this.prisma.klass.count({ where }),
         this.prisma.klass.findMany({ ...args, where }),
      ]);

      return { count, rows };
   }
}
