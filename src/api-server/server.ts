import { createServer } from 'node:http';

import { MetaOutput } from '@/entrypoint/utils/meta';
import { makeProviders, makeStandardFetcher, targets } from '@/index';

import { getMovieMediaFromTmdb, getShowMediaFromTmdb } from './tmdb';

const port = Number(process.env.PORT ?? 3000);

const providers = makeProviders({
  fetcher: makeStandardFetcher(fetch),
  target: targets.ANY,
  externalSources: 'all',
});

const sourceMeta = providers.listSources();

function jsonResponse(data: unknown, statusCode = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function getBaseUrl(req: Request) {
  return new URL(req.url).origin;
}

function appCss() {
  return `
  :root {
    color-scheme: dark;
    --bg: #0f172a;
    --card: #1e293b;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --accent: #22d3ee;
    --ok: #22c55e;
    --bad: #ef4444;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: radial-gradient(circle at top, #1e293b 0%, #0f172a 45%);
    color: var(--text);
  }
  .container { max-width: 1060px; margin: 0 auto; padding: 32px 16px 60px; }
  h1, h2, h3 { margin: 0 0 12px; }
  h1 { font-size: 2.1rem; }
  .card {
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 14px;
    padding: 18px;
    margin-top: 16px;
    backdrop-filter: blur(5px);
  }
  .muted { color: var(--muted); }
  code {
    background: rgba(15, 23, 42, 0.75);
    border-radius: 8px;
    padding: 2px 8px;
  }
  pre {
    background: rgba(15, 23, 42, 0.75);
    border-radius: 12px;
    overflow: auto;
    padding: 14px;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
  th, td { text-align: left; padding: 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); }
  .pill { padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; display: inline-block; }
  .pill.ok { background: rgba(34, 197, 94, 0.18); color: #86efac; }
  .pill.bad { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
  a { color: var(--accent); }
  button {
    border: 0;
    border-radius: 10px;
    background: linear-gradient(90deg, #06b6d4, #3b82f6);
    color: white;
    font-weight: 700;
    padding: 10px 14px;
    cursor: pointer;
  }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
`;
}

function renderHome(baseUrl: string) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>P-Stream Providers API</title><style>${appCss()}</style></head>
<body>
  <main class="container">
    <h1>P-Stream Providers API Server</h1>
    <p class="muted">HTTP API wrapper for the providers library. Resolve streams from a TMDB id for movies and TV shows.</p>

    <section class="card">
      <h2>Quick start</h2>
      <p>Set <code>TMDB_API_KEY</code> (or <code>TMDB_ACCESS_TOKEN</code>) and run:</p>
      <pre>pnpm start:api</pre>
      <p>Default port: <code>${port}</code>. Override with <code>PORT</code>.</p>
    </section>

    <section class="card">
      <h2>Endpoints</h2>
      <ul>
        <li><code>GET /api/providers</code> - list all source providers available in this process.</li>
        <li><code>GET /api/stream/movie/:tmdbId</code> - run all providers for a movie and return the first successful result.</li>
        <li><code>GET /api/stream/tv/:tmdbId/:season/:episode</code> - run all providers for a TV episode and return the first successful result.</li>
        <li><code>GET /api/source/:sourceId/movie/:tmdbId</code> - test a specific source provider for a movie.</li>
        <li><code>GET /api/source/:sourceId/tv/:tmdbId/:season/:episode</code> - test a specific source provider for TV.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Examples</h2>
      <pre>curl ${baseUrl}/api/stream/movie/299536
curl ${baseUrl}/api/stream/tv/79744/1/1
curl ${baseUrl}/api/source/vidsrcvip/movie/299536</pre>
      <p>Interactive provider tester: <a href="/test">${baseUrl}/test</a>.</p>
    </section>
  </main>
</body>
</html>`;
}

function renderTestPage() {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Provider Test Dashboard</title><style>${appCss()}</style></head>
<body>
  <main class="container">
    <h1>Provider Test Dashboard</h1>
    <p class="muted">Movie TMDB: <code>299536</code> · TV TMDB: <code>79744</code> season <code>1</code> episode <code>1</code>.</p>
    <div class="card">
      <button id="run-tests">Run all provider tests</button>
      <p class="muted" id="summary">Ready.</p>
    </div>
    <div class="grid">
      <section class="card"><h3>Movie results</h3><table><thead><tr><th>Provider</th><th>Status</th><th>Streams</th><th>Time</th><th>Message</th></tr></thead><tbody id="movie-results"></tbody></table></section>
      <section class="card"><h3>TV results</h3><table><thead><tr><th>Provider</th><th>Status</th><th>Streams</th><th>Time</th><th>Message</th></tr></thead><tbody id="tv-results"></tbody></table></section>
    </div>
  </main>
  <script>
  const runButton = document.getElementById('run-tests');
  const summary = document.getElementById('summary');
  const movieBody = document.getElementById('movie-results');
  const tvBody = document.getElementById('tv-results');

  function row(result) {
    const statusOk = result.ok;
    return '<tr>' +
      '<td><code>' + result.sourceId + '</code></td>' +
      '<td><span class="pill ' + (statusOk ? 'ok' : 'bad') + '">' + (statusOk ? 'PASS' : 'FAIL') + '</span></td>' +
      '<td>' + (result.streamCount || 0) + '</td>' +
      '<td>' + result.durationMs + 'ms</td>' +
      '<td class="muted">' + (result.message || '') + '</td>' +
    '</tr>';
  }

  async function run() {
    runButton.disabled = true;
    summary.textContent = 'Running... this can take some time.';
    movieBody.innerHTML = '';
    tvBody.innerHTML = '';

    const response = await fetch('/api/test/all');
    const payload = await response.json();

    movieBody.innerHTML = payload.movieResults.map(row).join('');
    tvBody.innerHTML = payload.tvResults.map(row).join('');

    const moviePassed = payload.movieResults.filter((x) => x.ok).length;
    const tvPassed = payload.tvResults.filter((x) => x.ok).length;

    summary.textContent = 'Done. Movie: ' + moviePassed + '/' + payload.movieResults.length + ' passed · TV: ' + tvPassed + '/' + payload.tvResults.length + ' passed.';
    runButton.disabled = false;
  }

  runButton.addEventListener('click', () => {
    run().catch((error) => {
      summary.textContent = 'Failed to run tests: ' + error.message;
      runButton.disabled = false;
    });
  });
  </script>
</body></html>`;
}

