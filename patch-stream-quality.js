const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

source = source.replace('version: "2.4.0",', 'version: "2.5.0",');

const marker = '    getStream(id) {';
if (!source.includes(marker)) throw new Error('getStream marker not found');

const helper = `    getItemQuality(item, extraValue) {
        const value = [
            item?.name,
            item?.category,
            item?.attributes?.['group-title'],
            item?.quality,
            item?.resolution,
            item?.stream_quality,
            extraValue
        ].filter(Boolean).join(' ').toUpperCase();

        if (/\\b(?:4320P|8K)\\b/.test(value)) return '8K';
        if (/\\b(?:2160P|UHD|4K)\\b/.test(value)) return '4K';
        if (/\\b1440P\\b/.test(value)) return '1440p';
        if (/\\b(?:1080P|FULL[ ._-]?HD|FHD)\\b/.test(value)) return '1080p';
        if (/\\b(?:720P|HD)\\b/.test(value)) return '720p';
        if (/\\b(?:576P|480P|SD)\\b/.test(value)) return 'SD';
        return null;
    }

`;
source = source.replace(marker, helper + marker);

source = source.replace(
`                    const language = this.getItemLanguage(match);
                    return {
                        url: match.url,
                        name: \`Xtream · \${language}\`,
                        title: \`\${language} · \${match.name}\`,`,
`                    const language = this.getItemLanguage(match);
                    const quality = this.getItemQuality(match);
                    const label = quality ? \`\${language} · \${quality}\` : language;
                    return {
                        url: match.url,
                        name: \`Xtream · \${label}\`,
                        title: \`\${label} · \${match.name}\`,`
);

source = source.replace(
`                const language = this.getItemLanguage(seriesItem);
                results.push({
                    url: selected.url,
                    name: \`Xtream · \${language}\`,
                    title: \`\${language} · \${seriesItem.name} S\${season}E\${episode}\`,`,
`                const language = this.getItemLanguage(seriesItem);
                const quality = this.getItemQuality(seriesItem, selected.title);
                const label = quality ? \`\${language} · \${quality}\` : language;
                results.push({
                    url: selected.url,
                    name: \`Xtream · \${label}\`,
                    title: \`\${label} · \${seriesItem.name} S\${season}E\${episode}\`,`
);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Stream quality labels applied when available');
