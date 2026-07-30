const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, 'src/js/providers/xtreamProvider.js');
let source = fs.readFileSync(providerPath, 'utf8');

const helperMarker = 'function keepRequestedLanguageCategory(category, allowedLanguages)';
if (!source.includes(helperMarker)) {
  const anchor = 'const fetch = require("node-fetch");\n';
  const helper = `const fetch = require("node-fetch");\n\nfunction detectCategoryLanguages(category) {\n  const value = String(category || '').trim().toUpperCase();\n  const detected = new Set();\n  if (!value) return detected;\n\n  if (/(^|[\\s|_\\-])(FR)(?=$|[\\s|_\\-])/.test(value) || /^(FRANCE|FRENCH)\\b/.test(value) || /\\bVOSTFR\\b/.test(value) || /\\bVF\\b/.test(value)) detected.add('fr');\n  if (/(^|[\\s|_\\-])(EN)(?=$|[\\s|_\\-])/.test(value) || /^ENGLISH\\b/.test(value) || /\\bVOSTEN\\b/.test(value)) detected.add('en');\n  if (value.includes('MULTI') || value.includes('MULTILANG')) detected.add('multi');\n  return detected;\n}\n\nfunction keepRequestedLanguageCategory(category, allowedLanguages) {\n  const allowed = Array.isArray(allowedLanguages) && allowedLanguages.length\n    ? new Set(allowedLanguages.map(v => String(v).toLowerCase()))\n    : new Set(['fr', 'multi', 'en']);\n  const detected = detectCategoryLanguages(category);\n  for (const language of detected) {\n    if (allowed.has(language)) return true;\n  }\n  return false;\n}\n`;
  if (!source.includes(anchor)) throw new Error('Provider import anchor not found');
  source = source.replace(anchor, helper);
}

const movieAnchor = `    addonInstance.movies = (Array.isArray(vod) ? vod : []).map((s) => {`;
if (!source.includes(movieAnchor)) throw new Error('Movie mapping anchor not found');

const movieEnd = `      };\n    });\n\n    if (config.includeSeries !== false) {`;
const movieEndReplacement = `      };\n    }).filter((item) => keepRequestedLanguageCategory(item.category, config.allowedLanguages));\n\n    if (config.includeSeries !== false) {`;
if (!source.includes(movieEnd)) throw new Error('Movie mapping end not found');
source = source.replace(movieEnd, movieEndReplacement);

const seriesEnd = `              };\n            });\n          }`;
const seriesEndReplacement = `              };\n            }).filter((item) => keepRequestedLanguageCategory(item.category, config.allowedLanguages));\n          }`;
if (!source.includes(seriesEnd)) throw new Error('Series mapping end not found');
source = source.replace(seriesEnd, seriesEndReplacement);

fs.writeFileSync(providerPath, source);
console.log('[PATCH] Configurable Xtream language filter applied');