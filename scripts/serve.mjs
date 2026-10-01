import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const html = new URL('../index.html', import.meta.url);
const port = Number(process.env.PORT || 4173);
const server = createServer(async (request, response) => {
  if (!['/', '/index.html'].includes((request.url || '/').split('?')[0])) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(html));
  } catch {
    response.writeHead(500).end('Unable to load index.html');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
