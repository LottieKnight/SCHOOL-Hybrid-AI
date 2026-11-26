/*
 * EKRP 211 — Introduction to Risk Management
 * Risk Governance Console data layer
 */

export const MODULE = {
  code: 'EKRP211',
  title: 'Introduction to Risk Management',
  institution: 'NWU',
  examDate: '2026-06-08T09:00:00+02:00',
  examTime: '09:00 SAST',
  examVenue: 'A18_G06',
  examStructure: 'Section A: MCQ (70 marks) · Section B: Definitions & Theory (4 marks) · Section C: Corporate Governance (7 marks) · Section D: ERM (5 marks) · Section E: Operational Risk Management (14 marks)',
  sphere: 'GOVERNANCE',
  brand: 'Risk Management',
  dossierTitle: 'Risk Governance Intelligence File',
  storyline: 'Risk is not the enemy of performance. Unmanaged risk is.',
  textbook: 'Managing Risk in South African Business Environments',
}

export type RiskClass = 'STRATEGIC' | 'FINANCIAL' | 'OPERATIONAL' | 'COMPLIANCE'

export interface ChapterArcItem {
  id: string
  number: number
  title: string
  summary: string
  riskClass: RiskClass
}

export const CHAPTER_ARC: ChapterArcItem[] = [
  {
    id: 'ch1',
    number: 1,
    title: 'Foundations of Risk',
    summary:
      'Definitions, uncertainty vs risk, risk environment, categories of risk, risk appetite vs risk tolerance. The conceptual bedrock before any framework can be applied.',
    riskClass: 'STRATEGIC',
  },
  {
    id: 'ch2',
    number: 2,
    title: 'The Risk Management Process',
    summary:
      'ISO 31000 lifecycle: identification, assessment, response, and continuous monitoring. How structured organisations build a repeatable risk process.',
    riskClass: 'OPERATIONAL',
  },
  {
    id: 'ch3',
    number: 3,
    title: 'Enterprise Risk Management',
    summary:
      'COSO ERM integrated framework, board-level oversight, strategic risk alignment, and how ERM connects governance to performance.',
    riskClass: 'STRATEGIC',
  },
  {
    id: 'ch4',
    number: 4,
    title: 'Governance Frameworks',
    summary:
      'King IV, King III, Cadbury Report, board composition, audit committees, director independence, and the South African governance context.',
    riskClass: 'COMPLIANCE',
  },
  {
    id: 'ch5',
    number: 5,
    title: 'Financial Risk Overview',
    summary:
      'Systematic vs unsystematic risk, portfolio diversification, the risk-return tradeoff, and the landscape of financial risk categories.',
    riskClass: 'FINANCIAL',
  },
  {
    id: 'ch6',
    number: 6,
    title: 'Credit Risk',
    summary:
      'Default probability, credit scoring models, concentration risk, credit derivatives, and Basel III capital requirements for credit exposures.',
    riskClass: 'FINANCIAL',
  },
  {
    id: 'ch7',
    number: 7,
    title: 'Liquidity Risk',
    summary:
      'Funding liquidity, market liquidity, asset-liability management, liquidity stress testing, LCR and NSFR regulatory ratios.',
    riskClass: 'FINANCIAL',
  },
  {
    id: 'ch8',
    number: 8,
    title: 'Market Risk',
    summary:
      'Interest rate risk, exchange rate risk, investment risk, commodity price risk, and Value-at-Risk measurement methodologies.',
    riskClass: 'FINANCIAL',
  },
  {
    id: 'ch9',
    number: 9,
    title: 'Operational Risk',
    summary:
      'Human error, system failures, process risk, internal fraud, external events, Basel Advanced Measurement Approach, and loss event databases.',
    riskClass: 'OPERATIONAL',
  },
  {
    id: 'ch10',
    number: 10,
    title: 'Risk Culture and Values',
    summary:
      'Risk culture vs organisational values, tone from the top, risk committees, accountability structures, and the difference between a stated risk appetite and a lived one.',
    riskClass: 'STRATEGIC',
  },
]

export interface ChapterSection {
  heading: string
  body: string
  examTip?: string
}

