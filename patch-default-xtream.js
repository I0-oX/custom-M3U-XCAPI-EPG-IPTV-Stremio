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
let defaultAddonPromise = null;

function getDefaultAddonInterface() {
  if (!DEFAULT_XTREAM_ENABLED) {
    throw new Error('Default Xtream configuration is incomplete');
  }
  if (!defaultAddonPromise) {
    defaultAddonPromise = createAddon({
      provider: 'xtream',
      xtreamUrl: process.env.DEFAULT_XTREAM_URL.replace(/\\/$/, ''),
      xtreamUsername: process.env.DEFAULT_XTREAM_USERNAME,
      xtreamPassword: process.env.DEFAULT_XTREAM_PASSWORD,
      xtreamUseM3U: false,
      includeSeries: true,
      enableEpg: false,
      instanceId: 'fixed-root-xtream'
    }).catch((error) => {
      defaultAddonPromise = null;
      throw error;
    });
  }
  return defaultAddonPromise;
}

app.get('/manifest.json', async (req, res) => {
  try {
    const iface = await getDefaultAddonInterface();
    const manifest = JSON.parse(JSON.stringify(iface.manifest));
    if (manifest.behaviorHints) {
      delete manifest.behaviorHints.configurationRequired;
      delete manifest.behaviorHints.configurable;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(manifest));
  } catch (error) {
    console.error('[DEFAULT ADDON] Manifest failed:', error.message);
    res.status(500).json({ error: 'Default addon unavailable' });
  }
});

app.use(async (req, res, next) => {
  if (!/^\\/(?:catalog|stream|meta)\\//.test(req.path)) return next();
  try {
    const iface = await getDefaultAddonInterface();
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
console.log('[PATCH] Fixed root Xtream addon routes applied');
