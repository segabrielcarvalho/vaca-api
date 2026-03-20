import { BadRequestException, Injectable } from '@nestjs/common';
import { AclScopeType, Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateOmrTemplateInput } from '../../inputs/create-omr-template.input';

@Injectable()
export class CreateOmrTemplateService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly scopedAccessService: ScopedAccessService,
   ) {
      this.logger.setContext(CreateOmrTemplateService.name);
   }

   async run(input: CreateOmrTemplateInput, user: AuthCurrentUser) {
      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: 'course.template.manage',
         scopeType: AclScopeType.course,
         scopeId: input.courseId,
      });

      const createdByAgentId =
         await this.scopedAccessService.getAgentIdByUserId(user.id);

      try {
         return await this.prisma.omrTemplate.create({
            data: {
               courseId: input.courseId,
               name: input.name.trim(),
               description: input.description?.trim() || null,
               createdByAgentId,
            },
         });
      } catch (error) {
         if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
         ) {
            throw new BadRequestException(
               'Já existe um template com esse nome no curso.',
            );
         }

         throw error;
      }
   }
}
