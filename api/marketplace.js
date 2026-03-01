// Discogs マーケットプレイス出品一覧取得
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
  if (!DISCOGS_TOKEN) { return res.status(500).json({ error: 'Server configuration error: DISCOGS_TOKEN not set' }); }

  try {
    // 最大100件取得（per_page上限）
    const url = `https://api.discogs.com/marketplace/search?release_id=${encodeURIComponent(release_id)}&status=For+Sale&per_page=100&page=1`;

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

    if (status === 200 && data.listings && data.listings.length > 0) {
      // 必要なフィールドだけ抽出して返す
      const listings = data.listings.map(l => ({
        price:           l.price ? l.price.value : null,
        currency:        l.price ? l.price.currency : null,
        media_condition: l.condition || '',
        sleeve_condition: l.sleeve_condition || ''
      })).filter(l => l.price !== null);

      return res.status(200).json({
        success: true,
        total: listings.length,
        listings: listings
      });

    } else if (status === 200) {
      return res.status(200).json({ success: true, total: 0, listings: [] });
    } else {
      return res.status(status).json({
        success: false,
        error: data.message || 'Discogs API error'
      });
    }
  } catch (error) {
    console.error('Marketplace error:', error);
    return res.status(500).json({ success: false, error: 'Server error', message: error.message });
  }
};marketplace.js
