const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

const marker = '\nfunction maybeDecryptConfig(token) {';
if (!source.includes(marker)) {
  throw new Error('server insertion marker not found');
}

const insertion = `
// Fixed root addon backed by Render secret environment variables.
const DEFAULT_XTREAM_ENABLED = Boolean(
  process.env.DEFAULT_XTREAM_URL &&
  process.env.DEFAULT_XTREAM_USERNAME &&
  process.env.DEFAULT_XTREAM_PASSWORD
);
const defaultAddonPromises = new Map();

function normalizeLanguageSelection(raw) {
  const allowed = new Set(['fr', 'multi', 'en']);
  const values = String(raw || 'fr-multi-en')
    .toLowerCase()
    .split('-')
    .filter(value => allowed.has(value));
  const unique = [...new Set(values)];
  return unique.length ? unique : ['fr', 'multi', 'en'];
}

function languageKey(languages) {
  return languages.join('-');
}

function getDefaultAddonInterface(rawLanguages) {
  if (!DEFAULT_XTREAM_ENABLED) {
    throw new Error('Default Xtream configuration is incomplete');
  }
  const languages = normalizeLanguageSelection(rawLanguages);
  const key = languageKey(languages);
  if (!defaultAddonPromises.has(key)) {
    const promise = createAddon({
      provider: 'xtream',
      xtreamUrl: process.env.DEFAULT_XTREAM_URL.replace(/\\/$/, ''),
      xtreamUsername: process.env.DEFAULT_XTREAM_USERNAME,
      xtreamPassword: process.env.DEFAULT_XTREAM_PASSWORD,
      xtreamUseM3U: false,
      includeSeries: true,
      enableEpg: false,
      allowedLanguages: languages,
      instanceId: 'fixed-root-xtream-' + key
    }).then((iface) => {
      iface.manifest.id = 'org.stremio.m3u-epg-addon.cinemeta.' + key.replace(/-/g, '.');
      iface.manifest.name = 'Xtream ' + languages.map(v => v.toUpperCase()).join(' / ');
      iface.manifest.version = '2.3.0';
      return iface;
    }).catch((error) => {
      defaultAddonPromises.delete(key);
      throw error;
    });
    defaultAddonPromises.set(key, promise);
  }
  return defaultAddonPromises.get(key);
}

function sendAddonManifest(iface, res) {
  const manifest = JSON.parse(JSON.stringify(iface.manifest));
  if (manifest.behaviorHints) {
    delete manifest.behaviorHints.configurationRequired;
    delete manifest.behaviorHints.configurable;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(manifest));
}

app.get('/configure-language', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(\`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Choisir les langues Xtream</title>
<style>body{font-family:system-ui,sans-serif;max-width:620px;margin:48px auto;padding:0 20px;background:#111;color:#eee}h1{font-size:28px}label{display:block;margin:14px 0;font-size:18px}button,a{display:inline-block;margin-top:20px;padding:12px 18px;border-radius:8px;border:0;background:#fff;color:#111;text-decoration:none;font-weight:700}#url{margin-top:20px;padding:12px;background:#222;border-radius:8px;word-break:break-all}</style></head>
<body><h1>Choisir les langues</h1>
<label><input type="checkbox" value="fr" checked> Français</label>
<label><input type="checkbox" value="multi" checked> MULTI</label>
<label><input type="checkbox" value="en"> Anglais</label>
<button id="generate">Générer le manifeste</button>
<div id="url"></div><a id="install" style="display:none">Installer dans Stremio</a>
<script>
const button=document.getElementById('generate');
button.onclick=()=>{const selected=[...document.querySelectorAll('input:checked')].map(x=>x.value);if(!selected.length){alert('Choisis au moins une langue');return;}const url=location.origin+'/'+selected.join('-')+'/manifest.json';document.getElementById('url').textContent=url;const install=document.getElementById('install');install.href='stremio://'+url.replace(/^https?:\\/\\//,'');install.style.display='inline-block';};
</script></body></html>\`);
});

app.get('/manifest.json', async (req, res) => {
  try {
    const iface = await getDefaultAddonInterface('fr-multi-en');
    sendAddonManifest(iface, res);
  } catch (error) {
    console.error('[DEFAULT ADDON] Manifest failed:', error.message);
    res.status(500).json({ error: 'Default addon unavailable' });
  }
});

app.get('/:languages/manifest.json', async (req, res, next) => {
  if (!/^(?:fr|multi|en)(?:-(?:fr|multi|en)){0,2}$/.test(req.params.languages)) return next();
  try {
    const iface = await getDefaultAddonInterface(req.params.languages);
    sendAddonManifest(iface, res);
  } catch (error) {
    console.error('[DEFAULT ADDON] Language manifest failed:', error.message);
    res.status(500).json({ error: 'Default addon unavailable' });
  }
});

app.use('/:languages', async (req, res, next) => {
  if (!/^(?:fr|multi|en)(?:-(?:fr|multi|en)){0,2}$/.test(req.params.languages)) return next();
  if (!/^\\/(?:catalog|stream|meta)\\//.test(req.path)) return next();
  try {
    const iface = await getDefaultAddonInterface(req.params.languages);
    const router = getRouter(iface);
    return router(req, res, next);
  } catch (error) {
    console.error('[DEFAULT ADDON] Language route failed:', error.message);
    return res.status(500).json({ error: 'Default addon unavailable' });
  }
});

app.use(async (req, res, next) => {
  if (!/^\\/(?:catalog|stream|meta)\\//.test(req.path)) return next();
  try {
    const iface = await getDefaultAddonInterface('fr-multi-en');
    const router = getRouter(iface);
    return router(req, res, next);
  } catch (error) {
    console.error('[DEFAULT ADDON] Route failed:', error.message);
    return res.status(500).json({ error: 'Default addon unavailable' });
  }
});
`;

source = source.replace(marker, insertion + marker);
fs.writeFileSync(serverPath, source);
console.log('[PATCH] Language-selectable fixed Xtream routes applied');