const KEY_VINDECODE    = process.env.PARTSAPI_KEY_VINDECODE;
const KEY_VINDECODEOE  = process.env.PARTSAPI_KEY_VINDECODEOE;
const KEY_CROSSES      = process.env.PARTSAPI_KEY_CROSSES;
const BASE = 'https://partsapi.ru/api/';

async function callApi(key, params) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key, lang: 'ru', ...params }).toString(),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vin } = req.body || {};

  if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid VIN' });
  }

  const vinUpper = vin.toUpperCase();

  // Шаги 1 + 2 параллельно
  const [step1, step2] = await Promise.all([
    callApi(KEY_VINDECODE,   { method: 'VINdecode',    vin: vinUpper }),
    callApi(KEY_VINDECODEOE, { method: 'VINdecodeOE',  vin: vinUpper }),
  ]);

  // Пробуем вытащить OEM из ответа шага 2 для шага 3
  let oemFound = [];
  let oemUsedForStep3 = null;
  let step3 = null;

  try {
    const items = Array.isArray(step2) ? step2
      : Array.isArray(step2?.result) ? step2.result
      : Array.isArray(step2?.data) ? step2.data
      : [];

    oemFound = items
      .map(item => ({
        oem:   item.oem   ?? item.article    ?? item.number      ?? item.partNumber ?? null,
        brand: item.brand ?? item.manufacturer ?? item.mfr       ?? null,
        name:  item.name  ?? item.partName   ?? item.description ?? null,
      }))
      .filter(i => i.oem);

    if (oemFound.length > 0) {
      oemUsedForStep3 = oemFound[0].oem;
      step3 = await callApi(KEY_CROSSES, {
        method: 'getCrossesTitle',
        oem:   oemUsedForStep3,
        brand: oemFound[0].brand ?? '',
      });
    }
  } catch (e) {
    oemFound = [{ parseError: e.message }];
  }

  return res.status(200).json({
    vin: vinUpper,
    step1_vindecode:    step1,
    step2_vindecodeOE:  step2,
    step3_crosses:      step3,
    debug: {
      carName:          step1?.name ?? step1?.car ?? step1?.result ?? null,
      oemFound,
      oemUsedForStep3,
    },
  });
}
