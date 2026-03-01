// Discogs マーケットプレイス相場取得
// Vercel Serverless Function
// エンドポイント: /api/marketplace?release_id=xxx
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }
  if (req.method !== 'GET') { return res.status(405).json({ error: 'Method not allowed' }); }

  const { release_id } = req.query;
  if (!release_id) { return res.status(400).json({ error: 'release_id is required' }); }

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'VinylInventoryProxy/1.0';
  if (!DISCOGS_TOKEN) { return res.status(500).json({ error: 'DISCOGS_TOKEN not set' }); }

  try {
    const url = `https://api.discogs.com/marketplace/stats/${encodeURIComponent(release_id)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': DISCOGS_USER_AGENT,
        'Accept': 'application/vnd.discogs.v2.discogs+json'
      }
    });

    const status = response.status;
    const data = await response.json();

    if (status === 200) {
      return res.status(200).json({
        success: true,
        num_for_sale: data.num_for_sale || 0,
        lowest_price: data.lowest_price ? data.lowest_price.value : null,
        currency: data.lowest_price ? data.lowest_price.currency : null
      });
    } else {
      return res.status(status).json({
        success: false,
        error: data.message || 'Discogs API error'
      });
    }
  } catch (error) {
    console.error('Marketplace error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
