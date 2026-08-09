const fs = require('fs');
const path = require('path');

const addonPath = path.join(__dirname, 'addon.js');
let source = fs.readFileSync(addonPath, 'utf8');

const oldSort = `.sort((a, b) => b.score - a.score)
            .map(entry => entry.item);`;
const newSort = `.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const priority = { ES: 0, OTHER: 1, MULTI: 2, FR: 3, EN: 4 };
                return (priority[this.getItemLanguage(a.item)] ?? 9) - (priority[this.getItemLanguage(b.item)] ?? 9);
            })
            .map(entry => entry.item);`;
if (source.includes(oldSort)) source = source.replace(oldSort, newSort);

const spanishSeriesMatches = `const matches = await this.findSpanishTitleMatches(type, this.series, meta, year, imdbId);`;
const localizedSeriesMatches = `const matches = this.findTitleMatchesAny(this.series, seriesTitles, year, imdbId);`;
const legacySeriesMatches = `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId);`;
if (source.includes(spanishSeriesMatches)) {
    source = source.replace(spanishSeriesMatches, `const matches = (await this.findSpanishTitleMatches(type, this.series, meta, year, imdbId)).slice(0, 6);`);
} else if (source.includes(localizedSeriesMatches)) {
    source = source.replace(localizedSeriesMatches, `const matches = this.findTitleMatchesAny(this.series, seriesTitles, year, imdbId).slice(0, 6);`);
} else if (source.includes(legacySeriesMatches)) {
    source = source.replace(legacySeriesMatches, `const matches = this.findTitleMatchesAny(this.series, this.collectMetaTitles(meta), year, imdbId).slice(0, 6);`);
} else if (!source.includes('.slice(0, 6);')) {
    throw new Error('series matches marker not found');
}

const oldInfo = `const info = await this.ensureSeriesInfo(seriesIdRaw);`;
const newInfo = `const info = await Promise.race([
                    this.ensureSeriesInfo(seriesIdRaw),
                    new Promise(resolve => setTimeout(() => resolve({ videos: [] }), 6500))
                ]);`;
if (source.includes(oldInfo)) source = source.replace(oldInfo, newInfo);

const oldReturn = `            return results;
        }

        return [];`;
const newReturn = `            const priority = { ES: 0, OTHER: 1, MULTI: 2, FR: 3, EN: 4 };
            return results.sort((a, b) => {
                const langA = String(a.name || '').match(/·\\s*(ES|FR|MULTI|EN|OTHER)/)?.[1] || 'OTHER';
                const langB = String(b.name || '').match(/·\\s*(ES|FR|MULTI|EN|OTHER)/)?.[1] || 'OTHER';
                return (priority[langA] ?? 9) - (priority[langB] ?? 9);
            });
        }

        return [];`;
if (source.includes(oldReturn)) source = source.replace(oldReturn, newReturn);

fs.writeFileSync(addonPath, source);
console.log('[PATCH] Spanish-first stream priority and bounded series lookups applied');
