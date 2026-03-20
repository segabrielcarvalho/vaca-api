import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { OmrTemplateResolver } from './resolvers/omr-template.resolver';
import { OmrTemplateVersionPdfAssetFieldsResolver } from './resolvers/omr-template-version-pdf-asset-fields.resolver';
import { OmrTemplateVersionFieldsResolver } from './resolvers/omr-template-version-fields.resolver';
import { CreateOmrTemplateService } from './services/create/create-omr-template.service';
import { CreateOmrTemplateVersionService } from './services/create/create-omr-template-version.service';
import { GetOmrTemplateService } from './services/get/get-omr-template.service';
import { ListCourseOmrTemplatesService } from './services/list/list-course-omr-templates.service';
import { OmrTemplatePdfGenerationProcessor } from './services/pdf/omr-template-pdf-generation.processor';
import { OmrTemplatePdfRendererService } from './services/pdf/omr-template-pdf-renderer.service';
import { QueueOmrTemplatePdfGenerationService } from './services/pdf/queue-omr-template-pdf-generation.service';
import { OmrTemplateRulesService } from './services/shared/omr-template-rules.service';
import { ArchiveOmrTemplateService } from './services/update/archive-omr-template.service';
import { GenerateOmrTemplateVersionPdfService } from './services/update/generate-omr-template-version-pdf.service';
import { PublishOmrTemplateVersionService } from './services/update/publish-omr-template-version.service';

@Module({
   imports: [
      PrismaModule,
      LoggerModule,
      AuthModule,
      StorageModule,
      QueueModule,
   ],
   providers: [
      OmrTemplateResolver,
      OmrTemplateVersionFieldsResolver,
      OmrTemplateVersionPdfAssetFieldsResolver,
      CreateOmrTemplateService,
      CreateOmrTemplateVersionService,
      PublishOmrTemplateVersionService,
      ArchiveOmrTemplateService,
      GenerateOmrTemplateVersionPdfService,
      GetOmrTemplateService,
      ListCourseOmrTemplatesService,
      OmrTemplateRulesService,
      QueueOmrTemplatePdfGenerationService,
      OmrTemplatePdfRendererService,
      OmrTemplatePdfGenerationProcessor,
   ],
   exports: [GetOmrTemplateService],
})
export class OmrTemplateModule {}
