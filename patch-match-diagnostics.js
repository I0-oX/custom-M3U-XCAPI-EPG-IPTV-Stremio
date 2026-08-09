const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const movieMarker = `            const matches = await this.findSpanishTitleMatches(type, this.movies, meta, year, imdbId);`;
const movieReplacement = `            const tmdbId = meta.moviedb_id || meta.tmdb_id || null;
            const titles = await this.fetchTmdbSpanishTitles(type, tmdbId);
${movieMarker}
            console.log('[MATCH TEST]', JSON.stringify({
                type: 'movie',
                imdbId,
                tmdbId,
                titles,
                matches: matches.slice(0, 12).map(item => ({
                    name: item.name,
                    language: this.getItemLanguage(item),
                    year: item.year || this.extractMediaYear(item.name) || null
                }))
            }));`;
if (!source.includes(movieMarker)) throw new Error('movie diagnostics marker not found');
source = source.replace(movieMarker, movieReplacement);

const seriesMarker = `            const matches = (await this.findSpanishTitleMatches(type, this.series, meta, year, imdbId)).slice(0, 6);`;
const seriesReplacement = `            const tmdbId = meta.moviedb_id || meta.tmdb_id || null;
            const titles = await this.fetchTmdbSpanishTitles(type, tmdbId);
${seriesMarker}
            console.log('[MATCH TEST]', JSON.stringify({
                type: 'series',
                imdbId,
                tmdbId,
                titles,
                matches: matches.map(item => ({
                    name: item.name,
                    language: this.getItemLanguage(item),
                    year: item.year || this.extractMediaYear(item.name) || null
                }))
            }));`;
if (!source.includes(seriesMarker)) throw new Error('series diagnostics marker not found');
source = source.replace(seriesMarker, seriesReplacement);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Spanish matching diagnostics enabled');
