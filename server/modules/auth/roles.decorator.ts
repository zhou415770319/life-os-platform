import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user-store.interface';

export const ROLES_KEY = 'auth:roles';

/** 标记接口所需角色（如 @Roles('admin')）；不标注 = 登录即可访问 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'auth:public';

/** 标记公开接口（免登录，仅白名单之外的特例使用；默认白名单在 AuthGuard 内维护） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
