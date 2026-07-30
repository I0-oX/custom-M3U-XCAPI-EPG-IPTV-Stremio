const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

// Let Stremio call this addon for normal Cinemeta IMDb ids.
source = source.replace(
  'idPrefixes: ["iptv_"],',
  'idPrefixes: ["iptv_", "tt"],'
);

// Bump identity/version so clients do not keep the old incompatible manifest.
source = source.replace(
  'const ADDON_ID = "org.stremio.m3u-epg-addon";',
  'const ADDON_ID = "org.stremio.m3u-epg-addon.cinemeta";'
);
source = source.replace('version: "2.0.0",', 'version: "2.2.0",');
source = source.replace('const ADDON_NAME = "M3U/EPG TV Addon";', 'const ADDON_NAME = "Xtream Cinemeta FR MULTI EN";');

const marker = '    getStream(id) {';
if (!source.includes(marker)) throw new Error('getStream marker not found');

const helpers = `    normalizeMediaTitle(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
            .toLowerCase()
            .replace(/\\b(?:fr|french|multi|multilang|vostfr|vf|vo|en|english)\\b/g, ' ')
            .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    extractMediaYear(value) {
        const match = String(value || '').match(/\\b((?:19|20)\\d{2})\\b/);
        return match ? parseInt(match[1], 10) : null;
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

    findBestTitleMatch(items, title, year) {
        const wanted = this.normalizeMediaTitle(title);
        if (!wanted) return null;
        const scored = (items || []).map(item => {
            const candidate = this.normalizeMediaTitle(item.name);
            if (!candidate) return { item, score: -1 };
            let score = 0;
            if (candidate === wanted) score += 100;
            else if (candidate.includes(wanted) || wanted.includes(candidate)) score += 70;
            else {
                const wantedWords = new Set(wanted.split(/\\s+/).filter(Boolean));
                const candidateWords = new Set(candidate.split(/\\s+/).filter(Boolean));
                const overlap = [...wantedWords].filter(word => candidateWords.has(word)).length;
                score += wantedWords.size ? (overlap / wantedWords.size) * 60 : 0;
            }
            const candidateYear = item.year || this.extractMediaYear(item.name);
            if (year && candidateYear) score += Math.abs(Number(year) - Number(candidateYear)) <= 1 ? 20 : -20;
            return { item, score };
        }).sort((a, b) => b.score - a.score);
        return scored.length && scored[0].score >= 65 ? scored[0].item : null;
    }

    async getCinemetaStreams(type, id) {
        const parts = String(id || '').split(':');
        const imdbId = parts[0];
        const season = parseInt(parts[1] || '0', 10);
        const episode = parseInt(parts[2] || '0', 10);
        const meta = await this.fetchCinemetaMeta(type, imdbId);
        if (!meta) return [];

        if (type === 'movie') {
            const match = this.findBestTitleMatch(this.movies, meta.name, meta.year || this.extractMediaYear(meta.releaseInfo));
            if (!match || !match.url) return [];
            return [{
                url: match.url,
                title: \`Xtream · \${match.name}\`,
                behaviorHints: { notWebReady: true }
            }];
        }

        if (type === 'series') {
            const seriesItem = this.findBestTitleMatch(this.series, meta.name, meta.year || this.extractMediaYear(meta.releaseInfo));
            if (!seriesItem) return [];
            const seriesIdRaw = seriesItem.series_id || seriesItem.id.replace(/^iptv_series_/, '');
            const info = await this.ensureSeriesInfo(seriesIdRaw);
            const videos = info && Array.isArray(info.videos) ? info.videos : [];
            const selected = videos.find(video => Number(video.season) === season && Number(video.episode) === episode);
            if (!selected || !selected.url) return [];
            return [{
                url: selected.url,
                title: \`Xtream · \${seriesItem.name} S\${season}E\${episode}\`,
                behaviorHints: { notWebReady: true }
            }];
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
console.log('[PATCH] Cinemeta IMDb movie and series stream support applied');
