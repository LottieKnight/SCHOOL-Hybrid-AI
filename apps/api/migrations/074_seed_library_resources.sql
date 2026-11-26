-- Seed library_resources with open-access starter content spanning all
-- six content types and a spread of grade bands.
-- All resource_url values are publicly accessible free resources.
-- Use ON CONFLICT DO NOTHING so re-running the migration is safe.

INSERT INTO library_resources (
  title, description, content_type, subject, grade_band,
  topic_tags, author, publisher, published_year, language,
  access_type, resource_url, file_type, metadata_json
) VALUES

-- ── Articles ──────────────────────────────────────────────────────────────────
(
  'How Compound Interest Works',
  'A plain-language explainer on compound interest, the Rule of 72, and why starting early matters for long-term wealth building.',
  'article', 'Mathematics', 'senior',
  ARRAY['compound interest','finance','mathematics','grade 10','grade 11'],
  'Khan Academy', 'Khan Academy', 2023, 'en',
  'free', 'https://www.khanacademy.org/economics-finance-domain/core-finance/interest-tutorial/compound-interest-tutorial/a/compound-interest-basics',
  'link', '{}'
),
(
  'Understanding Supply and Demand',
  'Core microeconomics explainer covering demand and supply curves, equilibrium price, and market forces — aligned to Grade 10–12 Economics.',
  'article', 'Economics', 'fet',
  ARRAY['supply','demand','equilibrium','microeconomics','grade 10','grade 11','grade 12'],
  'Investopedia', 'Investopedia', 2024, 'en',
  'free', 'https://www.investopedia.com/terms/l/law-of-supply-demand.asp',
  'link', '{}'
),
(
  'DNA Replication Explained',
  'Step-by-step breakdown of DNA replication: helicase, DNA polymerase, leading and lagging strands, and Okazaki fragments.',
  'article', 'Life Sciences', 'fet',
  ARRAY['DNA','replication','genetics','biology','grade 12'],
  'Biology Online', 'Biology Online', 2023, 'en',
  'free', 'https://www.biologyonline.com/tutorials/dna-replication',
  'link', '{}'
),

-- ── Books ─────────────────────────────────────────────────────────────────────
(
  'Everything Maths — Grade 12',
  'Open textbook covering the full Grade 12 Mathematics curriculum: calculus, probability, statistics, algebra, and geometry. Free to download.',
  'book', 'Mathematics', 'fet',
  ARRAY['mathematics','grade 12','calculus','algebra','probability','open textbook'],
  'Siyavula', 'Siyavula Education', 2023, 'en',
  'free', 'https://www.siyavula.com/read/maths/grade-12',
  'link', '{}'
),
(
  'Everything Science — Grade 11',
  'Open textbook for Grade 11 Physical Sciences: mechanics, waves, electricity, matter and materials.',
  'book', 'Physical Sciences', 'fet',
  ARRAY['physics','chemistry','grade 11','mechanics','waves','electricity','open textbook'],
  'Siyavula', 'Siyavula Education', 2023, 'en',
  'free', 'https://www.siyavula.com/read/science/grade-11',
  'link', '{}'
),
(
  'Think Like a Computer Scientist — Python',
  'Introductory programming textbook using Python. Covers variables, functions, loops, recursion, and object-oriented design. Suitable for university first-years and advanced FET learners.',
  'book', 'Computer Science', 'university',
  ARRAY['python','programming','computer science','algorithms','open textbook'],
  'Allen B. Downey', 'Green Tea Press', 2015, 'en',
  'free', 'https://greenteapress.com/thinkpython2/html/index.html',
  'link', '{}'
),

-- ── Journals ──────────────────────────────────────────────────────────────────
(
  'South African Journal of Education — Open Access',
  'Peer-reviewed journal publishing research on education policy, curriculum, teaching practice, and learner outcomes in South Africa.',
  'journal', 'Education', 'university',
  ARRAY['education research','curriculum','teaching','south africa','peer reviewed'],
  'SAJE Editorial Board', 'Education Association of South Africa', 2024, 'en',
  'free', 'https://www.sajournalofeducation.co.za',
  'link', '{}'
),
(
  'African Journal of Mathematics, Science and Technology Education',
  'Open-access journal focused on STEM education research across the African continent.',
  'journal', 'Mathematics', 'university',
  ARRAY['STEM','mathematics education','science education','Africa','research'],
  'AMSTE Editorial Board', 'Routledge / Taylor & Francis', 2024, 'en',
  'free', 'https://www.tandfonline.com/journals/rmse20',
  'link', '{}'
),

