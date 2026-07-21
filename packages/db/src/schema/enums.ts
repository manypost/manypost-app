import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ActorTypes,
  ApprovalStatuses,
  BillingPeriods,
  ChannelStatuses,
  GroupStates,
  MemberRoles,
  PlanTiers,
  PostOrigins,
  PublicationStates,
  SubscriptionStatuses,
} from '@manypost/contracts';

export const memberRole = pgEnum('member_role', MemberRoles);
export const channelStatus = pgEnum('channel_status', ChannelStatuses);
export const groupState = pgEnum('group_state', GroupStates);
export const publicationState = pgEnum('publication_state', PublicationStates);
export const postOrigin = pgEnum('post_origin', PostOrigins);
export const actorType = pgEnum('actor_type', ActorTypes);
export const approvalStatus = pgEnum('approval_status', ApprovalStatuses);
export const planTier = pgEnum('plan_tier', PlanTiers);
export const billingPeriod = pgEnum('billing_period', BillingPeriods);
export const subscriptionStatus = pgEnum('subscription_status', SubscriptionStatuses);
