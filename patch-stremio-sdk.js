const fs = require('fs');

const builderPath = require.resolve('stremio-addon-sdk/src/builder');
let source = fs.readFileSync(builderPath, 'utf8');

const errorText = 'manifest size exceeds 8kb, which is incompatible with addonCollection API';

if (source.includes(errorText)) {
  source = source.replace(
    /throw new Error\(["'`]manifest size exceeds 8kb, which is incompatible with addonCollection API["'`]\);?/g,
    "console.warn('[SDK PATCH] Allowing manifest larger than 8kb');"
  );
  fs.writeFileSync(builderPath, source, 'utf8');
  console.log('[SDK PATCH] Removed the 8kb manifest limit');
} else {
  console.log('[SDK PATCH] Manifest limit check not found or already patched');
}
