import { affectsPublicProfiles, invalidatePublicProfiles } from './public-profile-cache.js';
import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { sharePreviewImage, sharePreviewPage } from './share-preview.js';

// Explicit routes prevent an accidentally copied maintenance script becoming an API.
export const API_ROUTES = Object.freeze([
  'onboarding-assistant', 'create-payment', 'create-business-payment', 'payment-webhook', 'business-billing', 'admin-billing', 'verify-profile', 'delete-expired-profile', 'analytics-session',
  'send-password-reset', 'vk-login', 'feed-list', 'activities-list', 'feed-create', 'admin-request-otp',
  'admin-verify-otp', 'admin-session', 'admin-dashboard', 'admin-audit', 'admin-users', 'admin-user-lifecycle', 'admin-analytics', 'admin-sport-id-verification', 'admin-config', 'admin-push', 'admin-announcements', 'admin-partners', 'admin-official-trainings', 'admin-moderation', 'app-config', 'announcements', 'partners', 'report', 'admin-mutate-event', 'admin-event-results', 'admin-mutate-venue', 'admin-mutate-leisure', 'sportbuddy-mutation', 'sport-passport', 'sport-id-verification', 'public-sport-id', 'public-profiles', 'notifications', 'stories', 'guest-catalog', 'leisure', 'massage', 'admin-massage', 'venues'
]);

export async function createApiApp({ apiDir, enforceOperations }) {
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
      if (affectsPublicProfiles(name, req.body)) {
        const json = res.json.bind(res);
        res.json = body => {
          if (res.statusCode >= 200 && res.statusCode < 300) invalidatePublicProfiles();
          return json(body);
        };
      }
      try { if(enforceOperations && await enforceOperations(name,req,res))return; await handler(req, res); } catch (error) { next(error); }
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
