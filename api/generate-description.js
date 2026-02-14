// Discogs 説明文生成API
// Vercel Serverless Function

module.exports = async (req, res) => {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: ANTHROPIC_API_KEY not set' });
  }

  try {
    const { artist, title, genre, style, country, year, format, discogsNotes } = req.body;

    if (!artist || !title) {
      return res.status(400).json({ error: 'Artist and title are required' });
    }

    // Claude APIにリクエスト
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `あなたはレコードショップの店員です。以下のレコード情報を元に、ヤフオク出品用の魅力的な商品説明文を150文字程度で作成してください。

【レコード情報】
アーティスト: ${artist}
タイトル: ${title}
ジャンル: ${genre || '不明'}
スタイル: ${style || '不明'}
国: ${country || '不明'}
リリース年: ${year || '不明'}
フォーマット: ${format || '不明'}
${discogsNotes ? `Discogsノート: ${discogsNotes.substring(0, 200)}` : ''}

【要件】
- レコード屋さんらしい、音楽愛に溢れた表現
- アーティストの特徴やジャンルの魅力を簡潔に説明
- 「です・ます」調で丁寧に
- コレクター向けの付加価値があれば言及
- 150文字程度（長すぎない）

説明文のみを出力してください。前置きや「」などは不要です。`
        }]
      })
    });

    const anthropicData = await anthropicResponse.json();

    if (anthropicResponse.status === 200 && anthropicData.content && anthropicData.content[0]) {
      const description = anthropicData.content[0].text.trim();
      
      return res.status(200).json({
        success: true,
        description: description
      });
    } else {
      console.error('Anthropic API error:', anthropicData);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate description',
        details: anthropicData
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
