const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const movieMarker = `            const matches = this.findTitleMatchesAny(this.movies, movieTitles, year, imdbId);`;
const movieReplacement = `${movieMarker}\n            console.log('[MATCH TEST]', JSON.stringify({\n                type: 'movie',\n                imdbId,\n                titles: [...new Set(movieTitles)].slice(0, 12),\n                matches: matches.slice(0, 12).map(item => ({\n                    name: item.name,\n                    language: this.getItemLanguage(item),\n                    year: item.year || this.extractMediaYear(item.name) || null\n                }))\n            }));`;
if (!source.includes(movieMarker)) throw new Error('movie diagnostics marker not found');
source = source.replace(movieMarker, movieReplacement);

const seriesMarker = `            const matches = this.findTitleMatchesAny(this.series, seriesTitles, year, imdbId).slice(0, 6);`;
const seriesReplacement = `${seriesMarker}\n            const diagnosticTokens = [...new Set(seriesTitles.flatMap(title => this.titleTokens(title)))]\n                .filter(token => token.length >= 4);\n            const nearby = (this.series || [])\n                .map(item => {\n                    const itemTokens = new Set(this.titleTokens(item.name));\n                    const overlap = diagnosticTokens.filter(token => itemTokens.has(token)).length;\n                    return { item, overlap };\n                })\n                .filter(entry => entry.overlap > 0)\n                .sort((a, b) => b.overlap - a.overlap)\n                .slice(0, 20)\n                .map(entry => ({\n                    name: entry.item.name,\n                    category: entry.item.category || entry.item.attributes?.['group-title'] || null,\n                    language: this.getItemLanguage(entry.item),\n                    overlap: entry.overlap\n                }));\n            console.log('[MATCH TEST]', JSON.stringify({\n                type: 'series',\n                imdbId,\n                titles: [...new Set(seriesTitles)].slice(0, 12),\n                matches: matches.map(item => ({\n                    name: item.name,\n                    category: item.category || item.attributes?.['group-title'] || null,\n                    language: this.getItemLanguage(item),\n                    year: item.year || this.extractMediaYear(item.name) || null\n                })),\n                nearby\n            }));`;
if (!source.includes(seriesMarker)) throw new Error('series diagnostics marker not found');
source = source.replace(seriesMarker, seriesReplacement);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Safe matching diagnostics enabled');
