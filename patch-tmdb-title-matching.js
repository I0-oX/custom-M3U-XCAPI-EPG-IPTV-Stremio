const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    async getCinemetaStreams(type, id) {`;
if (!source.includes(methodMarker)) throw new Error('Cinemeta stream method marker not found');

const helpers = `
    async fetchTmdbSpanishTitles(type, tmdbId) {
        const normalizedId = String(tmdbId || '').match(/^\\d+$/)?.[0];
        if (!normalizedId) return [];
        if (!this.localizedTitleCache) this.localizedTitleCache = new Map();
        const cacheKey = 'tmdb-es:' + type + ':' + normalizedId;
        if (this.localizedTitleCache.has(cacheKey)) {
            return this.localizedTitleCache.get(cacheKey);
        }

        const cleanTitle = value => String(value || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#(?:39|x27);/gi, "'")
            .replace(/&#(?:8212|x2014);/gi, '—')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\\s+/g, ' ')
            .trim()
            .replace(/\\s*(?:—|--)\\s*The Movie Database.*$/i, '')
            .replace(/\\s*\\([^)]*\\)\\s*$/g, '')
            .trim();

        const expandTitles = values => {
            const titles = new Set();
            const add = value => {
                const title = cleanTitle(value);
                if (!title) return;
                titles.add(title);
                const fragments = title.split(/\\s+(?:y|e|and)\\s+/i);
                if (fragments.length < 2) return;
                for (const fragment of fragments) {
                    const significant = this.titleTokens(fragment);
                    if (significant.length < 2) continue;
                    titles.add(fragment);
                    titles.add(significant.join(' '));
                }
            };
            values.forEach(add);
            return [...titles];
        };

        const promise = (async () => {
            const endpoint = type === 'series' ? 'tv' : 'movie';
            const apiKey = process.env.TMDB_API_KEY || this.config.tmdbApiKey;
            try {
                if (apiKey) {
                    const response = await fetch(
                        'https://api.themoviedb.org/3/' + endpoint + '/' + normalizedId +
                        '/translations?api_key=' + encodeURIComponent(apiKey),
                        { timeout: 12000 }
                    );
                    if (response.ok) {
                        const payload = await response.json();
                        const values = (payload.translations || []).flatMap(translation =>
                            translation?.iso_639_1 === 'es'
                                ? [translation.data?.title, translation.data?.name]
                                : []
                        );
                        const titles = expandTitles(values);
                        if (titles.length) return titles;
                    }
                }

                const response = await fetch(
                    'https://www.themoviedb.org/' + endpoint + '/' + normalizedId + '/translations',
                    {
                        timeout: 12000,
                        headers: { 'User-Agent': 'Xtream-Stremio-Addon/2.10 Spanish-title-matching' }
                    }
                );
                let html = '';
                if (response.ok) html = await response.text();
                const pattern = /<h2[^>]*>\\s*(?:Spanish; Castilian|Español; Castellano)\\s*<span[^>]*>\\(es-[^)]+\\)<\\/span>[\\s\\S]*?<td[^>]*>\\s*(?:Title|Título)\\s*<\\/td>[\\s\\S]*?<h3[^>]*>([\\s\\S]*?)<\\/h3>/gi;
                const titles = expandTitles([...html.matchAll(pattern)].map(match => match[1]));
                if (titles.length) return titles;

                const pageResponse = await fetch(
                    'https://www.themoviedb.org/' + endpoint + '/' + normalizedId + '?language=es-ES',
                    {
                        timeout: 12000,
                        headers: { 'User-Agent': 'Xtream-Stremio-Addon/2.10 Spanish-title-matching' }
                    }
                );
                if (!pageResponse.ok) return [];
                const page = await pageResponse.text();
                const pageTitles = [
                    page.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1],
                    page.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]
                ];
                return expandTitles(pageTitles);
            } catch {
                return [];
            }
        })();

        this.localizedTitleCache.set(cacheKey, promise);
        return promise;
    }

    async findSpanishTitleMatches(type, items, meta, year, imdbId) {
        const tmdbTitles = await this.fetchTmdbSpanishTitles(
            type,
            meta.moviedb_id || meta.tmdb_id
        );
        return this.findTitleMatchesAny(
            items,
            tmdbTitles,
            year,
            imdbId,
            { spanishOnly: true, titleFirst: true }
        );
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const movieOld = `const matches = this.findTitleMatchesAny(this.movies, [meta.name], year, imdbId, { spanishOnly: true, titleFirst: true });`;
const movieNew = `const matches = await this.findSpanishTitleMatches(type, this.movies, meta, year, imdbId);`;
if (!source.includes(movieOld)) throw new Error('movie TMDB title marker not found');
source = source.replace(movieOld, movieNew);

const seriesOld = `const matches = this.findTitleMatchesAny(this.series, [meta.name], year, imdbId, { spanishOnly: true, titleFirst: true });`;
const seriesNew = `const matches = await this.findSpanishTitleMatches(type, this.series, meta, year, imdbId);`;
if (!source.includes(seriesOld)) throw new Error('series TMDB title marker not found');
source = source.replace(seriesOld, seriesNew);
source = source.replace('version: "2.7.0",', 'version: "2.9.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] TMDB Spanish titles first, with IMDb fallback applied');
