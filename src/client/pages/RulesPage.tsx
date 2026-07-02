import { useEffect, useState } from 'react';
import type { SystemSettings } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';
import { TimePicker } from '../components/TimePicker';

const defaultSettings: SystemSettings = {
  timezone: 'Asia/Shanghai',
  defaultAdvanceDays: 0,
  defaultTimesPerDay: 1,
  defaultRemindTimes: ['09:00'],
  logRetentionDays: 90,
  debugLogging: false
};

const advanceDayOptions = [
  { value: 0, label: '当天提醒' },
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' },
  { value: 15, label: '提前 15 天' },
  { value: 30, label: '提前 30 天' }
];

const timesPerDayOptions = [1, 2, 3, 4, 5, 6];

const normalizeTimesPerDay = (value: string | number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(6, Math.max(1, Math.trunc(parsed)));
};

export const RulesPage = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void api
      .get<SystemSettings>('/api/settings/system')
      .then(setSettings)
      .catch((reason) =>
        setMessage({
          tone: 'error',
          text: reason instanceof ApiError ? reason.message : '默认规则加载失败'
        })
      );
  }, []);

  const resizeTimes = (value: string | number) => {
    const count = normalizeTimesPerDay(value);
    setSettings((current) => {
      const nextTimes = [...current.defaultRemindTimes];
      while (nextTimes.length < count) {
        nextTimes.push('09:00');
      }
      return {
        ...current,
        defaultTimesPerDay: count,
        defaultRemindTimes: nextTimes.slice(0, count)
      };
    });
  };

  const save = async () => {
    try {
      const next = await api.put<SystemSettings>('/api/settings/system', settings);
      setSettings(next);
      setMessage({ tone: 'success', text: '默认提醒规则已保存。' });
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
        <div className="section-heading">
          <h2>默认提醒规则</h2>
          <p>新建提醒时会自动带入这些默认值。</p>
        </div>
        <label className="field">
          <span>默认提前天数</span>
          <select
            value={settings.defaultAdvanceDays}
            onChange={(event) =>
              setSettings((value) => ({
                ...value,
                defaultAdvanceDays: Number(event.target.value)
              }))
            }
          >
            {advanceDayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>默认每日提醒次数</span>
          <select
            value={settings.defaultTimesPerDay}
            onChange={(event) => resizeTimes(event.target.value)}
          >
            {timesPerDayOptions.map((count) => (
              <option key={count} value={count}>
                {count} 次
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>默认提醒时间</span>
          <div className="inline-grid">
            {settings.defaultRemindTimes.map((time, index) => (
              <TimePicker
                key={`default-remind-time-${index}`}
                value={time}
                onChange={(nextTime) =>
                  setSettings((current) => {
                    const nextTimes = [...current.defaultRemindTimes];
                    nextTimes[index] = nextTime;
                    return { ...current, defaultRemindTimes: nextTimes };
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="tip-box">
          每个提醒仍然可以单独覆盖默认规则。这里主要是为了让常用场景录入更快。
        </div>
        <button type="button" className="primary-button" onClick={() => void save()}>
          保存默认规则
        </button>
      </section>
    </div>
  );
};
