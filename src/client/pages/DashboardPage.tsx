import { useEffect, useState } from 'react';
import type { DashboardDistributionItem, DashboardSummary, MessageLog } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';
import { StatCard } from '../components/StatCard';

export const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<MessageLog[]>([]);
  const [distribution, setDistribution] = useState<DashboardDistributionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartWidth = 720;
  const chartHeight = 320;
  const chartPadding = {
    top: 30,
    right: 28,
    bottom: 50,
    left: 42
  };
  const chartSeries = [
    { key: 'solar', label: '公历月份', color: '#1971d4' },
    { key: 'lunar', label: '阴历月份', color: '#14a37f' }
  ] as const;
  const hasDistributionData = distribution.some((item) => item.solar > 0 || item.lunar > 0);
  const maxDistributionValue = Math.max(
    1,
    ...distribution.flatMap((item) => [item.solar, item.lunar])
  );
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const getChartPoint = (
    item: DashboardDistributionItem,
    index: number,
    value: number
  ) => {
    const x =
      distribution.length === 1
        ? chartPadding.left + chartInnerWidth / 2
        : chartPadding.left + (chartInnerWidth * index) / (distribution.length - 1);
    const y =
      chartPadding.top +
      chartInnerHeight -
      (value / maxDistributionValue) * chartInnerHeight;
    return { ...item, value, x, y };
  };
  const seriesPoints = chartSeries.map((series) => ({
    ...series,
    points: distribution.map((item, index) =>
      getChartPoint(item, index, item[series.key])
    )
  }));
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: chartPadding.top + chartInnerHeight * ratio,
    value: Math.round(maxDistributionValue * (1 - ratio))
  }));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, recentData, distributionData] = await Promise.all([
        api.get<DashboardSummary>('/api/dashboard/summary'),
        api.get<MessageLog[]>('/api/dashboard/recent-logs'),
        api.get<DashboardDistributionItem[]>('/api/dashboard/reminder-distribution')
      ]);
      setSummary(summaryData);
      setRecentLogs(recentData);
      setDistribution(distributionData);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : '仪表盘加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading && !summary) {
    return <div className="card">正在加载仪表盘...</div>;
  }

  return (
    <div className="page-stack">
      {error ? <Notice tone="error" message={error} /> : null}
      <section className="stats-grid">
        <StatCard label="提醒事项总数" value={summary?.totalReminders ?? 0} />
        <StatCard label="今日待提醒" value={summary?.todayDueCount ?? 0} />
        <StatCard label="已启用渠道" value={summary?.enabledChannelCount ?? 0} />
        <StatCard label="本周提醒次数" value={summary?.weekReminderCount ?? 0} />
      </section>

      <section className="two-column">
        <div className="card">
          <div className="section-heading">
            <h2>最近要提醒的事项</h2>
            <p>这里优先展示最先进入提醒窗口的项目。</p>
          </div>
          <div className="list-stack">
            {summary?.upcomingReminders.length ? (
              summary.upcomingReminders.map((item) => (
                <article key={item.id} className="list-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      下次提醒 {item.nextRemindDate} {item.nextRemindTime}，目标日期 {item.occurrenceDate}
                    </p>
                  </div>
                  <span className="pill">
                    {item.daysUntilNextRemind === 0 ? '今天' : `${item.daysUntilNextRemind} 天后`}
                  </span>
                </article>
              ))
            ) : (
              <div className="empty-state">还没有可展示的提醒事项。</div>
            )}
          </div>
        </div>

        <div className="card distribution-card">
          <div className="section-heading">
            <h2>提醒分布</h2>
            <p>按 1-12 月对比公历与阴历提醒数量。</p>
          </div>
          {hasDistributionData ? (
            <div className="distribution-chart">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="公历月份和阴历月份提醒分布折线图"
              >
                {gridLines.map((line) => (
                  <g key={line.y}>
                    <line
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={line.y}
                      y2={line.y}
                    />
                    <text x={chartPadding.left - 10} y={line.y + 4}>
                      {line.value}
                    </text>
                  </g>
                ))}
                {seriesPoints.map((series) => (
                  <polyline
                    key={series.key}
                    className={`distribution-line distribution-line-${series.key}`}
                    points={series.points
                      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
                      .join(' ')}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {seriesPoints.map((series) =>
                  series.points.map((point) => (
                    <g
                      key={`${series.key}-${point.label}`}
                      className={`distribution-point distribution-point-${series.key}`}
                    >
                      <circle cx={point.x} cy={point.y} r="5.5" vectorEffect="non-scaling-stroke" />
                      {point.value > 0 ? (
                        <text x={point.x} y={point.y - 12}>
                          {point.value}
                        </text>
                      ) : null}
                    </g>
                  ))
                )}
                {distribution.map((point, index) => (
                  <text
                    key={`${point.label}-label`}
                    className="distribution-x-label"
                    x={
                      distribution.length === 1
                        ? chartPadding.left + chartInnerWidth / 2
                        : chartPadding.left + (chartInnerWidth * index) / (distribution.length - 1)
                    }
                    y={chartHeight - 16}
                  >
                    {point.label}
                  </text>
                ))}
              </svg>
              <div className="distribution-legend">
                {chartSeries.map((series) => (
                  <span key={series.key}>
                    <i className={`distribution-dot distribution-dot-${series.key}`} />
                    {series.label} · {distribution.reduce((sum, item) => sum + item[series.key], 0)} 项
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="distribution-chart-empty">
              <div className="empty-state">暂无统计数据。</div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <h2>最近消息日志</h2>
          <p>便于快速确认推送是否正常。</p>
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
              </tr>
            </thead>
            <tbody>
              {recentLogs.length ? (
                recentLogs.map((log) => (
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    还没有消息日志。
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
