import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KlassFieldsResolver } from './resolvers/klass-fields.resolver';
import { KlassListResolver } from './resolvers/klass-list.resolver';
import { KlassResolver } from './resolvers/klass.resolver';
import { CreateKlassService } from './services/create/create-klass.service';
import { DeleteKlassService } from './services/delete/delete-klass.service';
import { GetKlassService } from './services/get/get-klass.service';
import { ListKlassesService } from './services/list/klass.service';
import { KlassRulesService } from './services/shared/klass-rules.service';
import { UpdateKlassService } from './services/update/update-klass.service';

@Module({
   imports: [PrismaModule, LoggerModule, AuthModule],
   providers: [
      KlassResolver,
      KlassFieldsResolver,
      KlassListResolver,
      CreateKlassService,
      ListKlassesService,
      GetKlassService,
      UpdateKlassService,
      DeleteKlassService,
      KlassRulesService,
   ],
})
export class KlassModule {}
