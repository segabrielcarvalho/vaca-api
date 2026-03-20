import {
   BadRequestException,
   Inject,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import { UploadSchoolBrandingInput } from '../../input/upload-school-branding.input';
import { SchoolRulesService } from '../shared/school-rules.service';

type UploadFileLike = {
   createReadStream: () => NodeJS.ReadableStream;
};

type UploadReference =
   | UploadFileLike
   | Promise<UploadFileLike>
   | null
   | undefined;

@Injectable()
export class UploadSchoolBrandingService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly rules: SchoolRulesService,
      private readonly scopedAccessService: ScopedAccessService,
      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {
      this.logger.setContext(UploadSchoolBrandingService.name);
   }

   async run(input: UploadSchoolBrandingInput, user?: AuthCurrentUser) {
      const schoolId = this.rules.extractSchoolId({ id: input.schoolId });

      if (user) {
         await this.scopedAccessService.assertPermission({
            user,
            permissionCode: 'school.update',
            scopeType: AclScopeType.school,
            scopeId: schoolId,
         });
      }

      const school = await this.prisma.school.findUnique({
         where: {
            id: schoolId,
         },
         select: {
            id: true,
         },
      });

      if (!school) {
         throw new NotFoundException('Escola nao encontrada.');
      }

      const folder = `schools/${schoolId}/branding`;
      const data: Prisma.SchoolUpdateInput = {};

      const bannerPath = await this.uploadAsset(input.bannerFile, folder);
      if (bannerPath) data.bannerPath = bannerPath;

      const logoFullPath = await this.uploadAsset(input.logoFullFile, folder);
      if (logoFullPath) data.logoFullPath = logoFullPath;

      const logoMarkPath = await this.uploadAsset(input.logoMarkFile, folder);
      if (logoMarkPath) data.logoMarkPath = logoMarkPath;

      const faviconPath = await this.uploadAsset(input.faviconFile, folder);
      if (faviconPath) data.faviconPath = faviconPath;

      if (Object.keys(data).length === 0) {
         throw new BadRequestException(
            'Informe ao menos um arquivo para upload de branding.',
         );
      }

      return this.prisma.school.update({
         where: {
            id: schoolId,
         },
         data,
      });
   }

   private async uploadAsset(
      fileRef: UploadReference,
      folder: string,
   ): Promise<string | undefined> {
      const file = await this.resolveUpload(fileRef);
      if (!file) {
         return undefined;
      }

      const buffer = await this.toBuffer(file.createReadStream());
      if (buffer.byteLength === 0) {
         throw new BadRequestException('Arquivo de branding vazio.');
      }

      return this.storageProvider.saveFileFromBuffer(buffer, folder);
   }

   private async resolveUpload(
      fileRef: UploadReference,
   ): Promise<UploadFileLike | undefined> {
      if (!fileRef) {
         return undefined;
      }

      const resolved = await fileRef;

      if (!resolved || typeof resolved.createReadStream !== 'function') {
         throw new BadRequestException('Arquivo de upload invalido.');
      }

      return resolved;
   }

   private async toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
      return new Promise((resolve, reject) => {
         const chunks: Buffer[] = [];

         stream.on('data', (chunk) => {
            if (Buffer.isBuffer(chunk)) {
               chunks.push(chunk);
               return;
            }

            chunks.push(Buffer.from(chunk));
         });
         stream.on('error', reject);
         stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
   }
}