export interface Chapter {
  id: string
  number: number
  title: string
  subtitle: string
  riskClass: RiskClass
  gated: boolean
  sections: ChapterSection[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    number: 1,
    title: 'Foundations of Risk',
    subtitle: 'Definitions · Risk vs Uncertainty · Appetite vs Tolerance',
    riskClass: 'STRATEGIC',
    gated: false,
    sections: [
      {
        heading: 'What is risk?',
        body: 'Risk is the possibility that actual outcomes will deviate from expected outcomes. The deviation can be positive (upside risk) or negative (downside risk). This dual nature is critical — risk management is not simply loss prevention; it is outcome optimisation under uncertainty.\n\nUncertainty differs from risk in that risk can be measured (probabilities can be assigned), while uncertainty cannot. A business decision made with complete information carries no risk. A business decision made without information carries pure uncertainty. Most real decisions fall somewhere between.',
        examTip:
          'A common exam trap: students confuse risk and uncertainty. Risk has a measurable probability distribution. Uncertainty does not. Know both definitions and the distinction.',
      },
      {
        heading: 'Risk appetite vs risk tolerance',
        body: "Risk appetite is the amount and type of risk an organisation is willing to accept in pursuit of its objectives. It is a strategic decision made at board level.\n\nRisk tolerance is the acceptable variation around the risk appetite — the operational boundary within which management can work. Tolerance is narrower than appetite and is often expressed as quantitative thresholds.\n\nExample: A bank's risk appetite states it will accept a maximum 2% non-performing loan ratio. Its risk tolerance may specify that the portfolio manager must escalate to the risk committee if the ratio exceeds 1.8%.",
        examTip:
          'Exam questions frequently test the appetite-tolerance distinction. Appetite = strategic boundary. Tolerance = operational boundary within appetite. Both are set by the board; tolerance is implemented by management.',
      },
      {
        heading: 'Categories of risk',
        body: 'The major risk categories in the EKRP 211 framework are:\n\n1. Financial risk — credit, liquidity, market (interest rate, exchange rate, investment)\n2. Operational risk — people, processes, systems, external events\n3. Strategic risk — poor strategic decisions, competitive position, reputation\n4. Compliance risk — regulatory, legal, governance failures\n\nThe boundaries between categories are not rigid. A system failure (operational) can trigger a liquidity crisis (financial) which damages reputation (strategic). Risk management must address both the primary event and the cascade.',
      },
    ],
  },
  {
    id: 'ch2',
    number: 2,
    title: 'The Risk Management Process',
    subtitle: 'ISO 31000 · Identification · Assessment · Response · Monitoring',
    riskClass: 'OPERATIONAL',
    gated: false,
    sections: [
      {
        heading: 'ISO 31000 framework',
        body: 'ISO 31000:2018 defines the principles and guidelines for risk management. Its process is iterative, not linear:\n\n1. Context establishment — define the internal and external environment\n2. Risk identification — find, recognise, and describe risks\n3. Risk analysis — understand the nature, sources, and likelihood of risks\n4. Risk evaluation — compare with criteria and prioritise\n5. Risk treatment — select and implement response options\n6. Monitoring and review — continuous feedback loop\n7. Communication and consultation — stakeholder engagement throughout',
        examTip:
          'ISO 31000 questions often ask which step is missing from a scenario or which step applies to a described activity. Master the seven steps and their definitions.',
      },
      {
        heading: 'Risk response strategies',
        body: 'The four primary risk response strategies:\n\nAvoidance — eliminate the activity generating the risk. Highest risk reduction, but also highest opportunity cost.\n\nReduction (Mitigation) — reduce the likelihood and/or impact of the risk. The most common operational response.\n\nTransfer — shift the financial consequence to a third party. Insurance is the classic mechanism. Does not eliminate the risk event, only the financial exposure.\n\nAcceptance — consciously decide to retain the risk, either because the cost of treatment exceeds the benefit, or because the risk is within appetite.',
        examTip:
          'Match each strategy to a scenario. Avoidance removes the activity. Transfer uses insurance or contracts. Reduction uses controls. Acceptance is a conscious decision, not neglect.',
      },
    ],
  },
  {
    id: 'ch3',
    number: 3,
    title: 'Enterprise Risk Management',
    subtitle: 'COSO ERM · 20 Principles · Strategy · Governance & Culture · Objective-Setting',
    riskClass: 'STRATEGIC',
    gated: true,
    sections: [
      {
        heading: 'SU 5.1 — COSO ERM definition and purpose',
        body: "COSO's definition of ERM:\n\n\"Enterprise Risk Management is the culture, capabilities, and practices that an organisation integrates with strategy-setting and applies when carrying out that strategy, with the purpose of managing risk in creating, preserving, and realising value.\"\n\nThree key words: Culture · Capabilities · Practices.\n\nERM is NOT a department or function — it is a capability integrated throughout the entire organisation.\n\nHow management decisions affect value:\n• Create value — identifying opportunities and taking calculated risks\n• Preserve value — protecting existing assets and capabilities\n• Erode value — taking on excessive or unmanaged risk\n• Realise value — successfully executing strategy within acceptable risk levels",
        examTip: 'The three-word definition anchor is exam-critical: Culture, Capabilities, Practices. ERM is also not a compliance exercise or checklist — it is a strategic capability. Know the four ways management decisions affect shareholder value.',
      },
      {
        heading: 'SU 5.1 — Benefits of adopting COSO ERM',
        body: 'Seven key benefits of the COSO ERM framework:\n\n1. Increases range of opportunities — identifies new opportunities alongside risks\n2. Identifies and manages entity-wide risks — addresses risk across all levels, not in silos\n3. Reduces negative surprises — early warning of risk events\n4. Reduces performance variability — smooths unexpected outcomes\n5. Improves resource deployment — allocates resources based on risk profile\n6. Enhances resilience — prepares the entity for change and disruption\n7. Links ERM to strategy — aligns risk management with business objectives\n\nCommon misconceptions:\n✗ ERM is just a checklist or compliance exercise\n✗ ERM is only for large organisations\n✗ ERM eliminates all risk\n✗ ERM is only the responsibility of the risk department',
        examTip: 'Benefits are tested in MCQ format — know all seven and be able to match a described outcome to the correct benefit. Also know the four misconceptions by name.',
      },
      {
        heading: 'SU 5.1 — The five components and 20 principles',
        body: 'The COSO ERM framework has five interrelated components, each with associated principles (total: 20):\n\n1. Governance and Culture (Principles 1–5) — sets the foundation: tone at the top, accountability, values, board oversight\n2. Strategy and Objective-Setting (Principles 6–9) — links ERM to strategic direction, risk appetite, business objectives\n3. Performance (Principles 10–12) — identifies, analyses, and responds to risk\n   • Principle 10: Identifies Risk\n   • Principle 11: Analyses Risk\n   • Principle 12: Responds to Risk\n4. Review and Revision (Principles 13–15) — monitors and improves ERM\n5. Information, Communication and Reporting (Principles 16–20) — shares risk information across the entity\n\nThe components are INTERRELATED, not sequential. A change in governance affects strategy; new information affects performance; a review may revise strategy.',
        examTip: 'Principle 10 (Identifies Risk) is under PERFORMANCE — a common exam trap. The five components do not operate in order; they interact continuously. "Identifies Risk" = Performance, not Strategy or Governance.',
      },
      {
        heading: 'SU 5.2 — How ERM affects strategy',
        body: 'ERM does not replace strategic planning — it enhances it. By integrating ERM into strategy-setting, management gains a better understanding of risks before committing to a direction.\n\nERM identifies three strategy-related risks:\n\na) Misalignment of strategy with mission, vision, and core values\nA chosen strategy may look financially attractive but conflict with who the organisation is. ERM flags this misalignment before commitment.\nExample: A food company whose mission is "affordable nutrition for all" considers a luxury-only premium strategy. ERM would flag the misalignment.\n\nb) Implications from the strategy chosen\nEvery strategy carries embedded risks — risks that arise simply because you chose that direction. ERM asks: what new risks are introduced? What opportunities are forgone?\n\nc) Risk to executing the strategy\nEven a well-chosen strategy can fail in implementation. ERM identifies execution risks: resource shortages, market changes, regulatory shifts, operational failures.',
        examTip: 'The three strategy-related risks are: misalignment, implications, and execution risk. Exam questions will describe a scenario and ask which type applies. Know the distinction: misalignment = wrong direction; implications = risks of the direction itself; execution = risks of carrying it out.',
      },
      {
        heading: 'SU 5.2 — Risk and performance (risk profile)',
        body: 'The risk profile is a composite view of the risks an entity faces at a given time, relative to its risk appetite and business objectives.\n\nThe relationship between risk and performance:\n• Too little risk taken → missed opportunities → underperformance\n• Too much risk taken → potential for severe losses → underperformance\n• Optimal risk within appetite → best performance potential\n\nFull ERM integration means ERM is embedded across all three dimensions:\n• Culture — risk awareness becomes part of how people think and behave daily\n• Capabilities — staff develop risk competencies; tools and processes are embedded\n• Practices — ERM is part of planning, budgeting, performance reviews, and reporting\n\nWhy full integration matters: silos create blind spots. Risks do not respect departmental boundaries. A portfolio view of risk across the whole organisation is only possible with full integration.',
        examTip: 'The risk-performance relationship is tested graphically and conceptually. Performance is maximised when risk is managed WITHIN appetite — not when it is avoided entirely. Know the three full integration dimensions: culture, capabilities, practices.',
      },
      {
        heading: 'SU 5.4 — Component 1: Governance and Culture',
        body: 'Governance and Culture is the FOUNDATION of all other COSO ERM components. Without the right culture, no framework or process will function effectively.\n\nBoard risk oversight requires the Board of Directors to:\n• Approve the entity\'s risk appetite\n• Oversee the ERM framework\n• Hold management accountable for risk management\n• Ensure the right operating structure is in place\nNote: the board OVERSEES risk management — it does not manage risk day-to-day.\n\nBoard independence: independent board members make objective decisions without personal interest conflicts. Independence is impeded by: conflicts of interest, personal relationships with executives, financial dependence on the company, and lack of diverse perspectives.\n\nOperating structure: how the entity is organised (legal entities, business units, governance layers). Risk responsibilities must be clearly assigned at every level.\n\nAuthority, Responsibility, and Accountability:\n• Authority — the power to make decisions and take actions\n• Responsibility — the obligation to carry out assigned tasks\n• Accountability — answering for the outcomes of decisions and actions\nAmbiguity in these creates gaps — nobody owns a risk because everyone assumes someone else does.',
        examTip: 'Governance and Culture is the foundation BECAUSE it sets the environment within which all other components operate. Board oversight ≠ day-to-day management. Know the authority/responsibility/accountability distinction by definition.',
      },
      {
        heading: 'SU 5.4 — Defining and embracing risk culture',
        body: 'Who defines desired culture? Primarily the board and senior management — through their behaviour, decisions, and communication. Culture is defined from the top but shaped by everyone.\n\nInternal factors that shape culture:\n• Leadership behaviour and tone\n• Reward and incentive structures\n• Communication and transparency\n• Policies and procedures\n\nExternal factors that shape culture:\n• Regulatory environment\n• Industry norms and standards\n• Societal expectations\n• Economic conditions\n\nEmbracing a risk culture:\n• Leadership visibly champions risk awareness\n• Risk is discussed openly — no blame culture\n• Risk training is provided at all levels\n• Risk is embedded in performance evaluations\n• Whistleblowing mechanisms are in place\n\nWhen core values deviate:\n• Excessive pressure to meet targets\n• Poor leadership examples\n• Inadequate incentives aligned with values\n• Lack of consequences for unethical behaviour\n\nAttracting, developing, retaining capable individuals:\n• Attract — hire people with the right competencies and values alignment\n• Develop — invest in training, mentoring, and career development\n• Retain — create an environment where capable people want to stay\nExcessive pressure is associated with: unrealistic targets, fear-based management, lack of resources, and short-term thinking.',
        examTip: 'Culture questions are scenario-based. When a question describes a company where risk is not discussed openly or bonuses reward risk-taking without accountability, that is a weak risk culture. Know the four factors that cause core values to deviate.',
      },
      {
        heading: 'SU 5.5 — Component 2: Strategy and Objective-Setting',
        body: "An entity's business context is its understanding of the environment in which it operates.\n\nInternal environment factors: capital structure, organisational culture, business complexity, workforce capabilities, technology infrastructure.\n\nExternal environment factors: economic conditions, political and regulatory landscape, social and demographic trends, technological disruptions, competitive landscape, environmental factors.\n\nRisk Appetite — the amount and type of risk an entity is willing to accept in pursuit of its objectives.\n• Set by the board\n• Expressed in qualitative terms (e.g., 'low appetite for compliance risk') OR quantitative terms (e.g., 'losses not exceeding R5m')\n• Applied by management in strategic decisions and operations\n\nHow appetite is defined and applied:\n1. Consider mission, vision, and core values\n2. Assess the entity's risk capacity\n3. Engage the board to set formal risk appetite statements\n4. Communicate throughout the organisation\n5. Apply in strategic decisions and operational activities\n6. Monitor and review regularly\n\nRisk Capacity — the MAXIMUM amount of risk the entity is able to absorb given its resources, capital, and constraints — without threatening its survival.\n\nRisk Tolerance — the acceptable variation in outcomes relative to the achievement of a specific objective. The boundary AROUND the risk appetite.\n\nAnalogy:\n• Capacity = maximum weight a bridge can hold before collapse\n• Appetite = weight limit sign posted on the bridge\n• Tolerance = acceptable range around that limit (e.g., ±10%)",
        examTip: 'Appetite, capacity, and tolerance are three separate definitions. Capacity = maximum survivable. Appetite = willingness. Tolerance = acceptable variation around appetite. Tolerance is NARROWER than appetite. Know the bridge analogy — it appears directly in exam scenarios.',
      },
      {
        heading: 'SU 5.5 — Strategy alignment and business objectives',
        body: 'Aligning strategy with mission and vision:\nIf strategy is not aligned with mission and vision, the entity may achieve financial targets but lose its identity, reputation, or stakeholder trust.\n\nImplications of a misaligned strategy:\n• Reputational damage\n• Loss of customer trust\n• Employee disengagement\n• Regulatory scrutiny\n• Long-term value destruction\n\nImplications of a chosen business objective:\n• Different objectives carry different risk profiles\n• Some objectives introduce new risks not previously managed\n• Management must assess whether the chosen objective\'s risk is within risk appetite\n\nBusiness objectives should be:\n• Specific and measurable\n• Aligned with mission and vision\n• Risk-informed — developed with understanding of what could prevent achievement\n• Set at multiple levels: entity-wide, division, business unit, individual\n\nTolerance levels are set considering:\n• The entity\'s risk appetite\n• The entity\'s risk capacity\n• The entity\'s current risk profile',
        examTip: "Misalignment vs implications vs execution risk: misalignment = wrong strategy for who you are; implications = risks built into the strategy itself; execution = risks of carrying it out. Also know that business objectives must be risk-informed, not just financial targets.",
      },
      {
        heading: 'COSO ERM vs ISO 31000',
        body: "Both frameworks guide risk management but differ in scope and intent:\n\nCOSO ERM is a governance framework aligned to strategic performance. It links risk management to strategy and value creation. Primarily used for board-level governance.\n\nISO 31000 is a process framework for implementing risk management across any context. It is more operational and universal, applicable to any organisation, project, or decision.\n\nIn practice: COSO ERM shapes the governance structure; ISO 31000 guides the process within that structure.",
        examTip: 'COSO = governance + strategy. ISO 31000 = process + universal application. One question type asks you to identify which framework applies to a described activity.',
      },
    ],
  },
  {
    id: 'ch4',
    number: 4,
    title: 'Governance Frameworks',
    subtitle: 'King IV · King III · Cadbury · Board Composition',
    riskClass: 'COMPLIANCE',
    gated: true,
    sections: [
      {
        heading: 'King IV Report on Corporate Governance',
        body: "King IV (2016, effective 2017) replaced King III and introduced several key shifts:\n\n1. Outcomes-based rather than principles-based compliance\n2. 'Apply and explain' replaced 'apply or explain'\n3. Integrated thinking and value creation across all capitals\n4. Governance applies to all organisations, not just listed companies\n5. The governing body is accountable for risk governance — not just oversight\n\nKey King IV principles for EKRP 211:\n- The board should govern risk in a way that supports it in setting and achieving its objectives\n- Risk management should be integrated into strategy and performance management\n- The risk committee oversees the risk function",
        examTip:
          "King IV vs King III distinction is a regular exam question. King IV introduced 'apply and explain' (vs III's 'apply or explain'), outcomes focus, and explicit integrated thinking. Know these three differences precisely.",
      },
      {
        heading: 'Cadbury Report',
        body: "The Cadbury Report (1992, UK) established the foundational principles of modern corporate governance after high-profile corporate failures. Key contributions:\n\n1. Separation of the roles of CEO and Chairman\n2. Introduction of independent non-executive directors\n3. Audit committee requirements\n4. Director remuneration transparency\n5. Board accountability to shareholders\n\nCadbury is the origin point of the governance reform movement that produced King I, II, III, and IV in South Africa.",
        examTip:
          'Cadbury is tested as the historical origin of governance frameworks. Know the separation of CEO/Chairman, the role of independent NEDs, and the audit committee as the three signature contributions.',
      },
    ],
  },
  {
    id: 'ch5',
    number: 5,
    title: 'Financial Risk Overview',
    subtitle: 'Systematic vs Unsystematic · Portfolio · Risk-Return',
    riskClass: 'FINANCIAL',
    gated: true,
    sections: [
      {
        heading: 'Systematic vs unsystematic risk',
        body: 'Systematic risk (market risk) is the risk inherent to the entire market or market segment. It cannot be eliminated through diversification. Examples: interest rate changes, inflation, recession, political instability.\n\nUnsystematic risk (specific/idiosyncratic risk) is unique to a specific company or industry. It can be reduced through diversification. Examples: management failures, product recalls, company-specific fraud.\n\nTotal risk = Systematic risk + Unsystematic risk\n\nBeta (β) measures systematic risk relative to the market. A β of 1 means the asset moves with the market. β > 1 is more volatile than the market. β < 1 is less volatile.',
        examTip:
          'The systematic/unsystematic distinction underpins portfolio theory. Exam questions test: which type can be diversified away (unsystematic), which cannot (systematic), and which beta values indicate what risk level.',
      },
      {
        heading: 'Risk-return tradeoff',
        body: 'Higher expected return requires accepting higher risk. This principle is foundational to financial theory.\n\nThe Capital Asset Pricing Model (CAPM) formalises this:\nExpected Return = Risk-free rate + β × (Market Return - Risk-free rate)\n\nThe market risk premium (Market Return - Risk-free rate) compensates investors for accepting systematic risk. Investors are not compensated for unsystematic risk because it can be diversified away.',
        examTip:
          'CAPM is tested conceptually, not always mathematically. Know: (1) what each component means, (2) why beta matters, (3) why only systematic risk is rewarded.',
      },
    ],
  },
  {
    id: 'ch6',
    number: 6,
    title: 'Credit Risk',
    subtitle: 'Default Risk · Credit Scoring · Basel III',
    riskClass: 'FINANCIAL',
    gated: true,
    sections: [
      {
        heading: 'Defining credit risk',
        body: 'Credit risk is the risk of loss due to a counterparty failing to meet its contractual obligations. The loss can take several forms:\n\n1. Default risk — the counterparty cannot repay at all\n2. Downgrade risk — the counterparty\'s credit quality deteriorates, reducing the value of the exposure\n3. Concentration risk — over-exposure to a single counterparty, sector, or geography\n4. Settlement risk — failure to settle a transaction at the agreed time\n\nCredit risk is the dominant risk in commercial banking and is heavily regulated under Basel III.',
        examTip:
          'Know all four types of credit risk by name and definition. Exam scenarios often describe one type and ask you to identify it. Concentration risk is frequently tested with case study scenarios.',
      },
    ],
  },
  {
    id: 'ch7',
    number: 7,
    title: 'Liquidity Risk',
    subtitle: 'Funding Liquidity · Market Liquidity · ALM · LCR',
    riskClass: 'FINANCIAL',
    gated: true,
    sections: [
      {
        heading: 'Types of liquidity risk',
        body: 'Funding liquidity risk is the risk that a firm cannot meet its cash flow obligations as they fall due. A bank experiences funding liquidity risk when depositors withdraw faster than the bank can raise new funds.\n\nMarket liquidity risk is the risk that an asset cannot be sold quickly enough at or near its fair value. Illiquid markets force sellers to accept steep discounts.\n\nThe 2008 financial crisis demonstrated how funding and market liquidity risk can reinforce each other in a self-amplifying spiral — forced asset sales drove prices down, triggering further margin calls, driving more sales.',
        examTip:
          'Funding vs market liquidity is a classic definition question. Funding = cannot meet obligations. Market = cannot exit position at fair value. Both are tested in case scenarios.',
      },
    ],
  },
  {
    id: 'ch8',
    number: 8,
    title: 'Market Risk',
    subtitle: 'Interest Rate · Exchange Rate · Investment Risk · VaR',
    riskClass: 'FINANCIAL',
    gated: true,
    sections: [
      {
        heading: 'Interest rate risk',
        body: 'Interest rate risk is the risk that changes in interest rates will adversely affect an institution\'s financial position. It affects:\n\n1. Net interest income (NII) — the difference between interest earned and interest paid\n2. Economic value of equity (EVE) — the present value of assets minus liabilities\n\nA bank that funds long-term fixed-rate mortgages with short-term floating-rate deposits is exposed to significant interest rate risk — rising rates increase its funding cost without a corresponding rise in mortgage income.',
        examTip:
          'Interest rate risk questions often use a bank scenario. Test yourself: which direction of rate change hurts a bank that borrows short and lends long? Rising rates. Always explain the mechanism, not just the direction.',
      },
      {
        heading: 'Exchange rate risk',
        body: 'Exchange rate risk (currency risk) is the risk of loss from adverse movements in exchange rates. It affects any entity with transactions, assets, or liabilities denominated in foreign currencies.\n\nThree forms:\n1. Transaction risk — risk on specific foreign currency transactions\n2. Translation risk — risk when consolidating foreign subsidiary financial statements\n3. Economic risk — long-term impact on competitive position and cash flows\n\nHedging tools: forward contracts, currency swaps, currency options, natural hedges (matching revenues and costs in the same currency).',
        examTip:
          'Know the three forms of exchange rate risk and one hedging tool for each. Transaction = forward contract. Translation = balance sheet hedge. Economic = operational restructuring or natural hedge.',
      },
    ],
  },
  {
    id: 'ch9',
    number: 9,
    title: 'Operational Risk',
    subtitle: 'People · Processes · Systems · External Events · Basel',
    riskClass: 'OPERATIONAL',
    gated: true,
    sections: [
      {
        heading: 'Basel definition of operational risk',
        body: 'Basel II/III defines operational risk as the risk of loss resulting from inadequate or failed internal processes, people, and systems, or from external events. Four loss event categories:\n\n1. Internal fraud — intentional misreporting, theft, unauthorised trading\n2. External fraud — robbery, hacking, forgery\n3. Employment practices — HR disputes, discrimination, workplace safety\n4. Clients, products, and business practices — mis-selling, fiduciary breaches\n5. Damage to physical assets — natural disasters, terrorism\n6. Business disruption and system failures — IT outages, power failures\n7. Execution, delivery, and process management — transaction errors, outsourcing failures',
        examTip:
          'The Basel seven operational risk categories are frequently listed in exam questions asking you to identify which category a scenario belongs to. Internal fraud vs external fraud is the most commonly confused pair.',
      },
    ],
  },
  {
    id: 'ch10',
    number: 10,
    title: 'Risk Culture and Values',
    subtitle: 'Culture vs Values · Risk Appetite · Tone from the Top',
    riskClass: 'STRATEGIC',
    gated: true,
    sections: [
      {
        heading: 'Risk culture vs organisational values',
        body: "Risk culture is the set of shared values, beliefs, knowledge, attitudes, and understanding about risk that shape the decisions and behaviour of individuals and groups within an organisation.\n\nOrganisational values are the stated principles that the organisation claims to operate by.\n\nThe critical distinction: values are what an organisation says. Risk culture is what it does. The two can diverge — often dangerously. Steinhoff had published values around integrity. Its actual risk culture tolerated and enabled fraud at the highest levels.\n\nIndicators of a weak risk culture include: risk functions that lack board-level access, bonus structures that reward risk-taking without accountability, and a history of tolerance for 'good' results regardless of how they were achieved.",
        examTip:
          'Culture vs values is a conceptual pair tested with case scenarios. When Steinhoff appears in an exam, the question usually tests risk culture failure, not just fraud. Explain the gap between stated values and actual behaviours.',
      },
      {
        heading: 'Risk appetite in practice',
        body: 'A risk appetite statement is not merely a compliance document. An effective risk appetite statement:\n\n1. Is set by the board, not management\n2. Is expressed in both qualitative and quantitative terms\n3. Is linked to strategic objectives\n4. Is reviewed at least annually\n5. Is communicated throughout the organisation\n6. Has escalation triggers connected to risk tolerance thresholds\n\nThe gap between a board-approved risk appetite and the operational reality of the business is one of the most common risk governance failures.',
        examTip:
          'When asked to assess a risk appetite framework, use the six criteria above as a checklist. An exam scenario describing a company that "approved a risk appetite statement five years ago and has not reviewed it" is describing criterion 4 failure.',
      },
    ],
  },
]

