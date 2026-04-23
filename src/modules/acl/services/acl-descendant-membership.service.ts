import { Injectable } from '@nestjs/common';
import { AclScopeType } from '../../../../.prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DESCENDANT_ROLE_CODES: Record<
   string,
   { courseRoleCode?: string; klassRoleCode?: string }
> = {
   school_owner: {
      courseRoleCode: 'course_owner',
      klassRoleCode: 'klass_owner',
   },
   school_manager: {
      courseRoleCode: 'course_manager',
      klassRoleCode: 'klass_manager',
   },
   school_editor: {
      courseRoleCode: 'course_editor',
      klassRoleCode: 'klass_editor',
   },
   school_viewer: {
      courseRoleCode: 'course_viewer',
      klassRoleCode: 'klass_viewer',
   },
   course_owner: {
      klassRoleCode: 'klass_owner',
   },
   course_manager: {
      klassRoleCode: 'klass_manager',
   },
   course_editor: {
      klassRoleCode: 'klass_editor',
   },
   course_viewer: {
      klassRoleCode: 'klass_viewer',
   },
};

@Injectable()
export class AclDescendantMembershipService {
   constructor(private readonly prisma: PrismaService) {}

   async syncForMembership(input: {
      agentId: string;
      scopeType: AclScopeType;
      scopeId: string;
      roleCode: string;
   }): Promise<void> {
      if (input.scopeType === AclScopeType.school) {
         await this.syncSchoolDescendants(input);
         return;
      }

      if (input.scopeType === AclScopeType.course) {
         await this.syncCourseDescendants(input);
      }
   }

   private async syncSchoolDescendants(input: {
      agentId: string;
      scopeId: string;
      roleCode: string;
   }): Promise<void> {
      const descendants = DESCENDANT_ROLE_CODES[input.roleCode];
      if (!descendants?.courseRoleCode && !descendants?.klassRoleCode) {
         return;
      }

      const roleIdByCode = await this.getRoleIdByCode([
         descendants.courseRoleCode,
         descendants.klassRoleCode,
      ]);
      const courseRoleId = descendants.courseRoleCode
         ? roleIdByCode.get(descendants.courseRoleCode)
         : undefined;
      const klassRoleId = descendants.klassRoleCode
         ? roleIdByCode.get(descendants.klassRoleCode)
         : undefined;

      const courses = await this.prisma.course.findMany({
         where: {
            schoolId: input.scopeId,
            isActive: true,
         },
         select: {
            id: true,
            Klasses: {
               where: { isActive: true },
               select: { id: true },
            },
         },
      });

      for (const course of courses) {
         if (courseRoleId) {
            await this.prisma.aclMembership.upsert({
               where: {
                  courseId_agentId: {
                     courseId: course.id,
                     agentId: input.agentId,
                  },
               },
               update: { roleId: courseRoleId },
               create: {
                  agentId: input.agentId,
                  courseId: course.id,
                  roleId: courseRoleId,
               },
            });
         }

         if (!klassRoleId) continue;

         for (const klass of course.Klasses) {
            await this.prisma.aclMembership.upsert({
               where: {
                  klassId_agentId: {
                     klassId: klass.id,
                     agentId: input.agentId,
                  },
               },
               update: { roleId: klassRoleId },
               create: {
                  agentId: input.agentId,
                  klassId: klass.id,
                  roleId: klassRoleId,
               },
            });
         }
      }
   }

   private async syncCourseDescendants(input: {
      agentId: string;
      scopeId: string;
      roleCode: string;
   }): Promise<void> {
      const descendants = DESCENDANT_ROLE_CODES[input.roleCode];
      if (!descendants?.klassRoleCode) {
         return;
      }

      const roleIdByCode = await this.getRoleIdByCode([
         descendants.klassRoleCode,
      ]);
      const klassRoleId = roleIdByCode.get(descendants.klassRoleCode);
      if (!klassRoleId) {
         return;
      }

      const klasses = await this.prisma.klass.findMany({
         where: {
            courseId: input.scopeId,
            isActive: true,
         },
         select: { id: true },
      });

      for (const klass of klasses) {
         await this.prisma.aclMembership.upsert({
            where: {
               klassId_agentId: {
                  klassId: klass.id,
                  agentId: input.agentId,
               },
            },
            update: { roleId: klassRoleId },
            create: {
               agentId: input.agentId,
               klassId: klass.id,
               roleId: klassRoleId,
            },
         });
      }
   }

   private async getRoleIdByCode(
      roleCodes: Array<string | undefined>,
   ): Promise<Map<string, string>> {
      const normalizedRoleCodes = roleCodes.filter(
         (roleCode): roleCode is string => Boolean(roleCode),
      );
      if (normalizedRoleCodes.length === 0) {
         return new Map();
      }

      const roles = await this.prisma.aclRole.findMany({
         where: { code: { in: normalizedRoleCodes } },
         select: { id: true, code: true },
      });

      return new Map(roles.map((role) => [role.code, role.id]));
   }
}
