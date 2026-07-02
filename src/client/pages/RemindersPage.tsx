import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  LunarDateValidation,
  ReminderInput,
  ReminderListItem,
  SystemSettings
} from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';
import { Drawer } from '../components/Drawer';
import { TimePicker } from '../components/TimePicker';

const lunarMonths = [
  { value: 1, label: '正月' },
  { value: 2, label: '二月' },
  { value: 3, label: '三月' },
  { value: 4, label: '四月' },
  { value: 5, label: '五月' },
  { value: 6, label: '六月' },
  { value: 7, label: '七月' },
  { value: 8, label: '八月' },
  { value: 9, label: '九月' },
  { value: 10, label: '十月' },
  { value: 11, label: '冬月' },
  { value: 12, label: '腊月' }
];

const lunarDays = Array.from({ length: 30 }, (_, index) => index + 1);

const baseSystemSettings: SystemSettings = {
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

const getLocalDateInputValue = () => {
  const current = new Date();
  const offset = current.getTimezoneOffset() * 60_000;
  return new Date(current.getTime() - offset).toISOString().slice(0, 10);
};

const repeatTypeLabels: Record<ReminderInput['repeatType'], string> = {
  yearly: '每年',
  monthly: '每月',
  weekly: '每周',
  once: '一次性'
};

const weekdayOptions = [
  { value: 1, label: '星期一' },
  { value: 2, label: '星期二' },
  { value: 3, label: '星期三' },
  { value: 4, label: '星期四' },
  { value: 5, label: '星期五' },
  { value: 6, label: '星期六' },
  { value: 0, label: '星期天' }
];

const weekdayAnchorDates: Record<number, string> = {
  1: '2024-01-01',
  2: '2024-01-02',
  3: '2024-01-03',
  4: '2024-01-04',
  5: '2024-01-05',
  6: '2024-01-06',
  0: '2024-01-07'
};

const channelLabels: Record<ReminderInput['channels'][number], string> = {
  bark: 'Bark',
  wecom: '企业微信'
};

const getWeekdayFromSolarDate = (solarDate: string | null) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate ?? '');
  if (!match) {
    return 1;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
};

const normalizeTimesPerDay = (value: string | number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(6, Math.max(1, Math.trunc(parsed)));
};

const lunarDayLabels = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十'
];

const lunarDayOptions = lunarDays.map((day) => ({
  value: day,
  label: lunarDayLabels[day]
}));

interface PickerOption {
  value: number;
  label: string;
}

interface InlinePickerProps {
  value: number;
  options: PickerOption[];
  onChange: (value: number) => void;
}

