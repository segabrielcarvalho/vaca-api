import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CourseFieldsResolver } from './resolvers/course-fields.resolver';
import { CourseResolver } from './resolvers/course.resolver';
import { CreateCourseService } from './services/create/create-course.service';
import { DeleteCourseService } from './services/delete/delete-course.service';
import { GetCourseAdminSettingsService } from './services/get/get-course-admin-settings.service';
import { GetCourseService } from './services/get/get-course.service';
import { ListCoursesService } from './services/list/course.service';
import { CourseRulesService } from './services/shared/course-rules.service';
import { UpdateCourseService } from './services/update/update-course.service';
import { UploadCourseBrandingService } from './services/update/upload-course-branding.service';

@Module({
   imports: [PrismaModule, LoggerModule, AuthModule, StorageModule],
   providers: [
      CourseResolver,
      CourseFieldsResolver,
      CreateCourseService,
      ListCoursesService,
      GetCourseService,
      GetCourseAdminSettingsService,
      UpdateCourseService,
      UploadCourseBrandingService,
      DeleteCourseService,
      CourseRulesService,
   ],
})
export class CourseModule {}
