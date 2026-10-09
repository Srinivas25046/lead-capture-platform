async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryProviderA(ip) {
  if (process.env.GEO_MOCK === 'true') {
    return { country: 'Mockland', city: 'Mocktown', provider: 'provider_a' };
  }

  const res = await fetchWithTimeout(`http://ip-api.com/json/${ip}`, 3000);
  if (!res.ok) throw new Error(`provider_a status ${res.status}`);
  const data = await res.json();
  if (data.status === 'fail') throw new Error('provider_a: lookup failed');
  return { country: data.country, city: data.city, provider: 'provider_a' };
}

async function tryProviderB(ip) {
  if (process.env.GEO_MOCK === 'true') {
    return { country: 'Mockland', city: 'Mocktown', provider: 'provider_b' };
  }

  const res = await fetchWithTimeout(`https://ipapi.co/${ip}/json/`, 3000);
  if (!res.ok) throw new Error(`provider_b status ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error('provider_b: lookup failed');
  return { country: data.country_name, city: data.city, provider: 'provider_b' };
}

async function lookupGeo(rawIp) {
  const ip = String(rawIp || '').replace(/^::ffff:/, ''); // strip the IPv4-in-IPv6 prefix

  if (process.env.GEO_PROVIDER_A_DISABLED === 'true') {
    console.log('Geo provider A manually disabled, skipping to provider B');
  } else {
    try {
      return await tryProviderA(ip);
    } catch (errA) {
      console.log(`Geo provider A failed (${errA.message}), trying provider B`);
    }
  }

  if (process.env.GEO_PROVIDER_B_DISABLED === 'true') {
    console.log('Geo provider B manually disabled — continuing without geo data');
    return { country: null, city: null, provider: null };
  }

  try {
    return await tryProviderB(ip);
  } catch (errB) {
    console.log(`Geo provider B also failed (${errB.message}) — continuing without geo data`);
    return { country: null, city: null, provider: null };
  }
}

module.exports = lookupGeo;