export interface MCQ {
  id: string
  chapter: string
  question: string
  options: string[]
  correct: number
  explanation: string
  gated: boolean
}

export const MCQS: MCQ[] = [
  {
    id: 'mcq1',
    chapter: 'ch1',
    question:
      'Which of the following BEST describes the difference between risk appetite and risk tolerance?',
    options: [
      'Risk appetite is set by management; risk tolerance is set by the board',
      'Risk appetite is the strategic boundary for acceptable risk; risk tolerance is the operational variation allowed within that boundary',
      'Risk appetite applies only to financial risk; risk tolerance applies to all risk types',
      'Risk appetite and risk tolerance are synonymous terms used interchangeably in ISO 31000',
    ],
    correct: 1,
    explanation:
      'Risk appetite is the amount and type of risk an organisation is willing to accept in pursuit of its objectives — a strategic decision made at board level. Risk tolerance is the acceptable variation around that appetite, setting the operational boundaries within which management works. Appetite = strategic. Tolerance = operational. Neither is limited to a single risk type.',
    gated: false,
  },
  {
    id: 'mcq2',
    chapter: 'ch2',
    question:
      'An organisation identifies that a particular risk would cost R500 000 to mitigate but only has a 1% annual probability with a R200 000 impact. Management decides to retain the risk without any controls. This is an example of:',
    options: [
      'Risk avoidance',
      'Risk transfer',
      'Risk reduction',
      'Risk acceptance',
    ],
    correct: 3,
    explanation:
      'Risk acceptance (retention) is the deliberate decision to retain a risk, typically when the cost of treatment exceeds the expected benefit. Here the mitigation cost (R500 000) exceeds the expected annual loss (1% × R200 000 = R2 000). Accepting the risk is the rational response. This is not neglect — it is a conscious risk response decision.',
    gated: false,
  },
  {
    id: 'mcq3',
    chapter: 'ch4',
    question:
      "Which of the following BEST describes the change from King III to King IV regarding the compliance approach?",
    options: [
      "King IV introduced 'comply or explain'; King III used 'apply and explain'",
      "King IV introduced 'apply and explain'; King III used 'apply or explain'",
      "Both King III and King IV use 'apply or explain' — the difference is in scope",
      "King IV is only applicable to JSE-listed companies, while King III applied to all entities",
    ],
    correct: 1,
    explanation:
      "King III used 'apply or explain' — an entity either applied a principle or explained why it did not. King IV shifted to 'apply and explain' — entities must apply all principles AND explain HOW they apply them. This is a more demanding standard because it requires evidence of application, not just a declaration of intent.",
    gated: false,
  },
  {
    id: 'mcq4',
    chapter: 'ch5',
    question:
      'A South African investor holds shares in only one JSE-listed mining company. Which type of risk CANNOT be reduced by adding more shares to the portfolio?',
    options: [
      'Unsystematic risk specific to the mining company',
      'Systematic risk affecting the entire market',
      'Operational risk specific to the mining sector',
      'Concentration risk from holding a single share',
    ],
    correct: 1,
    explanation:
      'Systematic risk (market risk) cannot be eliminated through diversification — it affects all assets in the market simultaneously. Unsystematic risk (the company-specific and sector-specific risks) CAN be reduced by diversifying into other shares and sectors. Concentration risk is a form of unsystematic risk and diminishes as the portfolio diversifies.',
    gated: false,
  },
  {
    id: 'mcq5',
    chapter: 'ch8',
    question:
      'A South African exporter invoices an international client in US dollars for goods to be delivered in 90 days. The ZAR/USD exchange rate moves adversely before payment. This is an example of:',
    options: [
      'Translation risk',
      'Economic risk',
      'Transaction risk',
      'Interest rate risk',
    ],
    correct: 2,
    explanation:
      'Transaction risk arises from specific foreign currency transactions where the exchange rate moves between the transaction date and the settlement date. This exporter has a contractual obligation to receive USD in 90 days — an adverse move in the ZAR/USD rate will reduce the ZAR value of that receipt. Translation risk relates to consolidating foreign subsidiaries; economic risk is long-term competitive impact.',
    gated: true,
  },
  {
    id: 'mcq6',
    chapter: 'ch3',
    question:
      'According to the COSO ERM 2017 framework, which component is DIRECTLY concerned with connecting risk management to strategic objectives?',
    options: [
      'Performance',
      'Governance and culture',
      'Strategy and objective-setting',
      'Information, communication, and reporting',
    ],
    correct: 2,
    explanation:
      "The 'Strategy and objective-setting' component is where COSO ERM 2017 explicitly connects risk management to business strategy. This includes analysing the business context, defining risk appetite, and evaluating alternative strategies. It is the component that makes the 2017 update qualitatively different from older frameworks — risk management is now inseparable from strategic planning.",
    gated: true,
  },
  {
    id: 'mcq7',
    chapter: 'ch7',
    question:
      'A bank funds long-term fixed-rate mortgages using short-term deposits that reprice every three months. Interest rates rise sharply. Which risk has PRIMARILY materialised?',
    options: [
      'Credit risk — borrowers may default in a high-rate environment',
      'Liquidity risk — depositors may withdraw funds',
      'Interest rate risk — the funding cost increases but mortgage income is fixed',
      'Exchange rate risk — international funding becomes more expensive',
    ],
    correct: 2,
    explanation:
      'Interest rate risk has materialised. The bank borrows short (at floating rates that now reset higher) and lends long (at fixed rates that do not change). The net interest margin compresses as funding costs rise while mortgage income stays flat. While credit risk and liquidity risk are secondary concerns, the primary risk event described is interest rate risk — specifically the repricing gap between assets and liabilities.',
    gated: true,
  },
  {
    id: 'mcq8',
    chapter: 'ch10',
    question:
      'The Steinhoff accounting fraud involved senior executives manipulating financial statements over many years without detection by internal governance structures. This BEST illustrates a failure of:',
    options: [
      'Market risk management',
      'Credit risk assessment',
      'Risk culture — the gap between stated values and actual behaviour',
      'ISO 31000 risk identification process',
    ],
    correct: 2,
    explanation:
      'Steinhoff is the definitive South African case study for risk culture failure. The organisation had published values centred on integrity, yet its actual culture tolerated and enabled large-scale financial fraud at executive level. This is the gap between stated values and lived behaviour — a core concept in Chapter 10. Governance structures (audit committee, board) failed to surface the risk because the culture made disclosure impossible.',
    gated: true,
  },
  {
    id: 'mcq9',
    chapter: 'ch3',
    question:
      'Which risk should be considered the highest priority on a risk heat map (risk matrix), based on COSO ERM? The four risks and their scores are: AI-generated fraud (L:9 × I:7 = 63); Physical damage due to floods (L:7 × I:8 = 56); Regulatory non-compliance fines (L:6 × I:6 = 36); Supply chain disruption (L:6 × I:5 = 30).',
    options: [
      'Supply chain disruption',
      'Physical company damage due to floods',
      'AI-generated fraud',
      'Regulatory non-compliance fines',
    ],
    correct: 2,
    explanation:
      'On a COSO ERM risk heat map, priority is determined by Likelihood × Impact score. AI-generated fraud scores highest (9 × 7 = 63), placing it in the upper-right critical zone. Physical flood damage scores 56, regulatory fines 36, and supply chain disruption 30. Risks in the upper-right quadrant of the heat map require immediate management attention and priority risk response under COSO ERM.',
    gated: false,
  },
  {
    id: 'mcq10',
    chapter: 'ch3',
    question:
      'According to COSO ERM, "Identifies Risk" — Principle 10 — is part of which component?',
    options: [
      'Review & Revision',
      'Governance and Culture',
      'Strategy & Objective-Setting',
      'Information, Communication & Reporting',
      'Performance',
    ],
    correct: 4,
    explanation:
      'Principle 10 ("Identifies Risk") is part of the Performance component. The Performance component contains Principles 10–12 (Identifies Risk, Analyses Risk, Responds to Risk) — the operational core where the organisation actively scans for risks, assesses likelihood and impact, and implements responses. Governance & Culture (Principles 1–3) sets the foundation; Strategy & Objective-Setting (Principles 4–6) links ERM to direction.',
    gated: false,
  },
  {
    id: 'mcq11',
    chapter: 'ch3',
    question:
      'If an insurer wanted to simulate thousands of possible financial outcomes based on probability distributions for each risk, which method should be used?',
    options: [
      'Scenario analysis',
      'Delphi method',
      'Interviews',
      'Monte Carlo simulation',
    ],
    correct: 3,
    explanation:
      'Monte Carlo simulation is the method for generating thousands of possible outcomes by randomly sampling from probability distributions for each risk variable. It produces a distribution of outcomes (expected value, worst-case tail risk, confidence intervals). Scenario analysis examines only 3–5 discrete future states. The Delphi method builds expert consensus for risk identification. Interviews gather qualitative insight. Monte Carlo aligns with Principle 11 (Analyses Risk) under the COSO ERM Performance component.',
    gated: false,
  },
  {
    id: 'mcq12',
    chapter: 'ch2',
    question:
      'What is the BEST risk response for regulatory non-compliance fines — a risk with a moderate-to-high likelihood (6) and moderate-to-high impact (6)?',
    options: [
      'Mitigate — improve compliance training and auditing procedures',
      'Avoid — exit all highly regulated markets',
      'Accept — fines are rare and small',
      'None of the above',
    ],
    correct: 0,
    explanation:
      'Mitigation is the best response. Improving compliance training and internal auditing directly reduces both the likelihood of violations and the severity of outcomes. Avoidance (exiting regulated markets) is operationally impossible for an insurer. Acceptance is inappropriate — the risk ratings (L:6, I:6) indicate a material risk that cannot simply be retained without controls. Mitigation aligns with COSO ERM Principle 12 (Responds to Risk) under the Performance component.',
    gated: false,
  },
]

