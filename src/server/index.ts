import { createServer } from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { initializeDatabase } from './db';
import { ensureDefaultAdmin } from './services/auth';
import { startScheduler } from './scheduler';

initializeDatabase();
ensureDefaultAdmin();

const app = createApp();
const server = createServer(app);

server.listen(config.port, () => {
  console.log(`日程提醒助手已启动：http://localhost:${config.port}`);
});

startScheduler();
