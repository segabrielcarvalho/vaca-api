import { ArgsType, Field } from '@nestjs/graphql';
import { IsEmail } from 'class-validator';

@ArgsType()
export class ClientLoginArgs {
   @IsEmail()
   @Field(() => String, {
      nullable: false,
      description:
         'Endereço de e-mail do usuário associado à Central de Vendas.',
   })
   email: string;
}
