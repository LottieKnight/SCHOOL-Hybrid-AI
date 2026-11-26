CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  phase TEXT NOT NULL,
  formats TEXT[] NOT NULL,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'books_phase_check'
  ) THEN
    ALTER TABLE books
      ADD CONSTRAINT books_phase_check
      CHECK (phase IN ('foundation', 'intermediate', 'senior', 'fet'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'paid', 'canceled'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);

INSERT INTO books (title, description, phase, formats, price_cents, is_free)
VALUES
  ('Foundation Phase Maths Workbook', 'Hands-on number sense activities with weekly practice pages.', 'foundation', ARRAY['Hardcopy','Digital'], NULL, true),
  ('Intermediate Natural Sciences Guide', 'Structured notes, experiments, and quick checks for every topic.', 'intermediate', ARRAY['Digital'], 12900, false),
  ('Senior Phase Language Toolkit', 'Reading strategies, writing frames, and exam-style practice.', 'senior', ARRAY['Hardcopy','Digital'], 19900, false),
  ('FET Economics Essentials', 'Clear summaries, graphs, and worked examples for each term.', 'fet', ARRAY['Digital'], 24900, false),
  ('Life Skills Activity Pack', 'Creative games and routines to build confidence and focus.', 'foundation', ARRAY['Hardcopy'], NULL, true),
  ('Grade 7 Social Sciences Atlas', 'Maps, timelines, and exam prep prompts for Geography & History.', 'senior', ARRAY['Hardcopy','Digital'], 15900, false)
ON CONFLICT (title) DO NOTHING;
