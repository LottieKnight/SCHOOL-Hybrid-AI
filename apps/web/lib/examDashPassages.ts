export type ExamDashPassage = {
  id: string;
  subject: string;
  title: string;
  text: string;
  difficulty?: 1 | 2 | 3;
};

export const EXAM_DASH_PASSAGES: ExamDashPassage[] = [
  {
    id: "econ_supply_demand",
    subject: "Economics",
    title: "Supply and Demand",
    text: "The law of demand states that as the price of a good increases, the quantity demanded decreases, ceteris paribus. The law of supply states that as the price of a good increases, the quantity supplied increases. The equilibrium price is the price at which the quantity demanded equals the quantity supplied, clearing the market of any surplus or shortage.",
    difficulty: 1,
  },
  {
    id: "econ_gdp",
    subject: "Economics",
    title: "Gross Domestic Product",
    text: "Gross domestic product measures the total monetary value of all finished goods and services produced within a country's borders in a specific time period. GDP can be calculated using the expenditure approach: GDP equals consumption plus investment plus government spending plus net exports. Real GDP adjusts nominal GDP for the effects of inflation.",
    difficulty: 2,
  },
  {
    id: "bman_management",
    subject: "Business Management",
    title: "Principles of Management",
    text: "Management is the process of planning, organising, leading, and controlling organisational resources to achieve goals effectively and efficiently. Planning involves setting objectives and determining the best course of action to achieve them. Organising allocates resources and tasks among organisational members. Leading motivates and directs employees. Controlling monitors performance and corrects deviations.",
    difficulty: 2,
  },
  {
    id: "bman_marketing",
    subject: "Business Management",
    title: "Marketing Mix",
    text: "The marketing mix consists of four key elements known as the four Ps: product, price, place, and promotion. Product refers to the goods or services offered to satisfy customer needs. Price is the amount customers pay. Place concerns the distribution channels used to deliver the product. Promotion encompasses advertising, public relations, and sales promotions used to communicate with target markets.",
    difficulty: 1,
  },
  {
    id: "acfs_financial",
    subject: "Financial Accounting",
    title: "Accounting Equation",
    text: "The fundamental accounting equation states that assets equal liabilities plus equity. Assets are resources controlled by the entity as a result of past events from which future economic benefits are expected. Liabilities represent present obligations of the entity arising from past events. Equity represents the residual interest in the assets of the entity after deducting all liabilities.",
    difficulty: 2,
  },
  {
    id: "mths_calculus",
    subject: "Mathematics",
    title: "Differential Calculus",
    text: "The derivative of a function measures the rate of change of the function with respect to its variable. The derivative of a constant is zero. The power rule states that the derivative of x raised to the power of n equals n times x raised to the power of n minus one. The chain rule is used to differentiate composite functions by multiplying the derivative of the outer function by the derivative of the inner function.",
    difficulty: 3,
  },
  {
    id: "icom_computer_science",
    subject: "Computer Science",
    title: "Algorithms and Complexity",
    text: "An algorithm is a finite sequence of well-defined instructions to solve a specific computational problem. Time complexity describes how the runtime of an algorithm grows as the input size increases. Big O notation is used to classify algorithms by their worst-case performance. An algorithm with O of n squared complexity is considered quadratic, while one with O of log n is considered logarithmic and much more efficient for large inputs.",
    difficulty: 3,
  },
  {
    id: "cmpg_programming",
    subject: "Computer Programming",
    title: "Object-Oriented Programming",
    text: "Object-oriented programming is a paradigm that organises software design around data, or objects, rather than functions and logic. A class is a blueprint for creating objects, defining their attributes and methods. Encapsulation bundles data and methods that operate on that data within a single unit. Inheritance allows a class to inherit properties and methods from a parent class. Polymorphism enables objects of different classes to be treated as instances of the same class through a common interface.",
    difficulty: 3,
  },
];

export function getDailyPassage(): ExamDashPassage {
  const today = new Date().toISOString().slice(0, 10);
  const hash = today.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return EXAM_DASH_PASSAGES[hash % EXAM_DASH_PASSAGES.length];
}

export function getRandomPassage(tier: 1 | 2 | 3 = 1): ExamDashPassage {
  const candidates = EXAM_DASH_PASSAGES.filter((p) => (p.difficulty ?? 1) === tier);
  if (candidates.length === 0) return EXAM_DASH_PASSAGES[Math.floor(Math.random() * EXAM_DASH_PASSAGES.length)];
  return candidates[Math.floor(Math.random() * candidates.length)];
}
