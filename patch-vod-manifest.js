const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

source = source.replace(
  'types: ["tv", "movie", "series"],',
  'types: ["movie", "series"],'
);

// Stremio caches addons by manifest id. Give each generated VOD addon a
// configuration-specific id so an older TV manifest cannot shadow it.
source = source.replace(
  'id: ADDON_ID,',
  "id: `${ADDON_ID}.vod.${crypto.createHash('md5').update(String(config.instanceId || config.xtreamUsername || 'default')).digest('hex').slice(0, 12)}`,"," 
);
source = source.replace('version: "2.0.0",', 'version: "2.1.0",');
source = source.replace('name: ADDON_NAME,', 'name: "Xtream FR / MULTI / EN",');

const tvCatalog = `            {
                type: 'tv',
                id: 'iptv_channels',
                name: 'IPTV Channels',
                extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }],
                genres: []
            },
`;

if (source.includes(tvCatalog)) {
  source = source.replace(tvCatalog, '');
}

source = source.replace(
  "extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }],\n                genres: []",
  "extra: [{ name: 'search' }, { name: 'skip' }]",
);
source = source.replace(
  "extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }],\n                genres: []",
  "extra: [{ name: 'search' }, { name: 'skip' }]",
);

source = source.replace(/\n\s*this\.buildGenresInManifest\(\);/g, '');
source = source.replace(/\n\s*addonInstance\.buildGenresInManifest\(\);/g, '');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Compact movies/series manifest with unique id applied');
