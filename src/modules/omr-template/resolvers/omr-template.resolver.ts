import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { OmrTemplate } from '../../graphql/@generated/omr-template/omr-template.model';
import { OmrTemplateVersionPdfAsset } from '../../graphql/@generated/omr-template-version-pdf-asset/omr-template-version-pdf-asset.model';
import { OmrTemplateVersion } from '../../graphql/@generated/omr-template-version/omr-template-version.model';
import { ArchiveOmrTemplateInput } from '../inputs/archive-omr-template.input';
import { CreateOmrTemplateInput } from '../inputs/create-omr-template.input';
import { CreateOmrTemplateVersionInput } from '../inputs/create-omr-template-version.input';
import { GenerateOmrTemplateVersionPdfInput } from '../inputs/generate-omr-template-version-pdf.input';
import { GetOmrTemplateInput } from '../inputs/get-omr-template.input';
import { ListCourseOmrTemplatesInput } from '../inputs/list-course-omr-templates.input';
import { PublishOmrTemplateVersionInput } from '../inputs/publish-omr-template-version.input';
import { OmrTemplateListObject } from '../objects/omr-template-list.object';
import { CreateOmrTemplateService } from '../services/create/create-omr-template.service';
import { CreateOmrTemplateVersionService } from '../services/create/create-omr-template-version.service';
import { GetOmrTemplateService } from '../services/get/get-omr-template.service';
import { ListCourseOmrTemplatesService } from '../services/list/list-course-omr-templates.service';
import { ArchiveOmrTemplateService } from '../services/update/archive-omr-template.service';
import { GenerateOmrTemplateVersionPdfService } from '../services/update/generate-omr-template-version-pdf.service';
import { PublishOmrTemplateVersionService } from '../services/update/publish-omr-template-version.service';

@Resolver(() => OmrTemplate)
export class OmrTemplateResolver {
   constructor(
      private readonly listCourseOmrTemplatesService: ListCourseOmrTemplatesService,
      private readonly getOmrTemplateService: GetOmrTemplateService,
      private readonly createOmrTemplateService: CreateOmrTemplateService,
      private readonly createOmrTemplateVersionService: CreateOmrTemplateVersionService,
      private readonly publishOmrTemplateVersionService: PublishOmrTemplateVersionService,
      private readonly archiveOmrTemplateService: ArchiveOmrTemplateService,
      private readonly generateOmrTemplateVersionPdfService: GenerateOmrTemplateVersionPdfService,
   ) {}

   @ScopedAuthorized({
      permission: 'course.template.read',
      scopeType: AclScopeType.course,
      scopeIdPath: 'input.courseId',
   })
   @Query(() => OmrTemplateListObject)
   async listCourseOmrTemplates(
      @Args('input') input: ListCourseOmrTemplatesInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listCourseOmrTemplatesService.run(input, user);
   }

   @Query(() => OmrTemplate)
   async getOmrTemplate(
      @Args('input') input: GetOmrTemplateInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.getOmrTemplateService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'course.template.manage',
      scopeType: AclScopeType.course,
      scopeIdPath: 'input.courseId',
   })
   @Mutation(() => OmrTemplate)
   async createOmrTemplate(
      @Args('input') input: CreateOmrTemplateInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.createOmrTemplateService.run(input, user);
   }

   @Mutation(() => OmrTemplateVersion)
   async createOmrTemplateVersion(
      @Args('input') input: CreateOmrTemplateVersionInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.createOmrTemplateVersionService.run(input, user);
   }

   @Mutation(() => OmrTemplateVersionPdfAsset)
   async generateOmrTemplateVersionPdf(
      @Args('input') input: GenerateOmrTemplateVersionPdfInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.generateOmrTemplateVersionPdfService.run(input, user);
   }

   @Mutation(() => OmrTemplateVersion)
   async publishOmrTemplateVersion(
      @Args('input') input: PublishOmrTemplateVersionInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.publishOmrTemplateVersionService.run(input, user);
   }

   @Mutation(() => OmrTemplate)
   async archiveOmrTemplate(
      @Args('input') input: ArchiveOmrTemplateInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.archiveOmrTemplateService.run(input, user);
   }
}
