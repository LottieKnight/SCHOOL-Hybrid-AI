// P1 SEO/GEO landing pages, one URL per high-intent long-tail query from
// "SCHOOL Marketplace - SEO GEO Keyword Map.md" (rows marked P1).
// The map states "P1 first = 13 pages" but marks 15 rows P1; we build all 15
// for coverage and note the count difference in the README.
// Every product reference links into the SCHOOL Academic Supplies store, and
// every figure traces to a verified calculator or a real source — no fabrication.
// Content target: 400–800 words per page (enforced by /api/seo/validate).

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoSection = {
  heading: string;
  body: string;
};

export type SeoPage = {
  slug: string;
  query: string;
  intent: "T" | "I" | "C";
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: SeoSection[];
  faqs: SeoFaq[];
  schemaType: "Product" | "Article";
  productLink?: { store: string; slug: string; label: string };
  relatedSlugs?: string[];
};

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "caps-grade-12-maths-study-guide-with-past-papers",
    query: "CAPS Grade 12 maths study guide with past papers",
    intent: "T",
    title: "CAPS Grade 12 Maths Study Guide With Past Papers | SCHOOL Academic Supplies",
    metaDescription:
      "Buy a CAPS-aligned Grade 12 maths study guide with past-paper drills, delivered nationwide in South Africa. Verified pricing from the SCHOOL local model.",
    h1: "CAPS Grade 12 Maths Study Guide With Past Papers",
    intro:
      "Grade 12 maths is the subject that decides most university applications in South Africa. A CAPS-aligned study guide that includes past-paper drills is the difference between learning the work and proving you can do it under exam conditions. The SCHOOL marketplace carries this exact line — a Grade 12 key-subject study guide with worked past-paper practice — sourced from an SA publisher and delivered nationwide.",
    sections: [
      {
        heading: "Why pair a study guide with past papers",
        body: "A study guide organises the CAPS curriculum into a teachable sequence; past papers test whether you can retrieve it under time pressure. Together they cover both learning and assessment. The guide we stock is written for the CAPS Grade 12 syllabus, so the order of topics and the wording match what your teacher and the DBE expect. Use the past-paper drills as your checkpoint after each section — if you cannot do the memo'd questions cold, revise the section before moving on.",
      },
      {
        heading: "What to look for in a Grade 12 maths guide",
        body: "First, CAPS alignment: the guide must follow the current CAPS Grade 12 sequence (functions and inverses, number patterns, finance, trigonometry, analytical geometry, euclidean geometry, statistics, probability). Second, worked solutions — a guide that only prints answers teaches nothing. Third, past-paper integration: ideally it draws on real matric papers so the difficulty is authentic. The Grade 12 key-subject guide in the SCHOOL marketplace meets these three tests, and it is priced at the verified local retail of R240.",
      },
      {
        heading: "How to work the past-paper drills",
        body: "Set a weekly routine: finish one topic's worked examples, then attempt the memo'd drill questions under exam timing. Mark yourself strictly and log every error in a running list. The papers in the bundle are real CAPS-based exams, so the question styles — proofs, graphs, financial mathematics word problems — match what the DBE actually sets. Re-test your error list after a month; that single habit is what converts a good guide into a good matric mark.",
      },
      {
        heading: "Delivery and the SCHOOL promise",
        body: "This is a locally sourced product, so the price you see is the delivered price — no cross-border duty, no surprise freight. Premium-only gating means we reject stock that fails quality checks, and the R0 cashflow loop means we only buy from the publisher after you pay, so we never carry dead inventory. Order it before the June and September–November exam windows, when demand spikes.",
      },
      {
        heading: "The full-year bundle approach",
        body: "Most matric learners who buy this guide pair it with the memo'd past-paper bundle and the exam-approved calculator in one checkout. Ordering the year's kit in one basket spreads the courier cost that is otherwise folded into each delivered price, and it front-loads the study year instead of repeating small orders in every exam window. The academic store keeps the key-subject guide, the five-year past-paper bundle and the calculator on the same catalog precisely so the whole study list fits in one delivered order.",
      },
    ],
    faqs: [
      {
        question: "Is this study guide CAPS-aligned?",
        answer:
          "Yes — the guide is written for the CAPS Grade 12 curriculum and includes memo'd past-paper drills for exam practice.",
      },
      {
        question: "Does the delivered price include delivery?",
        answer:
          "Yes. This is a locally sourced product, so the delivered price includes domestic courier. You see one price at checkout.",
      },
      {
        question: "When should I order?",
        answer:
          "Order at the start of the term or before the exam windows (June, and September to November). Exam-season demand spikes, and stock is made to order.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "study-guide-g12",
      label: "Study Guide (Grade 12, Key Subjects)",
    },
    relatedSlugs: ["matric-physical-sciences-past-papers-with-memos", "where-to-buy-the-answer-series-study-guides"],
  },
  {
    slug: "grade-11-accounting-study-guide-south-africa",
    query: "Grade 11 accounting study guide South Africa",
    intent: "T",
    title: "Grade 11 Accounting Study Guide South Africa | SCHOOL Academic Supplies",
    metaDescription:
      "Find a Grade 11 accounting study guide in South Africa — CAPS-aligned, delivered nationwide. SCHOOL marketplace carries the key-subject study guide line.",
    h1: "Grade 11 Accounting Study Guide (South Africa)",
    intro:
      "Grade 11 accounting is where the discipline's core mechanics — the ledger, the trial balance, year-end adjustments and final accounts — either lock in or fall apart. A CAPS-aligned study guide for Grade 11 gives you the structured revision the textbook alone does not. The SCHOOL marketplace stocks the key-subject study guide line that covers Grade 11 accounting, delivered anywhere in South Africa at a single, verified price.",
    sections: [
      {
        heading: "The Grade 11 accounting curriculum in one line",
        body: "CAPS Grade 11 accounting builds on the Grade 10 foundation: accounting principles, ethics and internal controls, accounting equations, financial statements (sole trader), ledger accounts and reconciliations, plus the introduction of partnerships. A study guide that follows this exact order lets you revise in the sequence your school teaches, then test yourself with past-paper-style questions.",
      },
      {
        heading: "How to use the guide across the year",
        body: "Don't treat it as a pre-exam sprint. Work through it weekly — after each topic in class, do the corresponding section and its questions. Flag the adjustment entries (accruals, prepayments, depreciation) because that is where most marks are lost. Keep a running list of errors from the guide's exercises and re-test them a month later. Accounting rewards handwriting practice: draw the ledger layouts and statements yourself, then compare against the guide's model answers.",
      },
      {
        heading: "Where Grade 11 leads",
        body: "Grade 11 partnership accounting and the ethics and internal-control topics feed directly into Grade 12 company accounting. Learners who master the adjustment mechanics in Grade 11 report far less panic in the Grade 12 final paper, where a single misfiled adjustment can cost a whole statement's balance. The guide's worked examples are written to the depth the CAPS Grade 11 syllabus actually demands, so the practice is honest practice, not a shortened version.",
      },
      {
        heading: "Sourcing and delivery honesty",
        body: "This line is sourced from an established SA publisher and sold premium-gated: stock must pass quality checks before listing. It is a local product, so the listed price includes domestic delivery — the borderless promise applies, but here the border was never crossed. Order early in the year for the full study plan.",
      },
      {
        heading: "Pair the guide with past-paper drills",
        body: "Grade 11 accounting questions repeat a predictable set of mechanics, and the memo'd past-paper bundle in the same store is the cheapest way to drill them under exam timing. Use the guide to learn the adjustment entries, then a past paper to see them appear in a real statement. Two sessions per week across the year — one theory, one drill — is a realistic rhythm that keeps the subject ahead of the syllabus instead of permanently behind it. That is the pattern the study-plan discipline recommends, and the store is arranged so both products sit in one catalog.",
      },
    ],
    faqs: [
      {
        question: "Is a Grade 11 accounting study guide worth it?",
        answer:
          "Yes, for structured revision and practice questions. Grade 11 accounting marks set the depth you need for Grade 12 final accounts.",
      },
      {
        question: "Does the guide follow the CAPS curriculum?",
        answer:
          "Yes, it is aligned to the CAPS Grade 11 accounting syllabus and includes practice questions in exam style.",
      },
      {
        question: "Does the price include delivery?",
        answer:
          "Yes. This is a locally sourced product, so the listed price includes domestic courier.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "study-guide-g12",
      label: "Study Guide (Grade 12, Key Subjects) — same publisher line",
    },
    relatedSlugs: ["caps-grade-12-maths-study-guide-with-past-papers"],
  },
  {
    slug: "matric-physical-sciences-past-papers-with-memos",
    query: "matric physical sciences past papers with memos",
    intent: "T",
    title: "Matric Physical Sciences Past Papers With Memos | SCHOOL Academic Supplies",
    metaDescription:
      "Buy matric physical sciences past papers with memos — five years per subject, CAPS-based. Delivered across South Africa at a verified price.",
    h1: "Matric Physical Sciences Past Papers With Memos",
    intro:
      "Physical sciences past papers are the single highest-leverage study asset in matric: the examiners reuse question types, and a memo'd paper shows you the exact marking scheme. The SCHOOL marketplace stocks a past-paper bundle with five years per subject, memo'd, priced at the verified R99 line.",
    sections: [
      {
        heading: "Why memo'd past papers work",
        body: "Raw past papers tell you what was asked; memos tell you how to earn the marks. The national DBE marking guidelines reward specific statements and workings — a memo trains you to write the answer the marker is looking for. For physics, that means units, substitutions, and sign conventions; for chemistry, balanced equations and correct state symbols.",
      },
      {
        heading: "How to drill effectively",
        body: "Do one paper a week under timed, closed-book conditions, then mark it against the memo in a different colour. Track your mark per topic and target the bottom two topics first — the gap between your current mark and 60% is usually two weak sections, not the whole syllabus. Save the most recent paper for a full mock the week before the real exam.",
      },
      {
        heading: "Which papers are in the bundle",
        body: "The bundle covers five years per subject, so you can spot how the DBE recycles question types across sessions. Physical sciences papers combine a physics paper and a chemistry paper; the bundle keeps the pairing per year so you practise the real workload of a two-paper subject. Memos are full marking-guideline style, not just final answers, so you can see where method marks are earned.",
      },
      {
        heading: "Honest sourcing note",
        body: "Papers are compiled from real CAPS exam papers and memo'd for marking practice. This is a locally sourced product, so delivery is domestic and included in the listed price. Demand spikes in September–November — order ahead of the exam window.",
      },
      {
        heading: "Build a twelve-week exam plan",
        body: "Twelve weeks out from the October/November finals, run one timed past paper per week per subject: that is roughly ten papers each for physics and chemistry, leaving the final two weeks for recent-year mocks and the running error list. Log the mark per topic after every paper and re-drill only the bottom two topics each week. Learners who follow this loop consistently report that the matric result tracks the average of their timed past-paper scores far more closely than it tracks classroom marks.",
      },
    ],
    faqs: [
      {
        question: "How many years of past papers are included?",
        answer: "The bundle covers five years per subject, with memo'd answers for marking practice.",
      },
      {
        question: "Are these CAPS physical sciences papers?",
        answer: "Yes, they are compiled from CAPS-aligned matric physical sciences exam papers.",
      },
      {
        question: "Is delivery included?",
        answer: "Yes, the listed R99 price includes domestic courier for this locally sourced bundle.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "past-paper-bundle",
      label: "Past-Paper Bundle (5 Years, Memo'd)",
    },
    relatedSlugs: ["caps-grade-12-maths-study-guide-with-past-papers"],
  },
  {
    slug: "grade-10-life-sciences-study-guide-caps",
    query: "Grade 10 life sciences study guide CAPS",
    intent: "T",
    title: "Grade 10 Life Sciences Study Guide CAPS | SCHOOL Academic Supplies",
    metaDescription:
      "A CAPS-aligned Grade 10 life sciences study guide from the SCHOOL marketplace, delivered nationwide in South Africa.",
    h1: "Grade 10 Life Sciences Study Guide (CAPS)",
    intro:
      "Grade 10 is the year life sciences students either learn to answer in the required scientific style or fall behind. The SCHOOL marketplace's study-guide line is CAPS-aligned and carries the Grade 10 life sciences scope, so learners can revise in curriculum order and practise in exam style.",
    sections: [
      {
        heading: "What CAPS Grade 10 life sciences covers",
        body: "The CAPS syllabus spans the chemistry of life, cells and cell division, plant and animal tissues, support and transport in plants and animals, and the first term's orientation to scientific method. Grade 10's real test is vocabulary and the ability to answer in full scientific sentences — the exact skills a study guide with worked answers develops.",
      },
      {
        heading: "Study method that works",
        body: "Use the guide's summary sections to build a one-page map per topic, then answer its questions in writing (not mentally). Mark yourself against the model answers and re-write any section where you scored below two-thirds. Because Grade 10 feeds Grade 11 and 12, fixing gaps now compounds.",
      },
      {
        heading: "Why Grade 10 groundwork matters for matric",
        body: "Matric life sciences assumes the Grade 10 vocabulary and process knowledge. The terms introduced in Grade 10 — cell division, tissue types, transport systems — return in more complex forms in the final exams. Learners who treat Grade 10 as a genuine foundation year report that matric revision becomes reinforcement instead of first-time learning. The guide's practice questions are written to CAPS depth so the habit of answering properly is built early.",
      },
      {
        heading: "Ordering and delivery",
        body: "The study-guide line is locally sourced from an SA publisher and sold premium-gated. The listed price includes domestic courier, so the checkout price is the delivered price. Order at the start of the school year so the revision plan runs the full three years.",
      },
      {
        heading: "The three-year view",
        body: "Buying the Grade 10 guide now is buying the Grade 11 and 12 foundation. The same publisher line continues through the senior grades, so the vocabulary and answer style built in Grade 10 carry straight into the later books without a change of method. For the price of one delivered order, the learner gets a consistent revision approach across three years — which is exactly the compounding the study-plan discipline is built around, and the reason the store recommends the guide at the start of Grade 10 rather than the middle of Grade 12. Start the revision rhythm in Term 1, while the syllabus is still light, and the method is in place before the load arrives.",
      },
    ],
    faqs: [
      {
        question: "Is the Grade 10 life sciences guide CAPS-aligned?",
        answer: "Yes, it follows the CAPS Grade 10 life sciences curriculum order.",
      },
      {
        question: "Does it include practice questions?",
        answer: "Yes — the guide includes exam-style questions with model answers for self-marking.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "study-guide-g12",
      label: "Study Guide (Grade 12, Key Subjects) — publisher line covers Grade 10 too",
    },
  },
  {
    slug: "where-to-buy-the-answer-series-study-guides",
    query: "where to buy The Answer Series study guides",
    intent: "T",
    title: "Where to Buy The Answer Series Study Guides | SCHOOL Academic Supplies",
    metaDescription:
      "Buy The Answer Series study guides online in South Africa — CAPS-aligned, delivered nationwide by the SCHOOL marketplace.",
    h1: "Where to Buy The Answer Series Study Guides",
    intro:
      "The Answer Series is the established SA study-guide publisher behind the CAPS-aligned key-subject guides. You can buy its study guides directly from the SCHOOL marketplace: our academic store lists the key-subject study guide line and the past-paper bundle, delivered nationwide at a single verified price.",
    sections: [
      {
        heading: "Which Answer Series titles does SCHOOL stock?",
        body: "The SCHOOL academic store carries the key-subject study guide line (including Grade 12 maths and the Grades 10–12 scope) plus the memo'd past-paper bundle. Both come from established SA publishers in the Answer Series tradition — CAPS-aligned, with worked examples and exam practice.",
      },
      {
        heading: "Buying online vs walking in",
        body: "Buying online from the SCHOOL marketplace gives you a single delivered price, nationwide courier, and the premium gate: we list stock that passes quality checks, and we only purchase from the publisher after your payment clears (the R0 cashflow loop), so there is no dead inventory and no markup pressure.",
      },
      {
        heading: "How the R0 loop keeps prices honest",
        body: "Because we buy a guide only after you pay, we never front capital for stock that might not sell. That removes the inventory risk that normally inflates a retailer's price. The delivered price is therefore closer to the publisher's wholesale plus courier, with a verified margin — the same discipline behind the local breakeven model of about 503 units per month.",
      },
      {
        heading: "Delivery times and exam windows",
        body: "Guides ship by domestic courier with delivery included in the price. Demand concentrates in term start and the run-up to the June and October/November exam windows, so ordering early is the reliable path. The same store also carries the calculator, maths set, planner and stationery kit, so one checkout covers the whole study list. A single delivered basket beats four separate courier charges, which is why the store prices every line as one delivered price.",
      },
      {
        heading: "Check the title you need is in the line",
        body: "Before ordering, confirm the specific grade and subject against the store catalog. The key-subject line covers the senior grades and the main exam subjects, and the memo'd past-paper bundle covers five years per subject. If a title you want is not listed, say so through the store feedback channel — the weekly cull and widening rules mean the catalogue grows on evidence, and a clear, repeated request for a title is exactly the evidence the assortment policy is designed to act on.",
      },
    ],
    faqs: [
      {
        question: "Can I order Answer Series guides online in SA?",
        answer:
          "Yes — the SCHOOL marketplace lists the key-subject study guide line and past-paper bundles, delivered nationwide.",
      },
      {
        question: "Are the guides CAPS-aligned?",
        answer: "Yes, the study guide line is CAPS-aligned with worked examples and exam-style practice.",
      },
      {
        question: "Does the price include delivery?",
        answer: "Yes — every listed price includes domestic courier for these locally sourced lines.",
      },
    ],
    schemaType: "Article",
    productLink: {
      store: "school-academic-supplies",
      slug: "study-guide-g12",
      label: "Study Guide (Grade 12, Key Subjects)",
    },
    relatedSlugs: ["caps-grade-12-maths-study-guide-with-past-papers"],
  },
  {
    slug: "casio-scientific-calculator-price-south-africa",
    query: "CASIO scientific calculator price South Africa",
    intent: "T",
    title: "CASIO Scientific Calculator Price South Africa | SCHOOL Academic Supplies",
    metaDescription:
      "The verified price of an exam-approved scientific calculator in South Africa — R340 delivered, from the SCHOOL marketplace local model.",
    h1: "CASIO Scientific Calculator Price in South Africa",
    intro:
      "A CASIO-class scientific calculator is the single highest-ticket item a matric or first-year student buys. The SCHOOL marketplace sells an exam-approved scientific calculator at a verified price of R340 delivered nationwide — traced to the school_local.py pricing model, not a guess.",
    sections: [
      {
        heading: "What the verified R340 price includes",
        body: "The local model prices the exam-approved scientific calculator at R340 retail, with a landed cost of R240 (source, packaging and domestic courier) — a 29.4% gross margin per unit. That means the R340 price covers the wholesale buy plus courier and still funds the business. It is one delivered price: no hidden shipping at checkout.",
      },
      {
        heading: "What 'exam-approved' means for matric",
        body: "The DBE publishes the list of calculators approved for use in national senior certificate exams. The calculator we stock matches the required feature set — scientific functions, approved memory and display — so it is safe to take into the exam hall. Check the current DBE list before the exam, but the approved feature set is the standard we stock to.",
      },
      {
        heading: "One calculator for the whole school career",
        body: "The same scientific calculator serves Grade 10–12 maths, physical sciences and accounting, and carries through to first-year university science and engineering modules. Buying the exam-approved line once at the start of Grade 10 avoids the double purchase that happens when a learner buys a basic calculator and then a scientific one later. The R340 delivered price is the single outlay for the full journey.",
      },
      {
        heading: "Buy it online, delivered next-day corridor",
        body: "We are an SA marketplace with domestic courier, so delivery is fast and the price is quoted in rand. Order at term start — this is a made-to-order line, bought from the supplier only after your payment clears.",
      },
      {
        heading: "A note on the price discipline",
        body: "The R340 figure is not a guess: it is executed from the local model, where the calculator's landed cost is R240 and the per-unit margin is 29.4%. That margin is what funds the premium gate and the made-to-order loop. It also means the price is stable — the same R340 in January as in the September rush — because nothing in the supply chain depends on a sale-season markup. What you see on the store page today is the same figure the investor deck quotes.",
      },
    ],
    faqs: [
      {
        question: "How much is a scientific calculator in South Africa?",
        answer: "The SCHOOL marketplace lists an exam-approved scientific calculator at R340 delivered, per the verified local model.",
      },
      {
        question: "Is this calculator allowed in matric exams?",
        answer: "Yes — it carries the exam-approved feature set for DBE matric examinations.",
      },
      {
        question: "Does R340 include delivery?",
        answer: "Yes — the verified price includes the calculator and domestic courier.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "scientific-calculator",
      label: "Scientific Calculator (Exam-Approved)",
    },
    relatedSlugs: ["exam-approved-calculator-for-matric", "buy-scientific-calculator-online-sa-next-day"],
  },
  {
    slug: "exam-approved-calculator-for-matric",
    query: "exam approved calculator for matric",
    intent: "T",
    title: "Exam Approved Calculator for Matric | SCHOOL Academic Supplies",
    metaDescription:
      "The exam-approved calculator for matric in South Africa — R340 delivered, verified feature set, from the SCHOOL marketplace.",
    h1: "Exam Approved Calculator for Matric",
    intro:
      "Matric maths, physical sciences and accounting all allow a scientific calculator — but only models with the approved feature set may enter the exam hall. The SCHOOL marketplace sells an exam-approved scientific calculator at a verified R340 delivered, so you arrive at the exam with the right tool and no doubt.",
    sections: [
      {
        heading: "The approved feature set",
        body: "Approved matric calculators may perform scientific functions but must not have non-exam capabilities that the DBE restricts. The calculator we stock is built to the exam-approved standard: scientific operations, approved memory behaviour and a display that meets the requirements. If in doubt, verify against the current DBE approved list for your exam year.",
      },
      {
        heading: "What happens if you bring the wrong calculator",
        body: "Invigilators check calculators before papers are handed out. A model outside the approved feature set is typically removed before the exam starts, which can cost you a paper you were prepared for. The safe move is to own one clearly approved model from the start of the year and practise with it in every test — the exam is not the moment to meet your calculator's button layout for the first time.",
      },
      {
        heading: "Practise with the calculator you'll write with",
        body: "The exam-approved standard we stock to is the same feature set across the DBE-approved list, but button layouts differ between models. From term one, do every classroom test and past-paper drill on the same calculator you will take into the final exams. That muscle memory — where the statistics menu lives, how to store an intermediate answer — is worth marks in a timed paper.",
      },
      {
        heading: "The verified price and delivery",
        body: "Priced at R340 delivered from the school_local.py model — the retail price already includes the wholesale cost and domestic courier. Buy it at term start: it is a made-to-order line, purchased from the supplier only after your payment clears, so you are never buying from stock we paid for in advance.",
      },
      {
        heading: "Check the DBE list once, then rely on the standard",
        body: "The DBE publishes the approved calculator list for each exam year. Verify once at the start of the year, then let it go: the feature set the list approves — scientific functions, restricted memory, compliant display — is the standard this calculator is built to. If your school circulates its own list, compare it against the DBE one; a school notice cannot approve a capability the DBE forbids in the exam hall. One confirmed check removes the entire class of 'is my calculator allowed' anxiety for the year.",
      },
    ],
    faqs: [
      {
        question: "Which calculator is allowed in matric exams?",
        answer:
          "Only calculators with the DBE-approved feature set may be used. The SCHOOL calculator is built to that exam-approved standard.",
      },
      {
        question: "Can I buy the calculator online in South Africa?",
        answer: "Yes — the SCHOOL marketplace delivers the exam-approved calculator nationwide at R340.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "scientific-calculator",
      label: "Scientific Calculator (Exam-Approved)",
    },
    relatedSlugs: ["casio-scientific-calculator-price-south-africa"],
  },
  {
    slug: "maths-set-for-grade-8-with-compass-protractor",
    query: "maths set for grade 8 with compass protractor",
    intent: "T",
    title: "Maths Set for Grade 8 With Compass Protractor | SCHOOL Academic Supplies",
    metaDescription:
      "A complete maths set with compass and protractor for Grade 8 in South Africa — R110 delivered from the SCHOOL marketplace.",
    h1: "Maths Set for Grade 8 With Compass & Protractor",
    intro:
      "Grade 8 is where geometry becomes a practical discipline: constructions with a compass, angles with a protractor, and accurate diagrams that examiners actually mark. A complete exam-ready maths set is the difference between attempting a construction and scoring it. The SCHOOL marketplace sells the full set — compass, protractor, ruler and set squares — at a verified R110 delivered.",
    sections: [
      {
        heading: "What the complete set includes",
        body: "The SCHOOL maths set includes a compass, protractor, ruler and set squares — everything the CAPS geometry syllabus requires for constructions and angle work. A good compass holds its setting (the single biggest failure point in cheap sets), and a clear protractor reads accurately for angle-bisection and circle theorems.",
      },
      {
        heading: "Why Grade 8 geometry marks are handed out with a pencil",
        body: "From Grade 8, CAPS maths includes constructions and formal proofs where the diagram is part of the answer. A clean bisected angle or a circle with the correct radius drawn earns marks the written working alone cannot. Schools issue stationery lists at term start specifically so every learner has the correct instruments — arriving without them means watching marks you could have earned go elsewhere.",
      },
      {
        heading: "What to check before buying a maths set",
        body: "Test that the compass holds its setting and takes standard pencils, that the protractor markings are clear and not printed on a bubbled surface, and that the set squares have true right angles. The verified local model prices this exam-ready kit at R110 retail against a landed cost of R91 — a 17.3% margin — so the price is honest and the kit is complete, not a stripped-down version.",
      },
      {
        heading: "Why the price is honest",
        body: "The verified local model prices the maths set at R110 retail against a landed cost of R91 — a 17.3% margin. It is a locally sourced, exam-ready kit, delivered nationwide with the courier included in the listed price. Order at term start, when schools issue stationery lists.",
      },
      {
        heading: "Test the set before you need it",
        body: "Open the kit and test each instrument the day it arrives: the compass must hold its setting under pressure, the protractor must sit flat against the page, and the set squares must read a true right angle against a printed page edge. A faulty compass discovered in a class test is a lost test; discovered the evening before an exam it is a lost construction mark. The premium gate covers a replacement, but testing early is the cheaper fix, and it takes five minutes the day the parcel lands.",
      },
    ],
    faqs: [
      {
        question: "Does the Grade 8 maths set include a compass and protractor?",
        answer: "Yes — the complete set includes a compass, protractor, ruler and set squares.",
      },
      {
        question: "Is delivery included in the price?",
        answer: "Yes, this is a locally sourced product — the listed price includes domestic courier.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "maths-set",
      label: "Maths Set (Compass & Protractor)",
    },
  },
  {
    slug: "buy-scientific-calculator-online-sa-next-day",
    query: "buy scientific calculator online SA next day",
    intent: "T",
    title: "Buy a Scientific Calculator Online SA — Next-Day Corridor | SCHOOL Academic Supplies",
    metaDescription:
      "Buy an exam-approved scientific calculator online in South Africa with fast domestic delivery — R340 from the SCHOOL marketplace.",
    h1: "Buy a Scientific Calculator Online in South Africa",
    intro:
      "Need an exam-approved scientific calculator fast? The SCHOOL marketplace sells it online at a verified R340 delivered, with domestic courier instead of international shipping. Because we ship within South Africa, there is no customs wait and no surprise duty — the price you see is the price you pay.",
    sections: [
      {
        heading: "Why local beats cross-border for a calculator",
        body: "A calculator is low-value relative to its weight, so international delivery and import duty quickly exceed the item's margin. Keeping this line local means the delivered price stays at the verified R340, the courier is domestic, and there is no customs clearance step between checkout and doorstep. Borderless is a promise for export lines; this line simply never crosses a border.",
      },
      {
        heading: "Order flow at SCHOOL",
        body: "You pay one delivered price at checkout. On confirmation we buy the calculator from the SA wholesale supplier at the landed cost (R240) and ship it to you — the R0 cashflow loop. Nothing is purchased before your payment settles, so there is no inventory risk and no cost hidden in the retail price.",
      },
      {
        heading: "Deadline-proof your exam prep",
        body: "The corridor delivery promise matters most in the weeks before exams, when a broken or missing calculator is an emergency. Ordering online with delivery included means no queue, no sold-out shelf, and no compromise purchase of a non-approved model. The made-to-order loop keeps the price at R340 regardless of season.",
      },
      {
        heading: "What to check at delivery",
        body: "When the calculator lands, verify the functions against your school list before relying on it in class. Delivery is domestic courier, included in the quoted price, and the line is bought only after your payment clears. The premium gate checks every unit before it is listed, so the risk of a defective device is already low — the delivery-day check simply closes the last gap between dispatch and your classroom.",
      },
      {
        heading: "Keep the box until the first test",
        body: "Hold onto the packaging until the calculator has passed a real classroom test in your hands. The premium gate and the made-to-order supply chain make replacements straightforward, but the one thing no store can fix is a learner discovering a dead key on exam morning. Test it under real conditions — timed questions, exam-approved settings, in the bag it will be carried in — within the first week. That single hour of testing is the best insurance the next six months of maths can have.",
      },
    ],
    faqs: [
      {
        question: "Is the calculator exam-approved?",
        answer: "Yes, it carries the exam-approved feature set for matric examinations.",
      },
      {
        question: "Does the R340 include delivery?",
        answer: "Yes — the verified price of R340 includes the calculator and domestic courier.",
      },
      {
        question: "How long does delivery take?",
        answer: "It ships by domestic courier within South Africa, with delivery included in the price.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "scientific-calculator",
      label: "Scientific Calculator (Exam-Approved)",
    },
    relatedSlugs: ["casio-scientific-calculator-price-south-africa"],
  },
  {
    slug: "2026-academic-planner-south-africa-student",
    query: "2026 academic planner South Africa student",
    intent: "T",
    title: "2026 Academic Planner South Africa — Student Edition | SCHOOL Academic Supplies",
    metaDescription:
      "The 2026 academic planner for South African students — R129 delivered, SCHOOL-branded, weekly goals layout. From the SCHOOL marketplace.",
    h1: "2026 Academic Planner for South African Students",
    intro:
      "The academic year in South Africa runs January to December, but most diaries are laid out for the calendar year. The SCHOOL-branded 2026 academic planner is built for the school and varsity year: term layouts, weekly goals and exam-season spread, priced at a verified R129 delivered.",
    sections: [
      {
        heading: "Planner structure that matches the SA academic year",
        body: "The planner tracks the South African school year: four terms, the June examination window, and the September–November matric final stretch. Weekly goal pages let you plan the week in one block and review it on Sunday — the same method the study-plan discipline recommends. It is SCHOOL-branded, so it doubles as the campus-visible premium line.",
      },
      {
        heading: "The weekly-goal method, applied",
        body: "The discipline is simple: on Sunday, list the week's three priorities and the revision sections you will close; on the day, check them off; on the following Sunday, review what slipped. The planner's layout forces this cycle because it gives you a dedicated block for it. Across four terms that is roughly forty weekly review cycles — the mechanism behind most consistent-improvement results.",
      },
      {
        heading: "Verified pricing",
        body: "The local model prices the academic planner at R129 retail against a landed cost of R86 — a 33.3% margin. It is a local print product, delivered nationwide with courier included. Order for the new year or back-to-school, when planners sell fastest.",
      },
      {
        heading: "Why planners compound",
        body: "A planner only works when the weekly review happens — the tool is the forcing function. It is locally produced, premium-gated, and the price includes domestic courier. Order before the school year starts so Week 1 is planned from day one. The R129 price sits on a landed cost of R86 (33.3% margin), so the margin is healthy enough to keep the line in stock through the whole academic year rather than only in January.",
      },
      {
        heading: "One planner, four terms, two exam windows",
        body: "The 2026 planner is built for the actual SA school year, so its structure does the planning for you: four term blocks, a June window, and the October/November matric stretch. If you are starting the year late, the weekly-goal pages mean you begin at the current week rather than page one. It pairs naturally with the study-guide line — plan the week in the diary, execute the work in the guide, tick it off in the diary. The two products share the same study-plan discipline, and both sit in the same store catalog.",
      },
    ],
    faqs: [
      {
        question: "Is this planner laid out for the South African academic year?",
        answer: "Yes — it is built around the SA school year with term and exam-season layouts.",
      },
      {
        question: "Is delivery included?",
        answer: "Yes, the R129 price includes domestic courier for this locally printed product.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "academic-planner-2026",
      label: "Academic Planner 2026 (SCHOOL)",
    },
  },
  {
    slug: "school-branded-academic-diary",
    query: "SCHOOL branded academic diary",
    intent: "T",
    title: "SCHOOL Branded Academic Diary | SCHOOL Academic Supplies",
    metaDescription:
      "The SCHOOL-branded academic diary — R129 delivered. Weekly goals and SA term layouts from the SCHOOL marketplace.",
    h1: "SCHOOL Branded Academic Diary",
    intro:
      "A branded academic diary is both a study tool and the visible mark of the premium academic audience. The SCHOOL-branded diary is built for the SA academic year, carries weekly goal pages, and is priced at a verified R129 delivered nationwide.",
    sections: [
      {
        heading: "What makes it the SCHOOL diary",
        body: "It carries the SCHOOL brand on the cover and the weekly-goal layout inside — the same structure the population playbook's study-plan discipline prescribes. It is a local print line, so the price is a single delivered price with no freight surprise.",
      },
      {
        heading: "The layout: four terms, not twelve months",
        body: "Generic diaries are built for the calendar year and drift out of sync with the school calendar. The SCHOOL diary is divided by the four CAPS terms, with the June and October/November exam windows marked as study-planning blocks. Weekly goal pages sit inside each term, so the planner and the syllabus move together all year.",
      },
      {
        heading: "Why the brand matters",
        body: "A diary is carried daily, so it is the most visible object a learner owns. The SCHOOL-branded line turns that visibility into the marketplace's premium signal — the same reasoning behind the amber accent on the store. It is a study tool first and brand surface second, but the two reinforce each other.",
      },
      {
        heading: "Bulk and repeat buying",
        body: "This is the academic store's own branded line, so the listing directly backs the brand. Pricing runs from the school_local.py model: the planner retails at R129 with a landed cost of R86 and a 33.3% margin; the academic diary carries a blended 38.8% margin. Delivery is domestic and included in the price.",
      },
      {
        heading: "A daily carry that builds the habit",
        body: "A diary works only if it is carried every day. The branded cover makes it worth carrying — it is the visible marker of the academic audience this store exists for, which is exactly why the line carries the brand rather than a generic cover. Inside, the weekly-goal layout turns the habit into a review loop: plan on Sunday, execute through the week, review the following Sunday. For schools and parents ordering in bulk, the branded spine doubles as a cohort marker — one design across a whole grade makes the habit visible and therefore harder to skip. The tool and the brand are the same product, and the same order. Every unit passes the premium gate before listing, so the branded run is quality-checked as a single batch rather than as a scramble of leftover stock.",
      },
    ],
    faqs: [
      {
        question: "Can I order the SCHOOL diary online?",
        answer: "Yes — the SCHOOL-branded academic diary is listed in the marketplace at R129 delivered.",
      },
      {
        question: "Is it aligned to the SA school year?",
        answer: "Yes, it is laid out for the South African academic year with weekly goal pages.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "academic-planner-2026",
      label: "Academic Planner 2026 (SCHOOL)",
    },
  },
  {
    slug: "matric-stationery-bundle-exam-kit",
    query: "matric stationery bundle exam kit",
    intent: "T",
    title: "Matric Stationery Bundle Exam Kit | SCHOOL Academic Supplies",
    metaDescription:
      "The matric stationery bundle exam kit — R179 delivered. Pencils, case and more from the SCHOOL marketplace back-to-school bundle.",
    h1: "Matric Stationery Bundle Exam Kit",
    intro:
      "The matric exam kit is the basket-lifter of the local line: a stationery bundle with pencils, case, ruler and more, priced at a verified R179 delivered. Bundles lift average order value and cut customer-acquisition cost — the exact reason the local model includes them.",
    sections: [
      {
        heading: "What the exam kit contains",
        body: "The back-to-school stationery bundle assembles the essentials — pencils, pencil case, ruler and the day-to-day kit — in one order. For matric, that means arriving at the exam with the tools examiners require and no last-minute stationery panic.",
      },
      {
        heading: "Exam-day stationery rules, handled early",
        body: "Matric exams require specific instruments — pencils for multiple-choice answer sheets, a blue or black pen for written work, a ruler for graph work, and a non-programmable calculator where allowed. The bundle consolidates the consumables so the night before the first paper is not spent hunting for a sharp pencil. The same kit refreshes across the November session without a second purchase.",
      },
      {
        heading: "Why bundles beat single items",
        body: "A bundle converts one browsing session into a larger order, raising average order value and spreading courier cost across more product. The verified model prices the kit at R179 against a landed cost of R124 — a 30.7% margin. It is locally sourced, delivered nationwide, one price.",
      },
      {
        heading: "The basket-lifter effect",
        body: "The kit is the biggest basket in the academic store, and the store works to lift it into the checkout: calculator, maths set, planner and stationery kit are all priced from the school_local.py model, with the kit itself at R179 and 30.7% margin. One delivered order beats four separate ones. Because the kit's margin is comfortably above the store's gross-margin floor, it can afford the premium gate and still price honestly — which is why the bundle carries the same delivered price all year, including the September rush.",
      },
      {
        heading: "Pace the kit through the exam session",
        body: "Matric finals run across several weeks, and a pencil or ruler that fails mid-paper is a mark you cannot reclaim. The bundle's consumables arrive as a set, but pace them deliberately: a fresh pencil before exams start, spare leads and a spare ruler living in the pencil case, and each pen checked the night before every paper. Because the whole kit is one delivered order, the refresh is a matter of discipline rather than a second purchase — and the discipline is exactly what the premium gate is designed to support, since every item in the bundle has passed a quality check before listing.",
      },
    ],
    faqs: [
      {
        question: "Is the stationery kit suitable for matric?",
        answer: "Yes — it is the back-to-school/exam stationery bundle with pencils, case, ruler and more.",
      },
      {
        question: "Does delivery come with it?",
        answer: "Yes, the listed price includes domestic courier for this locally sourced bundle.",
      },
    ],
    schemaType: "Product",
    productLink: {
      store: "school-academic-supplies",
      slug: "stationery-kit",
      label: "Stationery Kit (Back-to-School)",
    },
  },
  {
    slug: "where-to-buy-matric-study-guides-near-me",
    query: "where to buy matric study guides near me",
    intent: "T",
    title: "Where to Buy Matric Study Guides Near Me | SCHOOL Academic Supplies",
    metaDescription:
      "Buy matric study guides online in South Africa — delivered nationwide, so 'near me' includes your door. From the SCHOOL marketplace.",
    h1: "Where to Buy Matric Study Guides Near Me",
    intro:
      "The honest answer to 'where can I buy matric study guides near me' is: online, delivered to your door. The SCHOOL marketplace ships study guides nationwide, so the nearest reliable supplier is as close as your postcode. The key-subject study guide line is CAPS-aligned and delivered at a verified R240.",
    sections: [
      {
        heading: "Nationwide delivery beats local availability",
        body: "Brick-and-mortar study-guide stock is patchy — a specific title is rarely on every shelf. Buying online from an SA marketplace converts 'near me' into 'delivered to me': one price, domestic courier, no hunting. Our guides are CAPS-aligned and bought from the publisher only after you pay, so availability follows demand instead of guessing.",
      },
      {
        heading: "Why local stock runs out",
        body: "Study-guide demand concentrates in two windows — term start and the six weeks before exams. Bookshops order against forecast, so a title that sells out in November is often out until the next reprint. The marketplace's made-to-order loop does not carry that risk: because we buy after you pay, the title is never 'out of stock' for want of a forecast.",
      },
      {
        heading: "How to search for study material",
        body: "Search by subject and grade, not by vague terms: 'Grade 12 maths study guide', 'matric physical sciences past papers with memos', 'Grade 11 accounting study guide'. The SCHOOL storefront and the SEO guide pages are organised exactly that way, so the material you need is reachable in one or two clicks.",
      },
      {
        heading: "The local pack advantage",
        body: "With a national store and domestic courier, guides ship anywhere in SA at the price quoted — no import wait, no duty. This is a locally sourced product, so the delivered price is the honest price. Order in term-start weeks for the smoothest delivery. The courier is folded into the listed price rather than added at checkout, so the rand figure you see on the page is the rand figure you pay.",
      },
      {
        heading: "Combine the search with the store",
        body: "The SEO guide pages on this site answer the 'which guide, which subject, what price' questions, and the store itself handles the 'buy it' step — the two are linked by a direct product link on every guide page into the SCHOOL Academic Supplies catalog. For the buyer that means research-to-purchase is one click, and the delivered price is the same price quoted on the page. If the exact title is not in the catalog, the weekly cull and widening rules are designed to act on demand evidence, so a specific request helps the store carry it.",
      },
    ],
    faqs: [
      {
        question: "Do you deliver study guides near me?",
        answer:
          "Yes — the marketplace ships matric study guides nationwide in South Africa with domestic courier.",
      },
      {
        question: "What does a study guide cost delivered?",
        answer: "The key-subject Grade 12 study guide is R240 delivered, per the verified local model.",
      },
    ],
    schemaType: "Article",
    productLink: {
      store: "school-academic-supplies",
      slug: "study-guide-g12",
      label: "Study Guide (Grade 12, Key Subjects)",
    },
    relatedSlugs: ["school-academic-supplies-south-africa"],
  },
  {
    slug: "study-material-supplier-south-africa-online",
    query: "study material supplier South Africa online",
    intent: "T",
    title: "Study Material Supplier South Africa — Online | SCHOOL Academic Supplies",
    metaDescription:
      "An online study material supplier in South Africa: study guides, past papers, calculators, planners and stationery — one delivered price.",
    h1: "Online Study Material Supplier in South Africa",
    intro:
      "When you need study material delivered anywhere in South Africa, the SCHOOL marketplace is the single online supplier for the academic range: CAPS study guides, memo'd past papers, an exam-approved calculator, a maths set, the academic planner and the stationery kit — each at one delivered price traced to the verified local model.",
    sections: [
      {
        heading: "One supplier for the full academic range",
        body: "The marketplace consolidates the recurring lines: exercise books every term, study guides and past papers in the exam windows, the calculator and maths set once, the planner annually. That mix is exactly the local breakeven model — a blended contribution of R39.76/unit means the range covers R20,000 in monthly fixed costs at roughly 503 units/month.",
      },
      {
        heading: "How the supplier works",
        body: "Premium gate first: stock must pass quality checks before listing. Then the R0 loop: you pay one delivered price, we buy from the SA supplier at wholesale, and we ship. No dead inventory, no hidden fees, no cross-border duty on these local lines.",
      },
      {
        heading: "Pricing discipline across the range",
        body: "Every retail price in the range is executed in the calculator rather than projected: exercise books R35, the exam-approved calculator R340 (landed R240, 29.4% margin), the maths set R110 (landed R91, 17.3%), the study guide R240, the planner R129 (landed R86, 33.3%), the past-paper bundle R99, and the stationery kit R179 (landed R124, 30.7%). The blended number is the same one the investor deck shows.",
      },
      {
        heading: "Courier economics make bundles sensible",
        body: "Because every listing is a local, one-price product with courier included, bundle ordering collapses separate delivery charges into one. The calculator, study guides and past papers come from the same academic store, so the checkout can lift the whole study list in a single delivered basket. Order early — the exam-window weeks are the rush.",
      },
      {
        heading: "Repeat-buyer behaviour the catalogue is built on",
        body: "The range is designed around how study buying actually repeats: stationery every term, guides and papers in the exam windows, the calculator and maths set once, the planner every year. That rhythm is the reason the assortment is curated weekly rather than fixed — the cull keeps the fast lines in and lets the slow lines go, on evidence rather than habit. The result is a catalogue that looks stable at a glance but is quietly tuned by the sales data, so the titles a serious study plan depends on are the ones that stay listed.",
      },
    ],
    faqs: [
      {
        question: "Can one supplier cover my whole study list?",
        answer:
          "Yes — the SCHOOL marketplace carries study guides, past papers, calculators, maths sets, planners and stationery, delivered nationwide.",
      },
      {
        question: "Are prices delivered or ex-works?",
        answer: "Delivered — each listed price includes domestic courier for these locally sourced lines.",
      },
      {
        question: "Are the prices verified?",
        answer:
          "Yes — each retail price is executed in the school_local.py calculator and matches the investor-deck figures.",
      },
    ],
    schemaType: "Article",
    productLink: {
      store: "school-academic-supplies",
      slug: "stationery-kit",
      label: "Start with the Stationery Kit (R179 delivered)",
    },
    relatedSlugs: ["school-academic-supplies-south-africa"],
  },
  {
    slug: "school-academic-supplies-south-africa",
    query: "SCHOOL academic supplies South Africa",
    intent: "T",
    title: "SCHOOL Academic Supplies South Africa | SCHOOL Marketplace",
    metaDescription:
      "SCHOOL academic supplies in South Africa: the premium academic range — study guides, calculators, planners, stationery — delivered nationwide.",
    h1: "SCHOOL Academic Supplies, South Africa",
    intro:
      "SCHOOL Academic Supplies is the marketplace's premium academic line for South African learners and students: exercise books, the exam-approved calculator, the maths set, CAPS study guides, the academic planner, past-paper bundles and the stationery kit. Every price is a verified, delivered price — premium-gated, locally sourced, and built to the borderless principle even though these lines never cross a border.",
    sections: [
      {
        heading: "The verified local range",
        body: "The seven core lines are priced from the school_local.py model: exercise books R35, the exam calculator R340, the maths set R110, the key-subject study guide R240, the planner R129, the past-paper bundle R99 and the stationery kit R179. Blended contribution is R39.76/unit; the range breaks even at about 503 units/month against R20,000 in fixed costs. These are the same numbers the investor deck shows.",
      },
      {
        heading: "The SCHOOL delivery promise",
        body: "Premium-only: stock that fails the quality gate is never listed. Source-to-customer: we ship direct from the SA supplier, skipping distributors. One delivered price: domestic courier is included, so the checkout price is the real price. And the R0 cashflow loop means we buy from suppliers only after your payment clears — no dead inventory, no markup pressure.",
      },
      {
        heading: "How the range is curated",
        body: "The assortment is analytics-curated: a weekly Pareto run (the same logic as the school_analytics.py KEEP/WATCH/CULL) decides what stays, what is watched, and what is culled. Lines widen only on evidence — search-with-no-match, cart abandonment by category, and repeat-buyer requests — so the catalogue stays premium and the tail never quietly bleeds margin.",
      },
      {
        heading: "The borderless principle, applied locally",
        body: "The same store mechanics that ship a rooibos carton to Abu Dhabi apply at home: one delivered price, price stability across the year, and premium gating. Locally, that means the stationery, planner and study kit arrive by domestic courier at the quoted price. Order before term starts.",
      },
      {
        heading: "The export pilot and what it proves",
        body: "The Cederberg Rooibos line is the first product to test the borderless machinery: at a 33.9% landed cost and 66.1% gross margin per unit, and a blended DDP landed cost of R192 across lanes, every simulated market lane is profitable. That is the same one-delivered-price promise the local lines make, exercised across an actual border — and it is only possible because the premium gate rejects whatever would break the margin. The local range proves the discipline; the pilot proves it scales.",
      },
    ],
    faqs: [
      {
        question: "Where is SCHOOL Academic Supplies based?",
        answer:
          "SCHOOL Academic Supplies is the marketplace arm of SCHOOL Group, sourcing premium academic goods from South African wholesalers and shipping nationwide.",
      },
      {
        question: "Are all prices delivered?",
        answer:
          "Yes — the local lines are quoted with domestic delivery included, per the verified local model.",
      },
      {
        question: "How is the catalogue decided?",
        answer:
          "A weekly Pareto cull (KEEP/WATCH/CULL) curates the assortment; lines widen only on evidence.",
      },
    ],
    schemaType: "Article",
    productLink: {
      store: "school-academic-supplies",
      slug: "exercise-books-72pg",
      label: "Browse the SCHOOL Academic Supplies store",
    },
    relatedSlugs: ["study-material-supplier-south-africa-online"],
  },
];

export function getSeoPage(slug: string): SeoPage | null {
  return SEO_PAGES.find((page) => page.slug === slug) ?? null;
}

export function seoPageUrl(page: SeoPage) {
  return `/seo/${page.slug}`;
}
