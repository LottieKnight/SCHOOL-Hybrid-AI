// ─────────────────────────────────────────────
// WVES312 MODULE DATA
// Source: Rathbone, M. (2024). Understanding
// Business and Ethics in the South African
// Context (2nd Ed.). Van Schaik.
// All explanations, questions, and summaries
// are original study aids. Not a substitute
// for the prescribed textbook.
// ─────────────────────────────────────────────

export const MODULE = {
  code: 'WVES312',
  name: 'Business Ethics',
  institution: 'North-West University',
  lecturer: 'Dr Danelle Fourie',
  brand: 'V4NTAG3',
  sphere: 'Cryptic SPHERE',
  dossierTitle: 'Investigative Study Dossier',
  storyline:
    'A cinematic dossier of power, ethics, reputation, and technology. Each chapter is staged as a clue: first the moral question, then the lenses, then the systems that shape the verdict.',
  year: 2026,
  examDate: '2026-06-11T07:00:00',
  examVenue: 'Building A18 G02 & G05',
  examDuration: '2 hours',
  examMarks: 70,
  examStructure: 'Section A: 20 MCQs (20 marks) · Section B: Case studies (50 marks)',
  textbook: 'Rathbone, M. (2024). Understanding Business and Ethics in the South African Context (2nd Ed.). Van Schaik Publishers.',
}

export interface Chapter {
  id: string
  number: number
  title: string
  subtitle: string
  color: string
  gated: boolean
  sections: Section[]
}

export interface Section {
  heading: string
  body: string
  examTip?: string
}

export interface MCQ {
  id: string
  chapter: string
  question: string
  options: string[]
  correct: number
  explanation: string
  gated: boolean
}

export interface Flashcard {
  id: string
  chapter: string
  front: string
  back: string
  gated: boolean
}

export interface CaseStudy {
  id: string
  chapters: string[]
  title: string
  scenario: string
  questions: { q: string; marks: number }[]
  modelAnswer: string
  gated: boolean
}

export interface Thinker {
  name: string
  concept: string
  era: string
  summary: string
  businessApplication: string
  filmLink?: string
}

export interface ChapterArc {
  id: string
  act: string
  title: string
  summary: string
  motif: string
}

export const CHAPTER_ARC: ChapterArc[] = [
  {
    id: 'ch3',
    act: 'I',
    title: 'The First Clue',
    summary: 'The story opens with responsibility, accountability, and the basic moral test of business itself.',
    motif: 'paper trail',
  },
  {
    id: 'ch7',
    act: 'II',
    title: 'The Mirror Room',
    summary: 'Ethical theories refract the same problem through different lenses, revealing what each framework notices and misses.',
    motif: 'split lens',
  },
  {
    id: 'ch8',
    act: 'III',
    title: 'The Ubuntu Counter-Archive',
    summary: 'Ubuntu and African moral theory pull the story back toward community, dignity, and restorative justice.',
    motif: 'community signal',
  },
  {
    id: 'ch9',
    act: 'IV',
    title: 'The Network Moves',
    summary: 'Stakeholders, CSR, and corporate citizenship reveal how the business is embedded in a wider social field.',
    motif: 'network map',
  },
  {
    id: 'ch10',
    act: 'V',
    title: 'The Control Room',
    summary: 'Ethics culture, climate, and leadership expose the hidden machinery that determines how organisations behave.',
    motif: 'surveillance feed',
  },
  {
    id: 'ch12',
    act: 'VI',
    title: 'The Boardroom Seal',
    summary: 'Governance, boards, and King IV show how power becomes answerable when the system is working.',
    motif: 'sealed ledger',
  },
  {
    id: 'ch13',
    act: 'VII',
    title: 'The Public Mask',
    summary: 'Communication, reporting, and reputation become the public face of the organisation and its ethical weather.',
    motif: 'front page',
  },
  {
    id: 'ch18',
    act: 'VIII',
    title: 'The Final Cipher',
    summary: 'Philosophy of technology and the six thinkers decode the final layer: how digital systems shape human life.',
    motif: 'cipher terminal',
  },
]

