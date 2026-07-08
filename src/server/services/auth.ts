import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import type { AuthUser } from '../../shared/types';
import { config } from '../config';
import { db } from '../db';
import { dayjs, formatDateTime } from '../utils/time';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  nickname: string;
  must_change_password: number;
}

interface SessionRow {
  user_id: number;
  expires_at: string;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

const mapUser = (row: UserRow): AuthUser => ({
  id: row.id,
  username: row.username,
  nickname: row.nickname,
  mustChangePassword: Boolean(row.must_change_password)
});

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  path: '/'
});

export const getSessionCookieOptions = sessionCookieOptions;

const unsafeAdminPasswords = new Set([
  'admin',
  'admin123456',
  'change-me-before-start',
  'changeme',
  'password',
  '123456'
]);

const assertProductionAdminPassword = (password: string) => {
  if (!config.isProduction) {
    return;
  }

  const normalized = password.trim().toLowerCase();
  if (!config.defaultAdminPasswordConfigured || unsafeAdminPasswords.has(normalized)) {
    throw new Error(
      '生产环境必须设置安全的 DEFAULT_ADMIN_PASSWORD，不能留空或使用示例密码。'
    );
  }
};

export const ensureDefaultAdmin = () => {
  const username = config.defaultAdminUsername.trim() || 'admin';
  const password = config.defaultAdminPassword || 'change-me-before-start';
  assertProductionAdminPassword(password);
  const now = formatDateTime(dayjs());
  const users = db
    .prepare(
      'SELECT id, username, password_hash, nickname, must_change_password FROM users ORDER BY id ASC'
    )
    .all() as UserRow[];

  if (!users.length) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(
      `INSERT INTO users (
        username,
        password_hash,
        nickname,
        must_change_password,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 0, ?, ?)`
    ).run(username, hash, '管理员', now, now);
    return;
  }

  const admin = users[0];
  const usernameTaken = users.some(
    (user) => user.id !== admin.id && user.username === username
  );
  if (usernameTaken) {
    throw new Error(`环境变量 DEFAULT_ADMIN_USERNAME=${username} 已被其他账号占用`);
  }

  const usernameChanged = admin.username !== username;
  const passwordChanged = !bcrypt.compareSync(password, admin.password_hash);
  const mustChangeFlagChanged = Boolean(admin.must_change_password);
  if (!usernameChanged && !passwordChanged && !mustChangeFlagChanged) {
    return;
  }

  const nextPasswordHash = passwordChanged
    ? bcrypt.hashSync(password, 12)
    : admin.password_hash;
  db.prepare(
    `UPDATE users
     SET username = ?, password_hash = ?, must_change_password = 0, updated_at = ?
     WHERE id = ?`
  ).run(username, nextPasswordHash, now, admin.id);

  if (usernameChanged || passwordChanged) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(admin.id);
  }
};

const createSession = (userId: number) => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(rawToken);
  const now = dayjs();
  const expiresAt = now.add(config.sessionDays, 'day');
  db.prepare(
    `INSERT INTO sessions (
      user_id,
      token_hash,
      expires_at,
      created_at,
      last_seen_at
    ) VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    tokenHash,
    formatDateTime(expiresAt),
    formatDateTime(now),
    formatDateTime(now)
  );
  return rawToken;
};

const getUserByUsername = (username: string) =>
  (db
    .prepare(
      'SELECT id, username, password_hash, nickname, must_change_password FROM users WHERE username = ?'
    )
    .get(username) as UserRow | undefined) ?? null;

const getUserById = (userId: number) =>
  (db
    .prepare(
      'SELECT id, username, password_hash, nickname, must_change_password FROM users WHERE id = ?'
    )
    .get(userId) as UserRow | undefined) ?? null;

export const login = (username: string, password: string) => {
  const user = getUserByUsername(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new AuthError('用户名或密码错误', 401);
  }
  const sessionToken = createSession(user.id);
  return {
    user: mapUser(user),
    sessionToken
  };
};

export const getUserFromSession = (rawToken?: string | null) => {
  if (!rawToken) {
    return null;
  }
  const session = db
    .prepare(
      `SELECT user_id, expires_at
       FROM sessions
       WHERE token_hash = ?`
    )
    .get(sha256(rawToken)) as SessionRow | undefined;
  if (!session) {
    return null;
  }
  if (dayjs(session.expires_at).isBefore(dayjs())) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(rawToken));
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(
    formatDateTime(dayjs()),
    sha256(rawToken)
  );
  const user = getUserById(session.user_id);
  return user ? mapUser(user) : null;
};

export const logout = (rawToken?: string | null) => {
  if (!rawToken) {
    return;
  }
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(rawToken));
};
