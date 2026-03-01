import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
   AclScopeType,
   Prisma,
   PrismaClient,
   RoleEnum,
} from '../../.prisma/client';
import { ACL_PERMISSION_CODES, ACL_ROLES } from './constants';

function parseLogLevels(env: NodeJS.ProcessEnv): Prisma.LogLevel[] {
   const levels: Prisma.LogLevel[] = [];
   if (env.PRISMA_LOG_ERROR === 'true') levels.push('error');
   if (env.PRISMA_LOG_WARN === 'true') levels.push('warn');
   if (env.PRISMA_LOG_INFO === 'true') levels.push('info');
   if (env.PRISMA_LOG_QUERY === 'true') levels.push('query');
   return levels;
}

async function main(prisma: PrismaClient) {
   try {
      await seedAclCatalog(prisma);
      await createMainUser(prisma);

      console.log('Seed finished');
   } catch (e) {
      console.error(e);
   }
}

async function createMainUser(prisma: PrismaClient) {
   try {
      const email = 'admin@vaca.local';
      const name = 'Admin User';
      const user = await prisma.user.upsert({
         where: { email },
         update: {
            role: RoleEnum.admin,
            verifiedEmail: true,
            isActive: true,
         },
         create: {
            email,
            role: RoleEnum.admin,
            verifiedEmail: true,
            isActive: true,
         },
      });

      await prisma.userProfile.upsert({
         where: { userId: user.id },
         update: {
            name,
            phoneE164: '+5500000000000',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: { email: true, push: true },
            onboardingCompletedAt: new Date(),
         },
         create: {
            userId: user.id,
            name,
            phoneE164: '+5500000000000',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: { email: true, push: true },
            onboardingCompletedAt: new Date(),
         },
      });

      const agent = await prisma.agent.upsert({
         where: { userId: user.id },
         update: {},
         create: {
            userId: user.id,
         },
      });

      const school = await prisma.school.upsert({
         where: { institutionCode: 'VACADEV' },
         update: {
            name: 'VACA Dev School',
            isActive: true,
         },
         create: {
            name: 'VACA Dev School',
            institutionCode: 'VACADEV',
            isActive: true,
         },
      });

      const schoolOwnerRole = await prisma.aclRole.findUnique({
         where: { code: 'school_owner' },
         select: { id: true },
      });

      if (!schoolOwnerRole) {
         throw new Error('Role ACL school_owner nao encontrada no seed.');
      }

      await prisma.aclMembership.upsert({
         where: {
            schoolId_agentId: {
               schoolId: school.id,
               agentId: agent.id,
            },
         },
         update: {
            roleId: schoolOwnerRole.id,
         },
         create: {
            schoolId: school.id,
            agentId: agent.id,
            roleId: schoolOwnerRole.id,
         },
      });
   } catch (e: any) {
      console.warn(e.message);
   }
}

async function seedAclCatalog(prisma: PrismaClient) {
   for (const code of ACL_PERMISSION_CODES) {
      await prisma.aclPermission.upsert({
         where: { code },
         update: {},
         create: { code },
      });
   }

   for (const role of ACL_ROLES) {
      await prisma.aclRole.upsert({
         where: { code: role.code },
         update: {
            scopeType: role.scopeType as AclScopeType,
            rank: role.rank,
            isSystem: true,
         },
         create: {
            code: role.code,
            scopeType: role.scopeType as AclScopeType,
            rank: role.rank,
            isSystem: true,
         },
      });
   }

   const permissions = await prisma.aclPermission.findMany({
      select: { id: true, code: true },
   });
   const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

   const roles = await prisma.aclRole.findMany({
      select: { id: true, code: true },
   });
   const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));

   for (const role of ACL_ROLES) {
      const roleId = roleIdByCode.get(role.code);
      if (!roleId) continue;

      for (const permissionCode of role.permissions) {
         const permissionId = permissionIdByCode.get(permissionCode);
         if (!permissionId) continue;

         await prisma.aclRolePermission.upsert({
            where: {
               roleId_permissionId: {
                  roleId,
                  permissionId,
               },
            },
            update: {},
            create: {
               roleId,
               permissionId,
            },
         });
      }
   }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
   throw new Error('DATABASE_URL deve estar definida para executar o seed.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({
   adapter,
   log: parseLogLevels(process.env),
   errorFormat:
      (process.env.PRISMA_ERROR_FORMAT as Prisma.ErrorFormat) || 'pretty',
});

main(prisma)
   .catch((e) => {
      throw e;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
