-- Sprint 8: Advanced Gamification

-- User Quests
CREATE TABLE IF NOT EXISTS user_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    reward_xp INTEGER NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE,
    quest_type TEXT NOT NULL, -- 'daily', 'weekly'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_id_claimed ON user_quests(user_id, is_claimed);

-- User Inventory (Streak Freezes)
CREATE TABLE IF NOT EXISTS user_inventory (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL, -- 'streak_freeze'
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, item_key)
);

-- University Battles
CREATE TABLE IF NOT EXISTS university_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_battle_contributions (
    battle_id UUID NOT NULL REFERENCES university_battles(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp_contributed INTEGER DEFAULT 0,
    PRIMARY KEY (battle_id, institution_id, user_id)
);
-- Initial Battle seed
INSERT INTO university_battles (title, start_at, end_at) VALUES 
('The Founders Battle', date_trunc('week', NOW()), date_trunc('week', NOW()) + INTERVAL '7 days')
ON CONFLICT DO NOTHING;