export interface Flashcard {
  id: string
  chapter: string
  front: string
  back: string
  gated: boolean
}

export const FLASHCARDS: Flashcard[] = [
  { id: 'fc1', chapter: 'ch1', front: 'Risk appetite', back: 'The amount and type of risk an organisation is willing to accept in pursuit of its strategic objectives. Set by the board.', gated: false },
  { id: 'fc2', chapter: 'ch1', front: 'Risk tolerance', back: 'The acceptable variation in outcomes relative to the risk appetite. The operational boundary within which management can work.', gated: false },
  { id: 'fc3', chapter: 'ch1', front: 'Systematic risk', back: 'Risk that affects the entire market and cannot be eliminated through diversification. Also called market risk. Measured by beta (β).', gated: false },
  { id: 'fc4', chapter: 'ch1', front: 'Unsystematic risk', back: 'Risk specific to a single company or industry. Can be reduced through portfolio diversification. Also called idiosyncratic or specific risk.', gated: false },
  { id: 'fc5', chapter: 'ch2', front: 'Risk avoidance', back: 'Deciding not to engage in an activity that generates a risk. Eliminates the risk entirely but also eliminates the potential opportunity.', gated: false },
  { id: 'fc6', chapter: 'ch2', front: 'Risk transfer', back: 'Shifting the financial consequence of a risk to a third party. Insurance is the primary mechanism. The risk event still occurs; only the financial impact is transferred.', gated: true },
  { id: 'fc7', chapter: 'ch3', front: 'COSO ERM (2017)', back: 'Five-component enterprise risk management framework: Governance and culture; Strategy and objective-setting; Performance; Review and revision; Information, communication, and reporting.', gated: true },
  { id: 'fc8', chapter: 'ch4', front: 'King IV — apply and explain', back: "King IV requires organisations to apply all governance principles AND explain HOW they apply them. Replaced King III's 'apply or explain' compliance standard.", gated: true },
  { id: 'fc9', chapter: 'ch4', front: 'Cadbury Report (1992)', back: 'UK governance report that established: separation of CEO and Chairman roles, independent non-executive directors, audit committee requirements, and director remuneration transparency. The origin of modern governance reform.', gated: true },
  { id: 'fc10', chapter: 'ch6', front: 'Credit risk', back: 'Risk of loss from a counterparty failing to meet its contractual obligations. Types: default risk, downgrade risk, concentration risk, settlement risk.', gated: true },
  { id: 'fc11', chapter: 'ch7', front: 'Funding liquidity risk', back: 'Risk that a firm cannot meet its payment obligations as they fall due without incurring unacceptable losses. Distinct from market liquidity risk.', gated: true },
  { id: 'fc12', chapter: 'ch7', front: 'Market liquidity risk', back: 'Risk that a position cannot be unwound at or near its fair value due to insufficient market depth or disruption.', gated: true },
  { id: 'fc13', chapter: 'ch8', front: 'Transaction risk', back: 'Exchange rate risk arising from a specific foreign currency transaction where the rate moves adversely between trade date and settlement date.', gated: true },
  { id: 'fc14', chapter: 'ch8', front: 'Value-at-Risk (VaR)', back: 'A statistical measure of the maximum expected loss over a given time horizon at a specified confidence level. E.g., a 1-day 99% VaR of R1m means a 1% probability of losing more than R1m in one day.', gated: true },
  { id: 'fc15', chapter: 'ch9', front: 'Operational risk (Basel definition)', back: 'Risk of loss resulting from inadequate or failed internal processes, people, and systems, or from external events. Includes legal risk but excludes strategic and reputational risk.', gated: true },
  { id: 'fc16', chapter: 'ch10', front: 'Risk culture', back: 'The shared values, beliefs, knowledge, attitudes, and understanding about risk that shape individual and group behaviour within an organisation. Distinct from stated organisational values — culture is what people actually do.', gated: true },
]

