-- Clauson Sözlük Veritabanı Şeması

DROP TABLE IF EXISTS words;

CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,          -- Orijinal kelime (örn: baṭığ)
  normalized_word TEXT NOT NULL, -- Arama için normalize edilmiş (örn: batig)
  meaning TEXT,                -- Anlam
  full_entry_text TEXT,        -- Tam metin (HTML içerir)
  etymology_type TEXT,         -- Etimoloji tipi (D, F, vb.)
  variants TEXT,               -- Varyantlar (JSON string olarak saklanacak)
  page INTEGER,                -- PDF Sayfa numarası
  skeleton TEXT,               -- İskelet yapı (örn: DIS. BDĞ)
  meaning_tr TEXT,             -- Türkçe Anlam
  full_entry_text_tr TEXT      -- Türkçe Tam metin
);

-- Hızlı arama için indeksler
CREATE INDEX idx_normalized_word ON words(normalized_word);
CREATE INDEX idx_word ON words(word);
