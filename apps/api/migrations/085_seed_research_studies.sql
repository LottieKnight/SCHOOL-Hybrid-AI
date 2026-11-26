-- Seed the default observational-silence-v1 research study with status='recruiting'
INSERT INTO research_studies (
    code,
    title,
    description,
    status,
    ethics_ref,
    principal_investigator,
    current_consent_version,
    current_stimulus_version,
    min_age,
    config,
    opened_at
)
VALUES (
    'observational-silence-v1',
    'Observational Silence: Selective Attention & Inattentional Blindness',
    'Replication of the Simons & Chabris (1999) visual selective attention paradigm.',
    'recruiting',
    'NWU-00124-2026',
    'Mondli Manzi (NWU Psychology)',
    'v1',
    'v1',
    18,
    '{"study": "observational-silence-v1", "purposes": ["academic_research"]}'::jsonb,
    NOW()
)
ON CONFLICT (code) DO UPDATE
SET status = 'recruiting',
    min_age = EXCLUDED.min_age;
