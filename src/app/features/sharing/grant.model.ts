import { AccessPermission } from '../../core/finance/access-permission';
import { Tables } from '../../core/supabase/database.types';

export type Grant = Tables<'financial_access_grants'>;

export interface GivenGrant {
  readonly id: string;
  readonly grantedUserId: string;
  readonly grantedUserName: string;
  readonly permission: AccessPermission;
  readonly createdAt: string;
}

export interface ReceivedGrantView {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly permission: AccessPermission;
  readonly createdAt: string;
}
