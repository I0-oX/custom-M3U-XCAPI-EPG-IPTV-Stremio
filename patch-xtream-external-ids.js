const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, 'src/js/providers/xtreamProvider.js');
let source = fs.readFileSync(providerPath, 'utf8');

const movieMarker = `        type: "movie",\n        url:`;
const movieReplacement = `        type: "movie",\n        imdb_id: s.imdb_id || s.imdb || s.imdbId || null,\n        tmdb_id: s.tmdb_id || s.tmdb || s.tmdbId || null,\n        url:`;
if (source.includes(movieReplacement)) {
    console.log('[PATCH] Movie external IDs already applied');
} else {
    if (!source.includes(movieMarker)) throw new Error('movie external-id marker not found');
    source = source.replace(movieMarker, movieReplacement);
}

const seriesMarker = `                type: "series",\n                poster:`;
const seriesReplacement = `                type: "series",\n                imdb_id: s.imdb_id || s.imdb || s.imdbId || null,\n                tmdb_id: s.tmdb_id || s.tmdb || s.tmdbId || null,\n                poster:`;
if (source.includes(seriesReplacement)) {
    console.log('[PATCH] Series external IDs already applied');
} else {
    if (!source.includes(seriesMarker)) throw new Error('series external-id marker not found');
    source = source.replace(seriesMarker, seriesReplacement);
}

fs.writeFileSync(providerPath, source);
console.log('[PATCH] Xtream IMDb/TMDB identifiers preserved when available');