// ─── CHAPTERS ───────────────────────────────

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch3',
    number: 3,
    title: 'Business Ethics',
    subtitle: 'Responsibility & Accountability',
    color: '#4a7fc1',
    gated: false,
    sections: [
      {
        heading: 'What is Business Ethics?',
        body: 'Business ethics refers to the application of ethical principles to business activities. It asks: what is the right way to conduct business? It goes beyond legal compliance — a business can act legally but unethically. Ethics involves values, integrity, and doing what is right even when no one is watching.',
        examTip: 'Always distinguish between legal compliance and ethical behaviour in case studies — examiners reward this distinction.',
      },
      {
        heading: "Carroll's Pyramid of CSR",
        body: "Carroll's four-part model describes corporate responsibilities in order of priority:\n1. Economic responsibilities — be profitable (foundation)\n2. Legal responsibilities — obey the law\n3. Ethical responsibilities — do what is right and fair, beyond the law\n4. Philanthropic responsibilities — contribute to the community\n\nAll four levels must be present for a business to be fully responsible.",
      },
      {
        heading: 'Accountability vs Responsibility',
        body: "Responsibility = the obligation to act ethically and make sound decisions.\nAccountability = answering for the outcomes of those decisions.\n\nA director is responsible for running the company ethically. They are accountable to shareholders, employees, and society for the results.",
        examTip: "Don't confuse these two — examiners distinguish them in Section B questions.",
      },
      {
        heading: 'Stakeholder vs Shareholder',
        body: 'Shareholders are the owners of the company (equity holders). Stakeholders are all parties affected by the business — employees, customers, suppliers, community, government, environment.\n\nThe shareholder view (Friedman): the sole responsibility of business is to maximise profits for shareholders.\nThe stakeholder view: business has responsibilities to all affected parties, not just owners.',
      },
    ],
  },
  {
    id: 'ch7',
    number: 7,
    title: 'Ethical Theories',
    subtitle: 'Frameworks for Moral Decision-Making',
    color: '#8b7fc1',
    gated: true,
    sections: [
      {
        heading: 'Utilitarianism',
        body: "Associated with Bentham and Mill. The right action is the one that produces the greatest good for the greatest number. Outcomes matter — judge actions by their consequences.\n\nStrength: practical, measurable.\nWeakness: can justify harming a minority for majority benefit.",
        examTip: 'In case studies, apply utilitarianism by calculating who benefits and who is harmed.',
      },
      {
        heading: 'Deontological Ethics',
        body: "Associated with Kant. The right action is one that follows a moral duty or rule — regardless of consequences. The means matter, not just the ends.\n\nCategorical Imperative: act only according to rules you would want to be universal laws.\n\nStrength: protects rights, consistent.\nWeakness: rigid — can lead to harmful outcomes.",
      },
      {
        heading: 'Virtue Ethics',
        body: "Associated with Aristotle. Focus on character rather than rules or outcomes. A virtuous person will naturally make ethical decisions. Key virtues: honesty, courage, integrity, fairness, compassion.\n\nIn business: hire people of good character; create a culture of virtue.",
        examTip: 'Virtue ethics is often tested in ethics culture questions (connects to Ch 10).',
      },
      {
        heading: 'Justice Theory',
        body: "Associated with Rawls. Justice requires fair distribution of benefits and burdens. The 'veil of ignorance' — design society as if you don't know your position in it.\n\nIn business: fair wages, equal opportunity, non-discriminatory practices.",
      },
    ],
  },
  {
    id: 'ch8',
    number: 8,
    title: 'African Moral Theory',
    subtitle: 'Ubuntu Philosophy & Ethics',
    color: '#c9a84c',
    gated: true,
    sections: [
      {
        heading: 'Ubuntu Philosophy',
        body: '"Umuntu ngumuntu ngabantu" — a person is a person through other persons. Ubuntu emphasises communal identity, interdependence, and collective wellbeing over individualism.\n\nCore values: humanness, compassion, sharing, community, respect for dignity.',
        examTip: 'Ubuntu is frequently tested — know the definition and how it differs from Western ethical theories.',
      },
      {
        heading: 'African Moral Theory (AMT)',
        body: 'AMT provides a uniquely African framework for ethics grounded in community, relationships, and human dignity. Key principles:\n- Communalism over individualism\n- Respect for elders and tradition\n- Restorative justice (healing relationships, not punishment)\n- Harmony and balance in community',
      },
      {
        heading: 'Ubuntu in Business',
        body: 'Applying Ubuntu to business means:\n- Treating employees as whole human beings, not resources\n- Prioritising community impact alongside profit\n- Collaborative leadership styles\n- Restorative approaches to workplace conflict\n- B-BBEE and transformation as expressions of communal responsibility',
        examTip: 'Link Ubuntu to stakeholder theory in case studies — both reject pure profit maximisation.',
      },
    ],
  },
  {
    id: 'ch9',
    number: 9,
    title: 'Business Theories',
    subtitle: 'Stakeholder Theory, CSR & Corporate Citizenship',
    color: '#3a9e8c',
    gated: true,
    sections: [
      {
        heading: "Freeman's Stakeholder Theory",
        body: "Freeman (1984) argued that businesses must manage relationships with all stakeholders — not just shareholders. Stakeholders are any group that can affect or be affected by the organisation's activities.\n\nStakeholder management: identify, prioritise, and engage stakeholders proactively.",
      },
      {
        heading: 'Corporate Social Responsibility (CSR)',
        body: "CSR is the voluntary commitment of businesses to contribute to sustainable development while improving quality of life for employees, communities, and society.\n\nCarroll's Pyramid underpins CSR (economic → legal → ethical → philanthropic).\n\nCSR vs Strategic CSR: strategic CSR aligns social initiatives with core business strategy for mutual benefit.",
        examTip: "Don't confuse CSR (voluntary, strategic) with legal compliance (mandatory).",
      },
      {
        heading: 'Corporate Citizenship',
        body: "Corporate citizenship treats the company as a 'citizen' with rights and responsibilities in society. Goes beyond CSR — the business is embedded in society and accountable to it.\n\nThree views: limited (philanthropy), equivalent (rights/responsibilities), extended (full social role).",
      },
    ],
  },
  {
    id: 'ch10',
    number: 10,
    title: 'Ethics Culture & Climate',
    subtitle: 'Managing Ethics in Organisations',
    color: '#e07055',
    gated: true,
    sections: [
      {
        heading: 'Ethics Culture',
        body: "Ethics culture refers to the shared values, norms, and beliefs that shape ethical behaviour in an organisation. It's the 'way we do things here' — informal and deeply embedded.\n\nStrong ethics culture: leaders model ethical behaviour, integrity is rewarded, misconduct is challenged.",
      },
      {
        heading: 'Ethics Climate',
        body: "Ethics climate is the shared perception of what practices and behaviours are expected and supported in an organisation. Victor & Cullen identified five climate types:\n1. Caring — concern for others\n2. Law & Code — rules and regulations\n3. Rules — company policies\n4. Instrumental — self-interest\n5. Independence — personal ethics",
        examTip: 'Know all 5 climate types — MCQs frequently test this.',
      },
      {
        heading: 'Ethics Management',
        body: "Tools for managing ethics:\n- Code of Ethics / Code of Conduct\n- Ethics training and awareness programmes\n- Ethics hotlines and whistleblower protection\n- Ethics audits\n- Ethics committees / compliance officers\n\nThe ethics officer is responsible for implementing and monitoring the ethics programme.",
      },
      {
        heading: 'Ethical Leadership',
        body: 'Ethical leaders model virtuous behaviour, communicate ethical expectations, and create conditions for an ethical culture. They demonstrate that ethics and performance are not in conflict.\n\nTone at the top: leadership sets the ethical tone for the entire organisation.',
        examTip: 'Ethical leadership connects to virtue ethics (Ch 7) and King IV (Ch 12) — link these in case studies.',
      },
    ],
  },
  {
    id: 'ch12',
    number: 12,
    title: 'Organisational Governance',
    subtitle: 'King IV, Boards & Corporate Accountability',
    color: '#e8c15a',
    gated: true,
    sections: [
      {
        heading: 'Corporate Governance',
        body: "Corporate governance is the system by which companies are directed and controlled. It balances the interests of shareholders, management, customers, suppliers, government, and the community.\n\nGoal: ensure accountability, fairness, transparency, and responsible corporate conduct.",
      },
      {
        heading: 'King IV Report',
        body: "South Africa's leading corporate governance framework. Applies to all organisations.\n\n4 pillars: Leadership · Sustainability · Corporate Citizenship · Performance\n\nPrinciple: 'Apply and explain' — don't just comply, explain how you applied each principle.\n\nEmphasises integrated thinking — financial AND non-financial value creation.",
        examTip: 'Know the 4 pillars cold. Examiners love asking you to apply King IV to a governance failure scenario.',
      },
      {
        heading: 'The Board of Directors',
        body: "Fiduciary duty: board must act in the company's best interest, not personal interest.\n\nExecutive directors: also managers in the company.\nNon-executive directors: independent, provide oversight.\n\nBoard responsibilities: set strategy, oversee risk, ensure ethical conduct, appoint CEO.",
      },
      {
        heading: 'Governance Failures',
        body: "Common failures:\n- Conflict of interest (directors benefiting personally)\n- Lack of transparency\n- Short-termism (quick profits over long-term value)\n- Weak accountability\n\nSA examples: Steinhoff, Eskom — massive governance failures with severe ethical and financial consequences.",
        examTip: 'SA examples score well in case studies — use them to demonstrate contextual understanding.',
      },
    ],
  },
  {
    id: 'ch13',
    number: 13,
    title: 'Strategic Communication',
    subtitle: 'Ethical Communication & Reputation Management',
    color: '#00889c',
    gated: true,
    sections: [
      {
        heading: 'Strategic Communication',
        body: "Purposeful communication designed to advance an organisation's mission while maintaining ethical relationships with stakeholders.\n\nIncludes: PR, CSR reporting, stakeholder engagement, crisis communication, branding.\n\nEthical communication requires honesty, transparency, and accountability — not spin.",
      },
      {
        heading: 'CSR Communication & Integrated Reporting',
        body: "Integrated reporting: combining financial and non-financial reporting (aligned with King IV).\n\nTriple Bottom Line: People · Planet · Profit — measuring success beyond money.\n\nGreenwashing: communicating false or exaggerated sustainability claims. Unethical and increasingly illegal.",
        examTip: "Greenwashing scenarios are exam-friendly — identify it, name it, then apply deontological ethics (lying is wrong regardless of outcome).",
      },
      {
        heading: 'Crisis Communication',
        body: "Principles of ethical crisis communication:\n1. Transparency — cover-ups always make it worse\n2. Speed — delayed responses fuel distrust\n3. Accountability — take responsibility, don't deflect\n4. Action — communication must be followed by genuine change",
      },
      {
        heading: 'Reputation Management',
        body: "Reputation = collective stakeholder perception of an organisation. Built over years, lost in moments.\n\nEthical reputation creates competitive advantage, attracts talent, builds investor confidence.\n\nSocial media has amplified reputational risk — public accountability is now instantaneous.",
      },
    ],
  },
  {
    id: 'ch18',
    number: 18,
    title: 'Philosophy of Technology',
    subtitle: 'Technology, Business & Human Existence',
    color: '#e07055',
    gated: true,
    sections: [
      {
        heading: 'Why Philosophy of Technology?',
        body: "Technology isn't neutral — it shapes how we think, work, relate, and exist. Business must ask: Is our technology ethical? What does it do to people?\n\nSix thinkers each offer a distinct lens on technology's impact on human life and society.",
      },
      {
        heading: 'Technology & Business Ethics',
        body: "Key ethical concerns:\n- AI and automation: job displacement, algorithmic bias, data privacy\n- Social media: platforms exploit psychological vulnerabilities\n- Digital surveillance: employees as monitored resources\n- Advertising: selling images, not realities\n- Gig economy: self-exploitation and burnout",
        examTip: 'Always name the thinker, state their concept, then apply it to the case. That 3-step structure gets full marks.',
      },
    ],
  },
]