async function runSingleSource(source: MetaOutput, mediaType: 'movie' | 'tv') {
  const started = Date.now();
  try {
    const media =
      mediaType === 'movie' ? await getMovieMediaFromTmdb('299536') : await getShowMediaFromTmdb('79744', 1, 1);

    const result = await providers.runSourceScraper({
      id: source.id,
      media,
      disableOpensubtitles: true,
    });

    return {
      sourceId: source.id,
      ok: (result.stream?.length ?? 0) > 0 || result.embeds.length > 0,
      streamCount: result.stream?.length ?? 0,
      durationMs: Date.now() - started,
      message: result.embeds.length > 0 ? `${result.embeds.length} embeds` : 'No embeds',
    };
  } catch (error) {
    return {
      sourceId: source.id,
      ok: false,
      streamCount: 0,
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === '/') {
    return htmlResponse(renderHome(getBaseUrl(req)));
  }

  if (pathname === '/test') {
    return htmlResponse(renderTestPage());
  }

  if (pathname === '/api/providers') {
    return jsonResponse({ count: sourceMeta.length, providers: sourceMeta });
  }

  if (pathname === '/api/test/all') {
    const movieResults = await Promise.all(sourceMeta.map((source) => runSingleSource(source, 'movie')));
    const tvResults = await Promise.all(sourceMeta.map((source) => runSingleSource(source, 'tv')));
    return jsonResponse({
      movieId: '299536',
      tvId: '79744',
      season: 1,
      episode: 1,
      movieResults,
      tvResults,
    });
  }

  const movieMatch = pathname.match(/^\/api\/stream\/movie\/(\d+)$/);
  if (movieMatch) {
    const media = await getMovieMediaFromTmdb(movieMatch[1]);
    const result = await providers.runAll({ media, disableOpensubtitles: true });
    return jsonResponse({ input: media, result });
  }

  const tvMatch = pathname.match(/^\/api\/stream\/tv\/(\d+)\/(\d+)\/(\d+)$/);
  if (tvMatch) {
    const media = await getShowMediaFromTmdb(tvMatch[1], Number(tvMatch[2]), Number(tvMatch[3]));
    const result = await providers.runAll({ media, disableOpensubtitles: true });
    return jsonResponse({ input: media, result });
  }

  const singleMovieMatch = pathname.match(/^\/api\/source\/([^/]+)\/movie\/(\d+)$/);
  if (singleMovieMatch) {
    const media = await getMovieMediaFromTmdb(singleMovieMatch[2]);
    const result = await providers.runSourceScraper({ id: singleMovieMatch[1], media, disableOpensubtitles: true });
    return jsonResponse({ input: media, result });
  }

  const singleTvMatch = pathname.match(/^\/api\/source\/([^/]+)\/tv\/(\d+)\/(\d+)\/(\d+)$/);
  if (singleTvMatch) {
    const media = await getShowMediaFromTmdb(singleTvMatch[2], Number(singleTvMatch[3]), Number(singleTvMatch[4]));
    const result = await providers.runSourceScraper({ id: singleTvMatch[1], media, disableOpensubtitles: true });
    return jsonResponse({ input: media, result });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

const server = createServer((incoming, outgoing) => {
  const host = incoming.headers.host ?? `localhost:${port}`;
  const request = new Request(`http://${host}${incoming.url ?? '/'}`, {
    method: incoming.method,
    headers: incoming.headers as any,
  });

  handleRequest(request)
    .then(async (response) => {
      outgoing.statusCode = response.status;
      response.headers.forEach((value, key) => outgoing.setHeader(key, value));
      outgoing.end(await response.text());
    })
    .catch((error) => {
      outgoing.statusCode = 500;
      outgoing.setHeader('content-type', 'application/json; charset=utf-8');
      outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
    });
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`P-Stream API server running on http://0.0.0.0:${port}\n`);
});
