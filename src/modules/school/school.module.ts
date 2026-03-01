import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SchoolFieldsResolver } from './resolvers/school-fields.resolver';
import { SchoolResolver } from './resolvers/school.resolver';
import { CreateSchoolService } from './services/create/create-school.service';
import { DeleteSchoolService } from './services/delete/delete-school.service';
import { GetSchoolAdminSettingsService } from './services/get/get-school-admin-settings.service';
import { GetSchoolService } from './services/get/get-school.service';
import { ListSchoolsService } from './services/list/school.service';
import { SchoolRulesService } from './services/shared/school-rules.service';
import { UpdateSchoolService } from './services/update/update-school.service';
import { UploadSchoolBrandingService } from './services/update/upload-school-branding.service';

@Module({
   imports: [PrismaModule, LoggerModule, AuthModule, StorageModule],
   providers: [
      SchoolResolver,
      SchoolFieldsResolver,
      CreateSchoolService,
      ListSchoolsService,
      GetSchoolService,
      GetSchoolAdminSettingsService,
      UpdateSchoolService,
      UploadSchoolBrandingService,
      DeleteSchoolService,
      SchoolRulesService,
   ],
})
export class SchoolModule {}