// ─── THINKERS (CH 18) ───────────────────────

export const THINKERS: Thinker[] = [
  {
    name: 'Martin Heidegger',
    concept: 'Enframing (Gestell)',
    era: '1889–1976',
    summary: "Technology reduces everything — including humans — to 'standing reserve' (resources to be used). We stop seeing the world as meaningful and see it only as raw material to exploit.",
    businessApplication: 'Employee surveillance, treating workers as inputs not people, automation that strips meaning from work.',
    filmLink: 'Interstellar, 2001: A Space Odyssey',
  },
  {
    name: 'Edmund Husserl',
    concept: 'Crisis of Science & the Lifeworld',
    era: '1859–1938',
    summary: "Modern science and technology caused a 'crisis' by separating facts from human meaning. We've lost the 'lifeworld' — lived human experience ignored in favour of data and efficiency.",
    businessApplication: 'Data-driven decisions that ignore human context, KPIs that miss what actually matters to employees and customers.',
    filmLink: 'Interstellar',
  },
  {
    name: 'Jean Baudrillard',
    concept: 'Simulacra & Hyperreality',
    era: '1929–2007',
    summary: 'Technology creates simulations that replace reality. The image becomes more real than the actual product — we live in a hyperreality of signs and representations.',
    businessApplication: 'Misleading advertising, brand image vs actual product quality, social media personas vs reality.',
    filmLink: 'The Matrix, Blade Runner',
  },
  {
    name: 'Erich Fromm',
    concept: 'Having vs Being',
    era: '1900–1980',
    summary: "Technology promotes a 'having' mode of existence (accumulating things, status) over 'being' (authentic human development). Consumerism driven by tech alienates us from ourselves.",
    businessApplication: "Products that exploit insecurity and status anxiety, consumerism that prioritises possession over personal growth.",
    filmLink: 'Her, Black Mirror',
  },
  {
    name: 'Herbert Marcuse',
    concept: 'One-Dimensional Man',
    era: '1898–1979',
    summary: "Advanced technological society creates 'one-dimensional' people who can't think critically — technology and consumerism suppress dissent and create false needs that keep people compliant.",
    businessApplication: 'Addictive apps designed to create dependency, media that creates passive consumers, manufactured desire.',
    filmLink: 'Black Mirror, The Matrix',
  },
  {
    name: 'Byung-Chul Han',
    concept: 'Burnout Society & Achievement Society',
    era: '1959–present',
    summary: "Digital technology and the 'achievement society' drives people to self-exploit. We're free but exhausted — we oppress ourselves chasing productivity, likes, and constant self-optimisation.",
    businessApplication: 'Always-on work culture, hustle culture glorification, gig economy self-exploitation, social media performance anxiety.',
    filmLink: 'Severance, Black Mirror',
  },
]

