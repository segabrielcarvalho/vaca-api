import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamFieldsResolver } from './resolvers/exam-fields.resolver';
import { ExamResolver } from './resolvers/exam.resolver';
import { CreateExamService } from './services/create/create-exam.service';
import { DeleteExamService } from './services/delete/delete-exam.service';
import { GetExamService } from './services/get/get-exam.service';
import { ListKlassExamsService } from './services/list/list-klass-exams.service';
import { ReactivateExamService } from './services/reactivate/reactivate-exam.service';
import { ExamRulesService } from './services/shared/exam-rules.service';
import { UpdateExamService } from './services/update/update-exam.service';

@Module({
   imports: [PrismaModule, LoggerModule, AuthModule],
   providers: [
      ExamResolver,
      ExamFieldsResolver,
      CreateExamService,
      DeleteExamService,
      GetExamService,
      ListKlassExamsService,
      ReactivateExamService,
      UpdateExamService,
      ExamRulesService,
   ],
   exports: [ExamRulesService],
})
export class ExamModule {}