-- ── Publications ──────────────────────────────────────────────────────────────
(
  'CAPS Curriculum Document — Mathematics Grades 10–12',
  'Official DBE curriculum and assessment policy statement for Mathematics in the FET phase. Defines topics, weighting, and assessment guidelines.',
  'publication', 'Mathematics', 'fet',
  ARRAY['CAPS','curriculum','assessment policy','grade 10','grade 11','grade 12','DBE'],
  'Department of Basic Education', 'Department of Basic Education', 2011, 'en',
  'free', 'https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSFETMathematics.aspx',
  'link', '{}'
),
(
  'National Senior Certificate Examination Guidelines 2025',
  'Official DBE examination guidelines covering subject content, question paper formats, and assessment criteria for NSC examinations.',
  'publication', NULL, 'fet',
  ARRAY['NSC','matric','examination','DBE','grade 12','assessment'],
  'Department of Basic Education', 'Department of Basic Education', 2024, 'en',
  'free', 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations.aspx',
  'link', '{}'
),

-- ── Past Papers ───────────────────────────────────────────────────────────────
(
  'Grade 12 Mathematics Paper 1 — 2023 NSC',
  'Official 2023 National Senior Certificate Mathematics Paper 1 examination. Covers algebra, functions, finance, calculus, probability.',
  'past_paper', 'Mathematics', 'fet',
  ARRAY['NSC','grade 12','mathematics','paper 1','2023','exam'],
  'Department of Basic Education', 'Department of Basic Education', 2023, 'en',
  'free', 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationpapers.aspx',
  'link', '{}'
),
(
  'Grade 12 Physical Sciences Paper 2 — 2023 NSC',
  'Official 2023 NSC Physical Sciences Paper 2 (Chemistry). Covers organic chemistry, electrochemistry, and quantitative aspects of chemical change.',
  'past_paper', 'Physical Sciences', 'fet',
  ARRAY['NSC','grade 12','physical sciences','chemistry','paper 2','2023','exam'],
  'Department of Basic Education', 'Department of Basic Education', 2023, 'en',
  'free', 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationpapers.aspx',
  'link', '{}'
),

-- ── Video Lessons ─────────────────────────────────────────────────────────────
(
  'Quadratic Equations — Full Lesson',
  'Video lesson covering factoring, completing the square, the quadratic formula, and graphing parabolas. Suitable for Grade 10–11 learners.',
  'video_lesson', 'Mathematics', 'senior',
  ARRAY['quadratic equations','grade 10','grade 11','algebra','factoring','parabola'],
  'Khan Academy', 'Khan Academy', 2023, 'en',
  'free', 'https://www.youtube.com/watch?v=rJH0sMQMl2I',
  'link', '{}'
),
(
  'Introduction to Macroeconomics — University Lecture',
  'Introductory university-level macroeconomics lecture covering GDP, inflation, unemployment, fiscal policy, and monetary policy.',
  'video_lesson', 'Economics', 'university',
  ARRAY['macroeconomics','GDP','inflation','fiscal policy','monetary policy','university','first year'],
  'MIT OpenCourseWare', 'MIT', 2022, 'en',
  'free', 'https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2018/video-galleries/',
  'link', '{}'
),
(
  'Newton''s Laws of Motion — Grade 11 Physics',
  'Video series covering Newton''s three laws with worked examples, free-body diagrams, and problem-solving techniques for Grade 11 Physical Sciences.',
  'video_lesson', 'Physical Sciences', 'fet',
  ARRAY['Newton''s laws','physics','grade 11','mechanics','free body diagram','forces'],
  'Mindset Learn', 'Mindset Network', 2022, 'en',
  'free', 'https://www.youtube.com/playlist?list=PLBFdOuiNkGMHHxIDrFBDPzFbJDnmDKQoH',
  'link', '{}'
)

ON CONFLICT DO NOTHING;
