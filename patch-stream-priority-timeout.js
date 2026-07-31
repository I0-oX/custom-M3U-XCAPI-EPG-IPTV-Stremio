const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const oldSort = `.sort((a, b) => b.score - a.score)
            .map(entry => entry.item);`;
const newSort = `.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const priority = { FR: 0, MULTI: 1, EN: 2, OTHER: 3 };
                return (priority[this.getItemLanguage(a.item)] ?? 9) - (priority[this.getItemLanguage(b.item)] ?? 9);
            })
            .map(entry => entry.item);`;
if (source.includes(oldSort)) source = source.replace(oldSort, newSort);

const oldSeriesMatches = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId);`;
const newSeriesMatches = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId).slice(0, 6);`;
if (!source.includes(oldSeriesMatches)) throw new Error('series matches marker not found');
source = source.replace(oldSeriesMatches, newSeriesMatches);

const oldInfo = `const info = await this.ensureSeriesInfo(seriesIdRaw);`;
const newInfo = `const info = await Promise.race([
                    this.ensureSeriesInfo(seriesIdRaw),
                    new Promise(resolve => setTimeout(() => resolve({ videos: [] }), 6500))
                ]);`;
if (!source.includes(oldInfo)) throw new Error('series info marker not found');
source = source.replace(oldInfo, newInfo);

const oldReturn = `            return results;
        }

        return [];`;
const newReturn = `            const priority = { FR: 0, MULTI: 1, EN: 2, OTHER: 3 };
            return results.sort((a, b) => {
                const langA = String(a.name || '').match(/·\\s*(FR|MULTI|EN|OTHER)/)?.[1] || 'OTHER';
                const langB = String(b.name || '').match(/·\\s*(FR|MULTI|EN|OTHER)/)?.[1] || 'OTHER';
                return (priority[langA] ?? 9) - (priority[langB] ?? 9);
            });
        }

        return [];`;
if (!source.includes(oldReturn)) throw new Error('series return marker not found');
source = source.replace(oldReturn, newReturn);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] French stream priority and bounded series lookups applied');
