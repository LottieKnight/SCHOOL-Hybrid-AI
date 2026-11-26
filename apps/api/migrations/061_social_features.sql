-- Sprint 3: Social Identity & Features

-- Spotify Connections
CREATE TABLE IF NOT EXISTS user_spotify_connections (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    spotify_id TEXT NOT NULL,
    display_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    top_artists JSONB DEFAULT '[]'::jsonb,
    top_tracks JSONB DEFAULT '[]'::jsonb,
    share_on_profile BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT, -- Target URL (e.g., /community/post/[id])
    type TEXT NOT NULL, -- 'mention', 'badge', 'streak', 'reminder', 'system'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_read ON user_notifications(user_id, is_read);

-- Module Presence (Tracked in DB for simplicity, can be moved to Redis later)
CREATE TABLE IF NOT EXISTS module_active_presence (
    module_code TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (module_code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_last_active ON module_active_presence(last_active_at);
