import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AclMembershipResolver } from './resolvers/acl-membership.resolver';
import { AclMembershipPermissionOverrideResolver } from './resolvers/acl-membership-permission-override.resolver';
import { SchoolMemberResolver } from './resolvers/school-member.resolver';
import { AclMembershipService } from './services/acl-membership.service';
import { AclMembershipPermissionOverrideService } from './services/acl-membership-permission-override.service';
import { AclDescendantMembershipService } from './services/acl-descendant-membership.service';
import { SchoolMemberService } from './services/school-member.service';

@Module({
   imports: [PrismaModule, LoggerModule, AuthModule],
   providers: [
      AclMembershipResolver,
      AclMembershipService,
      AclDescendantMembershipService,
      AclMembershipPermissionOverrideResolver,
      AclMembershipPermissionOverrideService,
      SchoolMemberResolver,
      SchoolMemberService,
   ],
})
export class AclModule {}
