-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    page TEXT,
    reason TEXT NOT NULL,
    description TEXT,
    timestamp TEXT NOT NULL
);
