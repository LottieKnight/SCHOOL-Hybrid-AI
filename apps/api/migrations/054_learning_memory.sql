DO $$
BEGIN
  IF to_regclass('public.institutions') IS NULL THEN
    RAISE EXCEPTION 'institutions table is missing. Apply migration 049 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS concept_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  module_code TEXT NOT NULL DEFAULT '__institution__',
  concept_key TEXT NOT NULL,
  concept_label TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_code, concept_key)
);
CREATE INDEX IF NOT EXISTS idx_concept_dictionary_institution
  ON concept_dictionary (institution_id);
CREATE INDEX IF NOT EXISTS idx_concept_dictionary_aliases
  ON concept_dictionary USING GIN (aliases);

CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_code TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'assistant_question',
    'assistant_followup',
    'struggle_signal',
    'resource_open',
    'resource_revisit',
    'resource_dwell',
    'quiz_correct',
    'quiz_incorrect',
    'concept_reviewed',
    'recommendation_clicked'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'assistant',
    'quiz',
    'resource',
    'manual_feedback'
  )),
  concept_key TEXT,
  resource_id UUID,
  quiz_attempt_id UUID,
  session_id UUID,
  event_weight NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_new_concept BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_from_personalization BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_concept_created
  ON learning_events (user_id, concept_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_module_created
  ON learning_events (user_id, module_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_personalization
  ON learning_events (user_id, excluded_from_personalization);
CREATE INDEX IF NOT EXISTS idx_learning_events_metadata_gin
  ON learning_events USING GIN (metadata);

CREATE TABLE IF NOT EXISTS student_concept_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL DEFAULT '__general__',
  concept_key TEXT NOT NULL,
  concept_label TEXT NOT NULL,
  mastery_score NUMERIC(4,3) NOT NULL DEFAULT 0.0 CHECK (mastery_score BETWEEN 0 AND 1),
  exposure_count INTEGER NOT NULL DEFAULT 0,
  struggle_count INTEGER NOT NULL DEFAULT 0,
  resource_open_count INTEGER NOT NULL DEFAULT 0,
  quiz_correct_count INTEGER NOT NULL DEFAULT 0,
  quiz_incorrect_count INTEGER NOT NULL DEFAULT 0,
  is_new_concept BOOLEAN NOT NULL DEFAULT TRUE,
  is_struggling BOOLEAN GENERATED ALWAYS AS (struggle_count > 2) STORED,
  last_seen_at TIMESTAMPTZ,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module_code, concept_key)
);

CREATE INDEX IF NOT EXISTS idx_student_concept_state_user_module
  ON student_concept_state (user_id, module_code);
CREATE INDEX IF NOT EXISTS idx_student_concept_state_user_score
  ON student_concept_state (user_id, mastery_score ASC, updated_at DESC);

