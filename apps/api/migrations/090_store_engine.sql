-- Generalized store engine: a single vendor-scoped commerce layer that all
-- SCHOOL marketplace stores (bookstore, equipment, clothing, cosmetics,
-- courses) run on. Each store is a vendor; catalogs, carts, orders and
-- quote requests are scoped by store_id.

CREATE TABLE IF NOT EXISTS store_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#C9A24B',
  badge TEXT NOT NULL DEFAULT '',
  icon_key TEXT NOT NULL DEFAULT 'store',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_vendors_slug_check') THEN
    ALTER TABLE store_vendors
      ADD CONSTRAINT store_vendors_slug_check
      CHECK (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_vendors_active_idx
  ON store_vendors(is_active, sort_order, name);

CREATE TABLE IF NOT EXISTS store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES store_vendors(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS store_categories_store_idx
  ON store_categories(store_id, sort_order, name);
CREATE INDEX IF NOT EXISTS store_categories_parent_idx
  ON store_categories(parent_id, sort_order, name);

CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES store_vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  variants_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_type TEXT NOT NULL DEFAULT 'SHIP_FROM_SUPPLIER',
  stock_qty INTEGER,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_products_price_check') THEN
    ALTER TABLE store_products
      ADD CONSTRAINT store_products_price_check
      CHECK (price_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_products_stock_qty_check') THEN
    ALTER TABLE store_products
      ADD CONSTRAINT store_products_stock_qty_check
      CHECK (stock_qty IS NULL OR stock_qty >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_products_fulfillment_type_check') THEN
    ALTER TABLE store_products
      ADD CONSTRAINT store_products_fulfillment_type_check
      CHECK (
        fulfillment_type IN (
          'LINK_ONLY',
          'FILE_DOWNLOAD',
          'PRINT_ON_DEMAND',
          'SHIP_FROM_SUPPLIER',
          'STOCKED',
          'DROPSHIP',
          'AFFILIATE_LINK',
          'QUOTE_REQUIRED'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_products_store_idx
  ON store_products(store_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS store_products_category_idx
  ON store_products(category_id);
CREATE INDEX IF NOT EXISTS store_products_tags_gin_idx
  ON store_products USING GIN(tags);

CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  payment_provider TEXT,
  payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_status_check') THEN
    ALTER TABLE store_orders
      ADD CONSTRAINT store_orders_status_check
      CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'canceled', 'fulfilled', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_payment_status_check') THEN
    ALTER TABLE store_orders
      ADD CONSTRAINT store_orders_payment_status_check
      CHECK (payment_status IN ('not_required', 'pending', 'authorized', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_fulfillment_status_check') THEN
    ALTER TABLE store_orders
      ADD CONSTRAINT store_orders_fulfillment_status_check
      CHECK (fulfillment_status IN ('pending', 'ready', 'fulfilled', 'canceled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_orders_user_idx
  ON store_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status_idx
  ON store_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS store_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  store_id UUID REFERENCES store_vendors(id) ON DELETE SET NULL,
  product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
  product_slug TEXT,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  variant_choice_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_order_items_qty_check') THEN
    ALTER TABLE store_order_items
      ADD CONSTRAINT store_order_items_qty_check
      CHECK (quantity > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_order_items_order_idx
  ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS store_order_items_product_idx
  ON store_order_items(product_id);
CREATE INDEX IF NOT EXISTS store_order_items_store_idx
  ON store_order_items(store_id);

CREATE TABLE IF NOT EXISTS store_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES store_vendors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_quote_requests_status_check') THEN
    ALTER TABLE store_quote_requests
      ADD CONSTRAINT store_quote_requests_status_check
      CHECK (status IN ('pending', 'contacted', 'quoted', 'accepted', 'declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_quote_requests_store_idx
  ON store_quote_requests(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS store_quote_requests_user_idx
  ON store_quote_requests(user_id, created_at DESC);
