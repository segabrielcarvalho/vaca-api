import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoginArgs } from '../args/login.args';
import { Public } from '../decorators/public.decorator';
import { LoginObject } from '../objects/login.object';
import { LoginService } from '../services/login/login.service';

@Resolver()
export class AuthResolver {
   constructor(private readonly loginService: LoginService) {}

   @Public()
   @Mutation(() => LoginObject)
   async login(@Args() args: LoginArgs) {
      return this.loginService.run(args);
   }
}
