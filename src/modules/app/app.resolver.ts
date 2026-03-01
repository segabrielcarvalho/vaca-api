import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/decorators/public.decorator';

@Resolver()
export class AppResolver {
   @Public()
   @Query(() => String)
   async healthCheck(): Promise<string> {
      return 'App is running';
   }
}
