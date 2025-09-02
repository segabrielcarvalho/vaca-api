import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClientLoginArgs } from '../args/client-login.args';
import { LoginArgs } from '../args/login.args';
import { ValidateCodeArgs } from '../args/validate-code.args';
import { Public } from '../decorators/public.decorator';
import { LoginObject } from '../objects/login.object';
import { TokenPairObject } from '../objects/token-pair.object';
import { ClientLoginService } from '../services/client-login/client-login.service';
import { LoginService } from '../services/login/login.service';
import { ValidateCodeService } from '../services/validate-code/validate-code.service';

@Resolver()
export class AuthResolver {
   constructor(
      private readonly clientLoginService: ClientLoginService,
      private readonly validateCodeService: ValidateCodeService,
      private readonly loginService: LoginService,
   ) {}

   @Public()
   @Mutation(() => LoginObject)
   async clientLogin(@Args() args: ClientLoginArgs) {
      return this.clientLoginService.run(args);
   }

   @Public()
   @Mutation(() => LoginObject)
   async login(@Args() args: LoginArgs) {
      return this.loginService.run(args);
   }

   @Public()
   @Mutation(() => TokenPairObject)
   async validateCode(@Args() args: ValidateCodeArgs) {
      return this.validateCodeService.run(args);
   }
}
