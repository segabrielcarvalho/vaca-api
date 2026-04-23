import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma, RoleEnum } from '../../../../.prisma/client';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAclMembershipsArgs } from '../inputs/list-acl-memberships.args';
import { RemoveAclMembershipInput } from '../inputs/remove-acl-membership.input';
import { UpsertAclMembershipInput } from '../inputs/upsert-acl-membership.input';
import { AclMembershipObject } from '../objects/acl-membership.object';
import { AclDescendantMembershipService } from './acl-descendant-membership.service';

type MembershipWithRole = Prisma.AclMembershipGetPayload<{
   include: { Role: { select: { code: true; rank: true } } };
}>;

@Injectable()
export class AclMembershipService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly descendantMembershipService: AclDescendantMembershipService,
      private readonly logger: MyLogger,
   ) {
      this.logger.setContext(AclMembershipService.name);
   }

   async list(user: AuthCurrentUser, args: ListAclMembershipsArgs) {
      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: args.scopeType,
         scopeId: args.scopeId,
      });

      const where = this.getScopeWhere(args.scopeType, args.scopeId);

      const [count, rows] = await Promise.all([
         this.prisma.aclMembership.count({
            where,
         }),
         this.prisma.aclMembership.findMany({
            where,
            include: { Role: { select: { code: true, rank: true } } },
            take: args.take,
            skip: args.skip,
         }),
      ]);

      return {
         count,
         rows: rows.map((row) =>
            this.mapMembership(args.scopeType, args.scopeId, row),
         ),
      };
   }

   async upsert(
      user: AuthCurrentUser,
      input: UpsertAclMembershipInput,
   ): Promise<AclMembershipObject> {
      await this.assertScopeExists(input.scopeType, input.scopeId);

      const role = await this.prisma.aclRole.findUnique({
         where: { code: input.roleCode },
         select: {
            id: true,
            code: true,
            rank: true,
            scopeType: true,
         },
      });
      if (!role) {
         throw new BadRequestException('Role ACL nao encontrada.');
      }
      if (role.scopeType !== input.scopeType) {
         throw new BadRequestException(
            'Role ACL incompativel com o escopo informado.',
         );
      }

      await this.scopedAccessService.assertAssignableRole({
         user,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
         targetRoleRank: role.rank,
      });

      const row = await this.prisma.aclMembership.upsert({
         where: this.getScopeUniqueWhere(
            input.scopeType,
            input.scopeId,
            input.agentId,
         ),
         update: {
            roleId: role.id,
         },
         create: {
            agentId: input.agentId,
            roleId: role.id,
            ...this.getScopeCreateData(input.scopeType, input.scopeId),
         },
         include: { Role: { select: { code: true, rank: true } } },
      });
      await this.descendantMembershipService.syncForMembership({
         agentId: input.agentId,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
         roleCode: role.code,
      });

      return this.mapMembership(input.scopeType, input.scopeId, row);
   }

   async remove(
      user: AuthCurrentUser,
      input: RemoveAclMembershipInput,
   ): Promise<AclMembershipObject> {
      await this.assertScopeExists(input.scopeType, input.scopeId);

      const existing = await this.findMembership(input);
      if (!existing) {
         throw new NotFoundException('Membership ACL nao encontrada.');
      }

      if (user.role !== RoleEnum.admin) {
         await this.scopedAccessService.assertAssignableRole({
            user,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            targetRoleRank: existing.Role.rank,
         });
      }

      const row = await this.prisma.aclMembership.delete({
         where: this.getScopeUniqueWhere(
            input.scopeType,
            input.scopeId,
            input.agentId,
         ),
         include: { Role: { select: { code: true, rank: true } } },
      });

      return this.mapMembership(input.scopeType, input.scopeId, row);
   }

   private async assertScopeExists(
      scopeType: AclScopeType,
      scopeId: string,
   ): Promise<void> {
      if (scopeType === AclScopeType.school) {
         const row = await this.prisma.school.findUnique({
            where: { id: scopeId },
            select: { id: true },
         });
         if (!row) throw new NotFoundException('School nao encontrada.');
         return;
      }

      if (scopeType === AclScopeType.course) {
         const row = await this.prisma.course.findUnique({
            where: { id: scopeId },
            select: { id: true },
         });
         if (!row) throw new NotFoundException('Course nao encontrado.');
         return;
      }

      const row = await this.prisma.klass.findUnique({
         where: { id: scopeId },
         select: { id: true },
      });
      if (!row) throw new NotFoundException('Klass nao encontrada.');
   }

   private async findMembership(
      input: RemoveAclMembershipInput,
   ): Promise<MembershipWithRole | null> {
      return this.prisma.aclMembership.findUnique({
         where: this.getScopeUniqueWhere(
            input.scopeType,
            input.scopeId,
            input.agentId,
         ),
         include: { Role: { select: { code: true, rank: true } } },
      });
   }

   private getScopeWhere(scopeType: AclScopeType, scopeId: string) {
      if (scopeType === AclScopeType.school) {
         return { schoolId: scopeId };
      }
      if (scopeType === AclScopeType.course) {
         return { courseId: scopeId };
      }
      return { klassId: scopeId };
   }

   private getScopeCreateData(scopeType: AclScopeType, scopeId: string) {
      if (scopeType === AclScopeType.school) {
         return { schoolId: scopeId };
      }
      if (scopeType === AclScopeType.course) {
         return { courseId: scopeId };
      }
      return { klassId: scopeId };
   }

   private getScopeUniqueWhere(
      scopeType: AclScopeType,
      scopeId: string,
      agentId: string,
   ): Prisma.AclMembershipWhereUniqueInput {
      if (scopeType === AclScopeType.school) {
         return {
            schoolId_agentId: {
               schoolId: scopeId,
               agentId,
            },
         };
      }
      if (scopeType === AclScopeType.course) {
         return {
            courseId_agentId: {
               courseId: scopeId,
               agentId,
            },
         };
      }
      return {
         klassId_agentId: {
            klassId: scopeId,
            agentId,
         },
      };
   }

   private mapMembership(
      scopeType: AclScopeType,
      scopeId: string,
      row: MembershipWithRole,
   ): AclMembershipObject {
      return {
         id: row.id,
         scopeType,
         scopeId,
         agentId: row.agentId,
         roleCode: row.Role.code,
         roleRank: row.Role.rank,
         createdAt: row.createdAt,
         updatedAt: row.updatedAt,
      };
   }
}
