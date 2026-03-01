import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { Exam } from '../../graphql/@generated/exam/exam.model';
import { CreateExamInput } from '../inputs/create-exam.input';
import { GetExamInput } from '../inputs/get-exam.input';
import { ListKlassExamsInput } from '../inputs/list-klass-exams.input';
import { UpdateExamInput } from '../inputs/update-exam.input';
import { ExamListObject } from '../objects/exam-list.object';
import { CreateExamService } from '../services/create/create-exam.service';
import { GetExamService } from '../services/get/get-exam.service';
import { ListKlassExamsService } from '../services/list/list-klass-exams.service';
import { UpdateExamService } from '../services/update/update-exam.service';

@Resolver(() => Exam)
export class ExamResolver {
   constructor(
      private readonly listKlassExamsService: ListKlassExamsService,
      private readonly getExamService: GetExamService,
      private readonly createExamService: CreateExamService,
      private readonly updateExamService: UpdateExamService,
   ) {}

   @ScopedAuthorized({
      permission: 'klass.exam.read',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Query(() => ExamListObject)
   async listKlassExams(
      @Args('input') input: ListKlassExamsInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listKlassExamsService.run(input, user);
   }

   @Query(() => Exam)
   async getExam(
      @Args('input') input: GetExamInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.getExamService.run(input, user);
   }

   @ScopedAuthorized({
      permission: 'klass.exam.manage',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'input.klassId',
   })
   @Mutation(() => Exam)
   async createExam(
      @Args('input') input: CreateExamInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.createExamService.run(input, user);
   }

   @Mutation(() => Exam)
   async updateExam(
      @Args('input') input: UpdateExamInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.updateExamService.run(input, user);
   }
}
