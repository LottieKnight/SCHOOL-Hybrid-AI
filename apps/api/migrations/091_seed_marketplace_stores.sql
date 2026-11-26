-- Seed the SCHOOL marketplace vendors (clothing, cosmetics, courses) that the
-- marketplace page and dynamic /store/[store] routes render from. Bookstore and
-- equipment keep their own legacy modules, so they are not seeded here.
-- Idempotent: re-running upserts the vendor rows without duplicating products.

INSERT INTO store_vendors (slug, name, tagline, description, accent, badge, icon_key, config_json, is_active, sort_order)
VALUES
  (
    'clothing',
    'Mr J Msibi',
    'Wear the brand',
    'Clothing, apparel, and accessories from Mr J Msibi — designed on the Ditshego house palette and built for the student who wears the story.',
    '#C9A24B',
    'Campus threads',
    'shirt',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"SHIP_FROM_SUPPLIER"}'::jsonb,
    TRUE,
    20
  ),
  (
    'cosmetics',
    'Cosmetics Store',
    'Glow on campus',
    'Skincare, body care, and fragrance routines crafted for the student lifestyle. Non-comedogenic, cruelty-free, and built for early classes and late sessions.',
    '#F9A8D4',
    'Skincare & self-care',
    'cosmetics',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"SHIP_FROM_SUPPLIER"}'::jsonb,
    TRUE,
    30
  ),
  (
    'courses',
    'Course Store',
    'Buy the knowledge',
    'Structured study courses and material packs — revision bundles, exam prep, and skills for the academic year. Every pack is CAPS-aligned and updated each term.',
    '#67E8F9',
    'Study material',
    'courses',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"LINK_ONLY"}'::jsonb,
    TRUE,
    40
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

-- Cosmetics categories + products
DO $$
DECLARE
  v_store_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM store_vendors WHERE slug = 'cosmetics';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'cosmetics vendor missing after seed';
  END IF;

  -- Categories
  INSERT INTO store_categories (store_id, slug, name, sort_order) VALUES
    (v_store_id, 'skincare', 'Skincare', 10),
    (v_store_id, 'body-care', 'Body Care', 20),
    (v_store_id, 'fragrance', 'Fragrance', 30),
    (v_store_id, 'gift-sets', 'Gift Sets', 40)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'skincare';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'daily-facial-cleanser', 'Daily Facial Cleanser', 'Gentle gel cleanser for everyday use — removes campus grit and sunscreen without stripping the barrier.', 19900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"skin_type":"all"}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['skincare','cleanser'], TRUE),
    (v_store_id, v_cat_id, 'hyaluronic-serum', 'Hyaluronic Serum', 'Lightweight hydration serum that pulls moisture in and keeps a dewy finish through a full day of classes.', 24900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"skin_type":"all"}'::jsonb, 'SHIP_FROM_SUPPLIER', 35, ARRAY['skincare','serum'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'fragrance';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'signature-mist', 'Signature Body Mist', 'A light, lecture-hall-safe scent with notes of amber, citrus, and clean musk.', 17900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"size":"100ml"}'::jsonb, 'SHIP_FROM_SUPPLIER', 50, ARRAY['fragrance','mist'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;
END $$;

-- Courses categories + products
DO $$
DECLARE
  v_store_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM store_vendors WHERE slug = 'courses';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'courses vendor missing after seed';
  END IF;

  INSERT INTO store_categories (store_id, slug, name, sort_order) VALUES
    (v_store_id, 'revision-bundles', 'Revision Bundles', 10),
    (v_store_id, 'exam-prep', 'Exam Prep', 20)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'revision-bundles';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'mathematics-revision-bundle', 'Mathematics Revision Bundle', 'CAPS-aligned revision pack combining notes, past papers, and practice questions for term-end and exam revision.', 39900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"level":"FET"}'::jsonb, 'LINK_ONLY', NULL, ARRAY['mathematics','revision','bundle'], TRUE),
    (v_store_id, v_cat_id, 'physical-sciences-revision-bundle', 'Physical Sciences Revision Bundle', 'Physics and chemistry revision notes with worked examples, marking memos, and answer strategies.', 39900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"level":"FET"}'::jsonb, 'LINK_ONLY', NULL, ARRAY['sciences','revision','bundle'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'exam-prep';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'exam-prep-pass', 'Exam Prep Pass', 'Timed paper practice, marking memos, and answer strategies across all FET subjects for one exam season.', 49900, 'ZAR', ARRAY[]::TEXT[], '[]'::jsonb, '{"level":"FET"}'::jsonb, 'LINK_ONLY', NULL, ARRAY['exam','prep','pass'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;
END $$;
