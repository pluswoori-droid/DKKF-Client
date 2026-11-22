import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { timingSafeEqual, createPrivateKey, sign } from 'node:crypto';
const root = path.resolve(process.env.DKKF_UPDATE_DIR || 'backend/update-server/releases');
const admin = process.env.DKKF_ADMIN_TOKEN;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/announcement') {
      const provided = req.headers.authorization || '';
      const wanted = 'Bearer ' + admin;
      if (
        !admin ||
        provided.length !== wanted.length ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(wanted))
      ) {
        res.writeHead(401).end();
        return;
      }
      let data = '';
      for await (const chunk of req) {
        data += chunk;
        if (data.length > 10000) {
          res.writeHead(413).end();
          return;
        }
      }
      const message = JSON.parse(data);
      if (typeof message.message !== 'string' || message.message.length > 2000) {
        res.writeHead(400).end();
        return;
      }
      const keyFile = process.env.DKKF_SIGNING_KEY;
      if (!keyFile) {
        res.writeHead(503).end('Signing key required');
        return;
      }
      const payload = { message: message.message, published: new Date().toISOString() };
      const key = createPrivateKey(await fs.readFile(keyFile));
      if (key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 key required');
      const signature = sign(null, Buffer.from(JSON.stringify(payload)), key).toString('base64');
      for (const c of wss.clients)
        if (c.readyState === 1) c.send(JSON.stringify({ payload, signature }));
      res.writeHead(202).end();
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    if (!/^\/(stable\.json|beta\.json|DKKF-Client-[\d.]+-Setup\.exe)$/.test(url.pathname)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(root, url.pathname.slice(1));
    const bytes = await fs.readFile(file);
    res.setHeader(
      'Content-Type',
      file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
const wss = new WebSocketServer({ server, path: '/announcements', maxPayload: 10000 });
server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () =>
  console.log('DKKF update server listening on loopback; deploy behind HTTPS/WSS reverse proxy.'),
);
