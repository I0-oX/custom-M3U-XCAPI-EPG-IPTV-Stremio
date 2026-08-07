const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    async getCinemetaStreams(type, id) {`;
if (!source.includes(methodMarker)) throw new Error('Cinemeta stream method marker not found');

const helpers = `    async fetchLocalizedTitles(imdbId, lang) {
        const normalizedId = this.normalizeExternalId(imdbId);
        if (!/^tt\\d+$/i.test(normalizedId)) return [];
        if (!this.localizedTitleCache) this.localizedTitleCache = new Map();
        const cacheKey = normalizedId + ':' + lang;
        if (this.localizedTitleCache.has(cacheKey)) {
            return this.localizedTitleCache.get(cacheKey);
        }

        const promise = (async () => {
            const query = [
                'SELECT DISTINCT ?label WHERE {',
                '  ?item wdt:P345 "' + normalizedId + '" .',
                '  { ?item rdfs:label ?label FILTER(LANG(?label) = "' + lang + '") }',
                '  UNION',
                '  { ?item skos:altLabel ?label FILTER(LANG(?label) = "' + lang + '") }',
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

        this.localizedTitleCache.set(cacheKey, promise);
        return promise;
    }

    async fetchFrenchLocalizedTitles(imdbId) {
        return this.fetchLocalizedTitles(imdbId, 'fr');
    }

    async fetchSpanishLocalizedTitles(imdbId) {
        return this.fetchLocalizedTitles(imdbId, 'es');
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const movieOld = `const matches = this.findTitleMatchesAny(this.movies, this.collectMetaTitles(meta), year, imdbId);`;
const movieNew = `const [frenchTitles, spanishTitles] = await Promise.all([
            this.fetchFrenchLocalizedTitles(imdbId),
            this.fetchSpanishLocalizedTitles(imdbId)
        ]);
            const movieTitles = [...this.collectMetaTitles(meta), ...frenchTitles, ...spanishTitles];
            const matches = this.findTitleMatchesAny(this.movies, movieTitles, year, imdbId);`;
if (!source.includes(movieOld)) throw new Error('movie localized title marker not found');
source = source.replace(movieOld, movieNew);

const seriesOld = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId);`;
const seriesNew = `const [frenchTitles, spanishTitles] = await Promise.all([
            this.fetchFrenchLocalizedTitles(imdbId),
            this.fetchSpanishLocalizedTitles(imdbId)
        ]);
            const seriesTitles = [...this.collectMetaTitles(meta), ...frenchTitles, ...spanishTitles];
            const matches = this.findTitleMatchesAny(this.series, seriesTitles, year, imdbId);`;
if (!source.includes(seriesOld)) throw new Error('series localized title marker not found');
source = source.replace(seriesOld, seriesNew);

source = source.replace('version: "2.7.0",', 'version: "2.9.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] French and Spanish localized titles from Wikidata applied');
