const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    async getCinemetaStreams(type, id) {`;
if (!source.includes(methodMarker)) throw new Error('Cinemeta stream method marker not found');

const helpers = `    async fetchFrenchLocalizedTitles(imdbId) {
        const normalizedId = this.normalizeExternalId(imdbId);
        if (!/^tt\\d+$/i.test(normalizedId)) return [];
        if (!this.localizedTitleCache) this.localizedTitleCache = new Map();
        if (this.localizedTitleCache.has(normalizedId)) {
            return this.localizedTitleCache.get(normalizedId);
        }

        const promise = (async () => {
            const query = [
                'SELECT DISTINCT ?label WHERE {',
                '  ?item wdt:P345 "' + normalizedId + '" .',
                '  { ?item rdfs:label ?label FILTER(LANG(?label) = "fr") }',
                '  UNION',
                '  { ?item skos:altLabel ?label FILTER(LANG(?label) = "fr") }',
                '}'
            ].join('\\n');
            const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
            try {
                const response = await fetch(url, {
                    timeout: 6000,
                    headers: {
                        'Accept': 'application/sparql-results+json',
                        'User-Agent': 'Xtream-Stremio-Addon/2.8 localized-title-matching'
                    }
                });
                if (!response.ok) return [];
                const payload = await response.json();
                const rows = payload && payload.results && Array.isArray(payload.results.bindings)
                    ? payload.results.bindings
                    : [];
                return [...new Set(rows
                    .map(row => row && row.label && row.label.value)
                    .filter(value => typeof value === 'string' && value.trim())
                    .map(value => value.trim()))];
            } catch {
                return [];
            }
        })();

        this.localizedTitleCache.set(normalizedId, promise);
        return promise;
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const movieOld = `const matches = this.findTitleMatchesAny(this.movies, this.collectMetaTitles(meta), year, imdbId);`;
const movieNew = `const localizedTitles = await this.fetchFrenchLocalizedTitles(imdbId);
            const movieTitles = [...this.collectMetaTitles(meta), ...localizedTitles];
            const matches = this.findTitleMatchesAny(this.movies, movieTitles, year, imdbId);`;
if (!source.includes(movieOld)) throw new Error('movie localized title marker not found');
source = source.replace(movieOld, movieNew);

const seriesOld = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId);`;
const seriesNew = `const localizedTitles = await this.fetchFrenchLocalizedTitles(imdbId);
            const seriesTitles = [...this.collectMetaTitles(meta), ...localizedTitles];
            const matches = this.findTitleMatchesAny(this.series, seriesTitles, year, imdbId);`;
if (!source.includes(seriesOld)) throw new Error('series localized title marker not found');
source = source.replace(seriesOld, seriesNew);

source = source.replace('version: "2.7.0",', 'version: "2.8.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] French localized titles from Wikidata applied');
