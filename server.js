const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const PRICES_FILE = path.join(__dirname, 'data', 'precios.json');
const LINEAS_FILE = path.join(__dirname, 'data', 'lineas.json');

// Redis para entornos sin disco escribible como Vercel.
// Si no hay variables configuradas se usan los archivos JSON locales.
// Acepta cualquier prefijo (KV_, STORAGE_, UPSTASH_REDIS_...):
//  - API REST (Upstash): *_REST_API_URL / *_REST_URL + su *_TOKEN (no el de solo lectura)
//  - Conexión directa: cualquier variable *URL con valor redis:// o rediss://
function findRedisEnv() {
  const env = process.env;
  for (const key of Object.keys(env)) {
    const m = key.match(/^(.*_REST(?:_API)?)_URL$/);
    if (m && env[`${m[1]}_TOKEN`]) return { url: env[key], token: env[`${m[1]}_TOKEN`] };
  }
  for (const key of Object.keys(env)) {
    if (/URL$/.test(key) && /^rediss?:\/\//.test(env[key] || '')) return { url: env[key], token: null };
  }
  return { url: null, token: null };
}
const { url: REDIS_URL, token: REDIS_TOKEN } = findRedisEnv();
const useRedis = Boolean(REDIS_URL);
const IS_VERCEL = Boolean(process.env.VERCEL);

// Cliente TCP reutilizado entre invocaciones de la función
let redisClientPromise = null;
function getRedisClient() {
  if (!redisClientPromise) {
    const { createClient } = require('redis');
    const client = createClient({ url: REDIS_URL });
    client.on('error', e => console.error('Redis:', e.message));
    redisClientPromise = client.connect().then(() => client).catch(e => {
      redisClientPromise = null;
      throw e;
    });
  }
  return redisClientPromise;
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

if (!useRedis && !IS_VERCEL) {
  // Ensure data directory exists
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
  }

  // Initialize default prices if not exists
  if (!fs.existsSync(PRICES_FILE)) {
    fs.writeFileSync(PRICES_FILE, JSON.stringify(defaultPrices(), null, 2));
  }
}

async function redis(command) {
  if (!REDIS_TOKEN) {
    const client = await getRedisClient();
    return client.sendCommand(command);
  }
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `Redis HTTP ${res.status}`);
  return json.result;
}

function readFileJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

async function load(key, file) {
  if (useRedis) {
    const raw = await redis(['GET', key]);
    if (raw) return JSON.parse(raw);
    // Sin datos aún en Redis: usar el archivo incluido en el despliegue
    return readFileJSON(file);
  }
  return readFileJSON(file);
}

