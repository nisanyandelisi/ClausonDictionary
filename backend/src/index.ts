import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Fix for missing types in Worker environment
declare var console: any;
// @ts-ignore
type D1Database = any;

type Bindings = {
  DB: D1Database
  ADMIN_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS Ayarları
app.use('/*', cors({
  origin: '*', // GitHub Pages veya local frontend için
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Admin-Secret'],
  maxAge: 86400,
}))

// Clauson Normalizasyon Fonksiyonu
// Clauson Normalizasyon Fonksiyonu
function normalizeClausonWord(word: string): string {
  if (!word) return '';

  // 1. Türkçe büyük/küçük harf dönüşümü
  let normalized = word.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

  // 2. İstenmeyen karakterleri temizle (Kullanıcı isteği: *, rakamlar, :, /, boşluklar yok sayılmalı)
  // Bu karakterleri tamamen siliyoruz ki "1 ı" -> "ı" olsun, "gı:ds" -> "gıds" olsun.
  normalized = normalized.replace(/[\d\*\:\/\s\-\.\(\)\[\]]/g, '');

  // 3. Clauson'a özgü karakterleri basitleştir
  const replacements = [
    { regex: /[ñŋ]/g, replacement: 'n' },
    { regex: /[ḏḍ]/g, replacement: 'd' },
    { regex: /ṭ/g, replacement: 't' },
    { regex: /ẓ/g, replacement: 'z' },
    { regex: /[āáă]/g, replacement: 'a' },
    { regex: /ī/g, replacement: 'i' },
    { regex: /ū/g, replacement: 'u' },
    { regex: /š/g, replacement: 's' },
    { regex: /γ/g, replacement: 'g' },
    { regex: /[éä]/g, replacement: 'e' },
    { regex: /č/g, replacement: 'c' }
  ];

  replacements.forEach(rule => {
    normalized = normalized.replace(rule.regex, rule.replacement);
  });

  return normalized;
}

// Veritabanını Düzeltme Endpoint'i (Tek seferlik kullanım için)
app.get('/api/fix-normalization', async (c) => {
  try {
    const allWords = await c.env.DB.prepare('SELECT id, word FROM words').all();
    let updatedCount = 0;

    const stmt = c.env.DB.prepare('UPDATE words SET normalized_word = ? WHERE id = ?');
    const batch = [];

    for (const result of allWords.results) {
      const newNormalized = normalizeClausonWord(result.word as string);
      batch.push(stmt.bind(newNormalized, result.id));

      // Batch execution in chunks of 50 to avoid limits
      if (batch.length >= 50) {
        await c.env.DB.batch(batch);
        updatedCount += batch.length;
        batch.length = 0;
      }
    }

    // Process remaining
    if (batch.length > 0) {
      await c.env.DB.batch(batch);
      updatedCount += batch.length;
    }

    return c.json({
      success: true,
      message: `Normalization fixed for ${updatedCount} words.`,
      sample: {
        original: "1 ı",
        normalized: normalizeClausonWord("1 ı"),
        original_colon: "gı:ds",
        normalized_colon: normalizeClausonWord("gı:ds")
      }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
})

// Ana Sayfa
app.get('/', (c) => {
  return c.text('Clauson Sözlük API (Cloudflare Workers + Hono)')
})

// Arama Endpoint'i
app.get('/api/search', async (c) => {
  try {
    const query = c.req.query('q')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = parseInt(c.req.query('offset') || '0')

    const scope = c.req.query('scope') || 'word'; // 'word' or 'meaning'

    if (!query) {
      return c.json({ error: 'Arama terimi (q) gerekli' }, 400)
    }

    let sqlQuery = '';
    let countQuery = '';
    let bindParams: any[] = [];
    let countBindParams: any[] = [];

    // Advanced Search Logic
    let processedQuery = query.trim();
    let searchPattern = '';
    let operatorMode = 'contains'; // default

    // 1. Check for prefixes
    if (processedQuery.startsWith('baş=')) {
      const term = processedQuery.substring(4);
      searchPattern = scope === 'meaning' ? `${term}%` : `${normalizeClausonWord(term)}%`;
      operatorMode = 'startsWith';
    } else if (processedQuery.startsWith('son=')) {
      const term = processedQuery.substring(4);
      searchPattern = scope === 'meaning' ? `%${term}` : `%${normalizeClausonWord(term)}`;
      operatorMode = 'endsWith';
    } else if (processedQuery.startsWith('tam=')) {
      const term = processedQuery.substring(4);
      searchPattern = scope === 'meaning' ? term : normalizeClausonWord(term);
      operatorMode = 'exact';
    } else {
      // Wildcard arama mantığı
      let temp = processedQuery;

      // Wildcard'ları ÖNCE SQL karakterlerine çevir (normalize'dan önce)
      // User: . -> SQL _ (tek karakter)
      // User: % veya & -> SQL % (sıfır veya daha fazla)
      temp = temp.replace(/\./g, '_');
      temp = temp.replace(/&/g, '%');
      // % zaten SQL wildcard, dokunma

      // Şimdi harfleri normalize et, ama _ ve % karakterlerini koru
      // Bunun için parçalara ayır
      const parts = temp.split(/([_%])/);
      const normalizedParts = parts.map(part => {
        if (part === '_' || part === '%') return part;
        return scope === 'meaning' ? part.toLowerCase() : normalizeClausonWord(part);
      });
      const sqlPattern = normalizedParts.join('');

      // If the pattern contains _ or %, treat as LIKE pattern
      if (sqlPattern.includes('_') || sqlPattern.includes('%')) {
        searchPattern = sqlPattern;
        operatorMode = 'pattern';
      } else {
        // Default: Contains
        searchPattern = `%${sqlPattern}%`;
        operatorMode = 'contains';
      }
    }

    // Construct SQL
    const etymology = c.req.query('etymology');
    let whereClause = '';

    if (scope === 'meaning') {
      if (operatorMode === 'exact') {
        whereClause = `(meaning = ? OR meaning_tr = ?)`;
        bindParams = [searchPattern, searchPattern];
        countBindParams = [searchPattern, searchPattern];
      } else {
        whereClause = `(meaning LIKE ? OR meaning_tr LIKE ?)`;
        bindParams = [searchPattern, searchPattern];
        countBindParams = [searchPattern, searchPattern];
      }
    } else {
      // Word search (normalized_word)
      if (operatorMode === 'exact') {
        whereClause = `normalized_word = ?`;
      } else {
        whereClause = `normalized_word LIKE ?`;
      }
      bindParams = [searchPattern];
      countBindParams = [searchPattern];
    }

    if (etymology && etymology !== 'all') {
      whereClause += ` AND etymology_type = ?`;
      bindParams.push(etymology);
      countBindParams.push(etymology);
    }

    sqlQuery = `SELECT * FROM words WHERE ${whereClause} LIMIT ? OFFSET ?`;
    countQuery = `SELECT COUNT(*) as total FROM words WHERE ${whereClause}`;

    bindParams.push(limit, offset);

    // Execute Count Query
    const countResult = await c.env.DB.prepare(countQuery).bind(...countBindParams).first();
    const total = countResult ? countResult.total : 0;

    // Execute Main Query
    const results = await c.env.DB.prepare(sqlQuery).bind(...bindParams).all();

    // JSON parse variants
    const processedResults = results.results.map((word: any) => {
      if (word.variants && typeof word.variants === 'string') {
        try {
          if (word.variants.startsWith('[') && word.variants.endsWith(']')) {
            word.variants = JSON.parse(word.variants);
          } else {
            word.variants = word.variants.split(',').map((v: string) => v.trim()).filter(Boolean);
          }
        } catch (e) {
          word.variants = [];
        }
      }
      return word;
    });

    return c.json({
      query: query,
      normalized: searchPattern, // Return the actual SQL pattern used
      mode: operatorMode,
      results: processedResults,
      total: total,
      limit: limit,
      offset: offset
    })
  } catch (e: any) {
    console.error('Search Error:', e);
    return c.json({ error: e.message, stack: e.stack }, 500);
  }
})

// Debug Endpoint
app.get('/api/debug', async (c) => {
  try {
    // Check if table exists
    const tableCheck = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='words'").first();

    // Count words
    const countCheck = await c.env.DB.prepare("SELECT COUNT(*) as count FROM words").first();

    return c.json({
      tableExists: !!tableCheck,
      wordCount: countCheck ? countCheck.count : 0,
      dbId: c.env.DB ? 'Connected' : 'Not Connected'
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
})

// Tüm Kelime Listesi (Smart Linking için - Sadece normalized_word döner)
app.get('/api/words/list', async (c) => {
  // Sadece normalized_word'leri çek, veri tasarrufu için
  const results = await c.env.DB.prepare(
    `SELECT normalized_word FROM words`
  ).all();

  // Dizi olarak döndür ["ab", "aba", ...]
  const wordList = results.results.map((r: any) => r.normalized_word);

  return c.json(wordList);
})

// Kelime Detay Endpoint'i
app.get('/api/word/:id', async (c) => {
  const id = c.req.param('id')
  const result = await c.env.DB.prepare(
    `SELECT * FROM words WHERE id = ?`
  ).bind(id).first();

  if (!result) {
    return c.json({ error: 'Kelime bulunamadı' }, 404)
  }

  // JSON parse variants alanını düzelt
  if (result.variants && typeof result.variants === 'string') {
    try {
      if (result.variants.startsWith('[') && result.variants.endsWith(']')) {
        result.variants = JSON.parse(result.variants);
      } else {
        result.variants = result.variants.split(',').map((v: string) => v.trim()).filter(Boolean);
      }
    } catch (e) {
      result.variants = [];
    }
  }

  return c.json(result)
})

// Autocomplete (Opsiyonel)
app.get('/api/search/autocomplete', async (c) => {
  const query = c.req.query('q')
  if (!query || query.length < 2) return c.json([])

  const normalizedQuery = normalizeClausonWord(query);

  // Sadece kelime listesi döndür
  const results = await c.env.DB.prepare(
    `SELECT word FROM words WHERE normalized_word LIKE ? LIMIT 10`
  ).bind(`${normalizedQuery}%`).all();

  return c.json(results.results.map((r: any) => r.word))
})


// Etimoloji Tipleri
app.get('/api/search/etymologies', async (c) => {
  const results = await c.env.DB.prepare(
    `SELECT DISTINCT etymology_type FROM words WHERE etymology_type IS NOT NULL`
  ).all();
  return c.json(results.results.map((r: any) => r.etymology_type))
})

// Rastgele Kelime
app.get('/api/search/random', async (c) => {
  const count = parseInt(c.req.query('count') || '1');

  if (count > 1) {
    const results = await c.env.DB.prepare(
      `SELECT * FROM words ORDER BY RANDOM() LIMIT ?`
    ).bind(count).all();

    const processedResults = results.results.map((word: any) => {
      if (word.variants && typeof word.variants === 'string') {
        try {
          if (word.variants.startsWith('[') && word.variants.endsWith(']')) {
            word.variants = JSON.parse(word.variants);
          } else {
            word.variants = word.variants.split(',').map((v: string) => v.trim()).filter(Boolean);
          }
        } catch (e) {
          word.variants = [];
        }
      }
      return word;
    });

    return c.json(processedResults);
  }

  const result = await c.env.DB.prepare(
    `SELECT * FROM words ORDER BY RANDOM() LIMIT 1`
  ).first();

  // JSON parse variants alanını düzelt
  if (result && result.variants && typeof result.variants === 'string') {
    try {
      if (result.variants.startsWith('[') && result.variants.endsWith(']')) {
        result.variants = JSON.parse(result.variants);
      } else {
        result.variants = result.variants.split(',').map((v: string) => v.trim()).filter(Boolean);
      }
    } catch (e) {
      result.variants = [];
    }
  }

  return c.json(result)
})



// --- Raporlama Endpointleri ---

// Sıralı Kelime Getir (İnceleme Modu İçin)
app.get('/api/word/by-offset', async (c) => {
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const result = await c.env.DB.prepare(
      `SELECT * FROM words ORDER BY id ASC LIMIT 1 OFFSET ?`
    ).bind(offset).first();

    if (!result) {
      return c.json({ error: 'No more words' }, 404);
    }

    // JSON parse variants
    if (result.variants && typeof result.variants === 'string') {
      try {
        result.variants = JSON.parse(result.variants);
      } catch (e) {
        result.variants = [];
      }
    }

    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Rapor Gönder (POST)
app.post('/api/reports', async (c) => {
  try {
    const body = await c.req.json();
    const { word, page, reason, description, timestamp } = body;

    if (!word || !reason) {
      return c.json({ error: 'Word and reason are required' }, 400);
    }

    const { results } = await c.env.DB.prepare(
      `INSERT INTO reports (word, page, reason, description, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).bind(word, page || null, reason, description || '', timestamp).run();

    return c.json({ success: true, message: 'Report saved' });
  } catch (e) {
    console.error('Report error:', e);
    return c.json({ error: 'Failed to save report' }, 500);
  }
});

// Raporları Listele (GET) - Güvenli
app.get('/api/reports', async (c) => {
  const secret = c.req.header('X-Admin-Secret');
  const envSecret = c.env.ADMIN_SECRET || 'parola'; // Fallback for dev, but should be set in env

  if (secret !== envSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM reports ORDER BY timestamp DESC`
    ).all();
    return c.json(results);
  } catch (e) {
    return c.json({ error: 'Failed to fetch reports' }, 500);
  }
});

// Seed Endpoint (Geçici - Veri Yükleme İçin)
app.post('/api/seed', async (c) => {
  const secret = c.req.header('X-Admin-Secret');
  const envSecret = c.env.ADMIN_SECRET || 'parola';

  if (secret !== envSecret) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const words = await c.req.json();
    if (!Array.isArray(words)) return c.json({ error: 'Array expected' }, 400);

    const stmt = c.env.DB.prepare(`
      INSERT INTO words (word, normalized_word, meaning, meaning_tr, full_entry_text, full_entry_text_tr, etymology_type, variants, page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = words.map((w: any) => stmt.bind(
      w.word,
      w.normalized_word,
      w.meaning,
      w.meaning_tr,
      w.full_entry_text,
      w.full_entry_text_tr,
      w.etymology_type,
      JSON.stringify(w.variants),
      w.page
    ));

    await c.env.DB.batch(batch);

    return c.json({ success: true, count: words.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Tabloyu Temizle Endpoint'i
app.post('/api/seed/clear', async (c) => {
  const secret = c.req.header('X-Admin-Secret');
  const envSecret = c.env.ADMIN_SECRET || 'parola';

  if (secret !== envSecret) return c.json({ error: 'Unauthorized' }, 401);

  try {
    await c.env.DB.prepare("DELETE FROM words").run();
    await c.env.DB.prepare("DELETE FROM sqlite_sequence WHERE name='words'").run();
    return c.json({ success: true, message: 'Table cleared' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app
