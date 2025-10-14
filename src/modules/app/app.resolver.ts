import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Resolver()
export class AppResolver {
   @Query(() => String)
   async healthCheck(): Promise<string> {
      return 'App is running';
   }
}
