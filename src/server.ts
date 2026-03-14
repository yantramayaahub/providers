import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  makeProviders,
  makeStandardFetcher,
  targets,
  MovieMedia,
  ShowMedia,
} from './index';

const app = new Hono();

app.use('*', cors());

// Initialize providers
const providers = makeProviders({
  fetcher: makeStandardFetcher(fetch),
  target: targets.ANY,
});

// Health Check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Search stream for a Movie
app.get('/api/movie', async (c) => {
  const tmdbId = c.req.query('tmdbId');
  const title = c.req.query('title') || 'Unknown';
  const releaseYear = c.req.query('releaseYear') || '2000';
  const sourceId = c.req.query('sourceId');

  if (!tmdbId) return c.json({ error: 'tmdbId is required' }, 400);

  const media: MovieMedia = {
    type: 'movie',
    title,
    releaseYear: parseInt(releaseYear, 10),
    tmdbId,
  };

  try {
    const sourceOrder = sourceId ? [sourceId] : providers.listSources().map((s) => s.id);
    const result = await providers.runAll({ media, sourceOrder });
    if (!result) return c.json({ error: 'No stream found' }, 404);
    return c.json({ stream: result });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Search stream for a TV Show
app.get('/api/show', async (c) => {
  const tmdbId = c.req.query('tmdbId');
  const title = c.req.query('title') || 'Unknown';
  const releaseYear = c.req.query('releaseYear') || '2000';
  const seasonStr = c.req.query('season') || '1';
  const episodeStr = c.req.query('episode') || '1';
  const sourceId = c.req.query('sourceId');

  if (!tmdbId) return c.json({ error: 'tmdbId is required' }, 400);

  const media: ShowMedia = {
    type: 'show',
    title,
    releaseYear: parseInt(releaseYear, 10),
    tmdbId,
    season: {
      number: parseInt(seasonStr, 10),
      tmdbId: '',
      title: `Season ${seasonStr}`
    },
    episode: {
      number: parseInt(episodeStr, 10),
      tmdbId: '',
    },
  };

  try {
    const sourceOrder = sourceId ? [sourceId] : providers.listSources().map((s) => s.id);
    const result = await providers.runAll({ media, sourceOrder });
    if (!result) return c.json({ error: 'No stream found' }, 404);
    return c.json({ stream: result });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// All providers results
app.get('/api/all', async (c) => {
  const tmdbId = c.req.query('tmdbId');
  const type = c.req.query('type') || 'movie';
  const title = c.req.query('title') || 'Unknown';
  const releaseYear = c.req.query('releaseYear') || '2000';
  const seasonStr = c.req.query('season') || '1';
  const episodeStr = c.req.query('episode') || '1';

  if (!tmdbId) return c.json({ error: 'tmdbId is required' }, 400);

  const media: any = {
    type,
    title,
    releaseYear: parseInt(releaseYear, 10),
    tmdbId,
  };

  if (type === 'show') {
    media.season = { number: parseInt(seasonStr, 10), tmdbId: '', title: `Season ${seasonStr}` };
    media.episode = { number: parseInt(episodeStr, 10), tmdbId: '' };
  }

  const sources = providers.listSources();
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await providers.runSourceScraper({ id: source.id, media });
        return { sourceId: source.id, name: source.name, success: true, flags: source.flags, result };
      } catch (err: any) {
        return { sourceId: source.id, name: source.name, success: false, flags: source.flags, error: err.message };
      }
    })
  );

  return c.json({ results });
});

// List providers
app.get('/api/providers', (c) => {
  const sources = providers.listSources();
  const embeds = providers.listEmbeds();
  return c.json({ sources, embeds });
});

// Serve static assets for Node.js
app.use('/*', serveStatic({ root: './public' }));

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