CREATE OR REPLACE FUNCTION compute_mastery_score(
  p_quiz_correct INTEGER,
  p_quiz_incorrect INTEGER,
  p_struggle_count INTEGER,
  p_resource_opens INTEGER,
  p_last_practiced_at TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_score NUMERIC := 0;
BEGIN
  v_score := (COALESCE(p_quiz_correct, 0) * 0.4)
    + (COALESCE(p_quiz_incorrect, 0) * -0.2)
    + (COALESCE(p_struggle_count, 0) * -0.15)
    + (COALESCE(p_resource_opens, 0) * 0.05);

  IF p_last_practiced_at IS NOT NULL AND p_last_practiced_at > NOW() - INTERVAL '14 days' THEN
    v_score := v_score + 0.1;
  END IF;

  IF v_score < 0 THEN
    v_score := 0;
  ELSIF v_score > 1 THEN
    v_score := 1;
  END IF;

  RETURN ROUND(v_score, 3);
END;
$$;

CREATE OR REPLACE FUNCTION update_concept_state_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_module_code TEXT := COALESCE(NULLIF(NEW.module_code, ''), '__general__');
  v_concept_label TEXT;
  v_last_practiced_at TIMESTAMPTZ;
BEGIN
  IF NEW.excluded_from_personalization OR NEW.concept_key IS NULL OR BTRIM(NEW.concept_key) = '' THEN
    RETURN NEW;
  END IF;

  SELECT cd.concept_label
  INTO v_concept_label
  FROM concept_dictionary cd
  WHERE cd.concept_key = NEW.concept_key
    AND COALESCE(cd.module_code, '__institution__') IN (v_module_code, '__institution__')
  ORDER BY CASE WHEN cd.module_code = v_module_code THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_concept_label IS NULL THEN
    v_concept_label := INITCAP(REPLACE(REPLACE(NEW.concept_key, '-', ' '), '_', ' '));
  END IF;

  INSERT INTO student_concept_state (
    user_id,
    module_code,
    concept_key,
    concept_label,
    exposure_count,
    struggle_count,
    resource_open_count,
    quiz_correct_count,
    quiz_incorrect_count,
    is_new_concept,
    last_seen_at,
    last_practiced_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    v_module_code,
    NEW.concept_key,
    v_concept_label,
    1,
    CASE WHEN NEW.event_type = 'struggle_signal' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type IN ('resource_open', 'resource_revisit', 'resource_dwell') THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'quiz_correct' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'quiz_incorrect' THEN 1 ELSE 0 END,
    TRUE,
    NEW.created_at,
    CASE WHEN NEW.event_type IN ('quiz_correct', 'quiz_incorrect', 'resource_revisit', 'concept_reviewed') THEN NEW.created_at ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, module_code, concept_key) DO UPDATE
  SET concept_label = EXCLUDED.concept_label,
      exposure_count = student_concept_state.exposure_count + 1,
      struggle_count = student_concept_state.struggle_count + CASE WHEN NEW.event_type = 'struggle_signal' THEN 1 ELSE 0 END,
      resource_open_count = student_concept_state.resource_open_count + CASE WHEN NEW.event_type IN ('resource_open', 'resource_revisit', 'resource_dwell') THEN 1 ELSE 0 END,
      quiz_correct_count = student_concept_state.quiz_correct_count + CASE WHEN NEW.event_type = 'quiz_correct' THEN 1 ELSE 0 END,
      quiz_incorrect_count = student_concept_state.quiz_incorrect_count + CASE WHEN NEW.event_type = 'quiz_incorrect' THEN 1 ELSE 0 END,
      is_new_concept = FALSE,
      last_seen_at = GREATEST(COALESCE(student_concept_state.last_seen_at, NEW.created_at), NEW.created_at),
      last_practiced_at = CASE
        WHEN NEW.event_type IN ('quiz_correct', 'quiz_incorrect', 'resource_revisit', 'concept_reviewed') THEN NEW.created_at
        ELSE student_concept_state.last_practiced_at
      END,
      updated_at = NOW();

  SELECT last_practiced_at
  INTO v_last_practiced_at
  FROM student_concept_state
  WHERE user_id = NEW.user_id
    AND module_code = v_module_code
    AND concept_key = NEW.concept_key;

  UPDATE student_concept_state
  SET mastery_score = compute_mastery_score(
        quiz_correct_count,
        quiz_incorrect_count,
        struggle_count,
        resource_open_count,
        v_last_practiced_at
      ),
      updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND module_code = v_module_code
    AND concept_key = NEW.concept_key;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_events_update_concept_state ON learning_events;
CREATE TRIGGER trg_learning_events_update_concept_state
AFTER INSERT ON learning_events
FOR EACH ROW
EXECUTE FUNCTION update_concept_state_on_event();

ALTER TABLE IF EXISTS resources
  ADD COLUMN IF NOT EXISTS concepts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE IF EXISTS bookstore_products
  ADD COLUMN IF NOT EXISTS concepts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF to_regclass('public.resources') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_resources_concepts_gin ON resources USING GIN (concepts)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.bookstore_products') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookstore_products_concepts_gin ON bookstore_products USING GIN (concepts)';
  END IF;
END $$;

WITH nwu AS (
  SELECT i.id
  FROM institutions i
  WHERE i.short_name = 'NWU VTC'
     OR i.domain = 'nwu.ac.za'
     OR i.name ILIKE 'North-West University%'
  ORDER BY CASE WHEN i.short_name = 'NWU VTC' THEN 0 ELSE 1 END
  LIMIT 1
)
INSERT INTO concept_dictionary (institution_id, module_code, concept_key, concept_label, aliases)
VALUES
  ((SELECT id FROM nwu), 'EKIP212', 'scarcity', 'Scarcity', ARRAY['limited resources', 'resource scarcity']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'opportunity-cost', 'Opportunity Cost', ARRAY['trade-off cost', 'next best alternative']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'production-possibility-frontier', 'Production Possibility Frontier', ARRAY['ppf', 'production frontier']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'comparative-advantage', 'Comparative Advantage', ARRAY['relative advantage', 'specialisation gains']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'absolute-advantage', 'Absolute Advantage', ARRAY['productivity advantage']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'demand', 'Demand', ARRAY['quantity demanded', 'demand curve']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'supply', 'Supply', ARRAY['quantity supplied', 'supply curve']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'market-equilibrium', 'Market Equilibrium', ARRAY['equilibrium price', 'equilibrium quantity']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'price-elasticity-demand', 'Price Elasticity of Demand', ARRAY['ped', 'elastic demand']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'income-elasticity-demand', 'Income Elasticity of Demand', ARRAY['yed', 'income responsiveness']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'cross-price-elasticity', 'Cross-Price Elasticity', ARRAY['cross elasticity', 'substitutes complements']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'consumer-surplus', 'Consumer Surplus', ARRAY['buyer surplus']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'producer-surplus', 'Producer Surplus', ARRAY['seller surplus']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'price-ceiling', 'Price Ceiling', ARRAY['maximum price']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'price-floor', 'Price Floor', ARRAY['minimum price']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'tax-incidence', 'Tax Incidence', ARRAY['burden of tax', 'who pays tax']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'externalities', 'Externalities', ARRAY['spillover effects']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'public-goods', 'Public Goods', ARRAY['non rival goods', 'non excludable goods']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'common-resources', 'Common Resources', ARRAY['tragedy of commons']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'marginal-utility', 'Marginal Utility', ARRAY['additional satisfaction']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'utility-maximisation', 'Utility Maximisation', ARRAY['consumer choice']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'budget-constraint', 'Budget Constraint', ARRAY['consumer budget line']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'indifference-curves', 'Indifference Curves', ARRAY['consumer indifference']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'cost-curves', 'Cost Curves', ARRAY['average cost', 'marginal cost']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'perfect-competition', 'Perfect Competition', ARRAY['competitive market']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'monopoly', 'Monopoly', ARRAY['single seller market']::TEXT[]),
  ((SELECT id FROM nwu), 'EKIP212', 'deadweight-loss', 'Deadweight Loss', ARRAY['welfare loss']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'financial-statements', 'Financial Statements', ARRAY['statement of financial position', 'income statement']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'double-entry', 'Double-Entry Accounting', ARRAY['debit and credit', 'double entry system']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'trial-balance', 'Trial Balance', ARRAY['balancing ledger']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'journals-ledgers', 'Journals and Ledgers', ARRAY['general journal', 'general ledger']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'adjusting-entries', 'Adjusting Entries', ARRAY['year end adjustments']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'accrual-accounting', 'Accrual Accounting', ARRAY['accrual basis']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'cash-flow-statement', 'Cash Flow Statement', ARRAY['statement of cash flows']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'depreciation', 'Depreciation', ARRAY['asset depreciation']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'inventory-valuation', 'Inventory Valuation', ARRAY['fifo', 'weighted average']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'cost-of-sales', 'Cost of Sales', ARRAY['cost of goods sold', 'cogs']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'accounts-receivable', 'Accounts Receivable', ARRAY['trade receivables', 'debtors']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'allowance-doubtful-debts', 'Allowance for Doubtful Debts', ARRAY['bad debt provision']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'bank-reconciliation', 'Bank Reconciliation', ARRAY['bank recon']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'vat-accounting', 'VAT Accounting', ARRAY['value added tax']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'payroll-accounting', 'Payroll Accounting', ARRAY['wages journal', 'salaries journal']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'internal-control', 'Internal Control', ARRAY['segregation of duties']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'budgeting', 'Budgeting', ARRAY['cash budget', 'operating budget']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'variance-analysis', 'Variance Analysis', ARRAY['budget variance']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'break-even-analysis', 'Break-even Analysis', ARRAY['cvp analysis', 'cost volume profit']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'contribution-margin', 'Contribution Margin', ARRAY['contribution per unit']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'job-costing', 'Job Costing', ARRAY['job order costing']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'process-costing', 'Process Costing', ARRAY['equivalent units']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'standard-costing', 'Standard Costing', ARRAY['standard costs']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'capital-budgeting', 'Capital Budgeting', ARRAY['investment appraisal']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'ratio-analysis', 'Ratio Analysis', ARRAY['liquidity ratios', 'profitability ratios']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'working-capital-management', 'Working Capital Management', ARRAY['current assets and liabilities']::TEXT[]),
  ((SELECT id FROM nwu), 'EKRP211', 'ethics-governance', 'Ethics and Governance', ARRAY['corporate governance', 'professional ethics']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'gross-domestic-product', 'Gross Domestic Product', ARRAY['gdp', 'national output']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'national-income-accounting', 'National Income Accounting', ARRAY['income expenditure approach']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'business-cycle', 'Business Cycle', ARRAY['economic cycle']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'inflation', 'Inflation', ARRAY['price level increase']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'consumer-price-index', 'Consumer Price Index', ARRAY['cpi']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'unemployment', 'Unemployment', ARRAY['joblessness']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'aggregate-demand', 'Aggregate Demand', ARRAY['ad curve']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'aggregate-supply', 'Aggregate Supply', ARRAY['as curve']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'keynesian-cross', 'Keynesian Cross', ARRAY['planned expenditure model']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'multiplier', 'Multiplier', ARRAY['income multiplier']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'fiscal-policy', 'Fiscal Policy', ARRAY['government spending and taxes']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'monetary-policy', 'Monetary Policy', ARRAY['interest rate policy']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'money-supply', 'Money Supply', ARRAY['money stock']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'central-bank', 'Central Bank', ARRAY['reserve bank', 'monetary authority']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'interest-rates', 'Interest Rates', ARRAY['policy rate', 'repo rate']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'exchange-rates', 'Exchange Rates', ARRAY['currency price']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'balance-of-payments', 'Balance of Payments', ARRAY['bop']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'current-account', 'Current Account', ARRAY['trade balance']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'capital-account', 'Capital and Financial Account', ARRAY['financial account']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'economic-growth', 'Economic Growth', ARRAY['real growth']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'development', 'Economic Development', ARRAY['human development']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'supply-side-policies', 'Supply-Side Policies', ARRAY['productivity policies']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'phillips-curve', 'Phillips Curve', ARRAY['inflation unemployment tradeoff']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'is-lm-framework', 'IS-LM Framework', ARRAY['is lm model']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'open-economy-macroeconomics', 'Open Economy Macroeconomics', ARRAY['small open economy']::TEXT[]),
  ((SELECT id FROM nwu), 'MACROECONOMICS', 'stabilisation-policy', 'Stabilisation Policy', ARRAY['countercyclical policy']::TEXT[])
ON CONFLICT (module_code, concept_key) DO NOTHING;

