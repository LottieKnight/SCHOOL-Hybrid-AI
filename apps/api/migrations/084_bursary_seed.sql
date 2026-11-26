-- apps/api/migrations/084_bursary_seed.sql
--
-- Seed a starter set of real, well-known South African bursaries so the
-- Bursary Finder is useful out of the box. Idempotent: bursaries.title carries
-- a UNIQUE index (idx_bursaries_title_seed), so ON CONFLICT (title) DO NOTHING
-- makes re-running this migration a no-op.
--
-- Deadlines are written RELATIVE to CURRENT_DATE so the seed stays "evergreen" —
-- a freshly applied database always shows live, future closing dates rather than
-- dates that silently lapse into the past. Rolling programmes use NULL.
--
-- Field-of-study tokens and year-level tokens below are the canonical vocabulary
-- shared with the web filter UI (apps/web/lib/bursary/constants.ts). Keep the two
-- in sync. Year tokens mirror the user_profiles.year_of_study CHECK:
-- 'school','1','2','3','4','postgrad'.

INSERT INTO bursaries
  (title, provider, provider_type, seta_name, fields_of_study, year_levels,
   needs_based, merit_based, amount_min, amount_max, deadline, description, requirements, link, is_active)
VALUES
  (
    'NSFAS Bursary',
    'National Student Financial Aid Scheme',
    'nsfas', NULL,
    '{}',
    ARRAY['school','1','2','3','4'],
    true, false, NULL, NULL,
    CURRENT_DATE + INTERVAL '120 days',
    'Government bursary covering tuition, accommodation, learning materials, and a living allowance for students from households earning under R350 000 per year (R600 000 for students with disabilities) at public universities and TVET colleges.',
    ARRAY['South African citizen', 'Combined household income below R350 000 p.a.', 'Registered or accepted at a public university or TVET college', 'First undergraduate qualification'],
    'https://www.nsfas.org.za/',
    true
  ),
  (
    'Funza Lushaka Bursary',
    'Department of Basic Education',
    'government', NULL,
    ARRAY['Education'],
    ARRAY['school','1','2','3','4'],
    true, true, NULL, NULL,
    CURRENT_DATE + INTERVAL '90 days',
    'Full-cost bursary for students training as teachers in priority subject areas. Recipients must teach at a public school for the same number of years they received funding.',
    ARRAY['South African citizen', 'Studying a teaching qualification in a priority subject', 'Commit to teach at a public school after graduating', 'Strong academic record'],
    'https://www.funzalushaka.doe.gov.za/',
    true
  ),
  (
    'Sasol Bursary',
    'Sasol',
    'corporate', NULL,
    ARRAY['Engineering','Natural Sciences','Information Technology'],
    ARRAY['school','1','2','3','4'],
    false, true, 150000, 250000,
    CURRENT_DATE + INTERVAL '75 days',
    'Comprehensive bursary covering tuition, accommodation, meals, books, and a laptop for high-performing students in engineering and the sciences, with vacation work and possible employment after graduation.',
    ARRAY['South African citizen', 'Minimum 60% average in Maths and Physical Science (or at university level)', 'Studying an approved engineering or science degree'],
    'https://www.sasolbursaries.com/',
    true
  ),
  (
    'Investec Bursary Programme',
    'Investec',
    'corporate', NULL,
    ARRAY['Commerce & Management','Accounting & Finance','Information Technology'],
    ARRAY['1','2','3','4'],
    true, true, 80000, 200000,
    CURRENT_DATE + INTERVAL '60 days',
    'Covers tuition, accommodation, meals, textbooks, and a laptop, plus mentorship and vacation work for talented students in commerce, accounting, and technology fields.',
    ARRAY['South African citizen', 'Demonstrated financial need', 'Minimum 65% academic average', 'Studying a supported degree'],
    'https://www.investec.com/en_za/welcome-to-investec/corporate-responsibility/education.html',
    true
  ),
  (
    'Allan Gray Orbis Foundation Fellowship',
    'Allan Gray Orbis Foundation',
    'ngo', NULL,
    '{}',
    ARRAY['school','1'],
    true, true, NULL, NULL,
    CURRENT_DATE + INTERVAL '45 days',
    'A fellowship for entrepreneurially minded school-leavers and first-year students. Covers full university costs and provides a structured programme of entrepreneurial development, mentorship, and a peer network.',
    ARRAY['South African citizen', 'Entrepreneurial potential', 'Academic excellence', 'Apply in Grade 12 or first year of study'],
    'https://www.allangrayorbis.org/',
    true
  ),
  (
    'Eskom Bursary',
    'Eskom',
    'corporate', NULL,
    ARRAY['Engineering','Information Technology'],
    ARRAY['school','1','2','3'],
    false, true, 120000, 220000,
    CURRENT_DATE + INTERVAL '80 days',
    'Full bursary for students in electrical, mechanical, and related engineering disciplines, including tuition, residence, meals, books, and a monthly allowance, with vacation training at Eskom.',
    ARRAY['South African citizen', 'Strong Maths and Physical Science results', 'Studying an approved engineering qualification'],
    'https://www.eskom.co.za/careers/bursaries/',
    true
  ),
  (
    'Department of Health Bursary',
    'National Department of Health',
    'government', NULL,
    ARRAY['Health Sciences','Medicine'],
    ARRAY['school','1','2','3','4'],
    true, true, NULL, NULL,
    CURRENT_DATE + INTERVAL '100 days',
    'Funds students in medicine and the health sciences in exchange for a period of work-back service in the public health system after qualifying.',
    ARRAY['South African citizen', 'Accepted into a health-sciences or medical programme', 'Financial need', 'Commit to public-sector community service'],
    'https://www.health.gov.za/',
    true
  ),
  (
    'SAICA Thuthuka Bursary Fund',
    'South African Institute of Chartered Accountants',
    'corporate', NULL,
    ARRAY['Accounting & Finance'],
    ARRAY['school','1','2','3'],
    true, true, 90000, 180000,
    CURRENT_DATE + INTERVAL '50 days',
    'Bursary for African and Coloured students pursuing the Chartered Accountant (CA) pathway. Covers tuition, residence, meals, books, a laptop, and academic and life-skills support.',
    ARRAY['South African citizen (African or Coloured)', 'Minimum 60% in Maths (not Maths Literacy)', 'Financial need', 'Studying towards CA(SA) at a SAICA-accredited university'],
    'https://www.thuthukabursaryfund.co.za/',
    true
  ),
  (
    'Transnet Bursary',
    'Transnet',
    'corporate', NULL,
    ARRAY['Engineering','Information Technology','Built Environment'],
    ARRAY['1','2','3'],
    false, true, 100000, 200000,
    CURRENT_DATE + INTERVAL '70 days',
    'Bursary covering tuition, accommodation, books, and allowances for engineering and built-environment students, with practical experience across Transnet operating divisions.',
    ARRAY['South African citizen', 'Minimum 60% average', 'Studying an approved engineering or built-environment degree'],
    'https://www.transnet.net/',
    true
  ),
  (
    'merSETA Bursary',
    'Manufacturing, Engineering and Related Services SETA',
    'seta', 'merSETA',
    ARRAY['Engineering'],
    ARRAY['1','2','3','4'],
    true, false, 60000, 120000,
    CURRENT_DATE + INTERVAL '85 days',
    'Sector bursary for students in manufacturing and engineering disciplines, supporting tuition and registration costs to grow scarce and critical skills.',
    ARRAY['South African citizen', 'Registered for a qualifying engineering programme', 'Financial need'],
    'https://www.merseta.org.za/',
    true
  ),
  (
    'Nedbank External Bursary',
    'Nedbank',
    'corporate', NULL,
    ARRAY['Commerce & Management','Accounting & Finance','Information Technology'],
    ARRAY['2','3'],
    true, true, 70000, 160000,
    CURRENT_DATE + INTERVAL '40 days',
    'Bursary for second- and third-year students in commerce, accounting, and IT, covering tuition, prescribed books, accommodation, and a laptop, with vacation work opportunities.',
    ARRAY['South African citizen', 'Minimum 65% average', 'Financial need', 'Studying a supported degree'],
    'https://www.nedbank.co.za/content/nedbank/desktop/gt/en/aboutus/careers.html',
    true
  ),
  (
    'GreenMatter Fellowship',
    'GreenMatter',
    'ngo', NULL,
    ARRAY['Natural Sciences','Agriculture'],
    ARRAY['3','4','postgrad'],
    true, true, NULL, NULL,
    NULL,
    'Fellowship supporting students in biodiversity and environmental fields, with a focus on building scarce skills for conservation and the green economy. Includes funding and professional development.',
    ARRAY['South African citizen', 'Studying a biodiversity or environmental field', 'Honours level or above'],
    'https://greenmatter.co.za/',
    true
  ),
  (
    'Standard Bank Group Bursary',
    'Standard Bank',
    'corporate', NULL,
    ARRAY['Commerce & Management','Information Technology','Accounting & Finance'],
    ARRAY['1','2','3'],
    true, true, 80000, 180000,
    CURRENT_DATE + INTERVAL '55 days',
    'Bursary covering tuition, accommodation, books, and allowances for students in commerce, accounting, and technology, with internship and graduate-programme pathways.',
    ARRAY['South African citizen', 'Strong academic record', 'Financial need', 'Studying a supported degree'],
    'https://www.standardbank.com/sbg/standard-bank-group/who-we-are/careers',
    true
  ),
  (
    'Mandela Rhodes Scholarship',
    'The Mandela Rhodes Foundation',
    'ngo', NULL,
    '{}',
    ARRAY['4','postgrad'],
    false, true, NULL, NULL,
    CURRENT_DATE + INTERVAL '110 days',
    'A prestigious postgraduate scholarship combining funding for honours or a master''s degree with a leadership development programme, open to African students across all fields.',
    ARRAY['African citizen', 'Academic excellence', 'Demonstrated leadership', 'Entering an honours or master''s year'],
    'https://www.mandelarhodes.org/',
    true
  )
ON CONFLICT (title) DO NOTHING;
