/**
 * Loopback proxy onto the console running inside WSL.
 *
 * Next's dev server refuses browser requests whose Host is not loopback, so
 * reaching the WSL console at the WSL IP returns 403 for every fetch the page
 * makes and it never gets past its loading shell. This forwards
 * 127.0.0.1:<listen> to the WSL server and rewrites Host to a loopback value,
 * which is all the dev-origin check wants. WebSocket upgrades are forwarded too,
 * because the dev client will not finish hydrating without its HMR socket.
 *
 * Capture-time only — nothing in the film depends on this at render time.
 *
 *   node scripts/wsl-proxy.mjs <wsl-ip> [targetPort=3000] [listenPort=3200]
 */
import http from 'node:http';
import net from 'node:net';

const TARGET_HOST = process.argv[2];
const TARGET_PORT = Number(process.argv[3] ?? 3000);
const LISTEN = Number(process.argv[4] ?? 3200);

if (!TARGET_HOST) {
  console.error('usage: node scripts/wsl-proxy.mjs <wsl-ip> [targetPort] [listenPort]');
  process.exit(2);
}

const hostHeader = `localhost:${TARGET_PORT}`;
const localOrigin = `http://localhost:${TARGET_PORT}`;

/**
 * Next's dev-origin check reads Origin and Referer as well as Host, so all three
 * have to look like the loopback server the page is really being served by.
 */
const rewrite = (headers) => {
  const out = { ...headers, host: hostHeader };
  if (out.origin) out.origin = localOrigin;
  if (out.referer) out.referer = String(out.referer).replace(/^https?:\/\/[^/]+/, localOrigin);
  return out;
};

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: rewrite(req.headers),
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    res.writeHead(502);
    res.end(String(err));
  });
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const up = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = rewrite(req.headers);
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(LISTEN, '127.0.0.1', () => {
  console.log(`proxy 127.0.0.1:${LISTEN} -> ${TARGET_HOST}:${TARGET_PORT}`);
});
