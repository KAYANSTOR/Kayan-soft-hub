import express, { type NextFunction, type Request, type Response } from 'express';
import { hubService, ServiceError, type SafeStaffUser } from '../services/hubService';
import type { UserRole } from '../../shared/types';

declare global {
  namespace Express {
    interface Request {
      currentUser?: SafeStaffUser | null;
    }
  }
}

const COOKIE_NAME = 'kayan_hub_session';

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

// Simple in-memory sliding rate limiter for sensitive auth & public lead endpoints
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxHits: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (hits.length >= maxHits) {
      res.status(429).json({ error: 'تم تجاوز الحد المسموح للطلبات. يرجى المحاولة بعد قليل.' });
      return;
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}

function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = cookies[COOKIE_NAME] || bearer;
  req.currentUser = hubService.getUserFromToken(token);
  next();
}

function handle(fn: (req: Request, res: Response) => unknown | Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const data = await fn(req, res);
      if (!res.headersSent) {
        res.json(data);
      }
    } catch (err) {
      if (err instanceof ServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('API Error:', err);
      res.status(500).json({ error: 'حدث خطأ داخلي في الخادم.' });
    }
  };
}

export function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));
  router.use(attachUser);

  // Public Website & SEO Routes
  router.get(
    '/public/site',
    handle(() => hubService.getPublicWebsiteData()),
  );

  router.get('/public/sitemap.xml', (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(hubService.getSitemapXml());
  });

  router.post(
    '/public/leads',
    rateLimit(20, 60_000),
    handle((req) => hubService.submitPublicLead(req.body)),
  );

  // Auth Routes
  router.post(
    '/auth/login',
    rateLimit(15, 60_000),
    handle((req, res) => {
      const { email, password } = req.body as { email: string; password: string };
      const { user, token } = hubService.authenticate(email || '', password || '');
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      return { user };
    }),
  );

  router.post(
    '/auth/quick-role',
    handle((req, res) => {
      const { role } = req.body as { role: UserRole };
      const { user, token } = hubService.quickSessionForRole(role);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      return { user };
    }),
  );

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  router.get(
    '/auth/me',
    handle((req) => {
      if (!req.currentUser) {
        return { user: null };
      }
      return { user: req.currentUser };
    }),
  );

  // Authenticated Bootstrap
  router.get(
    '/hub/bootstrap',
    handle((req) => {
      const user = hubService.requirePerm(req.currentUser ?? null, 'dashboard.view');
      return hubService.getBootstrapData(user);
    }),
  );

  // Products & Connectors
  router.post(
    '/products',
    handle((req) => hubService.createProduct(req.currentUser!, req.body)),
  );
  router.patch(
    '/products/:id',
    handle((req) => hubService.updateProduct(req.currentUser!, String(req.params.id), req.body)),
  );
  router.post(
    '/products/:id/sync',
    handle((req) => hubService.syncProduct(req.currentUser!, String(req.params.id), 'manual')),
  );

  // Subscribers & Subscriptions
  router.post(
    '/subscribers/:id/notes',
    handle((req) => hubService.addSubscriberNote(req.currentUser!, String(req.params.id), req.body?.note || '')),
  );
  router.post(
    '/subscriptions/:id/action',
    handle((req) =>
      hubService.performSubscriptionAction(
        req.currentUser!,
        String(req.params.id),
        req.body?.action,
        req.body?.reason,
      ),
    ),
  );

  // CMS
  router.post(
    '/cms/pages',
    handle((req) => hubService.createPage(req.currentUser!, req.body)),
  );
  router.put(
    '/cms/pages/:id/draft',
    handle((req) => hubService.savePageDraft(req.currentUser!, String(req.params.id), req.body)),
  );
  router.post(
    '/cms/pages/:id/publish',
    handle((req) => hubService.publishPage(req.currentUser!, String(req.params.id), req.body?.summary)),
  );
  router.post(
    '/cms/pages/:id/restore',
    handle((req) => hubService.restorePageVersion(req.currentUser!, String(req.params.id), Number(req.body?.versionNumber))),
  );

  router.post(
    '/cms/articles',
    handle((req) => hubService.saveArticle(req.currentUser!, req.body)),
  );
  router.delete(
    '/cms/articles/:id',
    handle((req) => hubService.deleteArticle(req.currentUser!, String(req.params.id))),
  );

  router.post(
    '/cms/projects',
    handle((req) => hubService.saveProject(req.currentUser!, req.body)),
  );
  router.post(
    '/cms/services',
    handle((req) => hubService.saveService(req.currentUser!, req.body)),
  );

  router.put(
    '/cms/settings',
    handle((req) => hubService.updateWebsiteSettings(req.currentUser!, req.body)),
  );
  router.post(
    '/cms/redirects',
    handle((req) => hubService.addRedirect(req.currentUser!, req.body)),
  );

  // Media
  router.post(
    '/media',
    handle((req) => hubService.addMediaAsset(req.currentUser!, req.body)),
  );
  router.delete(
    '/media/:id',
    handle((req) => hubService.deleteMediaAsset(req.currentUser!, String(req.params.id))),
  );

  // CRM
  router.patch(
    '/crm/leads/:id',
    handle((req) => hubService.updateLead(req.currentUser!, String(req.params.id), req.body)),
  );
  router.post(
    '/crm/tasks',
    handle((req) => hubService.addCrmTask(req.currentUser!, req.body)),
  );
  router.post(
    '/crm/tasks/:id/toggle',
    handle((req) => hubService.toggleCrmTask(req.currentUser!, String(req.params.id))),
  );

  // Users & RBAC
  router.post(
    '/users',
    handle((req) => hubService.createUser(req.currentUser!, req.body)),
  );
  router.patch(
    '/users/:id',
    handle((req) => hubService.updateUser(req.currentUser!, String(req.params.id), req.body)),
  );

  // Integrations, Webhooks & Backups
  router.post(
    '/integrations/webhook-sample',
    handle((req) => {
      hubService.requirePerm(req.currentUser ?? null, 'integrations.manage');
      return hubService.generateSampleWebhookHeaders(
        req.body?.productId || 'prod-kayan-ai',
        req.body?.eventId || `evt_${Date.now()}`,
        req.body?.payload || '{"event":"invoice.paid"}',
      );
    }),
  );
  router.post(
    '/integrations/webhook-verify',
    handle((req) => hubService.processSignedWebhook(req.body)),
  );
  router.post(
    '/backups',
    handle((req) => hubService.createBackup(req.currentUser!, req.body?.reason)),
  );
  router.get(
    '/backups/:id/download',
    handle((req, res) => {
      const payload = hubService.downloadBackup(req.currentUser!, String(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.json"`);
      res.json(payload);
    }),
  );
  router.post(
    '/backups/:id/restore',
    handle((req) => hubService.restoreBackup(req.currentUser!, String(req.params.id))),
  );

  // Org Settings
  router.put(
    '/org/settings',
    handle((req) => hubService.updateOrgSettings(req.currentUser!, req.body)),
  );

  return router;
}
