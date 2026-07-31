const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

source = source.replace(
  'idPrefixes: ["iptv_"],',
  'idPrefixes: ["iptv_", "tt"],'
);

source = source.replace(
  'const ADDON_ID = "org.stremio.m3u-epg-addon";',
  'const ADDON_ID = "org.stremio.m3u-epg-addon.cinemeta";'
);
source = source.replace('version: "2.0.0",', 'version: "2.4.0",');
source = source.replace('const ADDON_NAME = "M3U/EPG TV Addon";', 'const ADDON_NAME = "Xtream Cinemeta FR MULTI EN";');

const marker = '    getStream(id) {';
if (!source.includes(marker)) throw new Error('getStream marker not found');

const helpers = `    normalizeMediaTitle(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
            .toLowerCase()
            .replace(/\\[[^\\]]*(?:fr|french|multi|vostfr|vf|vo|en|english)[^\\]]*\\]/g, ' ')
            .replace(/\\([^)]*(?:fr|french|multi|vostfr|vf|vo|en|english)[^)]*\\)/g, ' ')
            .replace(/\\b(?:fr|french|multi|multilang|vostfr|vf|vo|en|english|truefrench)\\b/g, ' ')
            .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    titleTokens(value) {
        const stopWords = new Set(['the', 'a', 'an', 'of', 'and', 'le', 'la', 'les', 'un', 'une', 'de', 'des', 'du', 'et']);
        return this.normalizeMediaTitle(value)
            .split(/\\s+/)
            .filter(Boolean)
            .filter(token => !stopWords.has(token));
    }

    extractMediaYear(value) {
        const match = String(value || '').match(/\\b((?:19|20)\\d{2})\\b/);
        return match ? parseInt(match[1], 10) : null;
    }

    getItemLanguage(item) {
        const value = [
            item.category,
            item.attributes?.['group-title'],
            item.name
        ].filter(Boolean).join(' ').toUpperCase();
        if (/\\b(?:MULTI|MULTILANG|MULTILINGUAL)\\b/.test(value)) return 'MULTI';
        if (/\\b(?:TRUEFRENCH|FRENCH|FRANCE|VOSTFR|VF|FR)\\b/.test(value)) return 'FR';
        if (/\\b(?:ENGLISH|ENG|EN)\\b/.test(value)) return 'EN';
        return 'OTHER';
    }

    async fetchCinemetaMeta(type, rawId) {
        const imdbId = String(rawId || '').split(':')[0];
        if (!/^tt\\d+$/i.test(imdbId)) return null;
        try {
            const response = await fetch(\`https://v3-cinemeta.strem.io/meta/\${type}/\${imdbId}.json\`, { timeout: 12000 });
            if (!response.ok) return null;
            const payload = await response.json();
            return payload && payload.meta ? payload.meta : null;
        } catch {
            return null;
        }
    }

    scoreTitleMatch(item, title, year) {
        const wanted = this.normalizeMediaTitle(title);
        const candidate = this.normalizeMediaTitle(item.name);
        if (!wanted || !candidate) return -1;

        const candidateYear = item.year || this.extractMediaYear(item.name);
        if (year && candidateYear && Math.abs(Number(year) - Number(candidateYear)) > 1) return -1;

        if (candidate === wanted) return 200;

        const wantedTokens = this.titleTokens(title);
        const candidateTokens = this.titleTokens(item.name);
        if (!wantedTokens.length || !candidateTokens.length) return -1;

        const wantedSet = new Set(wantedTokens);
        const candidateSet = new Set(candidateTokens);
        const intersection = [...wantedSet].filter(token => candidateSet.has(token)).length;
        const union = new Set([...wantedSet, ...candidateSet]).size;
        const wantedCoverage = intersection / wantedSet.size;
        const candidateCoverage = intersection / candidateSet.size;
        const jaccard = union ? intersection / union : 0;

        // Require essentially the same title. This prevents partial collisions such as
        // "Young Indiana Jones" matching an unrelated title sharing one short word.
        if (wantedCoverage < 0.8 || candidateCoverage < 0.8 || jaccard < 0.7) return -1;

        let score = 100 + (jaccard * 60);
        if (year && candidateYear) score += 20;
        return score;
    }

    findTitleMatches(items, title, year) {
        return (items || [])
            .map(item => ({ item, score: this.scoreTitleMatch(item, title, year) }))
            .filter(entry => entry.score >= 100)
            .sort((a, b) => b.score - a.score)
            .map(entry => entry.item);
    }

    async getCinemetaStreams(type, id) {
        const parts = String(id || '').split(':');
        const imdbId = parts[0];
        const season = parseInt(parts[1] || '0', 10);
        const episode = parseInt(parts[2] || '0', 10);
        const meta = await this.fetchCinemetaMeta(type, imdbId);
        if (!meta) return [];
        const year = meta.year || this.extractMediaYear(meta.releaseInfo);

        if (type === 'movie') {
            const matches = this.findTitleMatches(this.movies, meta.name, year);
            const seen = new Set();
            return matches
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
                        name: \`Xtream · \${language}\`,
                        title: \`\${language} · \${match.name}\`,
                        behaviorHints: {
                            notWebReady: true,
                            bingeGroup: \`xtream-\${imdbId}-\${language.toLowerCase()}\`
                        }
                    };
                });
        }

        if (type === 'series') {
            const matches = this.findTitleMatches(this.series, meta.name, year);
            const results = [];
            const seen = new Set();
            for (const seriesItem of matches) {
                const seriesIdRaw = seriesItem.series_id || seriesItem.id.replace(/^iptv_series_/, '');
                const info = await this.ensureSeriesInfo(seriesIdRaw);
                const videos = info && Array.isArray(info.videos) ? info.videos : [];
                const selected = videos.find(video => Number(video.season) === season && Number(video.episode) === episode);
                if (!selected || !selected.url || seen.has(selected.url)) continue;
                seen.add(selected.url);
                const language = this.getItemLanguage(seriesItem);
                results.push({
                    url: selected.url,
                    name: \`Xtream · \${language}\`,
                    title: \`\${language} · \${seriesItem.name} S\${season}E\${episode}\`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: \`xtream-\${imdbId}-\${language.toLowerCase()}\`
                    }
                });
            }
            return results;
        }

        return [];
    }

`;
source = source.replace(marker, helpers + marker);

const oldHandler = `        builder.defineStreamHandler(async ({ type, id }) => {
            try {
                if (id.startsWith('iptv_series_ep_')) {`;
const newHandler = `        builder.defineStreamHandler(async ({ type, id }) => {
            try {
                if (/^tt\\d+/i.test(id)) {
                    const streams = await addonInstance.getCinemetaStreams(type, id);
                    return { streams };
                }
                if (id.startsWith('iptv_series_ep_')) {`;
if (!source.includes(oldHandler)) throw new Error('stream handler marker not found');
source = source.replace(oldHandler, newHandler);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Strict Cinemeta matching and combined language detection applied');
