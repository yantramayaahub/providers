# @p-stream/providers

Provider library and now a ready-to-run API server for resolving stream URLs from TMDB IDs.

## API server

This repository now includes a small HTTP server with docs UI and a provider test dashboard.

### Start

```bash
TMDB_API_KEY=your_key pnpm start:api
```

Environment variables:

- `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN` (required)
- `PORT` (optional, default `3000`)

### Pages

- `/` → Home + API documentation
- `/test` → Visual provider testing page for:
  - Movie TMDB ID: `299536`
  - Show TMDB ID: `79744` (season `1`, episode `1`)

### API endpoints

- `GET /api/providers`
- `GET /api/stream/movie/:tmdbId`
- `GET /api/stream/tv/:tmdbId/:season/:episode`
- `GET /api/source/:sourceId/movie/:tmdbId`
- `GET /api/source/:sourceId/tv/:tmdbId/:season/:episode`
- `GET /api/test/all`

## Project

Features:

- scrape popular streaming websites
- works in both browser and server-side

Visit package documentation here: https://p-stream.github.io/providers/
