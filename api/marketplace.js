const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  if (!DISCOGS_TOKEN) { return res.status(500).json({ error: 'DISCOGS_TOKEN not set' }); }

  try {
    const url = `https://api.discogs.com/marketplace/stats/249504`;
    console.log('Fetching:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': 'VinylInventoryProxy/1.0',
        'Accept': 'application/vnd.discogs.v2.discogs+json'
      }
    });

    const text = await response.text();
    console.log('Status:', response.status);

    return res.status(200).json({ debug: true, status: response.status, body: text.substring(0, 1000) });

  } catch (e) {
    console.error('Catch error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
