-- Migration 057: rich community seed posts across NWU module rooms and campus life
-- Adds realistic academic posts so rooms don't feel empty at launch
-- All inserted with DO NOTHING on content conflict so it's safe to re-run

DO $$
DECLARE
  nwu_id UUID;
  seed_author_id UUID;
BEGIN
  SELECT id INTO nwu_id
  FROM institutions
  WHERE short_name ILIKE 'NWU%' OR name ILIKE 'North-West University%' OR domain = 'nwu.ac.za'
  LIMIT 1;

  IF nwu_id IS NULL THEN
    nwu_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  SELECT id INTO seed_author_id FROM users LIMIT 1;
  IF seed_author_id IS NULL THEN RETURN; END IF;

  -- Ensure module rooms exist
  INSERT INTO module_rooms (institution_id, module_code, module_name)
  SELECT nwu_id, v.code, v.name
  FROM (VALUES
    ('EKIP212',        'Economics and International Trade'),
    ('EKRP211',        'Risk Management Fundamentals'),
    ('MACROECONOMICS', 'Macroeconomics'),
    ('ACCN111',        'Financial Accounting 111'),
    ('STAT111',        'Statistics 111'),
    ('ECOS111',        'Economics 111'),
    ('VARSITY-LIFE',   'Varsity Life'),
    ('FRESHERS',       'Freshers')
  ) AS v(code, name)
  ON CONFLICT (institution_id, module_code) DO NOTHING;

  -- --- EKIP212: Economics and International Trade ---------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKIP212',
    'Can someone explain the difference between absolute and comparative advantage? I keep confusing them when the exam question asks me to determine who should specialise in what.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKIP212'
    AND content LIKE 'Can someone explain the difference between absolute and comparative%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKIP212',
    'EKIP212 Resource Share: The WTO Dispute Settlement Understanding (DSU) is high-frequency in exams. Key points: (1) prefer consultation before panel, (2) Appellate Body gives final binding ruling, (3) retaliatory measures only allowed if compliance fails. Draw the flowchart - examiners love it.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKIP212'
    AND content LIKE 'EKIP212 Resource Share: The WTO Dispute Settlement%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKIP212',
    'Is the exchange rate question in Section B always a calculation, or can it be a theoretical essay? The past papers seem inconsistent.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKIP212'
    AND content LIKE 'Is the exchange rate question in Section B always%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKIP212',
    'Quick exam tip: when explaining trade barriers, always link back to the specific GATT/WTO article. Examiners want to see you know the source - not just that tariffs "restrict trade". Article XI is your friend for quantitative restrictions.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKIP212'
    AND content LIKE 'Quick exam tip: when explaining trade barriers%');

  -- --- EKRP211: Risk Management Fundamentals -------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKRP211',
    'What is the difference between inherent risk and residual risk? The study guide uses them almost interchangeably in Chapter 3 and it''s confusing me.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKRP211'
    AND content LIKE 'What is the difference between inherent risk and residual%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKRP211',
    'Risk matrix tip for the exam: always state your axes explicitly (Likelihood x Impact), use a 3 x 3 or 5 x 5 grid, and classify each risk as Low/Medium/High/Critical. Do NOT just draw the grid without populating it - that is an instant mark loss.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKRP211'
    AND content LIKE 'Risk matrix tip for the exam: always state your axes%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKRP211',
    'Does anyone have notes on the King IV principles specifically? The lecturer mentioned it would be tested and I can''t find a concise summary anywhere.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKRP211'
    AND content LIKE 'Does anyone have notes on the King IV principles%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'EKRP211',
    'EKRP211 Summary: The four risk responses are TARA - Terminate, Accept, Reduce, Accept (or sometimes SARA with Share). The exam usually gives a scenario and asks you to choose the appropriate response AND justify it. Justification earns the marks, not just naming the response.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'EKRP211'
    AND content LIKE 'EKRP211 Summary: The four risk responses are TARA%');

  -- --- MACROECONOMICS ------------------------------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'MACROECONOMICS',
    'How does the repo rate actually affect inflation in South Africa? I understand the mechanism in theory but struggle to explain it in an exam answer without sounding vague.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'MACROECONOMICS'
    AND content LIKE 'How does the repo rate actually affect inflation in South Africa%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'MACROECONOMICS',
    'SA-specific macro framework worth memorising: SARB targets 3-6% CPI inflation. When inflation rises above 6%, SARB increases the repo rate -> commercial banks raise prime rate -> borrowing becomes expensive -> consumer spending falls -> demand-pull inflation decreases. Reverse for when inflation is below 3%. Link each step explicitly in your answer.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'MACROECONOMICS'
    AND content LIKE 'SA-specific macro framework worth memorising%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'MACROECONOMICS',
    'Is the AD-AS model tested as a diagram or just conceptually? I want to know whether to practise drawing it properly or just explain the shifts in words.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'MACROECONOMICS'
    AND content LIKE 'Is the AD-AS model tested as a diagram or just conceptually%');

  -- --- ACCN111: Financial Accounting ---------------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'ACCN111',
    'I keep making sign errors on the trial balance. Does anyone have a clean rule for deciding which accounts are Dr and which are Cr?',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'ACCN111'
    AND content LIKE 'I keep making sign errors on the trial balance%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'ACCN111',
    'DEAD CLIC mnemonic for Accounting 111 - Debits increase: Expenses, Assets, Drawings. Credits increase: Liabilities, Income, Capital. If you memorise nothing else for the first test, memorise this.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'ACCN111'
    AND content LIKE 'DEAD CLIC mnemonic for Accounting 111%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'ACCN111',
    'How much time should we allow per question in the accounting exam? Some of my calculations take forever and I always run out of time.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'ACCN111'
    AND content LIKE 'How much time should we allow per question in the accounting exam%');

  -- --- ECOS111: Economics 111 -----------------------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'ECOS111',
    'Does price elasticity of demand always need to be calculated with the midpoint formula or can we use point elasticity? The lecturer seemed to use both in different slides.',
    'question', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'ECOS111'
    AND content LIKE 'Does price elasticity of demand always need to be calculated%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'ECOS111',
    'Supply and demand shift checklist - save this before the exam: Demand shifts RIGHT when: income rises (normal goods), price of substitute rises, price of complement falls, taste improves, population grows, future price expected to rise. Demand shifts LEFT: opposite of all the above. Supply shifts RIGHT: input costs fall, technology improves, number of producers increases, subsidies given. Left: opposite.',
    'resource', 'module'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'ECOS111'
    AND content LIKE 'Supply and demand shift checklist - save this before the exam%');

  -- --- VARSITY-LIFE (Campus Life) -------------------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'VARSITY-LIFE',
    'For anyone stressed about first-year modules: the lecturers are actually approachable. Email them before you fail a test - they''d rather help you than watch you repeat the module. I learned this the hard way in semester 1.',
    'general', 'campus'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'VARSITY-LIFE'
    AND content LIKE 'For anyone stressed about first-year modules%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'VARSITY-LIFE',
    'Library quiet rooms on the Vanderbijlpark campus - anyone know which floors are least crowded during exam season? The second floor always seems packed by 8 AM.',
    'question', 'campus'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'VARSITY-LIFE'
    AND content LIKE 'Library quiet rooms on the Vanderbijlpark campus%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'VARSITY-LIFE',
    'Study tip that actually worked for me: I set a 25-minute timer, work on one thing only, then 5-minute break. The Pomodoro Technique sounds basic but it genuinely got me through 4 tests in one week. The key is no phone during the 25 minutes - not even on silent.',
    'general', 'campus'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'VARSITY-LIFE'
    AND content LIKE 'Study tip that actually worked for me: I set a 25-minute timer%');

  -- --- FRESHERS -------------------------------------------------------------

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'FRESHERS',
    'Welcome to NWU. Three things nobody tells you in orientation: (1) the timetable on eFundi is not always final - check your module home screen for venue changes. (2) You can submit a timetable clash form if two tests clash. (3) The bursary office has walk-in hours - you don''t need to send an email.',
    'general', 'campus'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'FRESHERS'
    AND content LIKE 'Welcome to NWU. Three things nobody tells you in orientation%');

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT seed_author_id, nwu_id, 'FRESHERS',
    'What is the difference between a module test and a class test at NWU? Do they both count towards the final mark or only one of them?',
    'question', 'campus'
  WHERE NOT EXISTS (SELECT 1 FROM posts WHERE institution_id = nwu_id AND module_code = 'FRESHERS'
    AND content LIKE 'What is the difference between a module test and a class test%');

END $$;
