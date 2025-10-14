import { BadRequestException, Injectable } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserArgs } from '../../args/create-user.args';

@Injectable()
export class CreateUserService {
   constructor(private readonly prisma: PrismaService) {}

   async run({ data: { ...rest } }: CreateUserArgs) {
      if (rest.role === RoleEnum.admin)
         throw new BadRequestException('Não é permitido criar usuários admin.');

      const exists = await this.prisma.user.findUnique({
         where: { email: rest.email },
      });
      if (exists) throw new BadRequestException('E-mail já cadastrado.');

      const relations: Record<string, any> = {};

      if (rest.role === RoleEnum.user) relations.UserAgent = { create: {} };

      const user = await this.prisma.user.create({
         data: { ...rest, ...relations },
      });

      return user;
   }
}
