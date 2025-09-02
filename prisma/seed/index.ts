import { PrismaClient, RoleEnum } from '@prisma/client';
import { hash } from 'bcryptjs';

interface Dependencies {
   prisma: PrismaClient;
}

async function main(db: Dependencies) {
   try {
      const mainUser = createMainUser({ db });

      await Promise.all([mainUser]);
      console.log('Seed finished');
   } catch (e) {
      console.error(e);
   }
}

async function createMainUser({ db }: { db: Dependencies }) {
   try {
      const email = 'user@user.com';
      const name = 'Admin User';
      await db.prisma.user.upsert({
         where: { email },
         update: {
            name,
            role: RoleEnum.admin,
            encryptedPassword: await hash('12345678', 10),
         },
         create: {
            email,
            name,
            role: RoleEnum.admin,
            encryptedPassword: await hash('12345678', 10),
         },
      });
   } catch (e: any) {
      console.warn(e.message);
   }
}

const prisma = new PrismaClient();
main({ prisma })
   .catch((e) => {
      throw e;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
