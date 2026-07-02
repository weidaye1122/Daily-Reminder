import { Router } from 'express';
import { listLogs } from '../services/logs';

export const logsRouter = Router();

logsRouter.get('/', (req, res) => {
  const reminderId = req.query.reminderId
    ? Number(req.query.reminderId)
    : null;
  res.json(listLogs(reminderId));
});

logsRouter.get('/:reminderId', (req, res) => {
  res.json(listLogs(Number(req.params.reminderId)));
});
