export const seedLanguages = [
  { id: '11111111-1111-1111-1111-111111111111', code: 'en', name: 'English' },
  { id: '22222222-2222-2222-2222-222222222222', code: 'zu', name: 'isiZulu' },
  { id: '33333333-3333-3333-3333-333333333333', code: 'tn', name: 'Setswana' },
] as const;

type SeedGlossaryTerm = {
  id: string;
  canonicalTerm: string;
  subjectCode?: string;
  moduleCode?: string;
  domain: string;
  plainDefinition: string;
  academicDefinition: string;
};

export const seedGlossaryTerms: readonly SeedGlossaryTerm[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    canonicalTerm: 'opportunity cost',
    subjectCode: 'ECON211',
    moduleCode: 'ECON211',
    domain: 'economics',
    plainDefinition: 'What you give up when you choose one option instead of another.',
    academicDefinition:
      'Opportunity cost refers to the value of the next best alternative forgone when a decision is made.',
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    canonicalTerm: 'gross domestic product',
    subjectCode: 'ECON211',
    moduleCode: 'ECON211',
    domain: 'economics',
    plainDefinition: 'The total value of goods and services produced in an economy over a period.',
    academicDefinition:
      'Gross domestic product is the aggregate monetary value of final goods and services produced within an economy during a specified period.',
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    canonicalTerm: 'inflation',
    subjectCode: 'ECON211',
    moduleCode: 'ECON211',
    domain: 'economics',
    plainDefinition: 'A general rise in prices over time.',
    academicDefinition:
      'Inflation is the sustained increase in the general price level of goods and services over time.',
  },
  {
    id: '70000000-0000-0000-0000-000000000004',
    canonicalTerm: 'repo rate',
    subjectCode: 'ECON211',
    moduleCode: 'ECON211',
    domain: 'economics',
    plainDefinition: 'The interest rate the central bank uses as a key policy tool.',
    academicDefinition:
      'The repo rate is the policy interest rate through which the South African Reserve Bank influences monetary conditions.',
  },
  {
    id: '70000000-0000-0000-0000-000000000005',
    canonicalTerm: 'is-lm model',
    subjectCode: 'ECON211',
    moduleCode: 'ECON211',
    domain: 'economics',
    plainDefinition: 'A model showing equilibrium in the goods market and money market together.',
    academicDefinition:
      'The IS-LM framework models simultaneous equilibrium in the goods market and money market through the interaction of income and interest rates.',
  },
  {
    id: '70000000-0000-0000-0000-000000000006',
    canonicalTerm: 'financial hold',
    domain: 'student-services',
    plainDefinition:
      'A block on your account that can stop registration or access to results until an issue is resolved.',
    academicDefinition:
      'A financial hold is an administrative restriction placed on a student account due to unresolved financial obligations or related compliance issues.',
  },
  {
    id: '70000000-0000-0000-0000-000000000007',
    canonicalTerm: 'nsfas',
    domain: 'student-services',
    plainDefinition: "South Africa's National Student Financial Aid Scheme that supports eligible students.",
    academicDefinition:
      'NSFAS is a public student funding mechanism providing financial assistance to qualifying students in higher education.',
  },
  {
    id: '70000000-0000-0000-0000-000000000008',
    canonicalTerm: 'efundi',
    domain: 'student-services',
    plainDefinition: 'NWU’s learning management system for course materials and class activity.',
    academicDefinition:
      'eFundi is North-West University’s learning management environment used for course communication, materials, and related academic workflows.',
  },
  {
    id: '70000000-0000-0000-0000-000000000009',
    canonicalTerm: 'school',
    domain: 'education-platform',
    plainDefinition: 'An AI-native education platform being built for South African students.',
    academicDefinition:
      'SCHOOL is a student-centered academic operating system designed to support learning, navigation, and study workflows.',
  },
  {
    id: '70000000-0000-0000-0000-000000000010',
    canonicalTerm: 'ithuba elilahlekile',
    domain: 'economics',
    plainDefinition: 'isiZulu translation for Opportunity Cost: Lokho okudlayo noma okuyekayo uma ukhetha okunye.',
    academicDefinition:
      'Ithuba elilahlekile (Opportunity Cost) libhekisela enanini lempahla noma yethemba elilandelayo elingcono eliyekwayo lapho kwenziwa isinqumo sezomnotho.',
  },
  {
    id: '70000000-0000-0000-0000-000000000011',
    canonicalTerm: 'studeerbeurs',
    domain: 'student-services',
    plainDefinition: 'Afrikaans for Bursary: Finansiële ondersteuning vir studente wat kwalifiseer.',
    academicDefinition:
      "'n Studeerbeurs is 'n finansiële toekenning wat aan studente gebied word om hul tersiêre studiefooie en lewenskoste te dek.",
  },
  {
    id: '70000000-0000-0000-0000-000000000012',
    canonicalTerm: 'morutwana',
    domain: 'student-services',
    plainDefinition: 'Sepedi/Setswana for Student/Learner: Motho yo a ithutago sekolong goba yunibesiting.',
    academicDefinition:
      'Morutwana ke moithuti yo a ingwadišitšego ka lefelong la thuto go tšwelopele ka dinomoro tša gagwe tša thuto.',
  },
] as const;

export const seedCorrectionCandidates = [
  { incorrectForm: 'pls', correctedForm: 'please', correctionType: 'slang-normalization' },
  { incorrectForm: 'u', correctedForm: 'you', correctionType: 'slang-normalization' },
  { incorrectForm: 'wat', correctedForm: 'what', correctionType: 'typo' },
  { incorrectForm: 'oppertunity', correctedForm: 'opportunity', correctionType: 'typo' },
  { incorrectForm: 'infaltion', correctedForm: 'inflation', correctionType: 'typo' },
  { incorrectForm: 'efundi', correctedForm: 'eFundi', correctionType: 'normalization' },
  { incorrectForm: 'nsfas', correctedForm: 'NSFAS', correctionType: 'normalization' },
  { incorrectForm: 'studentportal', correctedForm: 'Student Portal', correctionType: 'spacing' },
  { incorrectForm: 'nwu', correctedForm: 'North-West University', correctionType: 'normalization' },
  { incorrectForm: 'econ 211', correctedForm: 'ECON211', correctionType: 'spacing' },
] as const;

export const seedKnowledgeSnippets = [
  {
    title: 'ECON211 Core Concepts',
    sourceType: 'glossary',
    moduleCode: 'ECON211',
    domain: 'economics',
    text: 'Opportunity cost is what you give up when choosing one option over another. GDP measures output. Inflation measures sustained price increases. The repo rate is a key SARB policy tool.',
  },
  {
    title: 'NWU Student Services Core Terms',
    sourceType: 'admin-doc',
    domain: 'student-services',
    text: 'Common student-services issues include NSFAS queries, financial holds, Student Portal access, and eFundi support.',
  },
  {
    title: 'SCHOOL Platform Core Terms',
    sourceType: 'glossary',
    domain: 'education-platform',
    text: 'SCHOOL is an AI-native education platform designed to help South African students study, search, and write with confidence.',
  },
] as const;
