import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { CreateOneKlassArgs } from '../../graphql/@generated/klass/create-one-klass.args';
import { DeleteOneKlassArgs } from '../../graphql/@generated/klass/delete-one-klass.args';
import { FindManyKlassArgs } from '../../graphql/@generated/klass/find-many-klass.args';
import { FindUniqueKlassArgs } from '../../graphql/@generated/klass/find-unique-klass.args';
import { Klass } from '../../graphql/@generated/klass/klass.model';
import { UpdateOneKlassArgs } from '../../graphql/@generated/klass/update-one-klass.args';
import { KlassListObject } from '../objects/klass-list.object';
import { CreateKlassService } from '../services/create/create-klass.service';
import { DeleteKlassService } from '../services/delete/delete-klass.service';
import { GetKlassService } from '../services/get/get-klass.service';
import { ListKlassesService } from '../services/list/klass.service';
import { UpdateKlassService } from '../services/update/update-klass.service';

@Resolver(() => Klass)
export class KlassResolver {
   constructor(
      private readonly listKlassesService: ListKlassesService,
      private readonly getKlassService: GetKlassService,
      private readonly createKlassService: CreateKlassService,
      private readonly updateKlassService: UpdateKlassService,
      private readonly deleteKlassService: DeleteKlassService,
   ) {}

   @Query(() => KlassListObject)
   async listKlasses(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: FindManyKlassArgs,
   ) {
      return this.listKlassesService.run(args, user);
   }

   @Query(() => Klass)
   async getKlass(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: FindUniqueKlassArgs,
   ) {
      return this.getKlassService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'klass.create',
      scopeType: AclScopeType.course,
      scopeIdPath: 'data.Course.connect.id',
   })
   @Mutation(() => Klass)
   async createKlass(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: CreateOneKlassArgs,
   ) {
      return this.createKlassService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'klass.update',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => Klass)
   async updateKlass(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: UpdateOneKlassArgs,
   ) {
      return this.updateKlassService.run(args, user);
   }

   @ScopedAuthorized({
      permission: 'klass.delete',
      scopeType: AclScopeType.klass,
      scopeIdPath: 'where.id',
   })
   @Mutation(() => Klass)
   async deleteKlass(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: DeleteOneKlassArgs,
   ) {
      return this.deleteKlassService.run(args, user);
   }
}
