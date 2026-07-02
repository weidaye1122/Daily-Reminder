import { useEffect, useState } from 'react';
import type { SystemSettings } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';

const defaultSettings: SystemSettings = {
  timezone: 'Asia/Shanghai',
  defaultAdvanceDays: 0,
  defaultTimesPerDay: 1,
  defaultRemindTimes: ['09:00'],
  logRetentionDays: 90,
  debugLogging: false
};

export const SettingsPage = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void api
      .get<SystemSettings>('/api/settings/system')
      .then(setSettings)
      .catch((reason) =>
        setMessage({
          tone: 'error',
          text: reason instanceof ApiError ? reason.message : '系统设置加载失败'
        })
      );
  }, []);

  const save = async () => {
    try {
      const next = await api.put<SystemSettings>('/api/settings/system', settings);
      setSettings(next);
      setMessage({ tone: 'success', text: '系统设置已保存。' });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '保存失败'
      });
    }
  };

  return (
    <div className="page-stack">
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <section className="card form-grid">
        <label className="field">
          <span>时区</span>
          <input
            value={settings.timezone}
            onChange={(event) =>
              setSettings((value) => ({ ...value, timezone: event.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>日志保留天数</span>
          <input
            type="number"
            min={1}
            max={3650}
            value={settings.logRetentionDays}
            onChange={(event) =>
              setSettings((value) => ({
                ...value,
                logRetentionDays: Number(event.target.value)
              }))
            }
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.debugLogging}
            onChange={(event) =>
              setSettings((value) => ({ ...value, debugLogging: event.target.checked }))
            }
          />
          <span>开启调试日志</span>
        </label>
        <div className="tip-box">
          时区会影响提醒任务的判断逻辑，默认建议保持 `Asia/Shanghai`。
        </div>
        <button type="button" className="primary-button" onClick={() => void save()}>
          保存系统设置
        </button>
      </section>
    </div>
  );
};
