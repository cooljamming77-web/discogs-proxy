// Discogs API プロキシサーバー
// Vercel Serverless Function

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETリクエストのみ許可
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // クエリパラメータからカタログ番号を取得
  const { catno } = req.query;

  if (!catno) {
    return res.status(400).json({ error: 'Catalog number is required' });
  }

  // 環境変数からDiscogs認証情報を取得
  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'VinylInventoryProxy/1.0';

  if (!DISCOGS_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error: DISCOGS_TOKEN not set' });
  }

  try {
    // Discogs APIにリクエスト
    const discogsUrl = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catno)}&type=release`;
    
    const response = await fetch(discogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': DISCOGS_USER_AGENT,
        'Accept': 'application/vnd.discogs.v2.discogs+json'
      }
    });

    const statusCode = response.status;
    const data = await response.json();

    // Discogsのレスポンスをそのまま返す
    if (statusCode === 200) {
      // 検索結果がある場合
      if (data.results && data.results.length > 0) {
        const { year, country } = req.query;

        function scoreResult(r) {
          let score = 0;
          if (label && r.label && r.label.some(l => l.toLowerCase().includes(label.toLowerCase()))) score += 10;
          if (year && r.year) {
            const diff = Math.abs(parseInt(r.year) - parseInt(year));
            if (diff === 0) score += 7;
            else if (diff === 1) score += 4;
          }
          if (country && r.country && r.country.toLowerCase() === country.toLowerCase()) score += 5;
          if (r.status === 'Accepted') score += 3;
          if (r.format && r.format.some(f => /LP|12"/.test(f))) score += 1;
          return score;
        }

        let firstResult;
        try {
          firstResult = data.results.reduce((best, r) =>
            scoreResult(r) >= scoreResult(best) ? r : best
          , data.results[0]);
        } catch(e) {
          firstResult = data.results[0];
        }
        
        // レスポンスを整形
        const result = {
          success: true,
          data: {
            title: firstResult.title || '',
            label: firstResult.label && firstResult.label[0] ? firstResult.label[0] : '',
            genre: firstResult.genre ? firstResult.genre.join(', ') : '',
            country: firstResult.country || '',
            year: firstResult.year || '',
            style: firstResult.style ? firstResult.style.join(', ') : ''
          }
        };
        
        return res.status(200).json(result);
      } else {
        // 検索結果なし
        return res.status(404).json({
          success: false,
          error: 'No results found'
        });
      }
    } else {
      // Discogsからエラーが返ってきた場合
      return res.status(statusCode).json({
        success: false,
        error: data.message || 'Discogs API error',
        details: data
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};
