const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    getStream(id) {`;
if (!source.includes(methodMarker)) throw new Error('getStream marker not found');

const helpers = `    async fetchTmdbMeta(type, tmdbId) {
        if (!/^\d+$/.test(String(tmdbId || ''))) return null;
        const apiKey = process.env.TMDB_API_KEY || this.config.tmdbApiKey;
        if (!apiKey) return null;
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        try {
            const response = await fetch(\`https://api.themoviedb.org/3/\${endpoint}/\${tmdbId}?api_key=\${apiKey}&language=es-ES\`, {
                timeout: 12000
            });
            if (!response.ok) return null;
            const data = await response.json();
            return {
                name: data.title || data.name || '',
                original_name: data.original_title || data.original_name || data.name || '',
                year: data.release_date ? parseInt(data.release_date.slice(0, 4), 10) : null,
                overview: data.overview || '',
                poster: data.poster_path ? \`https://image.tmdb.org/t/p/w500\${data.poster_path}\` : null,
                tmdbId: data.id,
                imdb_id: data.imdb_id || null
            };
        } catch {
            return null;
        }
    }

    tmdbPrioritySort(matches) {
        // TMDB results take priority over Cinemeta (IMDb) matches.
        // Sort: TMDB source first, then Spanish/localized language priority.
        return matches.sort((a, b) => {
            const aTmdb = a._source === 'TMDB' ? 0 : 1;
            const bTmdb = b._source === 'TMDB' ? 0 : 1;
            if (aTmdb !== bTmdb) return aTmdb - bTmdb;
            return this.getLanguagePriority(a) - this.getLanguagePriority(b);
        });
    }

    async getTmdbStreams(type, id) {
        const parts = String(id || '').split(':');
        const tmdbId = parts[0].replace(/^tmdb:/, '');
        const season = parseInt(parts[1] || '0', 10);
        const episode = parseInt(parts[2] || '0', 10);
        const meta = await this.fetchTmdbMeta(type, tmdbId);
        if (!meta) return [];
        const titles = [meta.name, meta.original_name].filter(Boolean);
        const year = meta.year;

        if (type === 'movie') {
            const matches = await this.findTitleMatchesAny(
                this.movies,
                titles,
                year,
                meta.imdb_id || null,
                { titleFirst: true }
            );
            const tagged = matches.map(m => ({ ...m, _source: 'TMDB' }));
            const seen = new Set();
            return this.tmdbPrioritySort(tagged)
                .filter(match => match && match.url)
                .filter(match => {
                    if (seen.has(match.url)) return false;
                    seen.add(match.url);
                    return true;
                })
                .map(match => {
                    const language = this.getItemLanguage(match);
                    return {
                        url: match.url,
                        name: \`TMDB \\u00b7 \${language}\`,
                        title: \`\${language} \\u00b7 \${match.name}\`,
                        behaviorHints: {
                            notWebReady: true,
                            bingeGroup: \`tmdb-\${tmdbId}-\${language.toLowerCase()}\`
                        }
                    };
                });
        }

        if (type === 'series') {
            const matches = await this.findTitleMatchesAny(
                this.series,
                titles,
                year,
                meta.imdb_id || null,
                { titleFirst: true }
            );
            const tagged = matches.map(m => ({ ...m, _source: 'TMDB' }));
            const results = [];
            const seen = new Set();
            for (const seriesItem of this.tmdbPrioritySort(tagged)) {
                const seriesIdRaw = seriesItem.series_id || seriesItem.id.replace(/^iptv_series_/, '');
                const info = await this.ensureSeriesInfo(seriesIdRaw);
                const videos = info && Array.isArray(info.videos) ? info.videos : [];
                const selected = videos.find(video => Number(video.season) === season && Number(video.episode) === episode);
                if (!selected || !selected.url || seen.has(selected.url)) continue;
                seen.add(selected.url);
                const language = this.getItemLanguage(seriesItem);
                results.push({
                    url: selected.url,
                    name: \`TMDB \\u00b7 \${language}\`,
                    title: \`\${language} \\u00b7 \${seriesItem.name} S\${season}E\${episode}\`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: \`tmdb-\${tmdbId}-\${language.toLowerCase()}\`
                    }
                });
            }
            return results;
        }

        return [];
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const oldHandler = `        builder.defineStreamHandler(async ({ type, id }) => {
            try {
                if (/^tt\\d+/i.test(id)) {
                    const streams = await addonInstance.getCinemetaStreams(type, id);
                    return { streams };
                }`;
if (!source.includes(oldHandler)) throw new Error('stream handler marker not found');

const newHandler = `        builder.defineStreamHandler(async ({ type, id }) => {
            try {
                if (id.startsWith('tmdb:')) {
                    const streams = await addonInstance.getTmdbStreams(type, id);
                    return { streams };
                }
                if (/^tt\\d+/i.test(id)) {
                    const streams = await addonInstance.getCinemetaStreams(type, id);
                    return { streams };
                }`;
source = source.replace(oldHandler, newHandler);

source = source.replace('version: "2.9.0",', 'version: "2.10.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] TMDB metadata with Spanish support + TMDB priority over Cinemeta applied');
