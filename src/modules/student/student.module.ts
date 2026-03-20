import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentResolver } from './resolvers/student.resolver';
import { CreateKlassStudentService } from './services/create/create-klass-student.service';
import { ImportKlassStudentsCsvService } from './services/create/import-klass-students-csv.service';
import { DeleteKlassStudentService } from './services/delete/delete-klass-student.service';
import { GetKlassStudentService } from './services/get/get-klass-student.service';
import { GetStudentDetailService } from './services/get/get-student-detail.service';
import { ListKlassStudentsService } from './services/list/list-klass-students.service';
import { ReactivateKlassStudentService } from './services/reactivate/reactivate-klass-student.service';
import { StudentRulesService } from './services/shared/student-rules.service';
import { UpdateKlassStudentService } from './services/update/update-klass-student.service';

@Module({
   imports: [PrismaModule, AuthModule],
   providers: [
      StudentResolver,
      CreateKlassStudentService,
      ImportKlassStudentsCsvService,
      DeleteKlassStudentService,
      GetKlassStudentService,
      GetStudentDetailService,
      ListKlassStudentsService,
      ReactivateKlassStudentService,
      StudentRulesService,
      UpdateKlassStudentService,
   ],
})
export class StudentModule {}