// ─── MCQs ────────────────────────────────────

export const MCQS: MCQ[] = [
  // CH 3 — PUBLIC (preview)
  {
    id: 'q1',
    chapter: 'Ch 3',
    question: "According to Carroll's Pyramid, which responsibility forms the foundation of all others?",
    options: ['Philanthropic', 'Ethical', 'Legal', 'Economic'],
    correct: 3,
    explanation: "Economic responsibility is the foundation of Carroll's Pyramid — without profitability, a business cannot fulfil its other responsibilities.",
    gated: false,
  },
  {
    id: 'q2',
    chapter: 'Ch 3',
    question: 'What is the key distinction between accountability and responsibility?',
    options: [
      'They mean the same thing in a business context',
      'Responsibility is the obligation to act; accountability is answering for outcomes',
      'Accountability applies only to directors; responsibility applies to all employees',
      'Responsibility is legal; accountability is ethical',
    ],
    correct: 1,
    explanation: 'Responsibility is the obligation to act ethically; accountability is answering for the results of those actions. They are related but distinct concepts.',
    gated: false,
  },
  {
    id: 'q3',
    chapter: 'Ch 3',
    question: "Milton Friedman's shareholder view holds that:",
    options: [
      'Businesses must serve all stakeholders equally',
      'The sole responsibility of business is to maximise profits for shareholders',
      'Philanthropic activity is the primary duty of business',
      'Legal compliance is sufficient for ethical business conduct',
    ],
    correct: 1,
    explanation: "Friedman argued the social responsibility of business is to increase its profits — within legal rules. This is the shareholder view, contrasted with Freeman's stakeholder view.",
    gated: false,
  },
  // CH 7 — GATED
  {
    id: 'q4',
    chapter: 'Ch 7',
    question: 'Utilitarianism judges the morality of an action based on:',
    options: [
      'The intentions behind the action',
      'The character of the person acting',
      'The consequences — greatest good for greatest number',
      'Compliance with universal moral duties',
    ],
    correct: 2,
    explanation: "Utilitarianism (Bentham, Mill) is a consequentialist theory — the right action produces the best overall outcomes. It doesn't care about intentions or rules, only results.",
    gated: true,
  },
  {
    id: 'q5',
    chapter: 'Ch 7',
    question: "Kant's Categorical Imperative states that you should:",
    options: [
      'Act to maximise happiness for the majority',
      'Act only according to rules you would want to be universal laws',
      'Act in accordance with your community values',
      'Act in ways that develop your virtuous character',
    ],
    correct: 1,
    explanation: "Kant's deontological ethics requires that we act only on maxims we could universalise. If lying were universal, trust would collapse — so lying is always wrong, regardless of outcome.",
    gated: true,
  },
  {
    id: 'q6',
    chapter: 'Ch 8',
    question: 'The Ubuntu philosophy is best expressed by which statement?',
    options: [
      'The greatest good for the greatest number',
      'Act only according to universal moral duties',
      'A person is a person through other persons',
      'Business exists to maximise shareholder value',
    ],
    correct: 2,
    explanation: "'Umuntu ngumuntu ngabantu' — Ubuntu emphasises communal identity and interdependence. A person's humanity is realised through relationships with others.",
    gated: true,
  },
  {
    id: 'q7',
    chapter: 'Ch 9',
    question: 'The Triple Bottom Line measures business success in terms of:',
    options: [
      'Profit, productivity, and market share',
      'People, planet, and profit',
      'Economic, legal, and ethical performance',
      'Shareholders, directors, and employees',
    ],
    correct: 1,
    explanation: 'The Triple Bottom Line (Elkington) expands business success beyond financial profit to include social impact (people) and environmental impact (planet).',
    gated: true,
  },
  {
    id: 'q8',
    chapter: 'Ch 10',
    question: "Which ethics climate type is characterised by decisions based on concern for others' wellbeing?",
    options: ['Instrumental', 'Independence', 'Law & Code', 'Caring'],
    correct: 3,
    explanation: "The Caring climate type (Victor & Cullen) is characterised by concern for others' wellbeing — the most ethically healthy climate, associated with stakeholder orientation.",
    gated: true,
  },
  {
    id: 'q9',
    chapter: 'Ch 12',
    question: "King IV's 'apply and explain' principle means:",
    options: [
      'Apply the law and explain any deviations',
      'Apply each governance principle and explain how you applied it',
      'Apply for exemptions and explain your reasons',
      'Apply shareholder decisions and explain to the board',
    ],
    correct: 1,
    explanation: "King IV moved from 'apply or explain' (King III) to 'apply and explain' — every principle must be applied, and the organisation must explain how. Compliance without explanation is insufficient.",
    gated: true,
  },
  {
    id: 'q10',
    chapter: 'Ch 12',
    question: 'A director who makes decisions that personally benefit them at the expense of the company is guilty of:',
    options: ['Greenwashing', 'Conflict of interest', 'Whistleblowing', 'Ethics auditing'],
    correct: 1,
    explanation: "A conflict of interest occurs when a director's personal interests conflict with their fiduciary duty to act in the company's best interest. This is a core governance failure.",
    gated: true,
  },
  {
    id: 'q11',
    chapter: 'Ch 13',
    question: 'Greenwashing refers to:',
    options: [
      'A company investing in environmental initiatives',
      'Communicating false or exaggerated sustainability claims',
      'Reporting environmental performance in the annual report',
      'Using green packaging for products',
    ],
    correct: 1,
    explanation: 'Greenwashing is the practice of making misleading environmental claims. It is unethical (deceptive communication) and increasingly subject to legal sanction.',
    gated: true,
  },
  {
    id: 'q12',
    chapter: 'Ch 18',
    question: "According to Byung-Chul Han's concept of the Burnout Society, modern workers:",
    options: [
      'Are oppressed by authoritarian managers',
      'Self-exploit by internalising achievement society demands',
      'Are liberated by digital technology',
      'Suffer because technology is dehumanising them as standing reserve',
    ],
    correct: 1,
    explanation: "Han argues we've moved from an external 'disciplinary society' to an internal 'achievement society' — we oppress ourselves, chasing productivity and self-optimisation until we burn out.",
    gated: true,
  },
  {
    id: 'q13',
    chapter: 'Ch 18',
    question: "Baudrillard's concept of 'hyperreality' in business is best illustrated by:",
    options: [
      'A company automating its manufacturing process',
      'A brand whose image becomes more compelling than its actual product',
      'An employee experiencing burnout from overwork',
      "A director acting against the company's fiduciary interests",
    ],
    correct: 1,
    explanation: "Baudrillard argues that simulations (images, brands, media) replace reality. In business, the brand simulation — its hyperreal image — often becomes more 'real' to consumers than the product itself.",
    gated: true,
  },
]

