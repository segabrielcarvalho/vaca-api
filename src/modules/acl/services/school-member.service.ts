import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import {
   AclMembershipPermissionEffect,
   AclScopeType,
   Prisma,
} from '../../../../.prisma/client';
import type { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { InviteUserService } from '../../auth/services/invite/invite-user.service';
import { ScopedAccessService } from '../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GetSchoolMemberInput } from '../inputs/get-school-member.input';
import { InviteSchoolMemberInput } from '../inputs/invite-school-member.input';
import { ListAclRolesByScopeInput } from '../inputs/list-acl-roles-by-scope.input';
import { ListSchoolMemberInvitesInput } from '../inputs/list-school-member-invites.input';
import { ListSchoolMembersInput } from '../inputs/list-school-members.input';
import { ResendSchoolMemberInviteInput } from '../inputs/resend-school-member-invite.input';
import { RevokeSchoolMemberInviteInput } from '../inputs/revoke-school-member-invite.input';
import { UpdateSchoolMemberBasicsInput } from '../inputs/update-school-member-basics.input';
import { AclMembershipPermissionOverrideObject } from '../objects/acl-membership-permission-override.object';
import { AclRoleOptionObject } from '../objects/acl-role-option.object';
import { SchoolMemberDetailObject } from '../objects/school-member-detail.object';
import { SchoolMemberInviteListObject } from '../objects/school-member-invite-list.object';
import { SchoolMemberInviteStatus } from '../objects/school-member-invite-status.enum';
import { SchoolMemberInviteObject } from '../objects/school-member-invite.object';
import { SchoolMemberListObject } from '../objects/school-member-list.object';
import { SchoolMemberPermissionObject } from '../objects/school-member-permission.object';
import { SchoolMemberScopeOptionObject } from '../objects/school-member-scope-option.object';
import { SchoolMemberObject } from '../objects/school-member.object';

type AgentWithMemberships = Prisma.AgentGetPayload<{
   include: {
      User: {
         select: {
            id: true;
            email: true;
            isActive: true;
            Profile: {
               select: {
                  name: true;
                  onboardingCompletedAt: true;
               };
            };
         };
      };
      Memberships: {
         include: {
            Role: { select: { code: true; rank: true } };
            Course: { select: { id: true; name: true; schoolId: true } };
            Klass: {
               select: {
                  id: true;
                  name: true;
                  courseId: true;
                  Course: { select: { id: true; name: true; schoolId: true } };
               };
            };
         };
      };
   };
}>;

type MemberManagementScope = {
   scopeType: AclScopeType;
   scopeId: string;
   schoolId: string;
   courseId: string | null;
   klassId: string | null;
};

type InviteWithUser = Prisma.AuthInviteGetPayload<{
   include: {
      User: {
         include: {
            Agent: {
               include: {
                  Memberships: {
                     include: {
                        Role: { select: { code: true; rank: true } };
                        Course: {
                           select: {
                              id: true;
                              schoolId: true;
                           };
                        };
                        Klass: {
                           select: {
                              id: true;
                              courseId: true;
                              Course: {
                                 select: {
                                    id: true;
                                    schoolId: true;
                                 };
                              };
                           };
                        };
                     };
                  };
               };
            };
         };
      };
   };
}>;

@Injectable()
export class SchoolMemberService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly inviteUserService: InviteUserService,
      private readonly logger: MyLogger,
   ) {
      this.logger.setContext(SchoolMemberService.name);
   }

   async listSchoolMembers(
      user: AuthCurrentUser,
      input: ListSchoolMembersInput,
   ): Promise<SchoolMemberListObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const normalizedSearch = input.search?.trim() ?? '';
      const take = this.normalizeTake(input.take, 10);
      const skip = this.normalizeSkip(input.skip);
      const where = this.buildAgentWhere(
         scope,
         normalizedSearch,
         input.isActive,
      );

      const [count, agents] = await Promise.all([
         this.prisma.agent.count({ where }),
         this.prisma.agent.findMany({
            where,
            orderBy: { id: 'asc' },
            skip,
            take,
            include: {
               User: {
                  select: {
                     id: true,
                     email: true,
                     isActive: true,
                     Profile: {
                        select: {
                           name: true,
                           onboardingCompletedAt: true,
                        },
                     },
                  },
               },
               Memberships: {
                  where: this.buildScopeRelatedMembershipWhere(scope),
                  include: {
                     Role: { select: { code: true, rank: true } },
                     Course: {
                        select: { id: true, name: true, schoolId: true },
                     },
                     Klass: {
                        select: {
                           id: true,
                           name: true,
                           courseId: true,
                           Course: {
                              select: {
                                 id: true,
                                 name: true,
                                 schoolId: true,
                              },
                           },
                        },
                     },
                  },
               },
            },
         }),
      ]);

      return {
         count,
         rows: agents.map((agent) =>
            this.mapSchoolMemberFromAgent(agent, scope.schoolId),
         ),
      };
   }

   async getSchoolMember(
      user: AuthCurrentUser,
      input: GetSchoolMemberInput,
   ): Promise<SchoolMemberDetailObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const school = await this.prisma.school.findUnique({
         where: { id: scope.schoolId },
         select: { id: true, name: true },
      });
      if (!school) {
         throw new NotFoundException('School nao encontrada.');
      }

      const agent = await this.prisma.agent.findFirst({
         where: {
            id: input.agentId,
            Memberships: {
               some: this.buildScopeFilterMembershipWhere(scope),
            },
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  isActive: true,
                  Profile: {
                     select: {
                        name: true,
                        onboardingCompletedAt: true,
                     },
                  },
               },
            },
            Memberships: {
               where: this.buildScopeRelatedMembershipWhere(scope),
               include: {
                  Role: {
                     select: {
                        code: true,
                        rank: true,
                        RolePermissions: {
                           include: {
                              Permission: {
                                 select: {
                                    code: true,
                                 },
                              },
                           },
                        },
                     },
                  },
                  PermissionOverrides: {
                     include: {
                        Permission: {
                           select: { code: true },
                        },
                     },
                  },
                  Course: { select: { id: true, name: true, schoolId: true } },
                  Klass: {
                     select: {
                        id: true,
                        name: true,
                        courseId: true,
                        Course: {
                           select: {
                              id: true,
                              name: true,
                              schoolId: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!agent || agent.Memberships.length === 0) {
         throw new NotFoundException('Membro nao encontrado para este escopo.');
      }

      const schoolPermissions: SchoolMemberPermissionObject[] = [];
      const coursePermissions: SchoolMemberPermissionObject[] = [];
      const klassPermissions: SchoolMemberPermissionObject[] = [];
      const schoolPermissionOverrides: AclMembershipPermissionOverrideObject[] =
         [];
      const coursePermissionOverrides: AclMembershipPermissionOverrideObject[] =
         [];
      const klassPermissionOverrides: AclMembershipPermissionOverrideObject[] =
         [];

      for (const membership of agent.Memberships) {
         if (membership.schoolId === scope.schoolId) {
            schoolPermissions.push({
               id: membership.id,
               scopeType: AclScopeType.school,
               scopeId: scope.schoolId,
               scopeName: school.name,
               roleCode: membership.Role.code,
               roleRank: membership.Role.rank,
               createdAt: membership.createdAt,
               updatedAt: membership.updatedAt,
               effectivePermissionCodes:
                  this.resolveEffectivePermissionCodesForMembership(membership),
            });

            for (const override of membership.PermissionOverrides) {
               schoolPermissionOverrides.push({
                  id: override.id,
                  scopeType: AclScopeType.school,
                  scopeId: scope.schoolId,
                  scopeName: school.name,
                  agentId: agent.id,
                  permissionCode: override.Permission.code,
                  effect: override.effect,
                  createdAt: override.createdAt,
                  updatedAt: override.updatedAt,
               });
            }
            continue;
         }

         if (membership.courseId && membership.Course) {
            coursePermissions.push({
               id: membership.id,
               scopeType: AclScopeType.course,
               scopeId: membership.courseId,
               scopeName: membership.Course.name,
               roleCode: membership.Role.code,
               roleRank: membership.Role.rank,
               createdAt: membership.createdAt,
               updatedAt: membership.updatedAt,
               effectivePermissionCodes:
                  this.resolveEffectivePermissionCodesForMembership(membership),
            });

            for (const override of membership.PermissionOverrides) {
               coursePermissionOverrides.push({
                  id: override.id,
                  scopeType: AclScopeType.course,
                  scopeId: membership.courseId,
                  scopeName: membership.Course.name,
                  agentId: agent.id,
                  permissionCode: override.Permission.code,
                  effect: override.effect,
                  createdAt: override.createdAt,
                  updatedAt: override.updatedAt,
               });
            }
            continue;
         }

         if (membership.klassId && membership.Klass) {
            klassPermissions.push({
               id: membership.id,
               scopeType: AclScopeType.klass,
               scopeId: membership.klassId,
               scopeName: membership.Klass.name,
               roleCode: membership.Role.code,
               roleRank: membership.Role.rank,
               createdAt: membership.createdAt,
               updatedAt: membership.updatedAt,
               effectivePermissionCodes:
                  this.resolveEffectivePermissionCodesForMembership(membership),
            });

            for (const override of membership.PermissionOverrides) {
               klassPermissionOverrides.push({
                  id: override.id,
                  scopeType: AclScopeType.klass,
                  scopeId: membership.klassId,
                  scopeName: membership.Klass.name,
                  agentId: agent.id,
                  permissionCode: override.Permission.code,
                  effect: override.effect,
                  createdAt: override.createdAt,
                  updatedAt: override.updatedAt,
               });
            }
         }
      }

      const [courses, klasses] = await Promise.all([
         this.prisma.course.findMany({
            where: this.buildAvailableCoursesWhere(scope),
            orderBy: { name: 'asc' },
            select: {
               id: true,
               name: true,
            },
         }),
         this.prisma.klass.findMany({
            where: this.buildAvailableKlassesWhere(scope),
            orderBy: [{ Course: { name: 'asc' } }, { name: 'asc' }],
            select: {
               id: true,
               name: true,
               courseId: true,
               Course: {
                  select: {
                     name: true,
                  },
               },
            },
         }),
      ]);

      const availableCourses: SchoolMemberScopeOptionObject[] = courses.map(
         (course) => ({
            id: course.id,
            name: course.name,
            courseId: null,
            courseName: null,
         }),
      );
      const availableKlasses: SchoolMemberScopeOptionObject[] = klasses.map(
         (klass) => ({
            id: klass.id,
            name: klass.name,
            courseId: klass.courseId,
            courseName: klass.Course.name,
         }),
      );

      return {
         member: this.mapSchoolMemberFromAgent(agent, scope.schoolId),
         schoolPermissions,
         coursePermissions,
         klassPermissions,
         schoolPermissionOverrides,
         coursePermissionOverrides,
         klassPermissionOverrides,
         availableCourses,
         availableKlasses,
      };
   }

   async listSchoolMemberInvites(
      user: AuthCurrentUser,
      input: ListSchoolMemberInvitesInput,
   ): Promise<SchoolMemberInviteListObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const normalizedSearch = input.search?.trim() ?? '';
      const take = this.normalizeTake(input.take, 10);
      const skip = this.normalizeSkip(input.skip);
      const now = new Date();

      const members = await this.prisma.agent.findMany({
         where: {
            Memberships: {
               some: this.buildScopeFilterMembershipWhere(scope),
            },
         },
         select: {
            id: true,
            userId: true,
            Memberships: {
               where: this.buildScopeRelatedMembershipWhere(scope),
               include: {
                  Role: { select: { code: true } },
                  Klass: {
                     select: {
                        id: true,
                        courseId: true,
                        Course: {
                           select: {
                              id: true,
                              schoolId: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      const userIds = members
         .map((member) => member.userId)
         .filter((value): value is string => Boolean(value));

      if (userIds.length === 0) {
         return { count: 0, rows: [] };
      }

      const roleByUserId = new Map<
         string,
         { agentId: string; roleCode: string | null }
      >();
      for (const member of members) {
         const roleCode = this.resolveRoleCodeForScope(member.Memberships, scope);

         roleByUserId.set(member.userId, {
            agentId: member.id,
            roleCode,
         });
      }

      const where: Prisma.AuthInviteWhereInput = {
         userId: { in: userIds },
         ...(normalizedSearch
            ? {
                 email: {
                    contains: normalizedSearch,
                    mode: Prisma.QueryMode.insensitive,
                 },
              }
            : {}),
         ...this.buildInviteStatusWhere(input.status, now),
      };

      const [count, rows] = await Promise.all([
         this.prisma.authInvite.count({ where }),
         this.prisma.authInvite.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            skip,
            take,
            select: {
               id: true,
               email: true,
               userId: true,
               invitedByUserId: true,
               createdAt: true,
               expiresAt: true,
               acceptedAt: true,
               revokedAt: true,
            },
         }),
      ]);

      return {
         count,
         rows: rows.map((invite) =>
            this.mapInviteObject(invite, now, roleByUserId.get(invite.userId)),
         ),
      };
   }

   async listAclRolesByScope(
      input: ListAclRolesByScopeInput,
   ): Promise<AclRoleOptionObject[]> {
      const roles = await this.prisma.aclRole.findMany({
         where: { scopeType: input.scopeType },
         orderBy: [{ rank: 'desc' }, { code: 'asc' }],
         select: {
            code: true,
            rank: true,
            scopeType: true,
         },
      });

      return roles.map((role) => ({
         code: role.code,
         rank: role.rank,
         scopeType: role.scopeType,
      }));
   }

   async inviteSchoolMember(
      user: AuthCurrentUser,
      input: InviteSchoolMemberInput,
   ): Promise<SchoolMemberInviteObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const normalizedRoleCode =
         input.roleCode?.trim() || input.schoolRoleCode?.trim();
      if (!normalizedRoleCode) {
         throw new BadRequestException('Role ACL obrigatoria para convite.');
      }

      const role = await this.prisma.aclRole.findUnique({
         where: { code: normalizedRoleCode },
         select: {
            id: true,
            code: true,
            rank: true,
            scopeType: true,
         },
      });
      if (!role || role.scopeType !== scope.scopeType) {
         throw new BadRequestException(
            'Role ACL nao encontrada ou incompativel com o escopo.',
         );
      }

      await this.scopedAccessService.assertAssignableRole({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
         targetRoleRank: role.rank,
      });

      const normalizedEmail = input.email.trim().toLowerCase();

      await this.inviteUserService.run(user, {
         email: normalizedEmail,
         metadataJson: JSON.stringify({
            source: 'school_members_admin',
            schoolId: scope.schoolId,
            courseId: scope.courseId,
            klassId: scope.klassId,
            roleCode: role.code,
            schoolRoleCode: role.code,
         }),
      });

      const targetUser = await this.prisma.user.findUnique({
         where: { email: normalizedEmail },
         select: {
            id: true,
         },
      });
      if (!targetUser) {
         throw new NotFoundException('Usuario convidado nao encontrado.');
      }

      const agent = await this.prisma.agent.upsert({
         where: { userId: targetUser.id },
         update: {},
         create: {
            userId: targetUser.id,
         },
         select: { id: true },
      });

      await this.prisma.aclMembership.upsert({
         where: this.getScopeMembershipUniqueWhere(scope, agent.id),
         update: {
            roleId: role.id,
         },
         create: {
            agentId: agent.id,
            roleId: role.id,
            ...this.getScopeMembershipCreateData(scope),
         },
      });

      const invite = await this.prisma.authInvite.findFirst({
         where: {
            email: normalizedEmail,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
               gt: new Date(),
            },
         },
         orderBy: {
            createdAt: 'desc',
         },
         select: {
            id: true,
            email: true,
            userId: true,
            invitedByUserId: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
         },
      });

      if (!invite || !invite.userId) {
         throw new NotFoundException('Convite nao encontrado apos criacao.');
      }

      return this.mapInviteObject(invite, new Date(), {
         agentId: agent.id,
         roleCode: role.code,
      });
   }

   async resendSchoolMemberInvite(
      user: AuthCurrentUser,
      input: ResendSchoolMemberInviteInput,
   ): Promise<SchoolMemberInviteObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const invite = await this.loadInviteForScope(scope, input.inviteId);
      if (invite.acceptedAt) {
         throw new BadRequestException(
            'Convites aceitos nao podem ser reenviados.',
         );
      }

      if (!invite.userId) {
         throw new BadRequestException('Convite sem usuario vinculado.');
      }

      const roleCode = this.resolveRoleCodeForScope(
         invite.User?.Agent?.Memberships ?? [],
         scope,
      );
      if (!roleCode) {
         throw new BadRequestException(
            'Nao foi possivel determinar o papel ACL do convite para reenvio.',
         );
      }

      if (!invite.revokedAt) {
         await this.prisma.authInvite.update({
            where: { id: invite.id },
            data: { revokedAt: new Date() },
         });
      }

      const resent = await this.inviteSchoolMember(user, {
         schoolId: scope.schoolId,
         courseId: scope.courseId ?? undefined,
         klassId: scope.klassId ?? undefined,
         email: invite.email,
         roleCode,
         schoolRoleCode: roleCode,
      });

      return resent;
   }

   async revokeSchoolMemberInvite(
      user: AuthCurrentUser,
      input: RevokeSchoolMemberInviteInput,
   ): Promise<SchoolMemberInviteObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const invite = await this.loadInviteForScope(scope, input.inviteId);
      if (invite.acceptedAt) {
         throw new BadRequestException(
            'Convites aceitos nao podem ser revogados.',
         );
      }

      const roleCode =
         this.resolveRoleCodeForScope(invite.User?.Agent?.Memberships ?? [], scope) ??
         null;
      const roleRef = invite.User?.Agent?.id
         ? {
              agentId: invite.User.Agent.id,
              roleCode,
           }
         : undefined;

      if (invite.revokedAt) {
         return this.mapInviteObject(invite, new Date(), roleRef);
      }

      const updated = await this.prisma.authInvite.update({
         where: { id: invite.id },
         data: { revokedAt: new Date() },
         select: {
            id: true,
            email: true,
            userId: true,
            invitedByUserId: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
         },
      });

      return this.mapInviteObject(updated, new Date(), roleRef);
   }

   async updateSchoolMemberBasics(
      user: AuthCurrentUser,
      input: UpdateSchoolMemberBasicsInput,
   ): Promise<SchoolMemberObject> {
      const scope = await this.resolveManagementScope({
         schoolId: input.schoolId,
         courseId: input.courseId,
         klassId: input.klassId,
      });

      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: scope.scopeType,
         scopeId: scope.scopeId,
      });

      const normalizedName = input.name.trim();
      if (normalizedName.length === 0) {
         throw new BadRequestException('Nome do membro e obrigatorio.');
      }

      const agent = await this.prisma.agent.findFirst({
         where: {
            id: input.agentId,
            Memberships: {
               some: this.buildScopeFilterMembershipWhere(scope),
            },
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  isActive: true,
                  Profile: {
                     select: {
                        id: true,
                        name: true,
                        onboardingCompletedAt: true,
                     },
                  },
               },
            },
            Memberships: {
               where: this.buildScopeRelatedMembershipWhere(scope),
               include: {
                  Role: { select: { code: true, rank: true } },
                  Course: { select: { id: true, name: true, schoolId: true } },
                  Klass: {
                     select: {
                        id: true,
                        name: true,
                        courseId: true,
                        Course: {
                           select: {
                              id: true,
                              name: true,
                              schoolId: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!agent || agent.Memberships.length === 0) {
         throw new NotFoundException('Membro nao encontrado para este escopo.');
      }

      if (!agent.User.Profile?.id) {
         throw new BadRequestException(
            'Perfil do membro ainda nao foi concluido e nao pode ser editado.',
         );
      }

      await this.prisma.userProfile.update({
         where: {
            id: agent.User.Profile.id,
         },
         data: {
            name: normalizedName,
         },
      });

      const refreshedAgent = await this.prisma.agent.findFirst({
         where: {
            id: input.agentId,
            Memberships: {
               some: this.buildScopeFilterMembershipWhere(scope),
            },
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  isActive: true,
                  Profile: {
                     select: {
                        name: true,
                        onboardingCompletedAt: true,
                     },
                  },
               },
            },
            Memberships: {
               where: this.buildScopeRelatedMembershipWhere(scope),
               include: {
                  Role: { select: { code: true, rank: true } },
                  Course: { select: { id: true, name: true, schoolId: true } },
                  Klass: {
                     select: {
                        id: true,
                        name: true,
                        courseId: true,
                        Course: {
                           select: {
                              id: true,
                              name: true,
                              schoolId: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!refreshedAgent) {
         throw new NotFoundException('Membro nao encontrado apos atualizacao.');
      }

      return this.mapSchoolMemberFromAgent(refreshedAgent, scope.schoolId);
   }

   private async resolveManagementScope(input: {
      schoolId: string;
      courseId?: string | null;
      klassId?: string | null;
   }): Promise<MemberManagementScope> {
      const schoolId = input.schoolId.trim();
      const courseId = input.courseId?.trim() ?? null;
      const klassId = input.klassId?.trim() ?? null;

      if (!schoolId) {
         throw new BadRequestException('SchoolId invalido.');
      }

      if (klassId) {
         const klass = await this.prisma.klass.findUnique({
            where: { id: klassId },
            select: {
               id: true,
               courseId: true,
               Course: {
                  select: {
                     schoolId: true,
                  },
               },
            },
         });
         if (!klass) {
            throw new NotFoundException('Klass nao encontrada.');
         }

         if (klass.Course.schoolId !== schoolId) {
            throw new BadRequestException(
               'Klass nao pertence a escola informada.',
            );
         }

         if (courseId && courseId !== klass.courseId) {
            throw new BadRequestException(
               'Klass nao pertence ao curso informado.',
            );
         }

         return {
            scopeType: AclScopeType.klass,
            scopeId: klass.id,
            schoolId,
            courseId: klass.courseId,
            klassId: klass.id,
         };
      }

      if (courseId) {
         const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
               id: true,
               schoolId: true,
            },
         });
         if (!course) {
            throw new NotFoundException('Course nao encontrado.');
         }

         if (course.schoolId !== schoolId) {
            throw new BadRequestException(
               'Course nao pertence a escola informada.',
            );
         }

         return {
            scopeType: AclScopeType.course,
            scopeId: course.id,
            schoolId,
            courseId: course.id,
            klassId: null,
         };
      }

      return {
         scopeType: AclScopeType.school,
         scopeId: schoolId,
         schoolId,
         courseId: null,
         klassId: null,
      };
   }

   private buildAgentWhere(
      scope: MemberManagementScope,
      search: string,
      isActive: boolean | undefined,
   ): Prisma.AgentWhereInput {
      const baseWhere: Prisma.AgentWhereInput = {
         Memberships: {
            some: this.buildScopeFilterMembershipWhere(scope),
         },
      };

      if (typeof isActive === 'boolean') {
         baseWhere.User = {
            is: {
               isActive,
            },
         };
      }

      if (!search) {
         return baseWhere;
      }

      return {
         ...baseWhere,
         User: {
            is: {
               ...(baseWhere.User?.is ?? {}),
               OR: [
                  {
                     email: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                     },
                  },
                  {
                     Profile: {
                        is: {
                           name: {
                              contains: search,
                              mode: Prisma.QueryMode.insensitive,
                           },
                        },
                     },
                  },
               ],
            },
         },
      };
   }

   private buildCourseHierarchyMembershipWhere(
      courseId: string,
   ): Prisma.AclMembershipWhereInput {
      return {
         OR: [
            {
               courseId,
            },
            {
               Klass: {
                  is: {
                     courseId,
                  },
               },
            },
         ],
      };
   }

   private buildScopeFilterMembershipWhere(
      scope: MemberManagementScope,
   ): Prisma.AclMembershipWhereInput {
      if (scope.scopeType === AclScopeType.klass) {
         return { klassId: scope.scopeId };
      }

      if (scope.scopeType === AclScopeType.course) {
         return this.buildCourseHierarchyMembershipWhere(scope.scopeId);
      }

      return this.buildSchoolHierarchyMembershipWhere(scope.schoolId);
   }

   private buildScopeRelatedMembershipWhere(
      scope: MemberManagementScope,
   ): Prisma.AclMembershipWhereInput {
      if (scope.scopeType === AclScopeType.school) {
         return this.buildSchoolHierarchyMembershipWhere(scope.schoolId);
      }

      if (scope.scopeType === AclScopeType.course) {
         return {
            OR: [
               { schoolId: scope.schoolId },
               this.buildCourseHierarchyMembershipWhere(scope.scopeId),
            ],
         };
      }

      const klassRelated: Prisma.AclMembershipWhereInput[] = [
         { schoolId: scope.schoolId },
         { klassId: scope.scopeId },
      ];

      if (scope.courseId) {
         klassRelated.push({ courseId: scope.courseId });
      }

      return { OR: klassRelated };
   }

   private buildAvailableCoursesWhere(
      scope: MemberManagementScope,
   ): Prisma.CourseWhereInput {
      if (scope.scopeType === AclScopeType.school) {
         return {
            schoolId: scope.schoolId,
            isActive: true,
         };
      }

      if (scope.scopeType === AclScopeType.course) {
         return {
            id: scope.scopeId,
            schoolId: scope.schoolId,
            isActive: true,
         };
      }

      return {
         id: scope.courseId ?? '',
         schoolId: scope.schoolId,
         isActive: true,
      };
   }

   private buildAvailableKlassesWhere(
      scope: MemberManagementScope,
   ): Prisma.KlassWhereInput {
      if (scope.scopeType === AclScopeType.school) {
         return {
            isActive: true,
            Course: {
               is: {
                  schoolId: scope.schoolId,
               },
            },
         };
      }

      if (scope.scopeType === AclScopeType.course) {
         return {
            isActive: true,
            courseId: scope.scopeId,
         };
      }

      return {
         isActive: true,
         id: scope.scopeId,
      };
   }

   private getScopeMembershipUniqueWhere(
      scope: MemberManagementScope,
      agentId: string,
   ): Prisma.AclMembershipWhereUniqueInput {
      if (scope.scopeType === AclScopeType.school) {
         return {
            schoolId_agentId: {
               schoolId: scope.scopeId,
               agentId,
            },
         };
      }

      if (scope.scopeType === AclScopeType.course) {
         return {
            courseId_agentId: {
               courseId: scope.scopeId,
               agentId,
            },
         };
      }

      return {
         klassId_agentId: {
            klassId: scope.scopeId,
            agentId,
         },
      };
   }

   private getScopeMembershipCreateData(scope: MemberManagementScope): {
      schoolId?: string;
      courseId?: string;
      klassId?: string;
   } {
      if (scope.scopeType === AclScopeType.school) {
         return { schoolId: scope.scopeId };
      }

      if (scope.scopeType === AclScopeType.course) {
         return { courseId: scope.scopeId };
      }

      return { klassId: scope.scopeId };
   }

   private resolveRoleCodeForScope(
      memberships: Array<{
         schoolId?: string | null;
         courseId?: string | null;
         klassId?: string | null;
         Role: { code: string };
         Course?: { id: string; schoolId: string } | null;
         Klass?: {
            id: string;
            courseId: string;
            Course: { id: string; schoolId: string };
         } | null;
      }>,
      scope: MemberManagementScope,
   ): string | null {
      if (scope.scopeType === AclScopeType.school) {
         return (
            memberships.find((membership) => membership.schoolId === scope.schoolId)
               ?.Role.code ?? null
         );
      }

      if (scope.scopeType === AclScopeType.course) {
         const directCourseRole = memberships.find(
            (membership) => membership.courseId === scope.scopeId,
         );
         if (directCourseRole) {
            return directCourseRole.Role.code;
         }

         const klassRole = memberships.find(
            (membership) =>
               membership.klassId &&
               membership.Klass?.courseId === scope.scopeId,
         );
         return klassRole?.Role.code ?? null;
      }

      return (
         memberships.find((membership) => membership.klassId === scope.scopeId)
            ?.Role.code ?? null
      );
   }

   private buildSchoolHierarchyMembershipWhere(
      schoolId: string,
   ): Prisma.AclMembershipWhereInput {
      return {
         OR: [
            {
               schoolId,
            },
            {
               Course: {
                  is: {
                     schoolId,
                  },
               },
            },
            {
               Klass: {
                  is: {
                     Course: {
                        is: {
                           schoolId,
                        },
                     },
                  },
               },
            },
         ],
      };
   }

   private mapSchoolMemberFromAgent(
      agent: AgentWithMemberships,
      schoolId: string,
   ): SchoolMemberObject {
      const schoolRoleCode =
         agent.Memberships.find(
            (membership) => membership.schoolId === schoolId,
         )?.Role.code ?? null;

      const courseScopeIds = new Set<string>();
      const klassScopeIds = new Set<string>();

      for (const membership of agent.Memberships) {
         if (membership.courseId) {
            courseScopeIds.add(membership.courseId);
         }

         if (membership.klassId) {
            klassScopeIds.add(membership.klassId);
         }
      }

      return {
         agentId: agent.id,
         userId: agent.User.id,
         email: agent.User.email,
         name: agent.User.Profile?.name ?? null,
         hasProfile: Boolean(agent.User.Profile),
         profileCompletedAt: agent.User.Profile?.onboardingCompletedAt ?? null,
         schoolRoleCode,
         coursePermissionsCount: courseScopeIds.size,
         klassPermissionsCount: klassScopeIds.size,
         isActive: agent.User.isActive,
      };
   }

   private resolveEffectivePermissionCodesForMembership(membership: {
      Role: {
         RolePermissions: Array<{
            Permission: {
               code: string;
            };
         }>;
      };
      PermissionOverrides: Array<{
         effect: AclMembershipPermissionEffect;
         Permission: {
            code: string;
         };
      }>;
   }): string[] {
      const effectivePermissionCodes = new Set(
         membership.Role.RolePermissions.map((rolePermission) =>
            rolePermission.Permission.code.trim(),
         ).filter((code) => code.length > 0),
      );

      for (const override of membership.PermissionOverrides) {
         const permissionCode = override.Permission.code.trim();
         if (!permissionCode) continue;

         if (override.effect === AclMembershipPermissionEffect.deny) {
            effectivePermissionCodes.delete(permissionCode);
            continue;
         }

         if (override.effect === AclMembershipPermissionEffect.allow) {
            effectivePermissionCodes.add(permissionCode);
         }
      }

      return Array.from(effectivePermissionCodes).sort((a, b) =>
         a.localeCompare(b),
      );
   }

   private buildInviteStatusWhere(
      status: SchoolMemberInviteStatus | undefined,
      now: Date,
   ): Prisma.AuthInviteWhereInput {
      if (!status) {
         return {};
      }

      if (status === SchoolMemberInviteStatus.pending) {
         return {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
               gt: now,
            },
         };
      }

      if (status === SchoolMemberInviteStatus.expired) {
         return {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
               lte: now,
            },
         };
      }

      if (status === SchoolMemberInviteStatus.accepted) {
         return {
            acceptedAt: {
               not: null,
            },
         };
      }

      return {
         revokedAt: {
            not: null,
         },
      };
   }

   private mapInviteObject(
      invite: {
         id: string;
         email: string;
         userId: string | null;
         invitedByUserId: string | null;
         createdAt: Date;
         expiresAt: Date;
         acceptedAt: Date | null;
         revokedAt: Date | null;
      },
      now: Date,
      roleRef?: { agentId: string; roleCode: string | null },
   ): SchoolMemberInviteObject {
      const isExpired = invite.acceptedAt
         ? false
         : invite.revokedAt
           ? false
           : invite.expiresAt.getTime() <= now.getTime();

      const status = invite.acceptedAt
         ? SchoolMemberInviteStatus.accepted
         : invite.revokedAt
           ? SchoolMemberInviteStatus.revoked
           : isExpired
             ? SchoolMemberInviteStatus.expired
             : SchoolMemberInviteStatus.pending;

      return {
         inviteId: invite.id,
         email: invite.email,
         userId: invite.userId ?? '',
         agentId: roleRef?.agentId ?? null,
         schoolRoleCode: roleRef?.roleCode ?? null,
         status,
         createdAt: invite.createdAt,
         expiresAt: invite.expiresAt,
         acceptedAt: invite.acceptedAt,
         revokedAt: invite.revokedAt,
         isExpired,
         invitedByUserId: invite.invitedByUserId,
      };
   }

   private async loadInviteForScope(
      scope: MemberManagementScope,
      inviteId: string,
   ): Promise<InviteWithUser> {
      const invite = await this.prisma.authInvite.findUnique({
         where: {
            id: inviteId,
         },
         include: {
            User: {
               include: {
                  Agent: {
                     include: {
                        Memberships: {
                           include: {
                              Role: {
                                 select: {
                                    code: true,
                                    rank: true,
                                 },
                              },
                              Course: {
                                 select: {
                                    id: true,
                                    schoolId: true,
                                 },
                              },
                              Klass: {
                                 select: {
                                    id: true,
                                    courseId: true,
                                    Course: {
                                       select: {
                                          id: true,
                                          schoolId: true,
                                       },
                                    },
                                 },
                              },
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      const roleCode = this.resolveRoleCodeForScope(
         invite?.User?.Agent?.Memberships ?? [],
         scope,
      );

      if (!invite?.User?.Agent?.id || !roleCode) {
         throw new NotFoundException(
            'Convite nao encontrado para membros deste escopo.',
         );
      }

      return invite;
   }

   private normalizeTake(value: number | undefined, fallback: number): number {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
         return fallback;
      }

      return Math.max(1, Math.min(Math.floor(value), 100));
   }

   private normalizeSkip(value: number | undefined): number {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
         return 0;
      }

      return Math.max(0, Math.floor(value));
   }
}
