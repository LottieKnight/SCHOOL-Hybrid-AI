-- Seed the two Ditshego Group clothing brands on the SCHOOL marketplace:
--   Cosmic Cottons (co-founded with Justin Msibi) and Flightmode
--   (co-founded with Kopano Ditshego). Both are distinct Pty Ltd entities
--   per DITSHEGO_GROUP_STRUCTURE.md, showcased and sold on the SCHOOL
--   marketplace. Catalog entries are a DRAFT start — product photos are SVG
--   placeholders flagged in tags/attributes for replacement.
-- Idempotent: re-running upserts vendors/categories/products without duplicating.

INSERT INTO store_vendors (slug, name, tagline, description, accent, badge, icon_key, config_json, is_active, sort_order)
VALUES
  (
    'cosmic-cottons',
    'Cosmic Cottons',
    'Threads from another orbit',
    'Cosmic Cottons is a Ditshego Group clothing brand co-founded with Justin Msibi — a soft-palette, street-meets-sky aesthetic built for the student who wears the stars. Distinct positioning from Flightmode, and each drop is co-produced and sold on the SCHOOL marketplace.',
    '#A78BFA',
    'Cosmic threads',
    'shirt',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"SHIP_FROM_SUPPLIER"}'::jsonb,
    TRUE,
    21
  ),
  (
    'flightmode',
    'Flightmode',
    'Wear the altitude',
    'Flightmode is a Ditshego Group clothing brand co-founded with Kopano Ditshego — a high-energy, aviation-inspired streetwear line for a different demographic than Cosmic Cottons, so the two brands never cannibalise each other. Co-produced and sold on the SCHOOL marketplace.',
    '#38BDF8',
    'Flight gear',
    'shirt',
    '{"paymentProvider":"stub","quoteOnly":false,"fulfillment":"SHIP_FROM_SUPPLIER"}'::jsonb,
    TRUE,
    22
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

-- Cosmic Cottons draft catalog
DO $$
DECLARE
  v_store_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM store_vendors WHERE slug = 'cosmic-cottons';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'cosmic-cottons vendor missing after seed';
  END IF;

  INSERT INTO store_categories (store_id, slug, name, sort_order) VALUES
    (v_store_id, 'tees', 'Tees', 10),
    (v_store_id, 'hoodies', 'Hoodies & Sweats', 20),
    (v_store_id, 'accessories', 'Accessories', 50)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'tees';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'nebula-crew-tee', 'Nebula Crew Tee', 'DRAFT CATALOG — heavyweight cotton tee in a soft cosmic palette, printed with the Cosmic Cottons wordmark. Replace image and finalise price before launch.', 44900, 'ZAR', ARRAY['/store/cosmic-cottons/product-01.svg']::TEXT[], '[]'::jsonb, '{"draft":true,"material":"Cotton"}'::jsonb, 'SHIP_FROM_SUPPLIER', 50, ARRAY['draft','tee','cosmic-cottons'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'hoodies';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'starlight-hoodie', 'Starlight Hoodie', 'DRAFT CATALOG — brushed-fleece hoodie in the Cosmic Cottons palette with a tonal chest print. Replace image and finalise price before launch.', 74900, 'ZAR', ARRAY['/store/cosmic-cottons/product-02.svg']::TEXT[], '[]'::jsonb, '{"draft":true,"material":"Fleece"}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','hoodie','cosmic-cottons'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'accessories';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'orbit-cap', 'Orbit Cap', 'DRAFT CATALOG — six-panel cap with embroidered Cosmic Cottons wordmark. Replace image and finalise price before launch.', 32900, 'ZAR', ARRAY['/store/cosmic-cottons/product-03.svg']::TEXT[], '[]'::jsonb, '{"draft":true}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','headwear','cosmic-cottons'], TRUE),
    (v_store_id, v_cat_id, 'galaxy-tote', 'Galaxy Tote', 'DRAFT CATALOG — heavyweight canvas tote with reinforced handles. Replace image and finalise price before launch.', 34900, 'ZAR', ARRAY['/store/cosmic-cottons/product-04.svg']::TEXT[], '[]'::jsonb, '{"draft":true}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','accessories','cosmic-cottons'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;
END $$;

-- Flightmode draft catalog
DO $$
DECLARE
  v_store_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM store_vendors WHERE slug = 'flightmode';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'flightmode vendor missing after seed';
  END IF;

  INSERT INTO store_categories (store_id, slug, name, sort_order) VALUES
    (v_store_id, 'tees', 'Tees', 10),
    (v_store_id, 'hoodies', 'Hoodies & Sweats', 20),
    (v_store_id, 'accessories', 'Accessories', 50)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'tees';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'airspeed-tee', 'Airspeed Tee', 'DRAFT CATALOG — high-energy aviation tee in the Flightmode colourway. Replace image and finalise price before launch.', 42900, 'ZAR', ARRAY['/store/flightmode/product-01.svg']::TEXT[], '[]'::jsonb, '{"draft":true,"material":"Cotton"}'::jsonb, 'SHIP_FROM_SUPPLIER', 50, ARRAY['draft','tee','flightmode'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'hoodies';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'cabin-crew-hoodie', 'Cabin Crew Hoodie', 'DRAFT CATALOG — midweight fleece hoodie with Flightmode sleeve branding. Replace image and finalise price before launch.', 74900, 'ZAR', ARRAY['/store/flightmode/product-02.svg']::TEXT[], '[]'::jsonb, '{"draft":true,"material":"Fleece"}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','hoodie','flightmode'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_cat_id FROM store_categories WHERE store_id = v_store_id AND slug = 'accessories';
  INSERT INTO store_products (store_id, category_id, slug, title, description, price_cents, currency, images, variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active) VALUES
    (v_store_id, v_cat_id, 'flight-cap', 'Flight Cap', 'DRAFT CATALOG — structured cap with embroidered Flightmode wordmark. Replace image and finalise price before launch.', 32900, 'ZAR', ARRAY['/store/flightmode/product-03.svg']::TEXT[], '[]'::jsonb, '{"draft":true}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','headwear','flightmode'], TRUE),
    (v_store_id, v_cat_id, 'runway-tote', 'Runway Tote', 'DRAFT CATALOG — heavy canvas tote with a zip security pocket. Replace image and finalise price before launch.', 34900, 'ZAR', ARRAY['/store/flightmode/product-04.svg']::TEXT[], '[]'::jsonb, '{"draft":true}'::jsonb, 'SHIP_FROM_SUPPLIER', 40, ARRAY['draft','accessories','flightmode'], TRUE)
  ON CONFLICT (store_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;
END $$;
