import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserFieldsResolver } from './resolvers/user-fields.resolver';
import { CreateUserService } from './services/create/create-user.service';

@Module({
   imports: [PrismaModule],
   providers: [CreateUserService, UserFieldsResolver],
   exports: [CreateUserService],
})
export class UserModule {}
