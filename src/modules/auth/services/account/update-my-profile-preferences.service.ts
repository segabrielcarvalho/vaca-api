import type { Prisma, User } from '../../../../../.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdateMyProfilePreferencesInput } from '../../input';
import type { AuthCurrentUser } from '../auth-context.service';
import { parseAppPrefs } from '../../utils/auth-crypto.util';
import { MeService } from './me.service';

@Injectable()
export class UpdateMyProfilePreferencesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly meService: MeService,
   ) {}

   async run(
      user: AuthCurrentUser,
      input: UpdateMyProfilePreferencesInput,
   ): Promise<User> {
      const currentProfile = await this.prisma.userProfile.findUnique({
         where: { userId: user.id },
         select: {
            appPrefsJson: true,
         },
      });

      if (!currentProfile) {
         throw new BadRequestException('Perfil nao encontrado.');
      }

      const currentPrefs = parseAppPrefs(currentProfile.appPrefsJson);
      const nextPrefs = {
         ...currentPrefs,
         scannerSoundEnabled: input.scannerSoundEnabled,
         scannerVibrationEnabled: input.scannerVibrationEnabled,
      };

      await this.prisma.userProfile.update({
         where: { userId: user.id },
         data: {
            appPrefsJson: nextPrefs as Prisma.InputJsonValue,
         },
      });

      return this.meService.run(user);
   }
}
