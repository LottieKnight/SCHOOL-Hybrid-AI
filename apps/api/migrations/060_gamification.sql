-- Sprint 1: Gamification & Social Identity

-- XP Ledger to track all point-earning actions
CREATE TABLE IF NOT EXISTS user_xp_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'QUIZ_COMPLETE', 'LESSON_COMPLETE', 'KUDOS_RECEIVED', etc.
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_created_at ON user_xp_ledger(created_at);

-- User Badges to track earned achievements
CREATE TABLE IF NOT EXISTS user_earned_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_key)
);

-- Badge definitions (metadata only, logic stays in code/API for now)
-- key: '7_day_streak', 'top_contributor', 'speed_demon', etc.

-- Game scores for leaderboard
CREATE TABLE IF NOT EXISTS game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_type_score ON game_scores(game_type, score DESC);

-- Add 'kudos' to reaction types
ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS post_reactions_reaction_type_check;
ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_reaction_type_check 
    CHECK (reaction_type IN ('got_it', 'same_question', 'great_explanation', 'saving_this', 'exam_relevant', 'kudos'));
