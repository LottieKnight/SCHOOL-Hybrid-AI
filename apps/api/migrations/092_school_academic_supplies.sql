-- M1 (hand-over): add wholesale-cost columns for the dropship margin math, and
-- seed the SCHOOL Academic Supplies vendor with the 7 verified local products
-- (prices traced to /home/lottie/school_local.py) plus the Cederberg Rooibos
-- borderless pilot product (traced to /home/lottie/school_pilot.py).
-- Idempotent: re-running upserts without duplicating products.

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS source_cost_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_cents INTEGER NOT NULL DEFAULT 0;

INSERT INTO store_vendors (slug, name, tagline, description, accent, badge, icon_key, config_json, is_active, sort_order)
VALUES
  (
    'school-academic-supplies',
    'SCHOOL Academic Supplies',
    'Premium academic essentials, delivered',
    'The SCHOOL marketplace core: exercise books, calculators, maths sets, study guides, planners, past-paper bundles and the back-to-school stationery kit — CAPS-aligned, premium-gated, shipped nationwide. Plus the Cederberg Rooibos borderless pilot (DDP).',
    '#F2A900',
    'Premium academic essentials',
    'academic',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"DROPSHIP"}'::jsonb,
    TRUE,
    10
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  accent = EXCLUDED.accent,
  badge = EXCLUDED.badge,
  icon_key = EXCLUDED.icon_key,
  config_json = EXCLUDED.config_json,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

DO $$
DECLARE
  v_store_id UUID;
  v_cat_study UUID;
  v_cat_calc UUID;
  v_cat_planner UUID;
  v_cat_stationery UUID;
  v_cat_papers UUID;
  v_cat_export UUID;
BEGIN
  SELECT id INTO v_store_id FROM store_vendors WHERE slug = 'school-academic-supplies';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'school-academic-supplies vendor missing after seed';
  END IF;

  INSERT INTO store_categories (store_id, slug, name, sort_order) VALUES
    (v_store_id, 'study-guides',   'Study Guides',      10),
    (v_store_id, 'calculators',    'Calculators & Sets',20),
    (v_store_id, 'planners',       'Planners & Diaries',30),
    (v_store_id, 'stationery',     'Stationery',        40),
    (v_store_id, 'past-papers',    'Past Papers',       50),
    (v_store_id, 'borderless',     'Borderless Pilot',  60)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_cat_study FROM store_categories WHERE store_id = v_store_id AND slug = 'study-guides';
  SELECT id INTO v_cat_calc FROM store_categories WHERE store_id = v_store_id AND slug = 'calculators';
  SELECT id INTO v_cat_planner FROM store_categories WHERE store_id = v_store_id AND slug = 'planners';
  SELECT id INTO v_cat_stationery FROM store_categories WHERE store_id = v_store_id AND slug = 'stationery';
  SELECT id INTO v_cat_papers FROM store_categories WHERE store_id = v_store_id AND slug = 'past-papers';
  SELECT id INTO v_cat_export FROM store_categories WHERE store_id = v_store_id AND slug = 'borderless';

  -- 7 verified local products (retail/landed from school_local.py).
  INSERT INTO store_products (
    store_id, category_id, slug, title, description, price_cents, currency,
    source_cost_cents, courier_cents, images, variants_json, attributes_json,
    fulfillment_type, stock_qty, tags, is_active
  ) VALUES
    (v_store_id, v_cat_stationery, 'exercise-books-72pg',
      'Exercise Books (72pg, CAPS)',
      'Premium-ruled 72-page CAPS exercise books with sewn binding — durable through a full term, safe for standard exam use.',
      3500, 'ZAR', 1600, 1000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.8,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['stationery','exercise-books','CAPS'], TRUE),
    (v_store_id, v_cat_calc, 'scientific-calculator',
      'Scientific Calculator (Exam-Approved)',
      'Exam-approved scientific calculator for matric and varsity — the required feature set for the DBE approved list, guaranteed.',
      34000, 'ZAR', 19000, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.5,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['calculator','matric','exam-approved'], TRUE),
    (v_store_id, v_cat_calc, 'maths-set',
      'Maths Set (Compass & Protractor)',
      'Complete exam-ready maths set — compass, protractor, ruler and set squares, packed for term-start bulk buys.',
      11000, 'ZAR', 4100, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.4,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['maths-set','geometry','exam-kit'], TRUE),
    (v_store_id, v_cat_study, 'study-guide-g12',
      'Study Guide (Grade 12, Key Subjects)',
      'CAPS-aligned Grade 12 study guide with past-paper drills — the exam-season core line.',
      24000, 'ZAR', 10200, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":1.1,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['study-guide','grade-12','CAPS'], TRUE),
    (v_store_id, v_cat_planner, 'academic-planner-2026',
      'Academic Planner 2026 (SCHOOL)',
      'SCHOOL-branded academic-year planner with weekly goals and term layouts — the new-year and back-to-school line.',
      12900, 'ZAR', 3600, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.4,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['planner','2026','diary'], TRUE),
    (v_store_id, v_cat_papers, 'past-paper-bundle',
      'Past-Paper Bundle (5 Years, Memo''d)',
      'Five years of CAPS past papers per subject with memos — high-intent pre-exam line.',
      9900, 'ZAR', 2700, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.9,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['past-papers','memo','exam'], TRUE),
    (v_store_id, v_cat_stationery, 'stationery-kit',
      'Stationery Kit (Back-to-School)',
      'Back-to-school bundle: pencils, case, ruler and more — lifts average order value and cuts customer-acquisition cost.',
      17900, 'ZAR', 7400, 5000, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":1.4,"dropship":true}'::jsonb, 'DROPSHIP', NULL, ARRAY['stationery','bundle','back-to-school'], TRUE),
    (v_store_id, v_cat_export, 'premium-rooibos',
      'Premium Cederberg Rooibos (Borderless Pilot)',
      'The Phase-0 borderless pilot: premium Cederberg rooibos, source-to-customer, one delivered price that includes all duties and freight (DDP).',
      36000, 'ZAR', 6000, 0, ARRAY[]::TEXT[], '[]'::jsonb,
      '{"pack_kg":0.4,"ddp_rate_kg":110.0,"pack_cost":1800,"export":true}'::jsonb,
      'DROPSHIP', NULL, ARRAY['rooibos','export','DDP','pilot'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    source_cost_cents = EXCLUDED.source_cost_cents,
    courier_cents = EXCLUDED.courier_cents,
    attributes_json = EXCLUDED.attributes_json,
    fulfillment_type = EXCLUDED.fulfillment_type,
    tags = EXCLUDED.tags,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
END $$;
