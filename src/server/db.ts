import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config';
import { dayjs, formatDateTime } from './utils/time';

const ensureDirectory = (filePath: string) => {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
};

const migrations = [
  {
    id: '001_initial',
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nickname TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date_type TEXT NOT NULL,
        repeat_type TEXT NOT NULL,
        solar_date TEXT,
        lunar_month INTEGER,
        lunar_day INTEGER,
        is_leap_month INTEGER NOT NULL DEFAULT 0,
        advance_days INTEGER NOT NULL DEFAULT 0,
        times_per_day INTEGER NOT NULL,
        remind_times TEXT NOT NULL,
        channels TEXT NOT NULL,
        remark TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        bark_enabled INTEGER NOT NULL DEFAULT 0,
        bark_server_url TEXT NOT NULL DEFAULT '',
        bark_device_key TEXT NOT NULL DEFAULT '',
        bark_default_title TEXT NOT NULL DEFAULT '日程提醒助手',
        bark_sound TEXT NOT NULL DEFAULT '',
        bark_group_name TEXT NOT NULL DEFAULT '',
        bark_auto_copy INTEGER NOT NULL DEFAULT 0,
        wecom_enabled INTEGER NOT NULL DEFAULT 0,
        wecom_corp_id TEXT NOT NULL DEFAULT '',
        wecom_agent_id TEXT NOT NULL DEFAULT '',
        wecom_secret TEXT NOT NULL DEFAULT '',
        wecom_to_user TEXT NOT NULL DEFAULT '@all',
        wecom_to_party TEXT NOT NULL DEFAULT '',
        wecom_to_tag TEXT NOT NULL DEFAULT '',
        wecom_cached_token TEXT NOT NULL DEFAULT '',
        wecom_token_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        default_advance_days INTEGER NOT NULL DEFAULT 0,
        default_times_per_day INTEGER NOT NULL DEFAULT 1,
        default_remind_times TEXT NOT NULL DEFAULT '["09:00"]',
        log_retention_days INTEGER NOT NULL DEFAULT 90,
        debug_logging INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id INTEGER,
        reminder_title TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        occurrence_date TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        send_time TEXT NOT NULL,
        error TEXT NOT NULL DEFAULT '',
        response TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (reminder_id) REFERENCES reminders (id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_reminder_id ON message_logs(reminder_id)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_scheduled ON message_logs(scheduled_date, scheduled_time)`,
      `CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(enabled)`
    ]
  },
  {
    id: '002_wecom_api_base_url',
    statements: [
      `ALTER TABLE notification_settings
       ADD COLUMN wecom_api_base_url TEXT NOT NULL DEFAULT ''`
    ]
  },
  {
    id: '003_bark_icon_url',
    statements: [
      `ALTER TABLE notification_settings
       ADD COLUMN bark_icon_url TEXT NOT NULL DEFAULT ''`
    ]
  },
  {
    id: '004_wecom_callback_config',
    statements: [
      `ALTER TABLE notification_settings
       ADD COLUMN wecom_token TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE notification_settings
       ADD COLUMN wecom_encoding_aes_key TEXT NOT NULL DEFAULT ''`
    ]
  },
  {
    id: '005_wecom_acknowledgements',
    statements: [
      `CREATE TABLE IF NOT EXISTS wecom_reminder_acknowledgements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id INTEGER NOT NULL,
        occurrence_date TEXT NOT NULL,
        message_log_id INTEGER,
        acknowledged_by TEXT NOT NULL DEFAULT '',
        reply_content TEXT NOT NULL DEFAULT '',
        acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (reminder_id, occurrence_date),
        FOREIGN KEY (reminder_id) REFERENCES reminders (id) ON DELETE CASCADE,
        FOREIGN KEY (message_log_id) REFERENCES message_logs (id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_wecom_ack_pending
       ON wecom_reminder_acknowledgements(acknowledged_at, message_log_id)`,
      `CREATE INDEX IF NOT EXISTS idx_wecom_ack_reminder_occurrence
       ON wecom_reminder_acknowledgements(reminder_id, occurrence_date)`
    ]
  }
];

ensureDirectory(config.databaseUrl);

export const db = new Database(config.databaseUrl);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const runMigrations = () => {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  );

  const existing = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all() as Array<{ id: string }>
  );

  const existingIds = new Set(
    Array.from(existing).map((row) => String(row.id))
  );

  for (const migration of migrations) {
    if (existingIds.has(migration.id)) {
      continue;
    }
    const apply = db.transaction(() => {
      for (const statement of migration.statements) {
        db.exec(statement);
      }
      db.prepare(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
      ).run(migration.id, formatDateTime(dayjs()));
    });
    apply();
  }
};

const ensureSingletonRows = () => {
  const now = formatDateTime(dayjs());

  db.prepare(
    `INSERT INTO notification_settings (
      id,
      bark_enabled,
      bark_server_url,
      bark_device_key,
      bark_default_title,
      bark_sound,
      bark_group_name,
      bark_icon_url,
      bark_auto_copy,
      wecom_enabled,
      wecom_corp_id,
      wecom_agent_id,
      wecom_secret,
      wecom_api_base_url,
      wecom_token,
      wecom_encoding_aes_key,
      wecom_to_user,
      wecom_to_party,
      wecom_to_tag,
      created_at,
      updated_at
    )
    SELECT
      1,
      CASE WHEN ? <> '' AND ? <> '' THEN 1 ELSE 0 END,
      ?,
      ?,
      '日程提醒助手',
      '',
      '',
      ?,
      0,
      CASE WHEN ? <> '' AND ? <> '' AND ? <> '' THEN 1 ELSE 0 END,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      '',
      '',
      ?,
      ?
    WHERE NOT EXISTS (SELECT 1 FROM notification_settings WHERE id = 1)`
  ).run(
    config.barkServerUrl,
    config.barkDeviceKey,
    config.barkServerUrl,
    config.barkDeviceKey,
    config.barkIconUrl,
    config.wecomCorpId,
    config.wecomAgentId,
    config.wecomSecret,
    config.wecomCorpId,
    config.wecomAgentId,
    config.wecomSecret,
    config.wecomApiBaseUrl,
    config.wecomToken,
    config.wecomEncodingAesKey,
    config.wecomToUser,
    now,
    now
  );

  db.prepare(
    `INSERT INTO system_settings (
      id,
      timezone,
      default_advance_days,
      default_times_per_day,
      default_remind_times,
      log_retention_days,
      debug_logging,
      created_at,
      updated_at
    )
    SELECT 1, ?, 0, 1, '["09:00"]', 90, 0, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1)`
  ).run(config.timezone, now, now);
};

export const initializeDatabase = () => {
  runMigrations();
  ensureSingletonRows();
};
