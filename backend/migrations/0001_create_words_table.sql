-- Migration number: 0001 	 2024-11-30T00:00:00.000Z
CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    normalized_word TEXT,
    meaning TEXT,
    meaning_tr TEXT,
    full_entry_text TEXT,
    full_entry_text_tr TEXT,
    etymology_type TEXT,
    variants TEXT,
    page TEXT
);

CREATE INDEX IF NOT EXISTS idx_normalized_word ON words(normalized_word);
CREATE INDEX IF NOT EXISTS idx_meaning ON words(meaning);
CREATE INDEX IF NOT EXISTS idx_meaning_tr ON words(meaning_tr);