const InlinePicker = ({ value, options, onChange }: InlinePickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={`inline-picker${open ? ' inline-picker-open' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="inline-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className="inline-picker-arrow">⌄</span>
      </button>
      {open ? (
        <div className="inline-picker-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'active' : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const createDefaultForm = (settings: SystemSettings): ReminderInput => ({
  title: '',
  dateType: 'solar',
  repeatType: 'yearly',
  solarDate: getLocalDateInputValue(),
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  advanceDays: settings.defaultAdvanceDays,
  timesPerDay: settings.defaultTimesPerDay,
  remindTimes: settings.defaultRemindTimes,
  channels: ['bark', 'wecom'],
  remark: '',
  enabled: true
});

const toForm = (reminder: ReminderListItem): ReminderInput => ({
  title: reminder.title,
  dateType: reminder.dateType,
  repeatType: reminder.repeatType,
  solarDate: reminder.solarDate,
  lunarMonth: reminder.lunarMonth,
  lunarDay: reminder.lunarDay,
  isLeapMonth: reminder.isLeapMonth,
  advanceDays: reminder.advanceDays,
  timesPerDay: reminder.timesPerDay,
  remindTimes: reminder.remindTimes,
  channels: reminder.channels,
  remark: reminder.remark,
  enabled: reminder.enabled
});

export const RemindersPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReminderListItem[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(baseSystemSettings);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReminderInput>(createDefaultForm(baseSystemSettings));
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [lunarPreview, setLunarPreview] = useState<LunarDateValidation | null>(null);
  const [lunarPreviewError, setLunarPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [reminders, settings] = await Promise.all([
        api.get<ReminderListItem[]>('/api/reminders'),
        api.get<SystemSettings>('/api/settings/system')
      ]);
      setItems(reminders);
      setSystemSettings(settings);
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '提醒列表加载失败'
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (form.dateType !== 'lunar') {
      setLunarPreview(null);
      setLunarPreviewError('');
      return;
    }

    if (form.repeatType === 'monthly') {
      setLunarPreview(null);
      setLunarPreviewError('');
      return;
    }

    let active = true;
    void api
      .post<LunarDateValidation>('/api/reminders/lunar-preview', {
        lunarMonth: form.lunarMonth ?? 1,
        lunarDay: form.lunarDay ?? 1,
        isLeapMonth: form.isLeapMonth
      })
      .then((result) => {
        if (!active) {
          return;
        }
        setLunarPreview(result);
        setLunarPreviewError('');
      })
      .catch((reason) => {
        if (!active) {
          return;
        }
        setLunarPreview(null);
        setLunarPreviewError(
          reason instanceof ApiError ? reason.message : '农历日期换算失败'
        );
      });

    return () => {
      active = false;
    };
  }, [
    form.dateType,
    form.repeatType,
    form.lunarMonth,
    form.lunarDay,
    form.isLeapMonth
  ]);

  const openNew = () => {
    setEditingId(null);
    setForm(createDefaultForm(systemSettings));
    setDrawerOpen(true);
  };

  const openEdit = (item: ReminderListItem) => {
    setEditingId(item.id);
    setForm(toForm(item));
    setDrawerOpen(true);
  };

  const resizeTimes = (value: string | number) => {
    const count = normalizeTimesPerDay(value);
    setForm((current) => {
      const nextTimes = [...current.remindTimes];
      while (nextTimes.length < count) {
        nextTimes.push('09:00');
      }
      return {
        ...current,
        timesPerDay: count,
        remindTimes: nextTimes.slice(0, count)
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await api.put(`/api/reminders/${editingId}`, form);
      } else {
        await api.post('/api/reminders', form);
      }
      await load();
      setDrawerOpen(false);
      setMessage({ tone: 'success', text: '提醒事项已保存。' });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '保存失败'
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (item: ReminderListItem) => {
    try {
      await api.patch(`/api/reminders/${item.id}/enabled`, { enabled: !item.enabled });
      await load();
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '状态更新失败'
      });
    }
  };

  const remove = async (item: ReminderListItem) => {
    if (!window.confirm(`确定删除提醒「${item.title}」吗？`)) {
      return;
    }
    try {
      await api.delete(`/api/reminders/${item.id}`);
      await load();
      setMessage({ tone: 'success', text: '提醒事项已删除。' });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '删除失败'
      });
    }
  };

  const testSend = async (item: ReminderListItem) => {
    try {
      await api.post(`/api/reminders/${item.id}/test`);
      setMessage({ tone: 'success', text: `已触发「${item.title}」测试发送。` });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '测试发送失败'
      });
    }
  };

  const repeatOptions = useMemo(
    () => [
      { value: 'yearly', label: '每年', disabled: false },
      { value: 'monthly', label: '每月', disabled: false },
      { value: 'weekly', label: '每周', disabled: false },
      { value: 'once', label: '一次性', disabled: false }
    ],
    []
  );

  const monthlyLunarHint =
    form.dateType === 'lunar' && form.repeatType === 'monthly'
      ? `每个农历月的${lunarDayLabels[form.lunarDay ?? 1]}提醒；如果某个月没有这一天，会自动跳过。`
      : '';

  return (
    <div className="page-stack">
      {message ? <Notice tone={message.tone} message={message.text} /> : null}

      <section className="card">
        <div className="card-header">
          <div className="section-heading">
            <h2>提醒列表</h2>
            <p>集中查看下一次提醒、推送渠道和启用状态。</p>
          </div>
          <button type="button" className="primary-button" onClick={openNew}>
            新建提醒
          </button>
        </div>

        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>下一次提醒</th>
                <th>日期类型</th>
                <th>重复方式</th>
                <th>时间点</th>
                <th>渠道</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>
                      {item.preview ? (
                        <>
                          <div>
                            {item.preview.nextRemindDate} {item.preview.nextRemindTime}
                          </div>
                          <small>目标日期：{item.preview.displayLabel}</small>
                        </>
                      ) : (
                        <span className="muted">{item.previewError ?? '暂无可计算日期'}</span>
                      )}
                    </td>
                    <td>{item.dateType === 'solar' ? '公历' : '农历'}</td>
                    <td>{repeatTypeLabels[item.repeatType]}</td>
                    <td>{item.remindTimes.join('、')}</td>
                    <td>{item.channels.map((channel) => channelLabels[channel]).join(' / ')}</td>
                    <td>
                      <span className={`pill ${item.enabled ? 'pill-success' : 'pill-muted'}`}>
                        {item.enabled ? '启用中' : '已停用'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => openEdit(item)}>
                          编辑
                        </button>
                        <button type="button" className="ghost-button" onClick={() => void toggleEnabled(item)}>
                          {item.enabled ? '停用' : '启用'}
                        </button>
                        <button type="button" className="ghost-button" onClick={() => void testSend(item)}>
                          测试发送
                        </button>
                        <button type="button" className="ghost-button" onClick={() => navigate(`/logs?reminderId=${item.id}`)}>
                          查看日志
                        </button>
                        <button type="button" className="danger-button" onClick={() => void remove(item)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    还没有提醒事项，先新建一条吧。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-cards">
          {items.length ? (
            items.map((item) => (
              <article key={item.id} className="mobile-card">
                <div className="mobile-card-head">
                  <strong>{item.title}</strong>
                  <span className={`pill ${item.enabled ? 'pill-success' : 'pill-muted'}`}>
                    {item.enabled ? '启用中' : '已停用'}
                  </span>
                </div>
                {item.preview ? (
                  <>
                    <p>下次提醒：{item.preview.nextRemindDate} {item.preview.nextRemindTime}</p>
                    <p>目标日期：{item.preview.displayLabel}</p>
                  </>
                ) : (
                  <p>{item.previewError ?? '暂无可计算日期'}</p>
                )}
                <p>
                  日期类型：{item.dateType === 'solar' ? '公历' : '农历'} · 重复方式：{repeatTypeLabels[item.repeatType]}
                </p>
                <p>时间：{item.remindTimes.join('、')}</p>
                <p>渠道：{item.channels.map((channel) => channelLabels[channel]).join(' / ')}</p>
                <div className="table-actions">
                  <button type="button" className="ghost-button" onClick={() => openEdit(item)}>
                    编辑
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void toggleEnabled(item)}>
                    {item.enabled ? '停用' : '启用'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void testSend(item)}>
                    测试发送
                  </button>
                  <button type="button" className="ghost-button" onClick={() => navigate(`/logs?reminderId=${item.id}`)}>
                    查看日志
                  </button>
                  <button type="button" className="danger-button" onClick={() => void remove(item)}>
                    删除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">还没有提醒事项，先新建一条吧。</div>
          )}
        </div>
      </section>

      <Drawer open={drawerOpen} title={editingId ? '编辑提醒' : '新建提醒'} onClose={() => setDrawerOpen(false)}>
        <div className="form-grid">
          <label className="field">
            <span>提醒名称</span>
            <input
              value={form.title}
              onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
            />
          </label>
          {form.repeatType !== 'weekly' ? (
            <div className="field">
              <span>日期类型</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={form.dateType === 'solar' ? 'active' : ''}
                  onClick={() =>
                    setForm((value) => ({
                      ...value,
                      dateType: 'solar'
                    }))
                  }
                >
                  公历
                </button>
                <button
                  type="button"
                  className={form.dateType === 'lunar' ? 'active' : ''}
                  onClick={() =>
                    setForm((value) => ({
                      ...value,
                      dateType: 'lunar'
                    }))
                  }
                >
                  农历
                </button>
              </div>
            </div>
          ) : null}
          <div className="field">
            <span>重复方式</span>
            <div className="segmented-control segmented-control-4">
              {repeatOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={form.repeatType === option.value ? 'active' : ''}
                  disabled={option.disabled}
                  onClick={() => {
                    const repeatType = option.value as ReminderInput['repeatType'];
                    setForm((value) => ({
                      ...value,
                      dateType: repeatType === 'weekly' ? 'solar' : value.dateType,
                      repeatType,
                      solarDate:
                        repeatType === 'weekly'
                          ? weekdayAnchorDates[getWeekdayFromSolarDate(value.solarDate)]
                          : value.solarDate
                    }));
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {form.repeatType === 'weekly' ? (
            <div className="field field-span-2">
              <span>每周提醒日</span>
              <InlinePicker
                value={getWeekdayFromSolarDate(form.solarDate)}
                options={weekdayOptions}
                onChange={(weekday) =>
                  setForm((value) => ({
                    ...value,
                    dateType: 'solar',
                    solarDate: weekdayAnchorDates[weekday]
                  }))
                }
              />
            </div>
          ) : form.dateType === 'solar' ? (
            <label className="field field-span-2">
              <span>日期</span>
              <input
                type="date"
                value={form.solarDate ?? ''}
                onChange={(event) =>
                  setForm((value) => ({ ...value, solarDate: event.target.value }))
                }
              />
            </label>
          ) : (
            <>
              {form.repeatType !== 'monthly' ? (
                <div className="field">
                  <span>农历月份</span>
                  <InlinePicker
                    value={form.lunarMonth ?? 1}
                    options={lunarMonths}
                    onChange={(month) =>
                      setForm((value) => ({
                        ...value,
                        lunarMonth: month
                      }))
                    }
                  />
                </div>
              ) : null}
              <div className="field">
                <span>农历日期</span>
                <InlinePicker
                  value={form.lunarDay ?? 1}
                  options={lunarDayOptions}
                  onChange={(day) =>
                    setForm((value) => ({
                      ...value,
                      lunarDay: day
                    }))
                  }
                />
              </div>
              {form.repeatType !== 'monthly' ? (
                <label className="checkbox-row field-span-2">
                  <input
                    type="checkbox"
                    checked={form.isLeapMonth}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, isLeapMonth: event.target.checked }))
                    }
                  />
                  <span>这是闰月</span>
                </label>
              ) : null}
              {monthlyLunarHint ? (
                <div className="tip-box field-span-2">{monthlyLunarHint}</div>
              ) : null}
              {lunarPreview ? (
                <div className="tip-box field-span-2">{lunarPreview.message}</div>
              ) : null}
              {lunarPreviewError ? (
                <div className="notice notice-error field-span-2">{lunarPreviewError}</div>
              ) : null}
            </>
          )}

          <label className="field">
            <span>提醒提前天数</span>
            <select
              value={form.advanceDays}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  advanceDays: Number(event.target.value)
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
            <span>每日提醒次数</span>
            <select
              value={form.timesPerDay}
              onChange={(event) => resizeTimes(event.target.value)}
            >
              {timesPerDayOptions.map((count) => (
                <option key={count} value={count}>
                  {count} 次
                </option>
              ))}
            </select>
          </label>
          <div className="field field-span-2">
            <span>提醒时间点</span>
            <div className="inline-grid">
              {form.remindTimes.map((time, index) => (
                <TimePicker
                  key={`remind-time-${index}`}
                  value={time}
                  onChange={(nextTime) =>
                    setForm((current) => {
                      const nextTimes = [...current.remindTimes];
                      nextTimes[index] = nextTime;
                      return { ...current, remindTimes: nextTimes };
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="field field-span-2">
            <span>通知渠道</span>
            <div className="choice-row">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.channels.includes('bark')}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      channels: event.target.checked
                        ? Array.from(new Set([...current.channels, 'bark']))
                        : current.channels.filter((channel) => channel !== 'bark')
                    }))
                  }
                />
                <span>Bark</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.channels.includes('wecom')}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      channels: event.target.checked
                        ? Array.from(new Set([...current.channels, 'wecom']))
                        : current.channels.filter((channel) => channel !== 'wecom')
                    }))
                  }
                />
                <span>企业微信</span>
              </label>
            </div>
          </div>
          <label className="field field-span-2">
            <span>备注</span>
            <textarea
              rows={4}
              value={form.remark}
              onChange={(event) => setForm((value) => ({ ...value, remark: event.target.value }))}
            />
          </label>
          <label className="checkbox-row field-span-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((value) => ({ ...value, enabled: event.target.checked }))
              }
            />
            <span>保存后立即启用</span>
          </label>
          <div className="actions-row">
            <button type="button" className="secondary-button" onClick={() => setDrawerOpen(false)}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>
              {saving ? '保存中...' : editingId ? '保存修改' : '创建提醒'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
