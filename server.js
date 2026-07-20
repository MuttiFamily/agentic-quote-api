import http from 'http';
import { handler } from './api/generate-quote.js';

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/generate-quote') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const event = {
          httpMethod: 'POST',
          headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])),
          body
        };
        const result = await handler(event);
        res.writeHead(result.statusCode, result.headers);
        res.end(Buffer.from(result.body, (result.isBase64Encoded ? 'base64' : 'utf8')));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'handler failed' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Quote API listening on :${port}`);
});
