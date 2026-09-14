import http from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'styles.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = path === '/' || path === '/-3/' ? 'index.html' : path.replace(/^\/(?:-3\/)?/, '');
  if (!Object.hasOwn(types, file)) { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', types[file] + '; charset=utf-8'); res.end(await readFile(new URL('../' + file, import.meta.url))); }
  catch { res.writeHead(500); res.end('Falha ao abrir arquivo.'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/-3/'));
process.on('SIGTERM', () => server.close());
