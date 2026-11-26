-- Sprint 5: Platform Depth & Utility

-- Flashcard Decks
CREATE TABLE IF NOT EXISTS user_flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_key TEXT NOT NULL,
    cards JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { question: string, answer: string }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, lesson_key)
);

-- External Calendar Subscriptions
CREATE TABLE IF NOT EXISTS user_calendar_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ical_url TEXT NOT NULL,
    label TEXT,
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
