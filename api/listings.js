// Discogs マーケットプレイス出品・取り下げ
// Vercel Serverless Function
// POST   /api/listings        → 出品
// DELETE /api/listings?id=xxx → 取り下げ
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'VinylInventoryProxy/1.0';
  if (!DISCOGS_TOKEN) { return res.status(500).json({ error: 'DISCOGS_TOKEN not set' }); }

  // ── POST: 出品 ──────────────────────────────────────
  if (req.method === 'POST') {
    const { release_id, condition, sleeve_condition, price, status, allow_offers, weight, comments } = req.body || {};

    if (!release_id || !condition || !price) {
      return res.status(400).json({ error: 'release_id, condition, price are required' });
    }

    try {
      const url = `https://api.discogs.com/marketplace/listings`;

      const requestBody = {
        release_id,
        condition,
        price,
        status:       status       || 'For Sale',
        allow_offers: allow_offers !== undefined ? allow_offers : true,
        comments:     comments     || ''
      };
      if (sleeve_condition)      requestBody.sleeve_condition = sleeve_condition;
      if (weight && weight > 0)  requestBody.weight = weight;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
          'User-Agent': DISCOGS_USER_AGENT,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.discogs.v2.discogs+json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Discogs request:', JSON.stringify(requestBody));
      console.log('Discogs response:', response.status, JSON.stringify(data));

      if (response.status === 201) {
        return res.status(201).json({
          success: true,
          listing_id: data.listing_id,
          resource_url: data.resource_url
        });
      } else {
        return res.status(response.status).json({
          success: false,
          error: data.message || 'Discogs API error',
          detail: data
        });
      }
    } catch (error) {
      console.error('Listings POST error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── DELETE: 取り下げ ────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'listing id is required' });
    }

    try {
      const url = `https://api.discogs.com/marketplace/listings/${encodeURIComponent(id)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
          'User-Agent': DISCOGS_USER_AGENT,
          'Accept': 'application/vnd.discogs.v2.discogs+json'
        }
      });

      if (response.status === 204) {
        return res.status(200).json({ success: true, deleted_id: id });
      } else {
        const data = await response.json();
        return res.status(response.status).json({
          success: false,
          error: data.message || 'Discogs API error'
        });
      }
    } catch (error) {
      console.error('Listings DELETE error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
