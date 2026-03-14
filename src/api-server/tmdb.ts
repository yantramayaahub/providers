export interface MovieMediaInput {
  type: 'movie';
  title: string;
  releaseYear: number;
  tmdbId: string;
  imdbId?: string;
}

export interface ShowMediaInput {
  type: 'show';
  title: string;
  releaseYear: number;
  tmdbId: string;
  imdbId?: string;
  season: {
    number: number;
    tmdbId: string;
    title: string;
    episodeCount: number;
  };
  episode: {
    number: number;
    tmdbId: string;
  };
}

function getTmdbKey(): string {
  const key = process.env.TMDB_API_KEY ?? process.env.TMDB_ACCESS_TOKEN;
  if (!key) {
    throw new Error('Missing TMDB credentials. Set TMDB_API_KEY (or TMDB_ACCESS_TOKEN).');
  }

  return key;
}

async function makeTmdbRequest(url: string): Promise<any> {
  const key = getTmdbKey();
  const requestUrl = new URL(url);
  const headers: { accept: string; authorization?: string } = {
    accept: 'application/json',
  };

  if (key.startsWith('ey')) {
    headers.authorization = `Bearer ${key}`;
  } else {
    requestUrl.searchParams.set('api_key', key);
  }

  const response = await fetch(requestUrl.toString(), { headers });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.status_message ?? `TMDB request failed with status ${response.status}`);
  }

  return data;
}

export async function getMovieMediaFromTmdb(tmdbId: string): Promise<MovieMediaInput> {
  const movie = await makeTmdbRequest(`https://api.themoviedb.org/3/movie/${tmdbId}`);

  if (!movie.release_date) {
    throw new Error(`${movie.title ?? 'Movie'} has no release date`);
  }

  return {
    type: 'movie',
    title: movie.title,
    releaseYear: Number(movie.release_date.split('-')[0]),
    tmdbId,
    imdbId: movie.imdb_id ?? undefined,
  };
}

export async function getShowMediaFromTmdb(
  tmdbId: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<ShowMediaInput> {
  const series = await makeTmdbRequest(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  const season = await makeTmdbRequest(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
  const episode = await makeTmdbRequest(
    `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
  );

  if (!series.first_air_date) {
    throw new Error(`${series.name ?? 'Series'} has no first air date`);
  }

  return {
    type: 'show',
    title: series.name,
    releaseYear: Number(series.first_air_date.split('-')[0]),
    tmdbId,
    imdbId: series.external_ids?.imdb_id ?? undefined,
    season: {
      number: season.season_number,
      tmdbId: String(season.id),
      title: season.name,
      episodeCount: Array.isArray(season.episodes) ? season.episodes.length : 0,
    },
    episode: {
      number: episode.episode_number,
      tmdbId: String(episode.id),
    },
  };
}