// ─── FLASHCARDS ──────────────────────────────

export const FLASHCARDS: Flashcard[] = [
  // CH 3 — PUBLIC
  { id: 'f1', chapter: 'Ch 3', front: 'Business Ethics', back: 'The application of ethical principles to business activities — going beyond legal compliance to do what is right.', gated: false },
  { id: 'f2', chapter: 'Ch 3', front: "Carroll's Pyramid", back: 'Four responsibilities in order: Economic (foundation) → Legal → Ethical → Philanthropic (top).', gated: false },
  { id: 'f3', chapter: 'Ch 3', front: 'Accountability', back: 'Answering for the outcomes of decisions and actions. Distinct from responsibility (the obligation to act).', gated: false },
  // CH 7 — GATED
  { id: 'f4', chapter: 'Ch 7', front: 'Utilitarianism', back: 'Greatest good for the greatest number. Consequentialist — judges actions by outcomes. Associated with Bentham and Mill.', gated: true },
  { id: 'f5', chapter: 'Ch 7', front: 'Categorical Imperative', back: "Kant's deontological rule: act only according to maxims you could will to be universal laws.", gated: true },
  { id: 'f6', chapter: 'Ch 7', front: 'Virtue Ethics', back: 'Focus on character, not rules or outcomes. A virtuous person naturally makes ethical decisions. Associated with Aristotle.', gated: true },
  { id: 'f7', chapter: 'Ch 7', front: 'Justice Theory (Rawls)', back: "Fair distribution of benefits and burdens. The 'veil of ignorance' — design society as if you don't know your position in it.", gated: true },
  // CH 8 — GATED
  { id: 'f8', chapter: 'Ch 8', front: 'Ubuntu', back: '"Umuntu ngumuntu ngabantu" — a person is a person through other persons. Communal identity, interdependence, collective wellbeing.', gated: true },
  { id: 'f9', chapter: 'Ch 8', front: 'African Moral Theory', back: 'Ethics grounded in community, relationships, and human dignity. Prioritises communalism, restorative justice, harmony.', gated: true },
  // CH 9 — GATED
  { id: 'f10', chapter: 'Ch 9', front: 'Stakeholder Theory (Freeman)', back: 'Businesses must manage relationships with all stakeholders — any group that can affect or be affected by the organisation.', gated: true },
  { id: 'f11', chapter: 'Ch 9', front: 'CSR', back: 'Corporate Social Responsibility — voluntary commitment to contribute to sustainable development and improve quality of life for stakeholders.', gated: true },
  { id: 'f12', chapter: 'Ch 9', front: 'Triple Bottom Line', back: 'People · Planet · Profit — measuring business success beyond financial performance. Associated with Elkington.', gated: true },
  // CH 10 — GATED
  { id: 'f13', chapter: 'Ch 10', front: 'Ethics Culture', back: "Shared values, norms, and beliefs shaping ethical behaviour — the informal 'way we do things here'.", gated: true },
  { id: 'f14', chapter: 'Ch 10', front: 'Caring Ethics Climate', back: "Decisions based on concern for others' wellbeing. Most ethically healthy climate type (Victor & Cullen).", gated: true },
  { id: 'f15', chapter: 'Ch 10', front: 'Ethical Leadership', back: 'Leaders who model virtuous behaviour, communicate ethical values, and set the tone at the top for the organisation.', gated: true },
  // CH 12 — GATED
  { id: 'f16', chapter: 'Ch 12', front: 'Corporate Governance', back: 'System by which companies are directed and controlled — balancing stakeholder interests with accountability, fairness, and transparency.', gated: true },
  { id: 'f17', chapter: 'Ch 12', front: 'King IV', back: "SA's corporate governance framework. 4 pillars: Leadership, Sustainability, Corporate Citizenship, Performance. Principle: 'apply and explain'.", gated: true },
  { id: 'f18', chapter: 'Ch 12', front: 'Fiduciary Duty', back: "A director's legal obligation to act in the company's best interest, not personal interest.", gated: true },
  // CH 13 — GATED
  { id: 'f19', chapter: 'Ch 13', front: 'Strategic Communication', back: "Purposeful communication advancing an organisation's mission while maintaining ethical stakeholder relationships.", gated: true },
  { id: 'f20', chapter: 'Ch 13', front: 'Greenwashing', back: 'Communicating false or exaggerated environmental/sustainability claims. Unethical and increasingly illegal.', gated: true },
  { id: 'f21', chapter: 'Ch 13', front: 'Integrated Reporting', back: 'Combined financial and non-financial reporting aligned with King IV. Reflects Triple Bottom Line thinking.', gated: true },
  // CH 18 — GATED
  { id: 'f22', chapter: 'Ch 18', front: 'Heidegger — Enframing', back: "Technology reduces everything to 'standing reserve' — resources to be used. Humans included. We lose meaningful relationships with the world.", gated: true },
  { id: 'f23', chapter: 'Ch 18', front: 'Baudrillard — Simulacra', back: 'Technology creates simulations that replace reality — hyperreality where the image is more real than the actual thing.', gated: true },
  { id: 'f24', chapter: 'Ch 18', front: 'Fromm — Having vs Being', back: "Technology promotes 'having' (accumulation) over 'being' (authentic development). Consumerism alienates us from ourselves.", gated: true },
  { id: 'f25', chapter: 'Ch 18', front: 'Marcuse — One-Dimensional Man', back: 'Technological society suppresses critical thinking, creates false needs, and produces compliant consumers incapable of dissent.', gated: true },
  { id: 'f26', chapter: 'Ch 18', front: 'Byung-Chul Han — Burnout Society', back: "Digital technology drives self-exploitation in the 'achievement society' — we oppress ourselves chasing productivity and self-optimisation.", gated: true },
  { id: 'f27', chapter: 'Ch 18', front: 'Husserl — Crisis of Science', back: "Modern science caused a 'crisis' by separating facts from human meaning. The 'lifeworld' — lived experience — is lost to data and efficiency.", gated: true },
]

