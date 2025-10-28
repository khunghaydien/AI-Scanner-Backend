import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  ADMIN = 'admin',
  PAGE_ADMIN = 'page_admin',
  SHOP_OWNER = 'shop_owner',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
