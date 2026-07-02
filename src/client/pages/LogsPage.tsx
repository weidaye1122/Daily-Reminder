import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MessageLog } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';

export const LogsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [message, setMessage] = useState('');
  const reminderId = searchParams.get('reminderId') ?? '';

  const load = async () => {
    try {
      const path = reminderId
        ? `/api/logs?reminderId=${encodeURIComponent(reminderId)}`
        : '/api/logs';
      setLogs(await api.get<MessageLog[]>(path));
      setMessage('');
    } catch (reason) {
      setMessage(reason instanceof ApiError ? reason.message : '日志加载失败');
    }
  };

  useEffect(() => {
    void load();
  }, [reminderId]);

  return (
    <div className="page-stack">
      {message ? <Notice tone="error" message={message} /> : null}
      <section className="card">
        <div className="toolbar">
          <label className="field compact-field">
            <span>提醒 ID</span>
            <input
              value={reminderId}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (value) {
                  setSearchParams({ reminderId: value });
                } else {
                  setSearchParams({});
                }
              }}
              placeholder="留空查看全部"
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => void load()}>
            刷新
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>提醒事项</th>
                <th>渠道</th>
                <th>状态</th>
                <th>计划时间</th>
                <th>发送时间</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.reminderTitle}</td>
                    <td>{log.channel === 'bark' ? 'Bark' : '企业微信'}</td>
                    <td>
                      <span className={`pill pill-${log.status}`}>{log.status}</span>
                    </td>
                    <td>
                      {log.scheduledDate} {log.scheduledTime}
                    </td>
                    <td>{log.sendTime}</td>
                    <td className="log-detail-cell">
                      {log.error || log.response || log.message}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    暂无日志记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
