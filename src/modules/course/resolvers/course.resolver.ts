import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { CreateOneCourseArgs } from '../../graphql/@generated/course/create-one-course.args';
import { DeleteOneCourseArgs } from '../../graphql/@generated/course/delete-one-course.args';
import { FindManyCourseArgs } from '../../graphql/@generated/course/find-many-course.args';
import { FindUniqueCourseArgs } from '../../graphql/@generated/course/find-unique-course.args';
import { Course } from '../../graphql/@generated/course/course.model';
import { UpdateOneCourseArgs } from '../../graphql/@generated/course/update-one-course.args';
import { GetCourseAdminSettingsInput } from '../inputs/get-course-admin-settings.input';
import { UploadCourseBrandingInput } from '../inputs/upload-course-branding.input';
import { CourseListObject } from '../objects/course-list.object';
import { CreateCourseService } from '../services/create/create-course.service';
import { DeleteCourseService } from '../services/delete/delete-course.service';
import { GetCourseAdminSettingsService } from '../services/get/get-course-admin-settings.service';
import { GetCourseService } from '../services/get/get-course.service';
import { ListCoursesService } from '../services/list/course.service';
import { UpdateCourseService } from '../services/update/update-course.service';
import { UploadCourseBrandingService } from '../services/update/upload-course-branding.service';

@Resolver(() => Course)
export class CourseResolver {
   constructor(
      private readonly listCoursesService: ListCoursesService,
      private readonly getCourseService: GetCourseService,
      private readonly getCourseAdminSettingsService: GetCourseAdminSettingsService,
      private readonly createCourseService: CreateCourseService,
      private readonly updateCourseService: UpdateCourseService,
      private readonly uploadCourseBrandingService: UploadCourseBrandingService,
      private readonly deleteCourseService: DeleteCourseService,
   ) {}

   @Query(() => CourseListObject)
   async listCourses(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: FindManyCourseArgs,
   ) {
      return this.listCoursesService.run(args, user);
   }

   @Query(() => Course)
   async getCourse(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: FindUniqueCourseArgs,
   ) {
      return this.getCourseService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'course.update',
      scopeType: AclScopeType.course,
      scopeIdPath: 'input.courseId',
   })
   @Query(() => Course)
   async getCourseAdminSettings(
      @Args('input') input: GetCourseAdminSettingsInput,
   ) {
      return this.getCourseAdminSettingsService.run(input);
   }

   @ScopedAuthorized({
      permission: 'course.create',
      scopeType: AclScopeType.school,
      scopeIdPath: 'data.School.connect.id',
   })
   @Mutation(() => Course)
   async createCourse(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: CreateOneCourseArgs,
   ) {
      return this.createCourseService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'course.update',
      scopeType: AclScopeType.course,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => Course)
   async updateCourse(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: UpdateOneCourseArgs,
   ) {
      return this.updateCourseService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'course.update',
      scopeType: AclScopeType.course,
      scopeIdPath: 'input.courseId',
   })
   @Mutation(() => Course)
   async uploadCourseBranding(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: UploadCourseBrandingInput,
   ) {
      return this.uploadCourseBrandingService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'course.delete',
      scopeType: AclScopeType.course,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => Course)
   async deleteCourse(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: DeleteOneCourseArgs,
   ) {
      return this.deleteCourseService.run(args, user);
   }
}
