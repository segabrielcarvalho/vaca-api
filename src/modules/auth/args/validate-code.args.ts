import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class ValidateCodeArgs {
   @Field(() => String, {
      nullable: false,
      description: 'O código a ser validado',
   })
   code!: string;

   @Field(() => String, {
      nullable: false,
      description:
         'O token da URL de validação, usado para identificar o usuário',
   })
   token!: string;
}
