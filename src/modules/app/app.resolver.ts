import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
   @Query(() => String)
   async healthCheck(): Promise<string> {
      return 'App is running';
   }
}
