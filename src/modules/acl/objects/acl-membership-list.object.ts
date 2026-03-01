import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { AclMembershipObject } from './acl-membership.object';

@ObjectType()
export class AclMembershipListObject extends DefaultListObject {
   @Field(() => [AclMembershipObject])
   @Type(() => AclMembershipObject)
   rows!: AclMembershipObject[];
}
