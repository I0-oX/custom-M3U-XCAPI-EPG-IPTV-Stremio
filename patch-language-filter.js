const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, 'src/js/providers/xtreamProvider.js');
let source = fs.readFileSync(providerPath, 'utf8');

const helperMarker = 'function keepRequestedLanguageItem(item, allowedLanguages)';
if (!source.includes(helperMarker)) {
  const anchor = 'const fetch = require("node-fetch");\n';
  const helper = `const fetch = require("node-fetch");\n\nfunction normalizeLanguageText(value) {\n  return String(value || '')\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .trim()\n    .toUpperCase();\n}\n\nfunction detectLanguageTags(value) {\n  const normalized = normalizeLanguageText(value);\n  const detected = new Set();\n  if (!normalized) return detected;\n\n  if (/(^|[\\s|_\\-])(FR)(?=$|[\\s|_\\-])/.test(normalized) || /^(FRANCE|FRENCH)(?:\\s|$)/.test(normalized) || /\\bVOSTFR\\b/.test(normalized) || /\\bTRUEFRENCH\\b/.test(normalized) || /\\bVF\\b/.test(normalized)) detected.add('fr');\n  if (/(^|[\\s|_\\-])(EN)(?=$|[\\s|_\\-])/.test(normalized) || /^ENGLISH(?:\\s|$)/.test(normalized) || /\\bVOSTEN\\b/.test(normalized) || /\\bENG\\b/.test(normalized)) detected.add('en');\n  if (/\\bMULTI(?:LANG|LINGUAL)?\\b/.test(normalized)) detected.add('multi');\n  return detected;\n}\n\nfunction keepRequestedLanguageItem(item, allowedLanguages) {\n  const allowed = Array.isArray(allowedLanguages) && allowedLanguages.length\n    ? new Set(allowedLanguages.map(v => String(v).toLowerCase()))\n    : new Set(['fr', 'multi', 'en']);\n\n  const detected = new Set([\n    ...detectLanguageTags(item && item.category),\n    ...detectLanguageTags(item && item.name),\n    ...detectLanguageTags(item && item.attributes && item.attributes['group-title'])\n  ]);\n\n  if (!detected.size) return true;\n  for (const language of detected) {\n    if (allowed.has(language)) return true;\n  }\n  return false;\n}\n\nfunction diagnosticSeriesRows(items) {\n  return (Array.isArray(items) ? items : [])\n    .filter(item => /stargate|porte des etoiles/i.test(normalizeLanguageText(item && item.name)))\n    .map(item => ({\n      id: item.series_id || item.id || null,\n      name: item.name || null,\n      category_id: item.category_id || null,\n      category: item.category || item.category_name || null,\n      detected: [...new Set([\n        ...detectLanguageTags(item && item.category),\n        ...detectLanguageTags(item && item.category_name),\n        ...detectLanguageTags(item && item.name),\n        ...detectLanguageTags(item && item.attributes && item.attributes['group-title'])\n      ])]\n    }));\n}\n`;
  if (!source.includes(anchor)) throw new Error('Provider import anchor not found');
  source = source.replace(anchor, helper);
}

const movieAnchor = `    addonInstance.movies = (Array.isArray(vod) ? vod : []).map((s) => {`;
if (!source.includes(movieAnchor)) throw new Error('Movie mapping anchor not found');

const movieEnd = `      };\n    });\n\n    if (config.includeSeries !== false) {`;
const movieEndReplacement = `      };\n    }).filter((item) => keepRequestedLanguageItem(item, config.allowedLanguages));\n\n    if (config.includeSeries !== false) {`;
if (!source.includes(movieEnd)) throw new Error('Movie mapping end not found');
source = source.replace(movieEnd, movieEndReplacement);

const rawSeriesMarker = `          if (Array.isArray(seriesList)) {\n            addonInstance.series = seriesList.map((s) => {`;
const rawSeriesReplacement = `          if (Array.isArray(seriesList)) {\n            console.log('[XTREAM SERIES RAW]', JSON.stringify({\n              total: seriesList.length,\n              allowedLanguages: config.allowedLanguages || null,\n              stargate: diagnosticSeriesRows(seriesList),\n              frenchCategoryCount: seriesList.filter(s => [...detectLanguageTags(seriesCatMap[s.category_id] || s.category_name || '')].includes('fr')).length,\n              englishCategoryCount: seriesList.filter(s => [...detectLanguageTags(seriesCatMap[s.category_id] || s.category_name || '')].includes('en')).length\n            }));\n            addonInstance.series = seriesList.map((s) => {`;
if (!source.includes(rawSeriesMarker)) throw new Error('Raw series diagnostics marker not found');
source = source.replace(rawSeriesMarker, rawSeriesReplacement);

const seriesEnd = `              };\n            });\n          }`;
const seriesEndReplacement = `              };\n            });\n            const beforeFilter = addonInstance.series;\n            addonInstance.series = beforeFilter.filter((item) => keepRequestedLanguageItem(item, config.allowedLanguages));\n            console.log('[XTREAM SERIES FILTER]', JSON.stringify({\n              before: beforeFilter.length,\n              after: addonInstance.series.length,\n              removed: beforeFilter.length - addonInstance.series.length,\n              rawStargate: diagnosticSeriesRows(beforeFilter),\n              keptStargate: diagnosticSeriesRows(addonInstance.series),\n              removedStargate: diagnosticSeriesRows(beforeFilter.filter(item => !keepRequestedLanguageItem(item, config.allowedLanguages)))\n            }));\n          }`;
if (!source.includes(seriesEnd)) throw new Error('Series mapping end not found');
source = source.replace(seriesEnd, seriesEndReplacement);

fs.writeFileSync(providerPath, source);
console.log('[PATCH] Configurable Xtream language filter with full series ingestion diagnostics applied');