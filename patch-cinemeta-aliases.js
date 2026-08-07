const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    async getCinemetaStreams(type, id) {`;
if (!source.includes(methodMarker)) throw new Error('Cinemeta stream method marker not found');

const helpers = `    collectMetaTitles(meta) {
        const values = [];
        const add = (value) => {
            if (typeof value === 'string' && value.trim()) values.push(value.trim());
            else if (Array.isArray(value)) value.forEach(add);
            else if (value && typeof value === 'object') Object.values(value).forEach(add);
        };
        add(meta && meta.name);
        add(meta && meta.originalName);
        add(meta && meta.original_name);
        add(meta && meta.title);
        add(meta && meta.originalTitle);
        add(meta && meta.original_title);
        add(meta && meta.aliases);
        add(meta && meta.akas);
        add(meta && meta.aka);
        add(meta && meta.alternativeTitles);
        add(meta && meta.alternative_titles);
        add(meta && meta.localizedTitles);
        add(meta && meta.translations);
        return [...new Set(values)];
    }

    normalizeExternalId(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/tt\\d+/i);
        return match ? match[0].toLowerCase() : raw.toLowerCase();
    }

    getLanguagePriority(item) {
        const priority = { FR: 0, ES: 1, MULTI: 2, EN: 3, OTHER: 4 };
        return priority[this.getItemLanguage(item)] ?? 9;
    }

    findTitleMatchesAny(items, titles, year, imdbId) {
        const wantedId = this.normalizeExternalId(imdbId);
        const candidates = Array.isArray(titles) ? titles.filter(Boolean) : [];
        const scored = new Map();

        for (const item of items || []) {
            const ids = [item.imdb_id, item.imdb, item.imdbId, item.attributes?.imdb_id];
            const exactId = Boolean(wantedId) && ids.some(value => this.normalizeExternalId(value) === wantedId);

            let bestTitleScore = -1;
            for (const title of candidates) {
                bestTitleScore = Math.max(bestTitleScore, this.scoreTitleMatch(item, title, year));
            }

            if (exactId || bestTitleScore >= 100) {
                scored.set(item, {
                    exactId,
                    titleScore: bestTitleScore
                });
            }
        }

        return [...scored.entries()]
            .sort((a, b) => {
                const languageDifference = this.getLanguagePriority(a[0]) - this.getLanguagePriority(b[0]);
                if (languageDifference !== 0) return languageDifference;
                if (a[1].exactId !== b[1].exactId) return a[1].exactId ? -1 : 1;
                return b[1].titleScore - a[1].titleScore;
            })
            .map(([item]) => item);
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const movieOld = `const matches = this.findTitleMatches(this.movies, meta.name, year);`;
const movieNew = `const matches = this.findTitleMatchesAny(this.movies, this.collectMetaTitles(meta), year, imdbId);`;
if (!source.includes(movieOld)) throw new Error('movie title matching marker not found');
source = source.replace(movieOld, movieNew);

const seriesOld = `const matches = this.findTitleMatches(this.series, meta.name, year);`;
const seriesNew = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId);`;
if (!source.includes(seriesOld)) throw new Error('series title matching marker not found');
source = source.replace(seriesOld, seriesNew);

source = source.replace('version: "2.6.0",', 'version: "2.7.0",');
source = source.replace('version: "2.5.0",', 'version: "2.7.0",');
source = source.replace('version: "2.4.0",', 'version: "2.7.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Combined IMDb and localized title matching with French priority applied');
