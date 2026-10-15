/**
 * 用户存储抽象：本地 JSON / 飞书多维表格 / 后期数据库 可平滑切换。
 * 业务代码只依赖本接口，切换后端只改 USER_STORE 配置。
 */
export type UserRole = 'admin' | 'user';

export interface StoredUser {
  /** 用户唯一 ID（如 u_xxxxxxxx） */
  id: string;
  /** 登录名（唯一） */
  username: string;
  /** scrypt(password, salt) 的 hex，不存明文 */
  passwordHash: string;
  /** 随机盐（hex） */
  salt: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  id?: string;
  createdAt?: string;
}

export interface UserStore {
  findAll(): StoredUser[];
  findByUsername(username: string): StoredUser | null;
  create(input: CreateUserInput): StoredUser;
  /** 用户总数（用于判断「首用户注册 = 管理员」） */
  count(): number;
}
