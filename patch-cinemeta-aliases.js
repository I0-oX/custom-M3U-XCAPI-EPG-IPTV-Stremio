const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const methodMarker = `    async getCinemetaStreams(type, id) {`;
if (!source.includes(methodMarker)) throw new Error('Cinemeta stream method marker not found');

const helpers = `    normalizeExternalId(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/tt\\d+/i);
        return match ? match[0].toLowerCase() : raw.toLowerCase();
    }

    getLanguagePriority(item) {
        const priority = { ES: 0, OTHER: 1, MULTI: 2, FR: 3, EN: 4 };
        return priority[this.getItemLanguage(item)] ?? 9;
    }

    findTitleMatchesAny(items, titles, year, imdbId, options = {}) {
        const spanishOnly = options.spanishOnly === true;
        const titleFirst = options.titleFirst === true;
        const wantedId = this.normalizeExternalId(imdbId);
        const candidates = Array.isArray(titles) ? titles.filter(Boolean) : [];
        const scored = new Map();

        for (const item of items || []) {
            const ids = [item.imdb_id, item.imdb, item.imdbId, item.attributes?.imdb_id];
            const exactId = Boolean(wantedId) && ids.some(value => this.normalizeExternalId(value) === wantedId);

            let bestTitleScore = -1;
            let bestTitleIndex = Infinity;
            for (const [index, title] of candidates.entries()) {
                const score = this.scoreTitleMatch(item, title, year);
                if (score > bestTitleScore) {
                    bestTitleScore = score;
                    bestTitleIndex = index;
                }
            }

            const titleMatch = bestTitleScore >= 100;
            const exactIdMatch = exactId && (!spanishOnly || titleMatch || this.getItemLanguage(item) === 'ES');
            if (exactIdMatch || titleMatch) {
                scored.set(item, {
                    exactId: exactIdMatch,
                    titleMatch,
                    titleIndex: bestTitleIndex,
                    titleScore: bestTitleScore
                });
            }
        }

        return [...scored.entries()]
            .sort((a, b) => {
                if (titleFirst && a[1].titleMatch !== b[1].titleMatch) {
                    return a[1].titleMatch ? -1 : 1;
                }
                if (titleFirst && a[1].titleMatch && b[1].titleMatch &&
                    a[1].titleIndex !== b[1].titleIndex) {
                    return a[1].titleIndex - b[1].titleIndex;
                }
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
const movieNew = `const matches = this.findTitleMatchesAny(this.movies, [meta.name], year, imdbId, { spanishOnly: true, titleFirst: true });`;
if (!source.includes(movieOld)) throw new Error('movie title matching marker not found');
source = source.replace(movieOld, movieNew);

const seriesOld = `const matches = this.findTitleMatches(this.series, meta.name, year);`;
const seriesNew = `const matches = this.findTitleMatchesAny(this.series, [meta.name], year, imdbId, { spanishOnly: true, titleFirst: true });`;
if (!source.includes(seriesOld)) throw new Error('series title matching marker not found');
source = source.replace(seriesOld, seriesNew);

source = source.replace('version: "2.6.0",', 'version: "2.7.0",');
source = source.replace('version: "2.5.0",', 'version: "2.7.0",');
source = source.replace('version: "2.4.0",', 'version: "2.7.0",');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] TMDB-first title matching helper applied');
