import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetOmrTemplateInput } from '../../inputs/get-omr-template.input';

@Injectable()
export class GetOmrTemplateService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async run(input: GetOmrTemplateInput, user: AuthCurrentUser) {
      const template = await this.prisma.omrTemplate.findUnique({
         where: { id: input.templateId },
      });

      if (!template) {
         throw new NotFoundException('Template não encontrado.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.read',
         scopeType: AclScopeType.course,
         scopeId: template.courseId,
      });

      return this.prisma.omrTemplate.findUniqueOrThrow({
         where: { id: template.id },
         include: {
            Versions: {
               orderBy: { version: 'desc' },
               include: {
                  PdfAssets: {
                     orderBy: { generationIndex: 'desc' },
                  },
               },
            },
            PublishedVersion: true,
         },
      });
   }
}
