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

  const resizeTimes = (count: number) => {
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
            <option value={0}>当天提醒</option>
            <option value={1}>提前 1 天</option>
            <option value={3}>提前 3 天</option>
            <option value={7}>提前 7 天</option>
            <option value={15}>提前 15 天</option>
            <option value={30}>提前 30 天</option>
          </select>
        </label>
        <label className="field">
          <span>默认每日提醒次数</span>
          <input
            type="number"
            min={1}
            max={6}
            value={settings.defaultTimesPerDay}
            onChange={(event) => resizeTimes(Number(event.target.value))}
          />
        </label>
        <div className="field">
          <span>默认提醒时间</span>
          <div className="inline-grid">
            {settings.defaultRemindTimes.map((time, index) => (
              <input
                key={`${index}-${time}`}
                type="time"
                value={time}
                onChange={(event) =>
                  setSettings((current) => {
                    const nextTimes = [...current.defaultRemindTimes];
                    nextTimes[index] = event.target.value;
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
