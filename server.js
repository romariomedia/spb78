import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiApp } from './server/app.js';

const root = dirname(fileURLToPath(import.meta.url));
// PM2's working directory must not determine which environment file is loaded.
dotenv.config({ path: join(root, '.env'), quiet: true });

try {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const app = await createApiApp({ apiDir: join(root, 'api') });
  const {startNotificationWorker}=await import('./server/notification-worker.js');
  const stopNotifications=startNotificationWorker();
  const {startStoryWorker}=await import('./server/story-worker.js');
  const stopStories=startStoryWorker();
  const {stopNotificationStreams}=await import('./api/notifications.js');
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`SportBuddy API listening on 127.0.0.1:${port}`);
  });
  server.on('error', () => {
    console.error('API listener failed; check port availability');
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    stopNotifications();
    stopStories();
    stopNotificationStreams();
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close(() => { clearTimeout(deadline); process.exit(0); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
