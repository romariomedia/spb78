import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { sharePreviewImage, sharePreviewPage } from './share-preview.js';

// Explicit routes prevent an accidentally copied maintenance script becoming an API.
export const API_ROUTES = Object.freeze([
  'create-payment', 'payment-webhook', 'verify-profile', 'delete-expired-profile', 'analytics-session',
  'send-password-reset', 'vk-login', 'feed-create', 'admin-request-otp',
  'admin-verify-otp', 'admin-session', 'admin-dashboard', 'admin-audit', 'admin-users', 'admin-user-lifecycle', 'admin-analytics', 'admin-sport-id-verification', 'admin-config', 'admin-push', 'admin-announcements', 'admin-partners', 'admin-official-trainings', 'admin-moderation', 'app-config', 'announcements', 'partners', 'report', 'admin-mutate-event', 'admin-event-results', 'admin-mutate-venue', 'admin-mutate-leisure', 'sportbuddy-mutation', 'sport-passport', 'sport-id-verification', 'public-sport-id', 'public-profiles', 'notifications', 'stories', 'leisure', 'venues'
]);

export async function createApiApp({ apiDir }) {
  // Import every required handler before making any health endpoint available.
  const handlers = [];
  for (const name of API_ROUTES) {
    let handler;
    try {
      handler = (await import(pathToFileURL(join(apiDir, `${name}.js`)).href)).default;
      if (typeof handler !== 'function') throw new Error('Missing default handler');
    } catch {
      // Import exceptions may contain credentials: report only the failing route.
      throw new Error(`Cannot load required API route: ${name}`);
    }
    handlers.push([name, handler]);
  }

  const app = express();
  app.disable('x-powered-by');
  // Preserve existing browser / Capacitor compatibility. Auth stays in handlers.
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  const health = (_req, res) => res.json({
    status: 'ok', api: 'sportbuddy', routesLoaded: handlers.length,
    release: process.env.SB_RELEASE_ID || 'development',
    ts: new Date().toISOString()
  });
  // These endpoints confirm process and route loading, not external service health.
  app.get('/health', health);
  app.get('/api/health', health);

  // Public social-preview routes must return HTML/image directly to crawlers before SPA fallback.
  app.get('/share/:kind/:id', sharePreviewPage);
  app.get('/share/image/:kind/:id', sharePreviewImage);

  for (const [name, handler] of handlers) {
    app.all(`/api/${name}`, async (req, res, next) => {
      try { await handler(req, res); } catch (error) { next(error); }
    });
  }
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400
      : error.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({ error: status === 400 ? 'Invalid JSON'
      : status === 413 ? 'Request body too large' : 'Internal server error' });
  });
  return app;
}
