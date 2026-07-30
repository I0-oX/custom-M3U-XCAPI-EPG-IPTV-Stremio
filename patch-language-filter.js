const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, 'src/js/providers/xtreamProvider.js');
let source = fs.readFileSync(providerPath, 'utf8');

const helperMarker = 'function keepRequestedLanguageCategory(category)';
if (!source.includes(helperMarker)) {
  const anchor = 'const fetch = require("node-fetch");\n';
  const helper = `const fetch = require("node-fetch");\n\nfunction keepRequestedLanguageCategory(category) {\n  const value = String(category || '').trim().toUpperCase();\n  if (!value) return false;\n  return (\n    /(^|[\\s|_\\-])(FR|EN|MULTI)(?=$|[\\s|_\\-])/.test(value) ||\n    /^(FRANCE|FRENCH|ENGLISH)\\b/.test(value) ||\n    value.includes('MULTI')\n  );\n}\n`;
  if (!source.includes(anchor)) throw new Error('Provider import anchor not found');
  source = source.replace(anchor, helper);
}

const movieAnchor = `    addonInstance.movies = (Array.isArray(vod) ? vod : []).map((s) => {`;
const movieReplacement = `    addonInstance.movies = (Array.isArray(vod) ? vod : []).map((s) => {`;
if (!source.includes(movieAnchor)) throw new Error('Movie mapping anchor not found');

const movieEnd = `      };\n    });\n\n    if (config.includeSeries !== false) {`;
const movieEndReplacement = `      };\n    }).filter((item) => keepRequestedLanguageCategory(item.category));\n\n    if (config.includeSeries !== false) {`;
if (!source.includes(movieEnd)) throw new Error('Movie mapping end not found');
source = source.replace(movieEnd, movieEndReplacement);

const seriesEnd = `              };\n            });\n          }`;
const seriesEndReplacement = `              };\n            }).filter((item) => keepRequestedLanguageCategory(item.category));\n          }`;
if (!source.includes(seriesEnd)) throw new Error('Series mapping end not found');
source = source.replace(seriesEnd, seriesEndReplacement);

fs.writeFileSync(providerPath, source);
console.log('[PATCH] Xtream movies and series filtered to FR, MULTI and EN categories');
