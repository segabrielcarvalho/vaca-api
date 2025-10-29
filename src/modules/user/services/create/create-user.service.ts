import { BadRequestException, Injectable } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserArgs } from '../../args/create-user.args';

@Injectable()
export class CreateUserService {
   constructor(private readonly prisma: PrismaService) {}

   async run({ data }: CreateUserArgs) {
      const { password, role, email, ...rest } = data;

      if (role === RoleEnum.admin)
         throw new BadRequestException('Não é permitido criar usuários admin.');

      const exists = await this.prisma.user.findUnique({
         where: { email },
      });
      if (exists) throw new BadRequestException('E-mail já cadastrado.');

      const relations: Record<string, any> = {};

      if (role === RoleEnum.user) relations.UserAgent = { create: {} };

      const encryptedPassword = await hash(password, 10);

      const user = await this.prisma.user.create({
         data: {
            ...rest,
            email,
            role,
            encryptedPassword,
            ...relations,
         },
      });

      return user;
   }
}
