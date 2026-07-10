import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ActorTypes,
  ApprovalStatuses,
  ChannelStatuses,
  GroupStates,
  MemberRoles,
  PostOrigins,
  PublicationStates,
} from '@manypost/contracts';

export const memberRole = pgEnum('member_role', MemberRoles);
export const channelStatus = pgEnum('channel_status', ChannelStatuses);
export const groupState = pgEnum('group_state', GroupStates);
export const publicationState = pgEnum('publication_state', PublicationStates);
export const postOrigin = pgEnum('post_origin', PostOrigins);
export const actorType = pgEnum('actor_type', ActorTypes);
export const approvalStatus = pgEnum('approval_status', ApprovalStatuses);
