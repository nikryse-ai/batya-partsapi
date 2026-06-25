const KEY_VINDECODE   = process.env.PARTSAPI_KEY_VINDECODE;
const KEY_VINDECODEOE = process.env.PARTSAPI_KEY_VINDECODEOE;
const KEY_CROSSES     = process.env.PARTSAPI_KEY_CROSSES;
const KEY_PARTSBYIN   = process.env.PARTSAPI_KEY_PARTSBYIN;
const BASE = 'https://api.partsapi.ru';

async function callApi(params) {
  const url = BASE + '?' + new URLSearchParams({ lang: 'ru', ...params }).toString();
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { vin, oem, brand, method, cat } = req.body || {};

  // Режим прямого теста любого метода
  if (method && oem) {
    const result = await callApi({ method, key: KEY_CROSSES, number: oem, brand: brand ?? '' });
    return res.status(200).json({ method, oem, result });
  }

  // Режим теста getPartsbyVIN с категорией
  if (method === 'getPartsbyVIN' && vin && cat) {
    const type = req.body.type ?? 'oem';
    const result = await callApi({ method: 'getPartsbyVIN', key: KEY_PARTSBYIN, vin: vin.toUpperCase(), cat, type });
    return res.status(200).json({ method, vin, cat, type, result });
  }

  // Режим теста метода с VIN без категории
  if (method && vin) {
    const result = await callApi({ method, key: KEY_VINDECODEOE, vin: vin.toUpperCase() });
    return res.status(200).json({ method, vin, result });
  }

  if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid VIN' });
  }

  const vinUpper = vin.toUpperCase();

  // Стандартный режим — все шаги
  const [step1, step2] = await Promise.all([
    callApi({ method: 'VINdecode',   key: KEY_VINDECODE,   vin: vinUpper }),
    callApi({ method: 'VINdecodeOE', key: KEY_VINDECODEOE, vin: vinUpper }),
  ]);

  return res.status(200).json({
    vin: vinUpper,
    step1_vindecode:   step1,
    step2_vindecodeOE: step2,
  });
}
