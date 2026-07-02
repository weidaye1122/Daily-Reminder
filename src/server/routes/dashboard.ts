import { Router } from 'express';
import { getDashboardSummary, getReminderDistribution } from '../services/dashboard';
import { listLogs } from '../services/logs';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', (_req, res) => {
  res.json(getDashboardSummary());
});

dashboardRouter.get('/recent-logs', (_req, res) => {
  res.json(listLogs(null, 10));
});

dashboardRouter.get('/reminder-distribution', (_req, res) => {
  res.json(getReminderDistribution());
});
