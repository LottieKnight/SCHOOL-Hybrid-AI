-- Sprint 10: Health & Well-being

-- Gratitude Journal
CREATE TABLE IF NOT EXISTS gratitude_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_journal_user_date ON gratitude_journal(user_id, entry_date);
