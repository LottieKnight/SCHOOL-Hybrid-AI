"""
SCHOOL RAG — CAPS Seed v4
Life Orientation and Mathematical Literacy (Gr10–12)
12 documents | 6 per subject

Usage:
  source ~/gpu-env/bin/activate
  python -m scripts.seed_caps_v4
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client


def _load_env() -> str:
    loaded = []
    for candidate in [
        Path(".env.local"),
        Path("apps/web/.env.local"),
        Path(__file__).parent.parent / "apps/web/.env.local",
    ]:
        if candidate.exists() and str(candidate.resolve()) not in [
            str(p.resolve()) for p in loaded
        ]:
            load_dotenv(candidate, override=True)
            loaded.append(candidate)
    return ", ".join(str(p) for p in loaded) if loaded else "shell environment"


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size]).strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def ingest(supabase, model: SentenceTransformer, content: str, metadata: dict, batch_size: int = 32) -> int:
    chunks = chunk_text(content)
    if not chunks:
        return 0
    print(f"  Embedding {len(chunks)} chunks for: {metadata.get('title', 'unknown')}")
    embeddings = model.encode(chunks, batch_size=batch_size, show_progress_bar=True)
    rows = [{"content": c, "embedding": e.tolist(), "metadata": metadata} for c, e in zip(chunks, embeddings)]
    result = supabase.table("documents").insert(rows).execute()
    count = len(result.data) if result.data else 0
    print(f"  Inserted {count} rows ✅")
    return count


# ---------------------------------------------------------------------------
# Life Orientation
# ---------------------------------------------------------------------------
LIFE_ORIENTATION: list[dict] = [
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 10,
            "topic": "health",
            "title": "Personal Health — HIV/AIDS, STIs and Reproductive Health — Grade 10 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        HIV/AIDS in South Africa:
        South Africa has one of the largest HIV epidemics in the world — approximately 7.8 million people living with HIV (2023).
        HIV (Human Immunodeficiency Virus) attacks the immune system's CD4 cells.
        AIDS (Acquired Immunodeficiency Syndrome) is the most advanced stage of HIV infection when the immune system is severely compromised.

        Transmission routes:
        - Unprotected sexual intercourse (most common route in SA).
        - Sharing needles or syringes.
        - Mother-to-child transmission (during pregnancy, birth, or breastfeeding).
        - Blood transfusions with infected blood (rare in SA — blood is screened).
        HIV is NOT transmitted through casual contact (shaking hands, hugging, sharing food or toilet seats).

        Prevention — ABC approach:
        A = Abstain from sexual activity.
        B = Be faithful to one uninfected partner.
        C = Condomise consistently and correctly (male and female condoms both effective).
        Additional prevention: PrEP (Pre-Exposure Prophylaxis) — antiretroviral medication taken by HIV-negative people at high risk. Available free at SA public health clinics.

        Testing: HIV test is confidential and available free at public clinics. Knowing your status allows early treatment.
        Treatment: ART (Antiretroviral Therapy) — does not cure HIV but suppresses the virus, allowing people to live long healthy lives and reduces transmission. SA has the world's largest ART programme (over 5 million people on ART).

        Sexually Transmitted Infections (STIs) other than HIV:
        - Gonorrhoea, syphilis, chlamydia (bacterial — curable with antibiotics).
        - Herpes, HPV (viral — manageable but not curable).
        - Symptoms: unusual discharge, sores, burning during urination, pain.
        - All STIs increase HIV risk (cause inflammation and sores that are entry points for HIV).
        Prevention: consistent condom use; regular testing; treating partners simultaneously.

        Reproductive health and rights:
        South Africa's Choice on Termination of Pregnancy Act allows legal abortion on request up to 12 weeks.
        Contraception: available free at public clinics — pills, injections (Depo-Provera), implants, IUDs, condoms.
        Teen pregnancy: SA has one of the highest teen pregnancy rates in the world; linked to poverty, gender inequality, and lack of comprehensive sexuality education.
        """,
    },
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 10,
            "topic": "human_rights",
            "title": "South African Constitution and Bill of Rights — Grade 10 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        The Constitution of South Africa (Act 108 of 1996) is the supreme law of the land.
        Any law or conduct inconsistent with the Constitution is invalid.
        South Africa's Constitution is widely regarded as one of the most progressive in the world.

        The Bill of Rights (Chapter 2 of the Constitution):
        Contains the fundamental human rights of all people in South Africa.
        The state must respect, protect, promote, and fulfil these rights.

        Key rights in the Bill of Rights:
        - Equality (Section 9): everyone is equal before the law; no unfair discrimination based on race, gender, sex, pregnancy, marital status, ethnic origin, colour, sexual orientation, age, disability, religion, conscience, belief, culture, language, or birth.
        - Human dignity (Section 10): everyone has inherent dignity and the right to have their dignity respected.
        - Life (Section 11): everyone has the right to life.
        - Freedom and security of the person (Section 12): includes freedom from violence and torture.
        - Slavery and forced labour (Section 13): prohibited.
        - Privacy (Section 14): home cannot be searched without warrant.
        - Freedom of expression (Section 16): includes freedom of the press; excludes hate speech and incitement to violence.
        - Freedom of religion, belief and opinion (Section 15).
        - Education (Section 29): everyone has the right to a basic education.
        - Health care, food, water and social security (Section 27): the state must take reasonable measures to progressively realise these rights.
        - Children's rights (Section 28): best interests of the child are paramount.
        - Labour rights (Section 23): right to fair labour practices; right to form and join trade unions.

        Limitations on rights:
        Rights are not absolute. Section 36 (Limitation Clause): rights may be limited by law of general application if the limitation is reasonable and justifiable in an open and democratic society.

        Constitutional institutions protecting rights:
        - Constitutional Court: highest court for constitutional matters.
        - South African Human Rights Commission (SAHRC): investigates human rights violations.
        - Public Protector: investigates maladministration and corruption in government (Thuli Madonsela was iconic holder 2009–2016).
        - Gender Commission: promotes gender equality.
        - Ombudsman for various sectors.

        Responsibilities accompanying rights:
        Rights come with responsibilities — you must respect others' rights. Vandalism, corruption, and discrimination violate others' constitutional rights.
        """,
    },
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 11,
            "topic": "social_issues",
            "title": "Social Issues — GBV, Substance Abuse and Peer Pressure — Grade 11 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Gender-Based Violence (GBV) in South Africa:
        South Africa has one of the highest rates of GBV in the world. A woman is killed every 3–4 hours by an intimate partner.
        GBV includes: domestic violence, sexual assault and rape, emotional abuse, economic abuse, stalking.

        The Domestic Violence Act 116 of 1998: provides legal protection for victims of domestic violence.
        Victims can apply for a Protection Order at the magistrate's court — prevents the abuser from contacting or approaching the victim.
        GBV Command Centre: 0800 428 428 (24-hour free helpline).

        Causes of GBV: patriarchal attitudes, harmful cultural norms (toxic masculinity), alcohol and substance abuse, poverty and stress, gender inequality.

        Bystander approach: if you witness GBV, report it to police (SAPS: 10111), support the victim, do not leave the victim alone with the abuser.

        Substance abuse:
        Commonly abused substances in SA: alcohol (legal but harmful), cannabis/dagga, methamphetamine (tik — epidemic in Western Cape), Nyaope (mix of heroin, antiretrovirals, rat poison), prescription medication abuse.
        Effects: physical health deterioration, mental health disorders, addiction, family breakdown, criminal behaviour.
        Stages of addiction: experimentation → regular use → risky use → dependence → addiction.
        Treatment: SANCA (South African National Council on Alcoholism and Drug Dependence) provides rehabilitation; SAPS narcotics units; community support groups.

        Peer pressure:
        Direct pressure: friends explicitly encouraging risky behaviour ("just try it," "everyone does it").
        Indirect pressure: observing peers and feeling the need to conform even without being asked.
        Positive peer pressure: peers encouraging sport, academic achievement, healthy behaviour.

        Strategies to resist negative peer pressure:
        - Use "I" statements ("I don't drink").
        - Suggest alternatives ("Let's go play sport instead").
        - Leave the situation.
        - Prepare responses in advance.
        - Surround yourself with positive influences.
        - Seek help from a trusted adult or counsellor if pressure continues.

        Support structures: school counsellors, SANCA, LifeLine (0861 322 322), religious organisations, family.
        """,
    },
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 11,
            "topic": "career",
            "title": "Career Planning and Study Skills — Grade 11 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Career planning is the process of making decisions about your education, training, and work.
        Grade 11 is the ideal time to plan your career path — your Grade 12 subject choices and university application happen now.

        Self-assessment for career choice:
        - Interests: what activities energise you? (Holland's RIASEC model: Realistic, Investigative, Artistic, Social, Enterprising, Conventional)
        - Skills: what are you good at? (hard skills: maths, languages; soft skills: communication, teamwork, problem-solving)
        - Values: what matters to you in a career? (helping others, financial reward, creativity, status)
        - Personality: introvert/extrovert, structured/flexible, independent/collaborative

        South African career landscape:
        - High demand fields: ICT, engineering, healthcare, education, accounting, renewable energy, data science.
        - DHET (Department of Higher Education and Training) identifies scarce and critical skills.
        - Bursaries available from NSFAS, Funza Lushaka (teaching), SASSETA (safety and security), corporate bursary programmes.

        Post-school pathways:
        - University (Bachelor's degree): requires Bachelor pass (Maths, Home Language, 4 other subjects at 50%+). Apply via CAPS.
        - TVET College (Technical and Vocational Education and Training): N1–N6 programmes, learnerships, artisan training. Apprenticeships for trades (electrician, plumber, welder).
        - Learnerships: work-based learning leading to a qualification; SETA-accredited.
        - Private colleges: business, design, hospitality — more flexible entry.

        Study skills for exam success:
        - Active reading: SQ3R method (Survey, Question, Read, Recite, Review).
        - Note-taking: mind maps, Cornell notes, summaries.
        - Time management: study timetable — schedule specific subjects at specific times; short sessions (45 min) with breaks are more effective than marathon sessions.
        - Spaced repetition: review material at increasing intervals (after 1 day, 3 days, 1 week, 1 month) — proven most effective for long-term retention.
        - Past papers: best exam preparation — practise under timed conditions, mark your own work.
        - Memory techniques: mnemonics, acronyms, visual associations, chunking.
        - Sleep: memory consolidation occurs during sleep — 8 hours is essential during exam period.
        - Stress management: exercise, mindfulness, talking to someone, maintaining social connections.
        """,
    },
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 12,
            "topic": "democracy",
            "title": "Democracy, Citizenship and Civic Responsibilities — Grade 12 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Democracy is a system of government where power is held by the people, exercised directly or through elected representatives.

        South Africa is a constitutional democracy — the Constitution is supreme, not Parliament or the President.
        Key features of South African democracy: free and fair elections, multi-party system, separation of powers, independent judiciary, free press, protection of human rights.

        The three branches of government:
        1. Legislature (Parliament): makes laws. Consists of the National Assembly (400 members) and the National Council of Provinces (NCOP — 90 members, 10 per province). Members of Parliament (MPs) are elected by proportional representation.
        2. Executive: implements laws. Led by the President (head of state and government), Deputy President, and Cabinet Ministers. President elected by the National Assembly.
        3. Judiciary: interprets and applies the law. Independent of the other branches. Hierarchy: Magistrate's Court → High Court → Supreme Court of Appeal → Constitutional Court (highest court).

        Separation of powers + checks and balances: each branch limits the powers of the others, preventing abuse.

        Elections in South Africa:
        - Electoral Commission of South Africa (IEC) administers elections.
        - Voting age: 18 years. ID required.
        - Proportional representation system: parties win seats proportional to their share of the vote. Encourages multi-party representation.
        - National elections held every 5 years. Last general election: 2024 (ANC lost outright majority for first time since 1994 — Government of National Unity formed).
        - Local government elections: every 5 years for municipalities.

        Active citizenship — responsibilities:
        - Voting: a right AND a civic duty. Low voter turnout weakens democracy.
        - Community involvement: joining civic organisations, school governing bodies (SGBs), ratepayers associations.
        - Paying taxes: funds public services.
        - Reporting corruption: use Public Protector, anti-corruption hotline (0800 701 701).
        - Obeying the law: including traffic laws, environmental regulations.
        - Respecting others' rights and dignity.

        Service delivery: the responsibility of all three spheres of government (national, provincial, municipal) to provide basic services — water, electricity, sanitation, housing, roads. Service delivery protests (Section 17 of Constitution allows peaceful assembly) — a sign of engaged citizenry demanding accountability.
        """,
    },
    {
        "metadata": {
            "subject": "life_orientation",
            "grade": 12,
            "topic": "physical_wellness",
            "title": "Physical Wellness, Mental Health and Stress Management — Grade 12 Life Orientation",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Physical wellness is a state of complete physical, mental, and social well-being — not merely the absence of disease (WHO definition of health).

        Physical fitness components:
        - Cardiovascular endurance: ability to sustain aerobic exercise (running, swimming, cycling). Measured by VO2 max.
        - Muscular strength: maximum force a muscle can exert in a single effort.
        - Muscular endurance: ability of muscles to sustain repeated contractions.
        - Flexibility: range of motion around a joint.
        - Body composition: ratio of fat to lean body mass.

        FITT principle for exercise planning:
        F = Frequency (how often: 3–5 days/week for cardio).
        I = Intensity (how hard: 60–80% of maximum heart rate for aerobic benefit).
        T = Time (how long: 30–60 minutes per session).
        T = Type (what kind: choose activities aligned with goals).

        SAID principle: Specific Adaptation to Imposed Demands — the body adapts specifically to the type of training imposed. Train specifically for your goal.

        Non-communicable diseases (lifestyle diseases) in SA context:
        - Hypertension (high blood pressure): very prevalent in SA — leading to stroke and heart disease. Linked to diet (salt, saturated fat), obesity, stress, inactivity.
        - Type 2 Diabetes: linked to obesity, poor diet, inactivity. SA has high and growing prevalence.
        - Obesity: over 68% of SA women and 31% of SA men are overweight/obese.
        Prevention: 150 minutes moderate activity/week, balanced diet (reduce sugar/fat/salt, increase fruit/vegetables/whole grains), no smoking, limited alcohol.

        Mental health:
        Common mental health conditions in SA: depression, anxiety disorders, PTSD (linked to violence exposure), eating disorders.
        Stigma prevents many South Africans from seeking help — particularly men.
        Signs of depression: persistent sadness, loss of interest, fatigue, sleep disturbance, feelings of worthlessness, difficulty concentrating.

        Stress management strategies:
        - Problem-focused coping: addressing the cause of stress directly (study planning to reduce exam anxiety).
        - Emotion-focused coping: managing emotional response (exercise, relaxation techniques, journaling, talking to someone).
        - Mindfulness: being present in the moment — reduces rumination and anxiety.
        - Physical activity: releases endorphins (natural mood elevators).
        - Sleep hygiene: regular sleep schedule, dark/cool room, no screens before bed.
        - Social support: talking to trusted friends, family, or a counsellor.

        SA mental health support: SADAG (South African Depression and Anxiety Group): 0800 456 789 (24-hour). School counsellors. Community health clinics.
        """,
    },
]

# ---------------------------------------------------------------------------
# Mathematical Literacy
# ---------------------------------------------------------------------------
MATHS_LITERACY: list[dict] = [
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 10,
            "topic": "finance",
            "title": "Finance — Income, Budgets, Banking and Interest — Grade 10 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Mathematical Literacy applies mathematical skills to real-life contexts in South Africa.

        Income and deductions:
        Gross income: total earnings before deductions (salary, wages, commission, overtime).
        Net income (take-home pay): gross income minus deductions.
        Deductions include: income tax (PAYE — Pay As You Earn), UIF (Unemployment Insurance Fund — 1% employee + 1% employer), pension/provident fund contributions, medical aid contributions.

        Income tax in South Africa:
        Administered by SARS (South African Revenue Service).
        South Africa uses a progressive tax system — higher income = higher tax rate.
        Tax brackets (2024/25): 18% on income up to R237,100; increasing up to 45% on income above R1,817,000.
        Tax threshold: individuals under 65 earning below R95,750 per year pay no tax.
        Rebates reduce tax owed: primary rebate (R17,235), secondary (age 65+), tertiary (age 75+).

        VAT (Value-Added Tax):
        VAT rate in South Africa: 15%.
        VAT-inclusive price = original price × 1.15.
        VAT amount = VAT-inclusive price × (15/115) = VAT-inclusive price ÷ 7.667.
        Zero-rated items (no VAT): basic foods — bread, milk, eggs, dried beans, maize, fruits, vegetables, rice.
        Exempt items (no VAT): residential rents, public transport, educational services.

        Budgeting:
        A budget is a financial plan showing expected income and planned expenditure.
        Surplus: income > expenditure (savings possible).
        Deficit: expenditure > income (debt accumulates).
        Steps: calculate income → list fixed expenses (rent, loan repayments) → list variable expenses (food, clothing, transport) → identify savings opportunities.
        The 50/30/20 rule: 50% needs, 30% wants, 20% savings.

        Banking:
        Types of accounts: savings account (earns interest), cheque/current account (for transactions), fixed deposit (locked-in savings at higher interest rate).
        Simple interest: I = P × r × t (P = principal, r = annual rate, t = time in years).
        Example: R5,000 at 6% p.a. for 3 years → I = 5000 × 0.06 × 3 = R900. Total = R5,900.
        Compound interest: I = P(1 + r)^t (interest earned on interest).
        Example: R5,000 at 6% p.a. compound for 3 years → A = 5000 × (1.06)³ = 5000 × 1.191 = R5,955.
        Compound interest ALWAYS grows faster than simple interest over the same period.
        """,
    },
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 10,
            "topic": "measurement",
            "title": "Measurement — Perimeter, Area, Volume and Unit Conversion — Grade 10 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Measurement is applied in everyday situations: building, cooking, tiling, painting, and filling containers.

        Unit conversions (metric system):
        Length: 1 km = 1000 m; 1 m = 100 cm; 1 cm = 10 mm.
        Mass: 1 kg = 1000 g; 1 t (tonne) = 1000 kg.
        Volume: 1 litre = 1000 ml; 1 kl (kilolitre) = 1000 L = 1 m³.
        Area: 1 m² = 10,000 cm²; 1 hectare = 10,000 m²; 1 km² = 100 hectares.

        Perimeter (distance around a shape):
        Rectangle: P = 2(l + w)
        Square: P = 4s
        Circle (circumference): C = 2πr or C = πd (π ≈ 3.14 or 22/7)
        Triangle: P = a + b + c (sum of all sides)

        Area (surface covered by a shape):
        Rectangle: A = l × w
        Square: A = s²
        Triangle: A = ½ × base × height
        Circle: A = πr²
        Trapezium: A = ½(a + b) × h (a and b are parallel sides, h is perpendicular height)

        Real-life area applications:
        - Tiling a floor: area of floor ÷ area of one tile = number of tiles needed. Add 10% for wastage/cutting.
        - Painting a wall: area of wall ÷ coverage per litre = litres of paint needed.
        - Fencing: perimeter of area to be fenced.

        Volume (space inside a 3D shape):
        Rectangular prism (box): V = l × w × h
        Cylinder: V = πr² × h
        Triangular prism: V = ½ × base × height of triangle × length of prism
        Cone: V = ⅓πr²h
        Sphere: V = (4/3)πr³

        Real-life volume applications:
        - Filling a swimming pool: volume in m³ × 1000 = litres needed.
        - Concrete for a slab: V = length × width × thickness.
        - Medication dosage: volume in ml.

        Surface area (total area of all faces of a 3D shape):
        Rectangular prism: SA = 2(lw + lh + wh)
        Cylinder: SA = 2πr² + 2πrh (two circles + rectangle wrapped around)
        Sphere: SA = 4πr²

        Temperature conversion:
        °C to °F: F = (C × 9/5) + 32
        °F to °C: C = (F − 32) × 5/9
        Water freezes at 0°C = 32°F; boils at 100°C = 212°F.
        """,
    },
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 11,
            "topic": "finance_advanced",
            "title": "Finance — Tax, Banking, Insurance and Loans — Grade 11 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Tax calculations in practice:

        PAYE (Pay As You Earn) example:
        Monthly salary: R25,000 → Annual income: R300,000.
        Tax (2024/25 brackets): 18% on first R237,100 = R42,678; 26% on R300,000 − R237,100 = R62,900 → R16,354.
        Total tax before rebates: R42,678 + R16,354 = R59,032.
        Primary rebate: −R17,235.
        Annual tax owed: R41,797. Monthly PAYE: R41,797 ÷ 12 = R3,483.

        Tax return (ITR12): submitted to SARS annually (usually between July–November).
        eFiling: SARS online portal for submitting tax returns and tracking refunds.
        Refund: if too much PAYE was deducted during the year, SARS refunds the difference.

        Loans and hire purchase:
        Simple interest loan: total repayment = P(1 + r × n) where n = number of periods.
        Monthly instalment = total repayment ÷ number of months.

        Hire purchase (HP): buying goods on credit; ownership transfers only when fully paid.
        HP total cost = deposit + (monthly payment × number of months).
        HP interest is calculated on the ORIGINAL amount, not the reducing balance — more expensive than a bank loan.

        Reducing balance loan (home loan/bond):
        Interest calculated on the outstanding balance each month.
        As you pay, the balance reduces → interest portion decreases → more of each payment goes to capital.
        Amortisation table shows this breakdown month by month.

        Insurance:
        Purpose: transfer financial risk to an insurer in exchange for a premium.
        Types relevant to Grade 11:
        - Vehicle insurance: third-party only (covers damage to others) vs comprehensive (covers own vehicle too).
        - Home contents insurance: replaces stolen/damaged possessions.
        - Life insurance: pays out on death; provides for dependants.
        - Medical aid: covers medical expenses; mandatory if employed in many SA sectors.

        Excess: the amount you pay when claiming before insurance pays the rest.
        Premium: monthly payment to maintain the policy.
        Value of item insured: market value (what it's worth now) vs replacement value (cost to replace with new). Always insure at replacement value to avoid being underinsured.

        UIF (Unemployment Insurance Fund):
        Workers contribute 1% of earnings (matched by employer = 2% total).
        Benefit: if retrenched or unable to work, claim from UIF for a maximum of 238 days.
        Paid as a percentage of your income (higher earners receive a lower percentage).
        """,
    },
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 11,
            "topic": "data_probability",
            "title": "Data Handling and Probability — Grade 11 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Data handling is essential for interpreting graphs, tables, and statistics encountered in everyday life — newspapers, government reports, company financials.

        Collecting and organising data:
        Population: the entire group being studied. Sample: a subset of the population.
        Quantitative data: numerical (height, income, temperature).
        Qualitative data: descriptive/categorical (colour, gender, province).
        Discrete data: countable, whole numbers (number of children). Continuous data: measurable (mass, time).

        Measures of central tendency (averages):
        - Mean: sum of all values ÷ number of values. Affected by outliers.
        - Median: middle value when data is ordered. Not affected by outliers.
        - Mode: most frequently occurring value.

        Measures of spread:
        - Range: maximum value − minimum value.
        - Quartiles: Q1 (25th percentile), Q2 (median/50th percentile), Q3 (75th percentile).
        - IQR (Interquartile Range): Q3 − Q1 — the middle 50% of data. Resistant to outliers.
        - Outlier: a data point that is significantly different from others. Rule: value below Q1 − (1.5 × IQR) or above Q3 + (1.5 × IQR).

        Graphs and their appropriate uses:
        - Bar graph: comparing discrete categories (e.g., number of learners per subject).
        - Histogram: frequency distribution of continuous data (grouped into intervals/bins).
        - Pie chart: parts of a whole (e.g., budget breakdown). Percentages must total 100%.
        - Line graph: trends over time (e.g., monthly rainfall, HIV new infections per year).
        - Scatter plot: relationship between two variables; draw line of best fit (trend line).
        - Box-and-whisker plot: shows minimum, Q1, median, Q3, maximum.

        Probability:
        P(event) = number of favourable outcomes ÷ total number of possible outcomes.
        Range: 0 (impossible) to 1 (certain). Can be expressed as fraction, decimal, or percentage.

        Complementary events: P(A) + P(not A) = 1.
        Example: P(rolling a 3 on a die) = 1/6. P(NOT rolling a 3) = 5/6.

        Independent events: P(A and B) = P(A) × P(B).
        Example: P(heads AND rolling a 6) = ½ × 1/6 = 1/12.

        Relative frequency (experimental probability):
        Relative frequency = number of times event occurred ÷ total number of trials.
        As number of trials increases, relative frequency approaches theoretical probability.

        SA context examples: Stats SA uses data and probability for census planning, crime statistics, economic indicators, and unemployment rates.
        """,
    },
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 12,
            "topic": "finance_gr12",
            "title": "Finance — Investments, Inflation, Retirement and Taxation — Grade 12 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Inflation and its effect on money:
        Inflation reduces purchasing power — the same amount of money buys fewer goods over time.
        South Africa's inflation target: 3%–6% (SARB monetary policy).
        Real vs nominal value:
        - Nominal value: the face value in current rand terms.
        - Real value: adjusted for inflation — reflects actual purchasing power.
        Real return on investment = nominal return − inflation rate.
        Example: savings account pays 7% p.a.; inflation is 5% p.a. → real return = 2%.

        Compound growth with inflation:
        Future cost of an item: FV = PV × (1 + inflation rate)^n
        Example: a car costs R350,000 today. At 6% inflation, in 5 years:
        FV = 350,000 × (1.06)⁵ = 350,000 × 1.3382 = R468,370.

        Retirement planning:
        Retirement annuity (RA): regular contributions to a fund that grows over time; tax-deductible (up to 27.5% of income).
        Pension and provident funds: employer-sponsored retirement savings.
        Annuity payment from savings: how much can you withdraw per month from a lump sum?
        Present value of annuity: PV = PMT × [(1 − (1 + r)^−n) ÷ r]
        Future value of annuity: FV = PMT × [((1 + r)^n − 1) ÷ r]
        (PMT = regular payment, r = periodic interest rate, n = number of periods)

        Home loan (bond) calculations:
        Monthly repayment formula: PMT = P × [r(1 + r)^n] ÷ [(1 + r)^n − 1]
        Where P = loan amount, r = monthly interest rate (annual ÷ 12), n = total months.
        Example: R1,000,000 bond at 11.75% p.a. over 20 years:
        r = 11.75% ÷ 12 = 0.979% per month. n = 240.
        PMT = R10,926 per month. Total paid = 240 × R10,926 = R2,622,240 (>2.6× the loan!).

        National Credit Act (NCA) and consumer protection:
        Governs all credit agreements in SA.
        Credit provider must: assess affordability before granting credit; provide a pre-agreement quote; not charge more than prescribed interest rates.
        Maximum interest rate on personal loans: repo rate + 21% per year (calculated monthly).
        Debt review: if over-indebted, a debt counsellor can restructure all debts into one affordable payment.
        """,
    },
    {
        "metadata": {
            "subject": "mathematical_literacy",
            "grade": 12,
            "topic": "maps_plans",
            "title": "Maps, Plans, Scale and Navigation — Grade 12 Mathematical Literacy",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Maps and scale drawings represent real-world spaces in reduced form.

        Scale:
        A scale shows the relationship between a measurement on a map/plan and the actual measurement.
        Written as a ratio: 1:50,000 means 1 cm on the map = 50,000 cm (500 m) in reality.

        Types of scale:
        - Ratio scale: 1:100 (most common in plans and maps).
        - Bar scale: a drawn line showing actual distances.
        - Verbal scale: "1 cm represents 10 km."

        Calculations using scale:
        Actual distance = map distance × scale denominator.
        Map distance = actual distance ÷ scale denominator.
        Example: on a 1:25,000 map, two towns are 8 cm apart.
        Actual distance = 8 × 25,000 = 200,000 cm = 2,000 m = 2 km.

        Floor plans and building plans:
        - Floor plans: bird's-eye view (looking down) of a building.
        - Elevations: side views of a building.
        - Reading a floor plan: identify scale, measure distances, calculate actual dimensions.
        SA building plans are drawn to scale (typically 1:100 for houses) and submitted to the local municipality for approval.

        Directions and compass bearings:
        Cardinal directions: North (N), South (S), East (E), West (W).
        Intercardinal: NE, NW, SE, SW.
        Compass bearing: measured clockwise from North. N = 0°, E = 90°, S = 180°, W = 270°.
        Example: bearing of 135° = SE direction.

        GPS and coordinates:
        GPS (Global Positioning System) uses latitude and longitude.
        Latitude: parallel lines north/south of the equator (0°).
        Longitude: vertical lines east/west of the Prime Meridian (0°, Greenwich).
        South Africa coordinates: approximately 25°–35°S latitude, 16°–33°E longitude.
        Johannesburg: 26.2°S, 28.0°E. Cape Town: 33.9°S, 18.4°E. Durban: 29.9°S, 31.0°E.

        Time zones:
        South Africa Standard Time (SAST) = UTC+2 (2 hours ahead of Greenwich Mean Time).
        No daylight saving in SA — SAST remains constant year-round.
        Example: if it is 14:00 in London (UTC), it is 16:00 in Johannesburg.

        Distance, speed and time:
        Distance = Speed × Time.
        Speed = Distance ÷ Time.
        Time = Distance ÷ Speed.
        Convert km/h to m/s: divide by 3.6 (or multiply by 1000/3600).
        Example: Johannesburg to Durban (580 km) at average 100 km/h: Time = 580 ÷ 100 = 5.8 hours = 5 hours 48 minutes.
        """,
    },
]

# ---------------------------------------------------------------------------
# All subjects
# ---------------------------------------------------------------------------
SUBJECT_GROUPS = [
    ("LIFE ORIENTATION", LIFE_ORIENTATION),
    ("MATHEMATICAL LITERACY", MATHS_LITERACY),
]


def main() -> None:
    env_source = _load_env()
    print(f"Loaded env from: {env_source}")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://iplliihtphnhgxqmxxdo.supabase.co").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY is required.\nAdd it to apps/web/.env.local")
        sys.exit(1)

    supabase = create_client(url, key)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
    print(f"Model device: {model.device}\n")

    grand_total = 0
    for label, docs in SUBJECT_GROUPS:
        print(f"── {label} ({len(docs)} documents) ──")
        total = 0
        for doc in docs:
            total += ingest(supabase, model, doc["content"], doc["metadata"])
        print(f"  {label} total: {total} chunks\n")
        grand_total += total

    print(f"Done — {grand_total} total new chunks in Supabase ✅")
    print("\nVerify with SQL:")
    print("  select metadata->>'subject', count(*) from documents group by 1 order by 1;")


if __name__ == "__main__":
    main()
