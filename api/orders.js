// Discogs 売上確認
// Vercel Serverless Function
// GET /api/orders          → 注文一覧
// GET /api/orders?id=xxx   → 注文詳細
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }
  if (req.method !== 'GET') { return res.status(405).json({ error: 'Method not allowed' }); }

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'VinylInventoryProxy/1.0';
  if (!DISCOGS_TOKEN) { return res.status(500).json({ error: 'DISCOGS_TOKEN not set' }); }

  const { id, status, page, per_page } = req.query;

  try {
    let url;

    // 注文詳細
    if (id) {
      url = `https://api.discogs.com/marketplace/orders/${encodeURIComponent(id)}`;
    } else {
      // 注文一覧
      const params = new URLSearchParams();
      if (status)   params.append('status', status);
      if (page)     params.append('page', page);
      if (per_page) params.append('per_page', per_page);
      url = `https://api.discogs.com/marketplace/orders?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': DISCOGS_USER_AGENT,
        'Accept': 'application/vnd.discogs.v2.discogs+json'
      }
    });

    const data = await response.json();

    if (response.status === 200) {
      return res.status(200).json({ success: true, data });
    } else {
      return res.status(response.status).json({
        success: false,
        error: data.message || 'Discogs API error'
      });
    }
  } catch (error) {
    console.error('Orders error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
