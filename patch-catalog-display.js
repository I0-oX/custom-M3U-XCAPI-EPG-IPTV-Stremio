const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const movieCatalogMarker = "id: 'iptv_movies'";
if (!source.includes(movieCatalogMarker)) throw new Error('Movie catalog marker not found');

const methodMarker = '    generateMetaPreview(item) {';
if (!source.includes(methodMarker)) throw new Error('Catalog preview marker not found');

const helpers = `    getCatalogDisplayName(item) {
        return String(item?.name || '')
            .replace(/^(?:(?:ES|ESP|SPA|SPANISH|ESPAÑOL)\\s*\\|\\s*)+/i, '')
            .trim();
    }

`;
source = source.replace(methodMarker, helpers + methodMarker);

const previewOld = 'const meta = { id: item.id, type: item.type, name: item.name };';
const previewNew = 'const meta = { id: item.id, type: item.type, name: this.getCatalogDisplayName(item) };';
if (!source.includes(previewOld)) throw new Error('Catalog preview name marker not found');
source = source.replace(previewOld, previewNew);

const tvDetailOld = `                name: item.name,
                poster: this.deriveFallbackLogoUrl(item),`;
const tvDetailNew = `                name: this.getCatalogDisplayName(item),
                poster: this.deriveFallbackLogoUrl(item),`;
if (!source.includes(tvDetailOld)) throw new Error('TV detail name marker not found');
source = source.replace(tvDetailOld, tvDetailNew);

const movieDetailOld = `                name: item.name,
                poster: item.poster || item.attributes?.['tvg-logo'] ||`;
const movieDetailNew = `                name: this.getCatalogDisplayName(item),
                poster: item.poster || item.attributes?.['tvg-logo'] ||`;
if (!source.includes(movieDetailOld)) throw new Error('Movie detail name marker not found');
source = source.replace(movieDetailOld, movieDetailNew);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Catalog names hide language prefixes; movie catalog retained');
