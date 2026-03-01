import { ForbiddenException, Injectable } from '@nestjs/common';
import {
   AclMembershipPermissionEffect,
   AclScopeType,
   RoleEnum,
} from '../../../../../.prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthCurrentUser } from '../auth-context.service';

type ScopeTarget = {
   scopeType: AclScopeType;
   scopeId: string;
};

type PermissionDecision = 'allow' | 'deny' | null;

@Injectable()
export class ScopedAccessService {
   constructor(private readonly prisma: PrismaService) {}

   async assertPermission(input: {
      user: AuthCurrentUser;
      permissionCode: string;
      scopeType: AclScopeType;
      scopeId: string;
   }): Promise<void> {
      const { user, permissionCode, scopeType, scopeId } = input;

      if (user.role === RoleEnum.admin) return;

      const agentId = await this.getAgentIdByUserId(user.id);
      const hasPermission = await this.hasPermissionForScope({
         agentId,
         permissionCode,
         scopeType,
         scopeId,
      });

      if (!hasPermission) {
         throw new ForbiddenException('Acesso negado');
      }
   }

   async assertAssignableRole(input: {
      user: AuthCurrentUser;
      scopeType: AclScopeType;
      scopeId: string;
      targetRoleRank: number;
   }): Promise<void> {
      const { user, scopeType, scopeId, targetRoleRank } = input;

      if (user.role === RoleEnum.admin) return;

      const permissionCode = `${scopeType}.membership.manage`;
      const agentId = await this.getAgentIdByUserId(user.id);

      const canManage = await this.hasPermissionForScope({
         agentId,
         permissionCode,
         scopeType,
         scopeId,
      });
      if (!canManage) {
         throw new ForbiddenException('Acesso negado');
      }

      const actorRank = await this.getMaxRoleRankForScope({
         agentId,
         scopeType,
         scopeId,
      });
      if (actorRank === undefined || targetRoleRank >= actorRank) {
         throw new ForbiddenException('Acesso negado');
      }
   }

   async assertCanManageMembership(input: {
      user: AuthCurrentUser;
      scopeType: AclScopeType;
      scopeId: string;
   }): Promise<void> {
      const { user, scopeType, scopeId } = input;
      if (user.role === RoleEnum.admin) return;

      const permissionCode = `${scopeType}.membership.manage`;
      const agentId = await this.getAgentIdByUserId(user.id);

      const canManage = await this.hasPermissionForScope({
         agentId,
         permissionCode,
         scopeType,
         scopeId,
      });
      if (!canManage) {
         throw new ForbiddenException('Acesso negado');
      }
   }

   async getAgentIdByUserId(userId: string): Promise<string> {
      const agent = await this.prisma.agent.findUnique({
         where: { userId },
         select: { id: true },
      });

      if (!agent) {
         throw new ForbiddenException('Acesso negado');
      }

      return agent.id;
   }

   private async hasPermissionForScope(input: {
      agentId: string;
      permissionCode: string;
      scopeType: AclScopeType;
      scopeId: string;
   }): Promise<boolean> {
      const targets = await this.resolveScopeTargets(
         input.scopeType,
         input.scopeId,
      );

      for (const target of targets) {
         const decision = await this.getPermissionDecisionAtTarget({
            agentId: input.agentId,
            permissionCode: input.permissionCode,
            target,
         });
         if (decision === 'allow') return true;
         if (decision === 'deny') return false;
      }

      return false;
   }

   private async getMaxRoleRankForScope(input: {
      agentId: string;
      scopeType: AclScopeType;
      scopeId: string;
   }): Promise<number | undefined> {
      const targets = await this.resolveScopeTargets(
         input.scopeType,
         input.scopeId,
      );
      const ranks: number[] = [];

      for (const target of targets) {
         const rank = await this.getDirectRoleRankAtTarget({
            agentId: input.agentId,
            target,
         });
         if (rank !== undefined) ranks.push(rank);
      }

      if (ranks.length === 0) return undefined;
      return Math.max(...ranks);
   }

   private async getPermissionDecisionAtTarget(input: {
      agentId: string;
      permissionCode: string;
      target: ScopeTarget;
   }): Promise<PermissionDecision> {
      const membership = await this.prisma.aclMembership.findFirst({
         where: {
            agentId: input.agentId,
            ...this.getMembershipScopeWhere(
               input.target.scopeType,
               input.target.scopeId,
            ),
         },
         select: {
            Role: {
               select: {
                  RolePermissions: {
                     where: {
                        Permission: {
                           code: input.permissionCode,
                        },
                     },
                     select: { id: true },
                  },
               },
            },
            PermissionOverrides: {
               where: {
                  Permission: {
                     code: input.permissionCode,
                  },
               },
               select: {
                  effect: true,
               },
               take: 1,
            },
         },
      });

      if (!membership) {
         return null;
      }

      const overrideEffect = membership.PermissionOverrides[0]?.effect;
      if (overrideEffect === AclMembershipPermissionEffect.allow) {
         return 'allow';
      }
      if (overrideEffect === AclMembershipPermissionEffect.deny) {
         return 'deny';
      }

      if (membership.Role.RolePermissions.length > 0) {
         return 'allow';
      }

      return null;
   }

   private async getDirectRoleRankAtTarget(input: {
      agentId: string;
      target: ScopeTarget;
   }): Promise<number | undefined> {
      const row = await this.prisma.aclMembership.findFirst({
         where: {
            agentId: input.agentId,
            ...this.getMembershipScopeWhere(
               input.target.scopeType,
               input.target.scopeId,
            ),
         },
         select: { Role: { select: { rank: true } } },
      });
      return row?.Role.rank;
   }

   private getMembershipScopeWhere(scopeType: AclScopeType, scopeId: string) {
      if (scopeType === AclScopeType.school) {
         return { schoolId: scopeId };
      }
      if (scopeType === AclScopeType.course) {
         return { courseId: scopeId };
      }
      return { klassId: scopeId };
   }

   private async resolveScopeTargets(
      scopeType: AclScopeType,
      scopeId: string,
   ): Promise<ScopeTarget[]> {
      if (scopeType === AclScopeType.school) {
         return [{ scopeType: AclScopeType.school, scopeId }];
      }

      if (scopeType === AclScopeType.course) {
         const course = await this.prisma.course.findUnique({
            where: { id: scopeId },
            select: { schoolId: true },
         });
         if (!course) {
            throw new ForbiddenException('Acesso negado');
         }

         return [
            { scopeType: AclScopeType.course, scopeId },
            { scopeType: AclScopeType.school, scopeId: course.schoolId },
         ];
      }

      const klass = await this.prisma.klass.findUnique({
         where: { id: scopeId },
         select: {
            courseId: true,
            Course: {
               select: {
                  schoolId: true,
               },
            },
         },
      });
      if (!klass) {
         throw new ForbiddenException('Acesso negado');
      }

      return [
         { scopeType: AclScopeType.klass, scopeId },
         { scopeType: AclScopeType.course, scopeId: klass.courseId },
         {
            scopeType: AclScopeType.school,
            scopeId: klass.Course.schoolId,
         },
      ];
   }
}