async function save(key, file, data) {
  if (useRedis) {
    await redis(['SET', key, JSON.stringify(data)]);
  } else if (IS_VERCEL) {
    // Solo nombres de variables relacionadas, nunca valores
    const vistas = Object.keys(process.env).filter(k => /REDIS|KV|STORAGE|UPSTASH/i.test(k));
    throw new Error(`Redis no configurado en Vercel. Variables encontradas: ${vistas.join(', ') || 'ninguna'}. Conecte una base Redis al proyecto y haga Redeploy.`);
  } else {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

// GET all prices
app.get('/api/precios', async (req, res) => {
  try {
    const data = await load('precios', PRICES_FILE);
    res.json(data ? completarPrecios(data) : defaultPrices());
  } catch (e) {
    console.error('Error leyendo precios:', e);
    res.json(defaultPrices());
  }
});

// PUT update prices
app.put('/api/precios', async (req, res) => {
  try {
    await save('precios', PRICES_FILE, req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error guardando precios:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET valor m² por línea
app.get('/api/lineas', async (req, res) => {
  try {
    res.json((await load('lineas', LINEAS_FILE)) || []);
  } catch (e) {
    console.error('Error leyendo líneas:', e);
    res.json([]);
  }
});

// PUT update valor m² por línea
app.put('/api/lineas', async (req, res) => {
  try {
    await save('lineas', LINEAS_FILE, req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error guardando líneas:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET single price by code
app.get('/api/precios/:codigo', async (req, res) => {
  try {
    const guardados = await load('precios', PRICES_FILE);
    const data = guardados ? completarPrecios(guardados) : defaultPrices();
    const item = data.find(p => p.codigo === req.params.codigo);
    res.json(item || null);
  } catch (e) {
    res.json(null);
  }
});

function perfilesTresColores(base, descripcion, precio, peso) {
  return [['M', 'Mate'], ['B', 'Bronce'], ['C', 'Champagne']].map(([suf, nombre]) => ({
    codigo: base + suf, descripcion: `${descripcion} ${nombre}`, precio, medida: 'P', peso,
  }));
}

// Agrega al final los códigos por defecto que no estén en la lista guardada,
// sin tocar los precios que el usuario ya editó
function completarPrecios(data) {
  const existentes = new Set(data.map(p => p.codigo));
  return [...data, ...defaultPrices().filter(p => !existentes.has(p.codigo))];
}

function defaultPrices() {
  return [
    // ===== VENTANAS L-5000 =====
    { codigo: 'ALC57091M', descripcion: '5001 Riel Superior L-5000 Mate', precio: 3500, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57091B', descripcion: '5001 Riel Superior L-5000 Bronce', precio: 3800, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57091C', descripcion: '5001 Riel Superior L-5000 Champagne', precio: 3900, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57090M', descripcion: '5002 Riel Inferior L-5000 Mate', precio: 3500, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57090B', descripcion: '5002 Riel Inferior L-5000 Bronce', precio: 3800, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57090C', descripcion: '5002 Riel Inferior L-5000 Champagne', precio: 3900, medida: 'P', peso: 0.52 },
    { codigo: 'ALC57092M', descripcion: '5003 Jamba L-5000 Mate', precio: 3200, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57092B', descripcion: '5003 Jamba L-5000 Bronce', precio: 3500, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57092C', descripcion: '5003 Jamba L-5000 Champagne', precio: 3600, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57094M', descripcion: '5004 Cabezal L-5000 Mate', precio: 3200, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57094B', descripcion: '5004 Cabezal L-5000 Bronce', precio: 3500, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57094C', descripcion: '5004 Cabezal L-5000 Champagne', precio: 3600, medida: 'P', peso: 0.45 },
    { codigo: 'ALC57093M', descripcion: '5005 Hoja L-5000 Mate', precio: 4200, medida: 'P', peso: 0.68 },
    { codigo: 'ALC57093B', descripcion: '5005 Hoja L-5000 Bronce', precio: 4500, medida: 'P', peso: 0.68 },
    { codigo: 'ALC57093C', descripcion: '5005 Hoja L-5000 Champagne', precio: 4700, medida: 'P', peso: 0.68 },
    { codigo: 'ALC58044M', descripcion: '5006 Larguero Hoja L-5000 Mate', precio: 3800, medida: 'P', peso: 0.55 },
    { codigo: 'ALC58044B', descripcion: '5006 Larguero Hoja L-5000 Bronce', precio: 4100, medida: 'P', peso: 0.55 },
    { codigo: 'ALC58044C', descripcion: '5006 Larguero Hoja L-5000 Champagne', precio: 4200, medida: 'P', peso: 0.55 },
    { codigo: 'ALC58045M', descripcion: '5007 Travesaño Hoja L-5000 Mate', precio: 3800, medida: 'P', peso: 0.55 },
    { codigo: 'ALC58045B', descripcion: '5007 Travesaño Hoja L-5000 Bronce', precio: 4100, medida: 'P', peso: 0.55 },
    { codigo: 'ALC58045C', descripcion: '5007 Travesaño Hoja L-5000 Champagne', precio: 4200, medida: 'P', peso: 0.55 },
    // ===== VENTANAS AL-15 =====
    { codigo: 'AL151501M', descripcion: '1501 Riel Superior AL-15 Mate', precio: 3200, medida: 'P', peso: 0.48 },
    { codigo: 'AL151501B', descripcion: '1501 Riel Superior AL-15 Bronce', precio: 3500, medida: 'P', peso: 0.48 },
    { codigo: 'AL151501C', descripcion: '1501 Riel Superior AL-15 Champagne', precio: 3600, medida: 'P', peso: 0.48 },
    { codigo: 'AL151502M', descripcion: '1502 Riel Inferior AL-15 Mate', precio: 3200, medida: 'P', peso: 0.48 },
    { codigo: 'AL151502B', descripcion: '1502 Riel Inferior AL-15 Bronce', precio: 3500, medida: 'P', peso: 0.48 },
    { codigo: 'AL151502C', descripcion: '1502 Riel Inferior AL-15 Champagne', precio: 3600, medida: 'P', peso: 0.48 },
    { codigo: 'AL151503M', descripcion: '1503 Jamba AL-15 Mate', precio: 2900, medida: 'P', peso: 0.40 },
    { codigo: 'AL151503B', descripcion: '1503 Jamba AL-15 Bronce', precio: 3200, medida: 'P', peso: 0.40 },
    { codigo: 'AL151503C', descripcion: '1503 Jamba AL-15 Champagne', precio: 3300, medida: 'P', peso: 0.40 },
    { codigo: 'AL151504M', descripcion: '1504 Cabezal AL-15 Mate', precio: 2900, medida: 'P', peso: 0.40 },
    { codigo: 'AL151504B', descripcion: '1504 Cabezal AL-15 Bronce', precio: 3200, medida: 'P', peso: 0.40 },
    { codigo: 'AL151504C', descripcion: '1504 Cabezal AL-15 Champagne', precio: 3300, medida: 'P', peso: 0.40 },
    { codigo: 'AL151505M', descripcion: '1505 Hoja AL-15 Mate', precio: 3800, medida: 'P', peso: 0.60 },
    { codigo: 'AL151505B', descripcion: '1505 Hoja AL-15 Bronce', precio: 4100, medida: 'P', peso: 0.60 },
    { codigo: 'AL151505C', descripcion: '1505 Hoja AL-15 Champagne', precio: 4200, medida: 'P', peso: 0.60 },
    { codigo: 'AL151507M', descripcion: '1507 Larguero Hoja AL-15 Mate', precio: 3500, medida: 'P', peso: 0.52 },
    { codigo: 'AL151507B', descripcion: '1507 Larguero Hoja AL-15 Bronce', precio: 3800, medida: 'P', peso: 0.52 },
    { codigo: 'AL151507C', descripcion: '1507 Larguero Hoja AL-15 Champagne', precio: 3900, medida: 'P', peso: 0.52 },
    { codigo: 'AL151508M', descripcion: '1508 Travesaño Hoja AL-15 Mate', precio: 3500, medida: 'P', peso: 0.52 },
    { codigo: 'AL151508B', descripcion: '1508 Travesaño Hoja AL-15 Bronce', precio: 3800, medida: 'P', peso: 0.52 },
    { codigo: 'AL151508C', descripcion: '1508 Travesaño Hoja AL-15 Champagne', precio: 3900, medida: 'P', peso: 0.52 },
    // ===== VENTANAS AL-20 =====
    { codigo: 'AL202012M', descripcion: '2012 Riel Superior AL-20 Mate', precio: 3300, medida: 'P', peso: 0.50 },
    { codigo: 'AL202012B', descripcion: '2012 Riel Superior AL-20 Bronce', precio: 3600, medida: 'P', peso: 0.50 },
    { codigo: 'AL202012C', descripcion: '2012 Riel Superior AL-20 Champagne', precio: 3700, medida: 'P', peso: 0.50 },
    { codigo: 'AL202013M', descripcion: '2013 Riel Inferior AL-20 Mate', precio: 3300, medida: 'P', peso: 0.50 },
    { codigo: 'AL202013B', descripcion: '2013 Riel Inferior AL-20 Bronce', precio: 3600, medida: 'P', peso: 0.50 },
    { codigo: 'AL202013C', descripcion: '2013 Riel Inferior AL-20 Champagne', precio: 3700, medida: 'P', peso: 0.50 },
    { codigo: 'AL202027M', descripcion: '2027 Jamba AL-20 Mate', precio: 3000, medida: 'P', peso: 0.42 },
    { codigo: 'AL202027B', descripcion: '2027 Jamba AL-20 Bronce', precio: 3300, medida: 'P', peso: 0.42 },
    { codigo: 'AL202027C', descripcion: '2027 Jamba AL-20 Champagne', precio: 3400, medida: 'P', peso: 0.42 },
    { codigo: 'AL202021M', descripcion: '2021 Cabezal AL-20 Mate', precio: 3000, medida: 'P', peso: 0.42 },
    { codigo: 'AL202021B', descripcion: '2021 Cabezal AL-20 Bronce', precio: 3300, medida: 'P', peso: 0.42 },
    { codigo: 'AL202021C', descripcion: '2021 Cabezal AL-20 Champagne', precio: 3400, medida: 'P', peso: 0.42 },
    { codigo: 'AL202016M', descripcion: '2016 Hoja AL-20 Mate', precio: 3900, medida: 'P', peso: 0.62 },
    { codigo: 'AL202016B', descripcion: '2016 Hoja AL-20 Bronce', precio: 4200, medida: 'P', peso: 0.62 },
    { codigo: 'AL202016C', descripcion: '2016 Hoja AL-20 Champagne', precio: 4300, medida: 'P', peso: 0.62 },
    { codigo: 'AL202026M', descripcion: '2026 Larguero Hoja AL-20 Mate', precio: 3600, medida: 'P', peso: 0.54 },
    { codigo: 'AL202026B', descripcion: '2026 Larguero Hoja AL-20 Bronce', precio: 3900, medida: 'P', peso: 0.54 },
    { codigo: 'AL202026C', descripcion: '2026 Larguero Hoja AL-20 Champagne', precio: 4000, medida: 'P', peso: 0.54 },
    { codigo: 'AL202028M', descripcion: '2028 Travesaño Hoja AL-20 Mate', precio: 3600, medida: 'P', peso: 0.54 },
    { codigo: 'AL202028B', descripcion: '2028 Travesaño Hoja AL-20 Bronce', precio: 3900, medida: 'P', peso: 0.54 },
    { codigo: 'AL202028C', descripcion: '2028 Travesaño Hoja AL-20 Champagne', precio: 4000, medida: 'P', peso: 0.54 },
    // ===== VENTANAS AL-25 =====
    { codigo: 'AL252521M', descripcion: '2521 Riel Superior AL-25 Mate', precio: 3800, medida: 'P', peso: 0.58 },
    { codigo: 'AL252521B', descripcion: '2521 Riel Superior AL-25 Bronce', precio: 4100, medida: 'P', peso: 0.58 },
    { codigo: 'AL252521C', descripcion: '2521 Riel Superior AL-25 Champagne', precio: 4200, medida: 'P', peso: 0.58 },
    { codigo: 'AL252524M', descripcion: '2524 Riel Inferior AL-25 Mate', precio: 3800, medida: 'P', peso: 0.58 },
    { codigo: 'AL252524B', descripcion: '2524 Riel Inferior AL-25 Bronce', precio: 4100, medida: 'P', peso: 0.58 },
    { codigo: 'AL252524C', descripcion: '2524 Riel Inferior AL-25 Champagne', precio: 4200, medida: 'P', peso: 0.58 },
    { codigo: 'AL252522M', descripcion: '2522 Jamba AL-25 Mate', precio: 3500, medida: 'P', peso: 0.50 },
    { codigo: 'AL252522B', descripcion: '2522 Jamba AL-25 Bronce', precio: 3800, medida: 'P', peso: 0.50 },
    { codigo: 'AL252522C', descripcion: '2522 Jamba AL-25 Champagne', precio: 3900, medida: 'P', peso: 0.50 },
    { codigo: 'AL252507M', descripcion: '2507 Cabezal AL-25 Mate', precio: 3500, medida: 'P', peso: 0.50 },
    { codigo: 'AL252507B', descripcion: '2507 Cabezal AL-25 Bronce', precio: 3800, medida: 'P', peso: 0.50 },
    { codigo: 'AL252507C', descripcion: '2507 Cabezal AL-25 Champagne', precio: 3900, medida: 'P', peso: 0.50 },
    { codigo: 'AL252506M', descripcion: '2506 Hoja AL-25 Mate', precio: 4500, medida: 'P', peso: 0.72 },
    { codigo: 'AL252506B', descripcion: '2506 Hoja AL-25 Bronce', precio: 4800, medida: 'P', peso: 0.72 },
    { codigo: 'AL252506C', descripcion: '2506 Hoja AL-25 Champagne', precio: 4900, medida: 'P', peso: 0.72 },
    { codigo: 'AL252504M', descripcion: '2504 Larguero Hoja AL-25 Mate', precio: 4200, medida: 'P', peso: 0.65 },
    { codigo: 'AL252504B', descripcion: '2504 Larguero Hoja AL-25 Bronce', precio: 4500, medida: 'P', peso: 0.65 },
    { codigo: 'AL252504C', descripcion: '2504 Larguero Hoja AL-25 Champagne', precio: 4600, medida: 'P', peso: 0.65 },
    { codigo: 'AL252523M', descripcion: '2523 Travesaño Hoja AL-25 Mate', precio: 4200, medida: 'P', peso: 0.65 },
    { codigo: 'AL252523B', descripcion: '2523 Travesaño Hoja AL-25 Bronce', precio: 4500, medida: 'P', peso: 0.65 },
    { codigo: 'AL252523C', descripcion: '2523 Travesaño Hoja AL-25 Champagne', precio: 4600, medida: 'P', peso: 0.65 },
    // ===== PAÑO FIJO AL-32 =====
    { codigo: 'AL323201M', descripcion: '3201 Marco AL-32 Mate', precio: 4200, medida: 'P', peso: 0.65 },
    { codigo: 'AL323201B', descripcion: '3201 Marco AL-32 Bronce', precio: 4500, medida: 'P', peso: 0.65 },
    { codigo: 'AL323201C', descripcion: '3201 Marco AL-32 Champagne', precio: 4600, medida: 'P', peso: 0.65 },
    { codigo: 'AL323203M', descripcion: '3203 Junquillo AL-32 Mate', precio: 2500, medida: 'P', peso: 0.30 },
    { codigo: 'AL323203B', descripcion: '3203 Junquillo AL-32 Bronce', precio: 2800, medida: 'P', peso: 0.30 },
    { codigo: 'AL323203C', descripcion: '3203 Junquillo AL-32 Champagne', precio: 2900, medida: 'P', peso: 0.30 },
    // ===== PAÑO FIJO AL-42 =====
    { codigo: 'AL424201M', descripcion: '4201 Marco AL-42 Mate', precio: 5200, medida: 'P', peso: 0.85 },
    { codigo: 'AL424201B', descripcion: '4201 Marco AL-42 Bronce', precio: 5500, medida: 'P', peso: 0.85 },
    { codigo: 'AL424201C', descripcion: '4201 Marco AL-42 Champagne', precio: 5600, medida: 'P', peso: 0.85 },
    // ===== SHOWER DOORS AM-12 =====
    { codigo: 'AL121202M', descripcion: '1202 Jamba AM-12 Mate', precio: 3800, medida: 'P', peso: 0.55 },
    { codigo: 'AL121202B', descripcion: '1202 Jamba AM-12 Bronce', precio: 4100, medida: 'P', peso: 0.55 },
    { codigo: 'AL121202C', descripcion: '1202 Jamba AM-12 Champagne', precio: 4200, medida: 'P', peso: 0.55 },
    { codigo: 'AL121203M', descripcion: '1203 Riel Superior AM-12 Mate', precio: 3600, medida: 'P', peso: 0.52 },
    { codigo: 'AL121203B', descripcion: '1203 Riel Superior AM-12 Bronce', precio: 3900, medida: 'P', peso: 0.52 },
    { codigo: 'AL121203C', descripcion: '1203 Riel Superior AM-12 Champagne', precio: 4000, medida: 'P', peso: 0.52 },
    { codigo: 'AL121204M', descripcion: '1204 Hoja AM-12 Mate', precio: 4500, medida: 'P', peso: 0.70 },
    { codigo: 'AL121204B', descripcion: '1204 Hoja AM-12 Bronce', precio: 4800, medida: 'P', peso: 0.70 },
    { codigo: 'AL121204C', descripcion: '1204 Hoja AM-12 Champagne', precio: 4900, medida: 'P', peso: 0.70 },
    { codigo: 'AL121207M', descripcion: '1207 Travesaño AM-12 Mate', precio: 3400, medida: 'P', peso: 0.48 },
    { codigo: 'AL121207B', descripcion: '1207 Travesaño AM-12 Bronce', precio: 3700, medida: 'P', peso: 0.48 },
    { codigo: 'AL121207C', descripcion: '1207 Travesaño AM-12 Champagne', precio: 3800, medida: 'P', peso: 0.48 },
    // ===== PUERTA AM-35 =====
    { codigo: 'AL353501M', descripcion: '3501 Marco AM-35 Mate', precio: 6500, medida: 'P', peso: 1.10 },
    { codigo: 'AL353501B', descripcion: '3501 Marco AM-35 Bronce', precio: 6800, medida: 'P', peso: 1.10 },
    { codigo: 'AL353501C', descripcion: '3501 Marco AM-35 Champagne', precio: 6900, medida: 'P', peso: 1.10 },
    { codigo: 'AL353502M', descripcion: '3502 Marco Puerta AM-35 Mate', precio: 5500, medida: 'P', peso: 0.90 },
    { codigo: 'AL353502B', descripcion: '3502 Marco Puerta AM-35 Bronce', precio: 5800, medida: 'P', peso: 0.90 },
    { codigo: 'AL353502C', descripcion: '3502 Marco Puerta AM-35 Champagne', precio: 5900, medida: 'P', peso: 0.90 },
    { codigo: 'AL353510M', descripcion: '3510 Junquillo AM-35 Mate', precio: 2800, medida: 'P', peso: 0.35 },
    { codigo: 'AL353510B', descripcion: '3510 Junquillo AM-35 Bronce', precio: 3100, medida: 'P', peso: 0.35 },
    { codigo: 'AL353510C', descripcion: '3510 Junquillo AM-35 Champagne', precio: 3200, medida: 'P', peso: 0.35 },
    { codigo: 'AL353506M', descripcion: '3506 Tapa AM-35 Mate', precio: 2500, medida: 'P', peso: 0.32 },
    { codigo: 'AL353506B', descripcion: '3506 Tapa AM-35 Bronce', precio: 2800, medida: 'P', peso: 0.32 },
    { codigo: 'AL353506C', descripcion: '3506 Tapa AM-35 Champagne', precio: 2900, medida: 'P', peso: 0.32 },
    // ===== ACCESORIOS COMUNES =====
    { codigo: 'SOBU1003', descripcion: 'Burlete Estándar', precio: 850, medida: 'P', peso: 1 },
    { codigo: 'SOBU302', descripcion: 'Burlete Reforzado', precio: 920, medida: 'P', peso: 1 },
    { codigo: 'SOBU305', descripcion: 'Burlete AL-25', precio: 950, medida: 'P', peso: 1 },
    { codigo: 'SOVAFEL5', descripcion: 'Felpa 5mm', precio: 420, medida: 'P', peso: 1 },
    { codigo: 'SOVAFEL7', descripcion: 'Felpa 7mm', precio: 480, medida: 'P', peso: 1 },
    { codigo: 'SOTB83/4MB', descripcion: 'Tornillo 8x3/4 Mate', precio: 95, medida: 'U', peso: 1 },
    { codigo: 'SOTB83/4BB', descripcion: 'Tornillo 8x3/4 Bronce', precio: 95, medida: 'U', peso: 1 },
    { codigo: 'SOTB85/8MB', descripcion: 'Tornillo 8x5/8 Mate', precio: 90, medida: 'U', peso: 1 },
    { codigo: 'SOTB85/8BB', descripcion: 'Tornillo 8x5/8 Bronce', precio: 90, medida: 'U', peso: 1 },
    { codigo: 'SOTB81/2MB', descripcion: 'Tornillo 8x1/2 Mate', precio: 85, medida: 'U', peso: 1 },
    { codigo: 'SOTB81/2BB', descripcion: 'Tornillo 8x1/2 Bronce', precio: 85, medida: 'U', peso: 1 },
    { codigo: 'SOTB81/2BP', descripcion: 'Tornillo 8x1/2 Bronce Pan', precio: 90, medida: 'U', peso: 1 },
    { codigo: 'SOTP81/2MP', descripcion: 'Tornillo 8x1/2 Mate Pan', precio: 90, medida: 'U', peso: 1 },
    { codigo: 'SOTB61/4MB', descripcion: 'Tornillo 6x1/4 Mate', precio: 75, medida: 'U', peso: 1 },
    { codigo: 'SOTB61/4BB', descripcion: 'Tornillo 6x1/4 Bronce', precio: 75, medida: 'U', peso: 1 },
    { codigo: 'SOTB61/2MB', descripcion: 'Tornillo 6x1/2 Mate', precio: 80, medida: 'U', peso: 1 },
    { codigo: 'SOTB61/2BB', descripcion: 'Tornillo 6x1/2 Bronce', precio: 80, medida: 'U', peso: 1 },
    { codigo: 'SOTB8X1-MB', descripcion: 'Tornillo 8x1 Mate', precio: 100, medida: 'U', peso: 1 },
    { codigo: 'SOTB8X1-BB', descripcion: 'Tornillo 8x1 Bronce', precio: 100, medida: 'U', peso: 1 },
    { codigo: 'SOTB1112MB', descripcion: 'Tornillo 11x1/2 Mate', precio: 110, medida: 'U', peso: 1 },
    { codigo: 'SOTB1112BB', descripcion: 'Tornillo 11x1/2 Bronce', precio: 110, medida: 'U', peso: 1 },
    { codigo: 'SOTB63/8MB', descripcion: 'Tornillo 6x3/8 Mate', precio: 72, medida: 'U', peso: 1 },
    { codigo: 'SOTB63/8BB', descripcion: 'Tornillo 6x3/8 Bronce', precio: 72, medida: 'U', peso: 1 },
    { codigo: 'SOTBESPECI', descripcion: 'Tornillo Especial', precio: 120, medida: 'U', peso: 1 },
    { codigo: 'SORM4X10MM', descripcion: 'Remache 4x10mm', precio: 45, medida: 'U', peso: 1 },
    { codigo: 'SOVATARUS6', descripcion: 'Tarugo 6mm', precio: 55, medida: 'U', peso: 1 },
    { codigo: 'SOCRL-5000', descripcion: 'Carro L-5000', precio: 1850, medida: 'U', peso: 1 },
    { codigo: 'SOCRAL-15', descripcion: 'Carro AL-15', precio: 1650, medida: 'U', peso: 1 },
    { codigo: 'SOCRPABOSE', descripcion: 'Carro Pabosé', precio: 1750, medida: 'U', peso: 1 },
    { codigo: 'SOCRAL-25', descripcion: 'Carro AL-25', precio: 1780, medida: 'U', peso: 1 },
    { codigo: 'SOCRGT264', descripcion: 'Rodamiento GT264', precio: 2200, medida: 'U', peso: 1 },
    { codigo: 'SOCRAM-12', descripcion: 'Carro AM-12', precio: 1950, medida: 'U', peso: 1 },
    { codigo: 'SOPS5000M', descripcion: 'Pestillo L-5000 Mate', precio: 3200, medida: 'U', peso: 1 },
    { codigo: 'SOPS5000B', descripcion: 'Pestillo L-5000 Bronce', precio: 3500, medida: 'U', peso: 1 },
    { codigo: 'SOPSAL15M', descripcion: 'Pestillo AL-15 Mate', precio: 2800, medida: 'U', peso: 1 },
    { codigo: 'SOPSAL15B', descripcion: 'Pestillo AL-15 Bronce', precio: 3100, medida: 'U', peso: 1 },
    { codigo: 'SOOPDOB-M', descripcion: 'Pestillo Doble Mate', precio: 3500, medida: 'U', peso: 1 },
    { codigo: 'SOOPDOB-B', descripcion: 'Pestillo Doble Bronce', precio: 3800, medida: 'U', peso: 1 },
    { codigo: 'SOPSPRATIK', descripcion: 'Cierre Pratika', precio: 4200, medida: 'U', peso: 1 },
    { codigo: 'SOPSCARAM', descripcion: 'Caracol Mate', precio: 2500, medida: 'U', peso: 1 },
    { codigo: 'SOPSCARAC', descripcion: 'Caracol Bronce', precio: 2700, medida: 'U', peso: 1 },
    { codigo: 'SOPSPALAC', descripcion: 'Pestillo Palanca', precio: 3800, medida: 'U', peso: 1 },
    { codigo: 'SOGUL-5000', descripcion: 'Guía L-5000', precio: 950, medida: 'U', peso: 1 },
    { codigo: 'SOGUAL-15', descripcion: 'Guía AL-15', precio: 850, medida: 'U', peso: 1 },
    { codigo: 'SOGUAL-25', descripcion: 'Guía AL-25', precio: 880, medida: 'U', peso: 1 },
    { codigo: 'SOGUAL33', descripcion: 'Guía AL-33', precio: 900, medida: 'U', peso: 1 },
    { codigo: 'SOGU12INTE', descripcion: 'Guía Interior AM-12', precio: 920, medida: 'U', peso: 1 },
    { codigo: 'SOGU12EXTE', descripcion: 'Guía Exterior AM-12', precio: 920, medida: 'U', peso: 1 },
    { codigo: 'SOVAOCLUSO', descripcion: 'Oclusor', precio: 1800, medida: 'U', peso: 1 },
    { codigo: 'SOVAQUI/ME', descripcion: 'Quicio Mecánico', precio: 8500, medida: 'U', peso: 1 },
    { codigo: 'SOVAQUI/HD', descripcion: 'Quicio Hidráulico', precio: 15000, medida: 'U', peso: 1 },
    { codigo: 'SOVATOPEGO', descripcion: 'Tapa Tornillo', precio: 350, medida: 'U', peso: 1 },
    { codigo: 'SOESEAM-12', descripcion: 'Escuadra AM-12', precio: 680, medida: 'U', peso: 1 },
    { codigo: 'SOESCAM-12', descripcion: 'Cuña AM-12', precio: 420, medida: 'U', peso: 1 },
    { codigo: 'SOESEAM-35', descripcion: 'Escuadra AM-35', precio: 720, medida: 'U', peso: 1 },
    { codigo: 'SOESEAL-32', descripcion: 'Escuadra AL-32', precio: 650, medida: 'U', peso: 1 },
    { codigo: 'SOESCAL-42', descripcion: 'Cuña AL-42', precio: 480, medida: 'U', peso: 1 },
    { codigo: 'SOES5050M', descripcion: 'Escuadra 50x50 Mate', precio: 750, medida: 'U', peso: 1 },
    { codigo: 'SOES0302', descripcion: 'Escuadra 030x2', precio: 580, medida: 'U', peso: 1 },
    { codigo: 'SOES0435', descripcion: 'Escuadra 04x35', precio: 620, medida: 'U', peso: 1 },
    { codigo: 'SOES0437', descripcion: 'Escuadra 04x37', precio: 640, medida: 'U', peso: 1 },
    { codigo: 'SOBUB-132', descripcion: 'Burlete Base 132', precio: 780, medida: 'P', peso: 1 },
    { codigo: 'SOBUDC-132', descripcion: 'Burlete DC 132', precio: 820, medida: 'P', peso: 1 },
    { codigo: 'SOBUB-AL42', descripcion: 'Burlete Base AL-42', precio: 850, medida: 'P', peso: 1 },
    { codigo: 'SOBUC-600', descripcion: 'Burlete Cuña 600', precio: 880, medida: 'P', peso: 1 },
    { codigo: 'SOBUDC142', descripcion: 'Burlete DC 142', precio: 860, medida: 'P', peso: 1 },
    { codigo: 'SOBUBMC', descripcion: 'Burlete BMC', precio: 910, medida: 'P', peso: 1 },
    { codigo: 'SOMA625DM', descripcion: 'Manilla 625 Doble Mate', precio: 4500, medida: 'U', peso: 1 },
    { codigo: 'SOMA625DB', descripcion: 'Manilla 625 Doble Bronce', precio: 4800, medida: 'U', peso: 1 },
    { codigo: 'SOMA635DM', descripcion: 'Manilla 635 Doble Mate', precio: 4700, medida: 'U', peso: 1 },
    { codigo: 'SOMA635DB', descripcion: 'Manilla 635 Doble Bronce', precio: 5000, medida: 'U', peso: 1 },
    { codigo: 'SOBSAL32M', descripcion: 'Bisagra AL-32 Mate', precio: 2800, medida: 'U', peso: 1 },
    { codigo: 'SOBSAL32B', descripcion: 'Bisagra AL-32 Bronce', precio: 3100, medida: 'U', peso: 1 },
    { codigo: 'SOBSAM35M', descripcion: 'Bisagra AM-35 Mate', precio: 3200, medida: 'U', peso: 1 },
    { codigo: 'SOBSAM35B', descripcion: 'Bisagra AM-35 Bronce', precio: 3500, medida: 'U', peso: 1 },
    { codigo: 'SOBSP-45M', descripcion: 'Bisagra SP-45 Mate', precio: 2600, medida: 'U', peso: 1 },
    { codigo: 'SOBSP-45B', descripcion: 'Bisagra SP-45 Bronce', precio: 2900, medida: 'U', peso: 1 },
    { codigo: 'SOEXNB30B', descripcion: 'Brazo Extensión 30 Bronce', precio: 5500, medida: 'U', peso: 1 },
    { codigo: 'SOEXDA35B1', descripcion: 'Brazo DA-35 Bronce', precio: 5800, medida: 'U', peso: 1 },
    { codigo: 'SOCE1080MM', descripcion: 'Chapa 1080 Mate-Mate', precio: 12000, medida: 'U', peso: 1 },
    { codigo: 'SOCE1080BM', descripcion: 'Chapa 1080 Bronce-Mate', precio: 12500, medida: 'U', peso: 1 },
    { codigo: 'SOCE1080MC', descripcion: 'Chapa 1080 Mate-Champagne', precio: 12200, medida: 'U', peso: 1 },
    { codigo: 'SOCE1080BC', descripcion: 'Chapa 1080 Bronce-Champagne', precio: 12700, medida: 'U', peso: 1 },
    { codigo: 'SOTIAM-12', descripcion: 'Tirador AM-12', precio: 2200, medida: 'U', peso: 1 },
    { codigo: 'SOTIAM35M', descripcion: 'Tirador AM-35 Mate', precio: 2500, medida: 'U', peso: 1 },
    { codigo: 'SOTIAM35B', descripcion: 'Tirador AM-35 Bronce', precio: 2800, medida: 'U', peso: 1 },
    { codigo: 'ALSILICOM', descripcion: 'Silicona Transparente', precio: 3500, medida: 'U', peso: 1 },
    { codigo: 'ALSILICOB', descripcion: 'Silicona Bronce', precio: 3800, medida: 'U', peso: 1 },
    { codigo: 'SOVACONPLA', descripcion: 'Contraplaca', precio: 1500, medida: 'U', peso: 1 },
    { codigo: 'SOVATOES33', descripcion: 'Tope Estanco', precio: 850, medida: 'U', peso: 1 },
    { codigo: 'SOVACL4401', descripcion: 'Clip 4401', precio: 380, medida: 'U', peso: 1 },
    { codigo: 'SOVAPEREXP', descripcion: 'Perno Expansión', precio: 450, medida: 'U', peso: 1 },
    { codigo: 'ALCO5051M', descripcion: 'Junquillo 5051 Mate', precio: 2200, medida: 'P', peso: 0.28 },
    { codigo: 'ALCO5051B', descripcion: 'Junquillo 5051 Bronce', precio: 2500, medida: 'P', peso: 0.28 },
    { codigo: 'ALCO5051C', descripcion: 'Junquillo 5051 Champagne', precio: 2600, medida: 'P', peso: 0.28 },
    { codigo: 'ALCO5029M', descripcion: 'Junquillo 5029 Mate', precio: 2100, medida: 'P', peso: 0.25 },
    { codigo: 'ALCO5029B', descripcion: 'Junquillo 5029 Bronce', precio: 2400, medida: 'P', peso: 0.25 },
    { codigo: 'ALCO5029C', descripcion: 'Junquillo 5029 Champagne', precio: 2500, medida: 'P', peso: 0.25 },
    // ===== VIDRIOS =====
    { codigo: 'VD4MM', descripcion: 'Vidrio 4mm Transparente', precio: 8500, medida: 'A', peso: 1 },
    { codigo: 'VD5INC', descripcion: 'Vidrio 5mm Incoloro', precio: 10000, medida: 'A', peso: 1 },
    { codigo: 'VD6MM', descripcion: 'Vidrio 6mm Transparente', precio: 12000, medida: 'A', peso: 1 },
    { codigo: 'VD4REF', descripcion: 'Vidrio 4mm Reflectante', precio: 11000, medida: 'A', peso: 1 },
    { codigo: 'VD6REF', descripcion: 'Vidrio 6mm Reflectante', precio: 15000, medida: 'A', peso: 1 },
    { codigo: 'ACRILICO', descripcion: 'Panel Acrílico', precio: 18000, medida: 'U', peso: 1 },
    // ===== MARCOS PUERTA =====
    { codigo: 'AL455034M', descripcion: '5034 Marco Puerta Mate', precio: 7500, medida: 'P', peso: 1.20 },
    { codigo: 'AL455034B', descripcion: '5034 Marco Puerta Bronce', precio: 7800, medida: 'P', peso: 1.20 },
    { codigo: 'AL455034C', descripcion: '5034 Marco Puerta Champagne', precio: 7900, medida: 'P', peso: 1.20 },
    { codigo: 'AL457095M', descripcion: '7095 Marco Puerta Mate', precio: 8200, medida: 'P', peso: 1.35 },
    { codigo: 'AL457095B', descripcion: '7095 Marco Puerta Bronce', precio: 8500, medida: 'P', peso: 1.35 },
    { codigo: 'AL457095C', descripcion: '7095 Marco Puerta Champagne', precio: 8600, medida: 'P', peso: 1.35 },
    { codigo: 'ALTR8024M', descripcion: '3060 Tubo Rect. Marco Puerta Mate', precio: 5500, medida: 'P', peso: 0.95 },
    { codigo: 'ALTR8024B', descripcion: '3060 Tubo Rect. Marco Puerta Bronce', precio: 5800, medida: 'P', peso: 0.95 },
    { codigo: 'ALTR8024C', descripcion: '3060 Tubo Rect. Marco Puerta Champagne', precio: 5900, medida: 'P', peso: 0.95 },
    { codigo: 'ALTR8006M', descripcion: '2576 Tubo Rect. Mate', precio: 5200, medida: 'P', peso: 0.88 },
    { codigo: 'ALTR8006B', descripcion: '2576 Tubo Rect. Bronce', precio: 5500, medida: 'P', peso: 0.88 },
    { codigo: 'ALTR8006C', descripcion: '2576 Tubo Rect. Champagne', precio: 5600, medida: 'P', peso: 0.88 },
    { codigo: 'ALTR8014M', descripcion: '2066 Tubo Rect. Mate', precio: 4800, medida: 'P', peso: 0.78 },
    { codigo: 'ALTR8014B', descripcion: '2066 Tubo Rect. Bronce', precio: 5100, medida: 'P', peso: 0.78 },
    { codigo: 'ALTR8014C', descripcion: '2066 Tubo Rect. Champagne', precio: 5200, medida: 'P', peso: 0.78 },
    { codigo: 'ALTR8016M', descripcion: '4080 Tubo Rect. Puerta Vaiven Mate', precio: 6500, medida: 'P', peso: 1.05 },
    { codigo: 'ALTR8016B', descripcion: '4080 Tubo Rect. Puerta Vaiven Bronce', precio: 6800, medida: 'P', peso: 1.05 },
    { codigo: 'ALTR8016C', descripcion: '4080 Tubo Rect. Puerta Vaiven Champagne', precio: 6900, medida: 'P', peso: 1.05 },
    { codigo: 'ALTC8003M', descripcion: '4040 Tubo Cuad. Puerta Abatir Mate', precio: 6200, medida: 'P', peso: 1.00 },
    { codigo: 'ALTC8003B', descripcion: '4040 Tubo Cuad. Puerta Abatir Bronce', precio: 6500, medida: 'P', peso: 1.00 },
    { codigo: 'ALTC8003C', descripcion: '4040 Tubo Cuad. Puerta Abatir Champagne', precio: 6600, medida: 'P', peso: 1.00 },
    // ===== PUERTA VAIVEN - TALONERA =====
    { codigo: 'AL455031M', descripcion: '5031 Talonera Mate', precio: 3200, medida: 'P', peso: 0.45 },
    { codigo: 'AL455031B', descripcion: '5031 Talonera Bronce', precio: 3500, medida: 'P', peso: 0.45 },
    { codigo: 'AL455031C', descripcion: '5031 Talonera Champagne', precio: 3600, medida: 'P', peso: 0.45 },
    { codigo: 'AL353507M', descripcion: '3507 Tapa Porta Felpa Mate', precio: 2900, medida: 'P', peso: 0.38 },
    { codigo: 'AL353507B', descripcion: '3507 Tapa Porta Felpa Bronce', precio: 3200, medida: 'P', peso: 0.38 },
    { codigo: 'AL353507C', descripcion: '3507 Tapa Porta Felpa Champagne', precio: 3300, medida: 'P', peso: 0.38 },
    // ===== ABATIR AL-32 extras =====
    { codigo: 'AL323202M', descripcion: '3202 Marco Abatir AL-32 Mate', precio: 4300, medida: 'P', peso: 0.68 },
    { codigo: 'AL323202B', descripcion: '3202 Marco Abatir AL-32 Bronce', precio: 4600, medida: 'P', peso: 0.68 },
    { codigo: 'AL323202C', descripcion: '3202 Marco Abatir AL-32 Champagne', precio: 4700, medida: 'P', peso: 0.68 },
    { codigo: 'AL424202M', descripcion: '4202 Marco Abatir AL-42 Mate', precio: 5400, medida: 'P', peso: 0.88 },
    { codigo: 'AL424202B', descripcion: '4202 Marco Abatir AL-42 Bronce', precio: 5700, medida: 'P', peso: 0.88 },
    { codigo: 'AL424202C', descripcion: '4202 Marco Abatir AL-42 Champagne', precio: 5800, medida: 'P', peso: 0.88 },
    { codigo: 'AL353509M', descripcion: '3509 Post. Intermedio AM-35 Mate', precio: 3800, medida: 'P', peso: 0.58 },
    { codigo: 'AL353509B', descripcion: '3509 Post. Intermedio AM-35 Bronce', precio: 4100, medida: 'P', peso: 0.58 },
    { codigo: 'AL353509C', descripcion: '3509 Post. Intermedio AM-35 Champagne', precio: 4200, medida: 'P', peso: 0.58 },
    { codigo: 'ALTA5000M', descripcion: 'Tubo Alto 5000 Mate', precio: 3600, medida: 'P', peso: 0.55 },
    { codigo: 'ALTA5000B', descripcion: 'Tubo Alto 5000 Bronce', precio: 3900, medida: 'P', peso: 0.55 },
    { codigo: 'ALTA5000C', descripcion: 'Tubo Alto 5000 Champagne', precio: 4000, medida: 'P', peso: 0.55 },
    { codigo: 'AL121512M', descripcion: '1512 Intermedio AM-12 Mate', precio: 3500, medida: 'P', peso: 0.50 },
    { codigo: 'AL121512B', descripcion: '1512 Intermedio AM-12 Bronce', precio: 3800, medida: 'P', peso: 0.50 },
    { codigo: 'AL121512C', descripcion: '1512 Intermedio AM-12 Champagne', precio: 3900, medida: 'P', peso: 0.50 },
    // ===== PERFILES DE OPCIONES (cámara, palillos, 4 hojas) =====
    ...perfilesTresColores('AL202029', '2029 Riel Superior Cámara AL-20', 5600, 0.50),
    ...perfilesTresColores('AL202022', '2022 Palillo AL-20', 5600, 0.54),
    ...perfilesTresColores('AL252516', '2516 Palillo AL-25', 5600, 0.65),
    ...perfilesTresColores('AL252512', '2512 Perfil 4ª Hoja AL-25', 5600, 0.65),
    ...perfilesTresColores('AL323204', '3204 Palillo Vertical AL-32', 5600, 0.65),
    ...perfilesTresColores('AL323205', '3205 Palillo Horizontal AL-32', 5600, 0.65),
    ...perfilesTresColores('AL424214', '4214 Perfil Cámara AL-42', 5600, 0.85),
  ];
}

app.listen(PORT, () => {
  console.log(`\n✅ Sistema de Aluminio corriendo en http://localhost:${PORT}\n`);
});
