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
  
    const { catno, label, details, year, country } = req.query;
  
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
            
                  // スコアリング関数でベストマッチを選択
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
                            if (r.format && r.format.length > 0) score += 8;
                            if (r.format && r.format.some(f => /LP|12"/.test(f))) score += 1;
                            return score;
                  }
            
                  let firstResult;
                  try {
                            firstResult = searchData.results.reduce((best, r) =>
                                        scoreResult(r) >= scoreResult(best) ? r : best
                                      , searchData.results[0]);
                            // フォーマット未設定の場合フォールバック
                            if (!firstResult.format || firstResult.format.length === 0) {
                                        const withFormat = searchData.results.filter(r => r.format && r.format.length > 0);
                                        if (withFormat.length > 0) {
                                                      firstResult = withFormat.reduce((best, r) =>
                                                                      scoreResult(r) >= scoreResult(best) ? r : best
                                                                    , withFormat[0]);
                                        }
                            }
                  } catch(e) {
                            firstResult = searchData.results[0];
                  }
            
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
                  return res.status(404).json({ success: false, error: 'No results found' });
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
};// Discogs API プロキシサーバー
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
  const { catno } = req.query

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
        const { year, country, label } = req.query;

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
          if (r.format && r.format.length > 0) score += 8
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
        // フォーマット未設定の場合、フォーマット有りの最高スコア結果を優先
        if (!firstResult.format || firstResult.format.length === 0) {
          const withFormat = data.results.filter(r => r.format && r.format.length > 0);
          if (withFormat.length > 0) {
            firstResult = withFormat.reduce((best, r) => scoreResult(r) >= scoreResult(best) ? r : best, withFormat[0]);
          }
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
            style: firstResult.style ? firstResult.style.join(', ') : '',
            format: firstResult.format ? firstResult.format.join(', ') : ''
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
