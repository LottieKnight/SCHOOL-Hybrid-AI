-- Sprint 4: Habits & Habit-Building

-- NPS Surveys
CREATE TABLE IF NOT EXISTS user_nps_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_user_id ON user_nps_surveys(user_id);

-- Feature Requests
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'under_review', -- 'under_review', 'planned', 'shipped'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Votes
CREATE TABLE IF NOT EXISTS user_feature_votes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, feature_id)
);

-- Initial feature seeds
INSERT INTO feature_requests (title, description, status) VALUES 
('Offline flashcards', 'Study your lessons even without an internet connection.', 'under_review'),
('Group study rooms', 'Join real-time study rooms with your classmates.', 'under_review'),
('Progress PDF export', 'Download a summary of your learning journey.', 'under_review'),
('Mobile app notifications', 'Get reminded about exams and streaks on your phone.', 'planned')
ON CONFLICT DO NOTHING;