// ─── CASE STUDIES ────────────────────────────

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'cs1',
    chapters: ['Ch 3', 'Ch 9'],
    title: 'MineRight Ltd',
    scenario: 'MineRight Ltd is a South African mining company that has been highly profitable for the past decade. The CEO recently announced record profits, but an investigative journalist revealed that the company has been dumping toxic waste near a rural community, causing illness among residents. The company claims its actions are legal under current environmental regulations. The board argues that their sole obligation is to deliver returns to shareholders.',
    questions: [
      { q: "Using Carroll's Pyramid, evaluate MineRight's fulfilment of its corporate responsibilities.", marks: 10 },
      { q: 'Apply stakeholder theory to identify who has been harmed and how MineRight should respond.', marks: 10 },
    ],
    modelAnswer: "Carroll's Pyramid analysis: MineRight fulfils its economic responsibility (profitable) and claims to meet its legal responsibility (technically compliant). However, it fails its ethical responsibility — acting legally is not sufficient; the company must do what is right and fair. The toxic dumping causes harm to the community, violating basic ethical obligations. The philanthropic responsibility is also absent. The board's shareholder-only view (Friedman) is directly contradicted by stakeholder theory (Freeman) — the rural community are legitimate stakeholders whose interests must be considered. A stakeholder response would require: immediate cessation of dumping, community health assessment and remediation, transparent engagement with affected residents, and structural changes to environmental practices.",
    gated: true,
  },
  {
    id: 'cs2',
    chapters: ['Ch 7', 'Ch 13'],
    title: 'GreenLife Foods',
    scenario: "GreenLife Foods launched a major marketing campaign claiming their packaging is '100% biodegradable and ocean-safe.' An independent audit found that the packaging only degrades under industrial composting conditions unavailable to most consumers, and performs no better than standard plastic in ocean environments. The marketing team argued the campaign was technically accurate because the packaging is certified biodegradable under laboratory conditions. Sales increased 40% following the campaign.",
    questions: [
      { q: 'Identify the ethical issue in this case and apply TWO ethical theories to evaluate GreenLife\'s communication.', marks: 15 },
      { q: 'What does ethical crisis communication require GreenLife to do now that the audit is public?', marks: 10 },
    ],
    modelAnswer: "The ethical issue is greenwashing — communicating misleading environmental claims that give consumers a false impression of the product's sustainability. Applying deontological ethics (Kant): GreenLife's communication violates the Categorical Imperative. If all companies made technically-true-but-misleading claims, informed consumer choice would become impossible — the maxim cannot be universalised. The intention was to deceive, regardless of technical accuracy. Applying utilitarianism: the short-term benefit (40% sales increase) must be weighed against harms — consumer deception, environmental damage from false confidence, damage to public trust in sustainability claims, and reputational risk. The utilitarian calculus does not support the campaign. Ethical crisis communication now requires: transparency (acknowledge the misleading nature of the campaign), accountability (accept responsibility rather than hiding behind technical compliance), speed (respond before the narrative hardens), and genuine remedial action (reformulate the packaging or correct the marketing immediately).",
    gated: true,
  },
  {
    id: 'cs3',
    chapters: ['Ch 18', 'Ch 10'],
    title: 'TechForward Solutions',
    scenario: "TechForward Solutions is a Johannesburg-based tech company that prides itself on its 'hustle culture.' Employees are expected to be available on Slack 24/7, respond to messages within 30 minutes regardless of time, and 'ship fast or go home.' The company recently introduced an AI monitoring system that tracks every employee's screen activity, keystrokes, and bathroom breaks. Productivity metrics have increased 15%, but the HR department has flagged a 60% rise in stress-related sick leave and three senior engineers resigned citing burnout.",
    questions: [
      { q: 'Apply TWO philosophers from Chapter 18 to analyse the ethical implications of TechForward\'s management approach.', marks: 15 },
      { q: "Evaluate TechForward's ethics climate and recommend changes using ethics management tools.", marks: 10 },
    ],
    modelAnswer: "Applying Byung-Chul Han's Burnout Society: TechForward exemplifies the 'achievement society' Han describes — employees are not externally coerced but internalise the demand for constant productivity. The 24/7 availability expectation and hustle culture framing cause employees to self-exploit. The 60% rise in stress leave and resignations are direct manifestations of Han's burnout phenomenon. The AI monitoring reinforces this by making self-surveillance continuous. Applying Heidegger's Enframing (Gestell): The AI monitoring system reduces employees to 'standing reserve' — measurable inputs in a productivity system. Tracking keystrokes and bathroom breaks treats humans as resources to be optimised, stripping work of meaning and dignity. This is Heidegger's warning about technology dehumanising human existence. Ethics climate analysis: TechForward displays an Instrumental climate — decisions are driven by self-interest and performance metrics. This is the least ethically healthy climate type. Recommended changes: introduce a Code of Conduct protecting employee wellbeing and right to disconnect; establish clear working hours; remove invasive monitoring or make it transparent and proportionate; implement an ethics officer role; conduct an ethics audit; and shift leadership language from 'hustle' to sustainable high performance.",
    gated: true,
  },
]
