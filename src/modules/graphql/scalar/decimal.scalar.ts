import { Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { Prisma } from '../../../../.prisma/client';

@Scalar('Decimal')
export class DecimalScalar {
   description =
      'Scalar Decimal que serializa para string e converte para Prisma.Decimal.';

   serialize(value: Prisma.Decimal | string | number): string {
      if (value instanceof Prisma.Decimal) return value.toString();
      if (typeof value === 'string' || typeof value === 'number') {
         return new Prisma.Decimal(value).toString();
      }
      throw new TypeError(`Decimal não pode serializar o valor: ${value}`);
   }

   parseValue(value: string | number): Prisma.Decimal {
      if (typeof value === 'string' || typeof value === 'number') {
         return new Prisma.Decimal(value);
      }
      throw new TypeError(
         `Decimal não pode representar valor não numérico: ${value}`,
      );
   }

   parseLiteral(ast: ValueNode): Prisma.Decimal | null {
      if (
         ast.kind === Kind.STRING ||
         ast.kind === Kind.INT ||
         ast.kind === Kind.FLOAT
      ) {
         return new Prisma.Decimal(ast.value);
      }
      return null;
   }
}

export const GraphQLDecimal = DecimalScalar;
