// Discogs API プロキシサーバー（詳細情報取得版）
// Vercel Serverless Function

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { catno, label, details } = req.query;

  if (!catno) {
    return res.status(400).json({ error: 'Catalog number is required' });
  }

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'VinylInventoryProxy/1.0';

  if (!DISCOGS_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error: DISCOGS_TOKEN not set' });
  }

  try {
    // 検索リクエスト
    let searchUrl = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catno)}&type=release`;
    
    if (label && label.trim() !== '') {
      searchUrl += `&label=${encodeURIComponent(label)}`;
    }
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': DISCOGS_USER_AGENT,
        'Accept': 'application/vnd.discogs.v2.discogs+json'
      }
    });

    const searchStatus = searchResponse.status;
    const searchData = await searchResponse.json();

    if (searchStatus === 200 && searchData.results && searchData.results.length > 0) {
      const firstResult = searchData.results[0];
      
      // 基本情報
      let result = {
        success: true,
        data: {
          title: firstResult.title || '',
          label: firstResult.label && firstResult.label[0] ? firstResult.label[0] : '',
          genre: firstResult.genre ? firstResult.genre.join(', ') : '',
          country: firstResult.country || '',
          year: firstResult.year || '',
          style: firstResult.style ? firstResult.style.join(', ') : '',
          format: firstResult.format ? firstResult.format.join(', ') : ''
        }
      };
      
      // 詳細情報が必要な場合（details=trueパラメータ）
      if (details === 'true' && firstResult.id) {
        try {
          const releaseUrl = `https://api.discogs.com/releases/${firstResult.id}`;
          const releaseResponse = await fetch(releaseUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
              'User-Agent': DISCOGS_USER_AGENT,
              'Accept': 'application/vnd.discogs.v2.discogs+json'
            }
          });
          
          if (releaseResponse.status === 200) {
            const releaseData = await releaseResponse.json();
            
            // トラックリスト取得
            let tracklist = [];
            if (releaseData.tracklist) {
              tracklist = releaseData.tracklist.map(track => ({
                position: track.position || '',
                title: track.title || '',
                duration: track.duration || ''
              }));
            }
            
            // 追加情報
            result.data.tracklist = tracklist;
            result.data.released = releaseData.released || '';
            result.data.notes = releaseData.notes || '';
            result.data.master_url = releaseData.master_url || '';
            result.data.uri = releaseData.uri || '';
            result.data.formats_detail = releaseData.formats || [];
          }
        } catch (detailError) {
          console.error('Detail fetch error:', detailError);
          // 詳細取得失敗しても基本情報は返す
        }
      }
      
      return res.status(200).json(result);
      
    } else if (searchStatus === 200) {
      return res.status(404).json({
        success: false,
        error: 'No results found'
      });
    } else {
      return res.status(searchStatus).json({
        success: false,
        error: searchData.message || 'Discogs API error',
        details: searchData
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
