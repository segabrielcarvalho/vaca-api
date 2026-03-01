import { AuthChannelEnum as PrismaAuthChannelEnum } from '../../../../../.prisma/client';
import { UnauthorizedException, Injectable } from '@nestjs/common';
import { AuthChannelEnum as GraphQLAuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';

@Injectable()
export class AssertChallengeChannelBindingService {
   run(input: {
      challengeChannel: PrismaAuthChannelEnum;
      inputChannel: GraphQLAuthChannelEnum | PrismaAuthChannelEnum;
   }) {
      if (input.challengeChannel !== input.inputChannel) {
         throw new UnauthorizedException(
            'Canal invalido para consumo do desafio.',
         );
      }
   }
}
