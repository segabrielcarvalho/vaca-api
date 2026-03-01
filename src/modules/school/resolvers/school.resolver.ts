import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { Authorized } from '../../auth/decorators/authorized.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { DeleteOneSchoolArgs } from '../../graphql/@generated/school/delete-one-school.args';
import { FindManySchoolArgs } from '../../graphql/@generated/school/find-many-school.args';
import { FindUniqueSchoolArgs } from '../../graphql/@generated/school/find-unique-school.args';
import { School } from '../../graphql/@generated/school/school.model';
import { UpdateOneSchoolArgs } from '../../graphql/@generated/school/update-one-school.args';
import { CreateSchoolArgs } from '../args/create-school.args';
import { GetSchoolAdminSettingsInput } from '../input/get-school-admin-settings.input';
import { UploadSchoolBrandingInput } from '../input/upload-school-branding.input';
import { SchoolListObject } from '../objects/school-list.object';
import { CreateSchoolService } from '../services/create/create-school.service';
import { DeleteSchoolService } from '../services/delete/delete-school.service';
import { GetSchoolAdminSettingsService } from '../services/get/get-school-admin-settings.service';
import { GetSchoolService } from '../services/get/get-school.service';
import { ListSchoolsService } from '../services/list/school.service';
import { UpdateSchoolService } from '../services/update/update-school.service';
import { UploadSchoolBrandingService } from '../services/update/upload-school-branding.service';

@Resolver(() => School)
export class SchoolResolver {
   constructor(
      private readonly listSchoolsService: ListSchoolsService,
      private readonly getSchoolService: GetSchoolService,
      private readonly getSchoolAdminSettingsService: GetSchoolAdminSettingsService,
      private readonly createSchoolService: CreateSchoolService,
      private readonly updateSchoolService: UpdateSchoolService,
      private readonly uploadSchoolBrandingService: UploadSchoolBrandingService,
      private readonly deleteSchoolService: DeleteSchoolService,
   ) {}

   @Query(() => SchoolListObject)
   async listSchools(@Args() args: FindManySchoolArgs) {
      return this.listSchoolsService.run(args);
   }

   @Query(() => School)
   async getSchool(@Args() args: FindUniqueSchoolArgs) {
      return this.getSchoolService.run(args);
   }

   @ScopedAuthorized({
      permission: 'school.update',
      scopeType: AclScopeType.school,
      scopeIdPath: 'input.schoolId',
   })
   @Query(() => School)
   async getSchoolAdminSettings(
      @Args('input') input: GetSchoolAdminSettingsInput,
   ) {
      return this.getSchoolAdminSettingsService.run(input);
   }

   @Authorized('admin')
   @Mutation(() => School)
   async createSchool(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: CreateSchoolArgs,
   ) {
      return this.createSchoolService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'school.update',
      scopeType: AclScopeType.school,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => School)
   async updateSchool(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: UpdateOneSchoolArgs,
   ) {
      return this.updateSchoolService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'school.update',
      scopeType: AclScopeType.school,
      scopeIdPath: 'input.schoolId',
   })
   @Mutation(() => School)
   async uploadSchoolBranding(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: UploadSchoolBrandingInput,
   ) {
      return this.uploadSchoolBrandingService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'school.delete',
      scopeType: AclScopeType.school,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => School)
   async deleteSchool(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: DeleteOneSchoolArgs,
   ) {
      return this.deleteSchoolService.run(args, user);
   }
}
