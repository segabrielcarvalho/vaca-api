import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { CreateKlassStudentInput } from '../inputs/create-klass-student.input';
import { DeleteKlassStudentInput } from '../inputs/delete-klass-student.input';
import { GetKlassStudentInput } from '../inputs/get-klass-student.input';
import { GetStudentDetailInput } from '../inputs/get-student-detail.input';
import { ImportKlassStudentsCsvInput } from '../inputs/import-klass-students-csv.input';
import { ListKlassStudentsInput } from '../inputs/list-klass-students.input';
import { ReactivateKlassStudentInput } from '../inputs/reactivate-klass-student.input';
import { UpdateKlassStudentInput } from '../inputs/update-klass-student.input';
import { KlassStudentImportResultObject } from '../objects/klass-student-import-result.object';
import { KlassStudentListObject } from '../objects/klass-student-list.object';
import { KlassStudentObject } from '../objects/klass-student.object';
import { StudentDetailObject } from '../objects/student-detail.object';
import { CreateKlassStudentService } from '../services/create/create-klass-student.service';
import { ImportKlassStudentsCsvService } from '../services/create/import-klass-students-csv.service';
import { DeleteKlassStudentService } from '../services/delete/delete-klass-student.service';
import { GetKlassStudentService } from '../services/get/get-klass-student.service';
import { GetStudentDetailService } from '../services/get/get-student-detail.service';
import { ListKlassStudentsService } from '../services/list/list-klass-students.service';
import { ReactivateKlassStudentService } from '../services/reactivate/reactivate-klass-student.service';
import { UpdateKlassStudentService } from '../services/update/update-klass-student.service';

@Resolver()
export class StudentResolver {
   constructor(
      private readonly listKlassStudentsService: ListKlassStudentsService,
      private readonly getKlassStudentService: GetKlassStudentService,
      private readonly getStudentDetailService: GetStudentDetailService,
      private readonly createKlassStudentService: CreateKlassStudentService,
      private readonly importKlassStudentsCsvService: ImportKlassStudentsCsvService,
      private readonly updateKlassStudentService: UpdateKlassStudentService,
      private readonly deleteKlassStudentService: DeleteKlassStudentService,
      private readonly reactivateKlassStudentService: ReactivateKlassStudentService,
   ) {}

   @ScopedAuthorized({
      permission: 'klass.student.read',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Query(() => KlassStudentListObject)
   async listKlassStudents(
      @Args('input') input: ListKlassStudentsInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listKlassStudentsService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.read',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Query(() => KlassStudentObject)
   async getKlassStudent(
      @Args('input') input: GetKlassStudentInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.getKlassStudentService.run(input, user);
   }

   @Query(() => StudentDetailObject)
   async getStudentDetail(
      @Args('input') input: GetStudentDetailInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.getStudentDetailService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => KlassStudentObject)
   async createKlassStudent(
      @Args('input') input: CreateKlassStudentInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.createKlassStudentService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => KlassStudentImportResultObject)
   async importKlassStudentsCsv(
      @Args('input') input: ImportKlassStudentsCsvInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.importKlassStudentsCsvService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => KlassStudentObject)
   async updateKlassStudent(
      @Args('input') input: UpdateKlassStudentInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.updateKlassStudentService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => KlassStudentObject)
   async deleteKlassStudent(
      @Args('input') input: DeleteKlassStudentInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.deleteKlassStudentService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.student.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => KlassStudentObject)
   async reactivateKlassStudent(
      @Args('input') input: ReactivateKlassStudentInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.reactivateKlassStudentService.run(input, user);
   }
}
