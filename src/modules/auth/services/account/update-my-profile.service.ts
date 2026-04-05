import type { User } from '../../../../../.prisma/client';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import type { UpdateMyProfileInput } from '../../input';
import type { AuthCurrentUser } from '../auth-context.service';
import { MeService } from './me.service';

@Injectable()
export class UpdateMyProfileService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly meService: MeService,
      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {}

   async run(
      user: AuthCurrentUser,
      input: UpdateMyProfileInput,
   ): Promise<User> {
      const currentProfile = await this.prisma.userProfile.findUnique({
         where: { userId: user.id },
         select: {
            photoPath: true,
         },
      });

      if (!currentProfile) {
         throw new BadRequestException('Perfil nao encontrado.');
      }

      const trimmedPhoto = input.photoBase64?.trim();
      const nextPhotoPath = trimmedPhoto
         ? await this.storageProvider.saveFileFromBase64(
              trimmedPhoto,
              'auth/profile-photos',
           )
         : currentProfile.photoPath;

      await this.prisma.userProfile.update({
         where: { userId: user.id },
         data: {
            name: input.name.trim(),
            photoPath: nextPhotoPath,
         },
      });

      return this.meService.run(user);
   }
}
