DO $$
DECLARE
  nwu_id UUID;
  starter_author_id UUID;
  ekip_room_id UUID;
  ekrp_room_id UUID;
  macro_room_id UUID;
  ekip_post_id UUID;
  ekrp_post_id UUID;
  macro_post_id UUID;
BEGIN
  nwu_id := COALESCE(
    (
      SELECT id
      FROM institutions
      WHERE
        short_name ILIKE 'NWU%'
        OR name ILIKE 'North-West University%'
        OR domain = 'nwu.ac.za'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO module_rooms (institution_id, module_code, module_name)
  SELECT nwu_id, seed.module_code, seed.module_name
  FROM (
    VALUES
      ('EKIP212', 'Economics and International Trade'),
      ('EKRP211', 'Risk Management Fundamentals'),
      ('MACROECONOMICS', 'Macroeconomics')
  ) AS seed(module_code, module_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM module_rooms existing
    WHERE existing.institution_id = nwu_id
      AND existing.module_code = seed.module_code
  );

  SELECT id INTO starter_author_id
  FROM users
  LIMIT 1;

  IF starter_author_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO ekip_room_id
  FROM module_rooms
  WHERE institution_id = nwu_id AND module_code = 'EKIP212'
  LIMIT 1;

  SELECT id INTO ekrp_room_id
  FROM module_rooms
  WHERE institution_id = nwu_id AND module_code = 'EKRP211'
  LIMIT 1;

  SELECT id INTO macro_room_id
  FROM module_rooms
  WHERE institution_id = nwu_id AND module_code = 'MACROECONOMICS'
  LIMIT 1;

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT
    starter_author_id,
    nwu_id,
    'EKIP212',
    'Starter thread: use this room for trade-policy questions, exam-pressure problem spots, and concise summaries that help the next student faster.',
    'announcement',
    'module'
  WHERE ekip_room_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM posts
      WHERE institution_id = nwu_id
        AND module_code = 'EKIP212'
        AND content = 'Starter thread: use this room for trade-policy questions, exam-pressure problem spots, and concise summaries that help the next student faster.'
    );

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT
    starter_author_id,
    nwu_id,
    'EKRP211',
    'Starter resource share: post risk frameworks, lecture clarifications, and quick examples that translate theory into an exam-ready answer structure.',
    'resource',
    'module'
  WHERE ekrp_room_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM posts
      WHERE institution_id = nwu_id
        AND module_code = 'EKRP211'
        AND content = 'Starter resource share: post risk frameworks, lecture clarifications, and quick examples that translate theory into an exam-ready answer structure.'
    );

  INSERT INTO posts (user_id, institution_id, module_code, content, post_type, audience)
  SELECT
    starter_author_id,
    nwu_id,
    'MACROECONOMICS',
    'Starter question: which macro concept do you want unpacked from a South African perspective first — inflation, unemployment, growth, or monetary policy?',
    'question',
    'module'
  WHERE macro_room_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM posts
      WHERE institution_id = nwu_id
        AND module_code = 'MACROECONOMICS'
        AND content = 'Starter question: which macro concept do you want unpacked from a South African perspective first — inflation, unemployment, growth, or monetary policy?'
    );

  SELECT id INTO ekip_post_id
  FROM posts
  WHERE institution_id = nwu_id
    AND module_code = 'EKIP212'
    AND content = 'Starter thread: use this room for trade-policy questions, exam-pressure problem spots, and concise summaries that help the next student faster.'
  LIMIT 1;

  SELECT id INTO ekrp_post_id
  FROM posts
  WHERE institution_id = nwu_id
    AND module_code = 'EKRP211'
    AND content = 'Starter resource share: post risk frameworks, lecture clarifications, and quick examples that translate theory into an exam-ready answer structure.'
  LIMIT 1;

  SELECT id INTO macro_post_id
  FROM posts
  WHERE institution_id = nwu_id
    AND module_code = 'MACROECONOMICS'
    AND content = 'Starter question: which macro concept do you want unpacked from a South African perspective first — inflation, unemployment, growth, or monetary policy?'
  LIMIT 1;

  UPDATE module_rooms
  SET pinned_post_id = ekip_post_id
  WHERE id = ekip_room_id
    AND pinned_post_id IS NULL
    AND ekip_post_id IS NOT NULL;

  UPDATE module_rooms
  SET pinned_post_id = ekrp_post_id
  WHERE id = ekrp_room_id
    AND pinned_post_id IS NULL
    AND ekrp_post_id IS NOT NULL;

  UPDATE module_rooms
  SET pinned_post_id = macro_post_id
  WHERE id = macro_room_id
    AND pinned_post_id IS NULL
    AND macro_post_id IS NOT NULL;
END $$;
