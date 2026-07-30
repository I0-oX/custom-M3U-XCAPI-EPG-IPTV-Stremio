const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

source = source.replace(
  'types: ["tv", "movie", "series"],',
  'types: ["movie", "series"],'
);

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
  "extra: [{ name: 'search' }, { name: 'skip' }]"
);
source = source.replace(
  "extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }],\n                genres: []",
  "extra: [{ name: 'search' }, { name: 'skip' }]"
);

source = source.replace(/\n\s*this\.buildGenresInManifest\(\);/g, '');
source = source.replace(/\n\s*addonInstance\.buildGenresInManifest\(\);/g, '');

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Compact movies/series manifest applied');
