import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env.PORT ?? 8081);
const root = resolve('dist');
const idleTimeoutMs = parseIdleTimeout(process.argv.slice(2));
let idleTimer = null;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer((request, response) => {
  resetIdleTimer();

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(join(root, requestedPath));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    filePath = join(root, 'index.html');
  } else if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
  resetIdleTimer();
});

function shutdown() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  server.closeAllConnections?.();
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, 1_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function resetIdleTimer() {
  if (!idleTimeoutMs) {
    return;
  }

  if (idleTimer) {
    clearTimeout(idleTimer);
  }

  idleTimer = setTimeout(shutdown, idleTimeoutMs);
  idleTimer.unref();
}

function parseIdleTimeout(args) {
  const rawArg = args.find((arg) => arg.startsWith('--idle-timeout='));
  if (!rawArg) {
    return null;
  }

  const value = Number(rawArg.slice('--idle-timeout='.length));
  return Number.isFinite(value) && value > 0 ? value : null;
}
