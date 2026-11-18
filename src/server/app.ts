import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApiRouter } from './controllers/apiRouter.js';

export function createApp() {
  const app = express();
  app.use('/api', createApiRouter());

  if (process.env.VERCEL) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
      return res.status(404).send('Build output not found.');
    });
  }

  return app;
}
