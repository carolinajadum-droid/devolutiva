const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, cors);
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/api') {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Chave de API inválida' } }));
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const proxyReq = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': body.length
        },
        timeout: 120000
      }, (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', c => resChunks.push(c));
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { ...cors, 'Content-Type': 'application/json' });
          res.end(Buffer.concat(resChunks));
        });
      });
      proxyReq.on('error', (err) => {
        res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      });
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404, cors);
  res.end('Not found');
});

server.listen(PORT, () => console.log('Servidor rodando na porta', PORT));
