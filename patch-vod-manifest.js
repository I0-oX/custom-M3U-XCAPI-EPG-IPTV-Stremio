const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const oldTypes = 'types: ["tv", "movie", "series"],';
const newTypes = 'types: ["movie", "series"],';
if (source.includes(oldTypes)) source = source.replace(oldTypes, newTypes);

const catalogsPattern = /catalogs:\s*\[\s*\{\s*type:\s*'tv',[\s\S]*?\},\s*\{\s*type:\s*'movie',[\s\S]*?\},\s*\{\s*type:\s*'series',[\s\S]*?\}\s*\],/m;
const compactCatalogs = `catalogs: [
            {
                type: 'movie',
                id: 'iptv_movies',
                name: 'IPTV Movies',
                extra: [{ name: 'search' }, { name: 'skip' }]
            },
            {
                type: 'series',
                id: 'iptv_series',
                name: 'IPTV Series',
                extra: [{ name: 'search' }, { name: 'skip' }]
            }
        ],`;

if (!catalogsPattern.test(source)) {
  throw new Error('Could not locate manifest catalogs block');
}
source = source.replace(catalogsPattern, compactCatalogs);

source = source.replace(/\n\s*addonInstance\.buildGenresInManifest\(\);/g, '');

const postBuildPattern = /\n\s*\/\/ POST-BUILD:[\s\S]*?\n\s*for \(const catalog of manifest\.catalogs\) \{[\s\S]*?\n\s*\}\n\s*\}/m;
if (postBuildPattern.test(source)) {
  source = source.replace(postBuildPattern, '');
}

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Compact VOD-only manifest applied');
