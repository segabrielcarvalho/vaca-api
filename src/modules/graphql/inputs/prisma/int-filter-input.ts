import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class IntFilterBase {
   @Field(() => Int, { nullable: true })
   equals?: number;

   @Field(() => [Int], { nullable: true })
   in?: Array<number>;

   @Field(() => [Int], { nullable: true })
   notIn?: Array<number>;

   @Field(() => Int, { nullable: true })
   lt?: number;

   @Field(() => Int, { nullable: true })
   lte?: number;

   @Field(() => Int, { nullable: true })
   gt?: number;

   @Field(() => Int, { nullable: true })
   gte?: number;
}

@InputType()
export class IntFilter extends IntFilterBase {
   @Field(() => IntFilterBase, { nullable: true })
   not?: IntFilterBase;
}