export interface CaseStudyQuestion {
  q: string
  marks: number
}

export interface CaseStudy {
  id: string
  title: string
  company: string
  riskClass: RiskClass
  scenario: string
  questions: CaseStudyQuestion[]
  modelAnswer: string
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'cs1',
    title: 'Steinhoff International — Risk Culture Collapse',
    company: 'Steinhoff International Holdings',
    riskClass: 'STRATEGIC',
    scenario:
      "Steinhoff International, a JSE- and Frankfurt-listed retail conglomerate, revealed in December 2017 that it had engaged in large-scale accounting irregularities spanning multiple years. Executive-level manipulation inflated assets and income across multiple jurisdictions. The audit committee and board, despite their stated governance structures, failed to identify or escalate the risk. Steinhoff's published values included commitments to integrity and transparency. Its risk appetite statement had been approved by the board. The company had received unqualified audit opinions for years prior to the disclosure.",
    questions: [
      { q: 'Identify and explain the PRIMARY risk governance failure in the Steinhoff scenario.', marks: 8 },
      { q: 'Explain the difference between risk culture and organisational values using Steinhoff as an example.', marks: 6 },
      { q: 'Using the COSO ERM 2017 framework, identify which component failed most critically. Justify your answer.', marks: 6 },
    ],
    modelAnswer:
      "PRIMARY FAILURE — Governance and risk culture failure:\nThe primary failure was a fundamental breakdown in risk culture. Steinhoff's board had approved risk frameworks, values, and audit processes — yet none of these structures surfaced or escalated the fraud. This is a textbook example of the gap between stated values and lived organisational behaviour.\n\nRISK CULTURE vs VALUES:\nOrganisational values are what an entity claims to stand for. Risk culture is how risk is actually perceived, discussed, and acted upon in practice. Steinhoff claimed integrity as a core value. Its actual culture enabled executive-level fraud over years without internal escalation. The two diverged entirely.\n\nCOSO ERM COMPONENT FAILURE:\nThe 'Governance and culture' component failed most critically. This component requires the governing body (board) to oversee the risk function, set the tone from the top, and ensure management accountability. The Steinhoff board failed to exercise effective oversight, and the tone from the top actively undermined risk disclosure. All other components depended on this foundation — once governance culture failed, performance monitoring, review, and information flows were compromised.",
  },
  {
    id: 'cs2',
    title: 'General Motors — Operational Risk and Recall Failure',
    company: 'General Motors',
    riskClass: 'OPERATIONAL',
    scenario:
      'General Motors (GM) faced a major crisis in 2014 when it was revealed that the company had known about a defective ignition switch in its Cobalt and other models since at least 2001. The defect was linked to at least 124 deaths. GM had documented the defect internally but failed to escalate it to regulators or initiate a recall. The cost of fixing the switch per vehicle was approximately $0.57. The total recall and settlement cost eventually exceeded $2.5 billion. Internal investigation revealed a "GM nod" culture — a meeting practice where decisions were implied but never formally made or recorded, ensuring no individual was accountable.',
    questions: [
      { q: 'Using the Basel classification system, identify the operational risk category that PRIMARILY applies to the GM ignition switch failure. Justify your answer.', marks: 6 },
      { q: 'Explain how the "GM nod" culture contributed to a risk management process failure. Reference the ISO 31000 process in your answer.', marks: 8 },
      { q: 'What risk response strategy should GM have applied when the defect was first documented internally in 2001? Motivate your choice.', marks: 6 },
    ],
    modelAnswer:
      "OPERATIONAL RISK CATEGORY:\nThe primary Basel operational risk category is 'Clients, products, and business practices' — specifically the subcategory of product defects and failures that harm customers. Secondary categories include 'Execution, delivery, and process management' (the failure to execute the recall process) and internal process failures that prevented escalation.\n\nISO 31000 PROCESS FAILURE:\nThe GM case illustrates a failure at the 'risk identification' and 'risk evaluation' stages of ISO 31000. The risk was identified (documented internally) but was not properly assessed or escalated. The communication and consultation requirement — which mandates that risk information flows to relevant stakeholders — was entirely absent. The recall decision should have triggered escalation to senior management, the board, and regulators under any functioning risk process.\n\nRISK RESPONSE:\nGM should have applied risk REDUCTION (mitigation) immediately — a product recall to fix or replace the defective switch at $0.57 per vehicle. This was a bounded, manageable cost. The alternative — acceptance without control — was inappropriate given the direct safety-of-life impact. ISO 31000 explicitly requires that risk treatment options be evaluated against criteria that include legal, regulatory, and ethical obligations. A known product safety risk cannot be rationally 'accepted' at the cost of human life.",
  },
  {
    id: 'cs3',
    title: 'Satyam Computer Services — Corporate Governance Breakdown',
    company: 'Satyam Computer Services (India)',
    riskClass: 'COMPLIANCE',
    scenario:
      "Satyam Computer Services, once India's fourth-largest IT company, revealed in January 2009 that its founder and chairman, Ramalinga Raju, had been falsifying accounts for years. The fraud included inflating cash balances by over $1 billion and fabricating revenue figures. The board of directors had approved a proposed acquisition that would have funnelled company funds to entities controlled by Raju's family — before facing shareholder backlash. The audit committee had received and approved falsified financial statements. Independent directors, including a Harvard professor and a former cabinet minister, failed to detect or challenge the misrepresentation.",
    questions: [
      { q: 'Apply the Cadbury Report principles to identify which governance mechanisms failed in the Satyam case.', marks: 8 },
      { q: "Using King IV's 'apply and explain' approach, evaluate how Satyam's board failed to meet its risk governance obligations.", marks: 6 },
      { q: 'Identify two specific risk response strategies that Satyam\'s independent directors should have employed and explain their application.', marks: 6 },
    ],
    modelAnswer:
      "CADBURY PRINCIPLES FAILURE:\n1. Independent non-executive directors — Satyam's independent directors failed their primary function: providing objective oversight and challenge. The presence of high-profile directors without genuine independence in practice illustrates that governance form does not guarantee governance substance.\n2. Audit committee — the committee received and approved falsified statements without adequate independent verification. Cadbury's audit committee requirement assumes that committee members will apply professional scepticism to management-prepared information.\n3. Chairman/CEO separation — while Satyam had this separation on paper, the founder's dominance over the board meant the practical effect was undermined.\n\nKING IV FAILURE:\nKing IV requires governing bodies to 'apply and explain' — to demonstrate, not merely declare, how governance principles are implemented. The Satyam board applied governance structures superficially (committees, independence policies, approved frameworks) but failed to explain or demonstrate HOW these structures produced genuine oversight. Under King IV, the board is accountable for risk governance outcomes, not merely for having governance structures in place.\n\nRISK RESPONSE STRATEGIES FOR INDEPENDENT DIRECTORS:\n1. Risk escalation (a sub-mechanism of the monitoring stage in ISO 31000) — upon identifying material inconsistencies in the proposed acquisition, independent directors should have escalated to the full board and external auditors, demanding independent due diligence.\n2. Risk transfer to regulatory bodies — reporting the suspected fraud to the Securities and Exchange Board of India (SEBI) would have transferred the investigative and enforcement function to the regulator. Independent directors have a fiduciary obligation to act when they have reasonable grounds to suspect fraud.",
  },
]
