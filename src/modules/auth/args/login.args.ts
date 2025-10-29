import { ArgsType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

@ArgsType()
export class LoginArgs {
   @IsEmail()
   @Field(() => String, {
      nullable: false,
      description:
         'Endereço de e-mail do usuário associado à Central de Vendas.',
   })
   email: string;

   @Field(() => String, {
      nullable: false,
      description: 'Senha do usuário.',
   })
   @IsNotEmpty()
   @MinLength(8)
   password: string;
}
