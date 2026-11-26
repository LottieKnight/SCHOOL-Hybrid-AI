export type FeatureItem = {
  label: string;
  href: string;
  description: string;
  badge?: string;
};

export type FeatureGroup = {
  key: string;
  label: string;
  description: string;
  features: FeatureItem[];
};

function getPastPapersHref(classId: string) {
  const encodedClassId = encodeURIComponent(classId);
  return `/classes/${encodedClassId}/past-papers`;
}

export function resolveClassId(pathname: string) {
  const match = pathname.match(/\/classes\/([^/]+)/);
  const value = match ? match[1] : "";
  if (!value || value === "undefined" || value === "null") {
    return "demo-class";
  }
  return value;
}

export function getFeatureGroups(classId = "demo-class"): FeatureGroup[] {
  const pastPapersHref = getPastPapersHref(classId);

  return [
    {
      key: "learning",
      label: "Learning",
      description: "Curriculum paths, AI coaching, and guided study tools for every grade and phase.",
      features: [
        {
          label: "Grade School Lessons",
          href: "/learn",
          description: "Browse CAPS-aligned lessons by phase, grade, subject, term, and week.",
          badge: "Core",
        },
        {
          label: "University Modules",
          href: "/university/learning",
          description: "University module study surfaces, community rooms, and AI-assisted learning.",
          badge: "University",
        },
        {
          label: "Hybrid tutor",
          href: "/tutor",
          description: "Ask anything. The assistant knows your institution, modules, and academic period.",
          badge: "Live",
        },
        {
          label: "Study Progress",
          href: "/dashboard/progress",
          description: "Track your learning signals, streaks, and study checkpoints over time.",
        },
      ],
    },
    {
      key: "practice",
      label: "Exam Prep",
      description: "Past papers, textbooks, and daily practice to get you ready for any assessment.",
      features: [
        {
          label: "Past Papers",
          href: pastPapersHref,
          description: "Every official past paper by province, grade, and subject. Free to browse.",
          badge: "Exam prep",
        },
        {
          label: "Daily Quiz",
          href: "/daily-quiz",
          description: "One targeted quiz a day. Focuses on your weakest areas and tracks your streak.",
          badge: "Quiz",
        },
        {
          label: "Textbooks",
          href: "/textbooks",
          description: "Open textbooks and supplementary study resources, institution-scoped.",
        },
        {
          label: "Library",
          href: "/library",
          description: "Articles, books, journals, publications, past papers, and video lessons — organised by type and grade band.",
          badge: "New",
        },
      ],
    },
    {
      key: "professional",
      label: "Professional Qualifications",
      description: "Prepare for industry-recognized certifications and regulatory exams.",
      features: [
        {
          label: "RE1 Exam Prep",
          href: "/learn/re1",
          description: "Study materials and practice exams for Regulatory Examination 1",
          badge: "Financial Services",
        },
        {
          label: "RE5 Exam Prep",
          href: "/learn/re5",
          description: "Study materials and practice exams for Regulatory Examination 5",
          badge: "Financial Services",
        },
      ],
    },
    {
      key: "community",
      label: "Community & Campus",
      description: "Module rooms, tutors, messages, and games — campus life on the platform.",
      features: [
        {
          label: "Ask the Campus",
          href: "/community",
          description: "Post questions in your module room and get answers from classmates.",
          badge: "Live",
        },
        {
          label: "Games Center",
          href: "/community/games",
          description: "BRAZIL text adventure is live. Exam Dash and Question Pool coming soon.",
          badge: "New",
        },
        {
          label: "SCHOOL Press",
          href: "/press",
          description: "Publish papers, essays, poetry, and design work. Open-access scholarly publishing.",
          badge: "New",
        },
        {
          label: "Bursary Finder",
          href: "/bursary",
          description: "Discover and track bursary opportunities matched to your profile.",
        },
        {
          label: "Find a Tutor",
          href: "/tutors",
          description: "Book a one-on-one session with a verified tutor in your subject.",
        },
        {
          label: "Messages",
          href: "/messages",
          description: "Direct messages and conversation threads with tutors and classmates.",
        },
      ],
    },
    {
      key: "commerce",
      label: "Marketplace",
      description: "The campus economy — every store, one shelf. Books, equipment, branded clothing, and your Scholar Credits wallet.",
      features: [
        {
          label: "Marketplace",
          href: "/marketplace",
          description: "Browse every SCHOOL store from a single shelf of vendors.",
          badge: "Hub",
        },
        {
          label: "Bookstore",
          href: "/bookstore",
          description: "Browse and buy textbooks and study materials.",
        },
        {
          label: "Equipment",
          href: "/store/equipment",
          description: "Scientific calculators, stationery, and study equipment.",
        },
        {
          label: "Cart",
          href: "/cart",
          description: "Review lines across every store before you check out.",
        },
        {
          label: "Wallet",
          href: "/wallet",
          description: "Top up Scholar Credits and track your balance.",
        },
        {
          label: "Orders",
          href: "/orders",
          description: "Track all past and current orders in one place.",
        },
      ],
    },
  ];
}

export function getSidebarFeatureGroups(classId = "demo-class"): FeatureGroup[] {
  const pastPapersHref = getPastPapersHref(classId);

  return [
    {
      key: "learning",
      label: "Learning",
      description: "Daily study routes, assistant support, textbooks, and curriculum entry points.",
      features: [
        {
          label: "Learn",
          href: "/learn",
          description: "Browse phases, grades, subjects, terms, and weeks.",
          badge: "Core",
        },
        {
          label: "Hybrid tutor",
          href: "/tutor",
          description: "Paste notes or ask a question for explanations, summaries, and quiz help.",
          badge: "MVP",
        },
        {
          label: "Progress",
          href: "/dashboard/progress",
          description: "Review learner progress signals and study checkpoints.",
        },
        {
          label: "Textbooks",
          href: "/textbooks",
          description: "Open textbook resources and supporting study material.",
        },
      ],
    },
    {
      key: "practice",
      label: "Practice",
      description: "Exam-prep routes and assessment tools.",
      features: [
        {
          label: "Past Papers",
          href: pastPapersHref,
          description: "Browse exam papers by province, grade, subject, and year.",
          badge: "Exam prep",
        },
        {
          label: "Library",
          href: "/library",
          description: "Articles, books, journals, publications, past papers, and video lessons.",
          badge: "New",
        },
      ],
    },
    {
      key: "community",
      label: "Community",
      description: "Messaging, tutoring, and support features for learners and tutors.",
      features: [
        {
          label: "Messages",
          href: "/messages",
          description: "Open direct messages, channels, and conversation threads.",
        },
        {
          label: "SCHOOL Press",
          href: "/press",
          description: "Publish papers, essays, poetry, and visual work. Open-access scholarly publishing.",
          badge: "New",
        },
        {
          label: "Bursary Finder",
          href: "/bursary",
          description: "Discover bursary opportunities matched to your profile.",
        },
        {
          label: "Tutors",
          href: "/tutors",
          description: "Browse tutor profiles and learner support options.",
        },
        {
          label: "Tutor Dashboard",
          href: "/tutors/dashboard",
          description: "Manage tutoring work, activity, and upcoming tasks.",
          badge: "Tutor",
        },
        {
          label: "Tutor Sessions",
          href: "/tutors/sessions",
          description: "View tutoring session flow and booking state.",
          badge: "Tutor",
        },
        {
          label: "Tutor Onboarding",
          href: "/tutors/onboarding",
          description: "Start or continue the tutor setup flow.",
          badge: "Tutor",
        },
      ],
    },
    {
      key: "commerce",
      label: "Marketplace",
      description: "Shopping, payment, order, and storefront routes.",
      features: [
        {
          label: "Bookstore",
          href: "/bookstore",
          description: "Browse books and product detail pages.",
        },
        {
          label: "Becoming El Matador",
          href: "/book/becoming-el-matador",
          description: "Free financial-literacy & AI-trading book by Moloti Ditshego.",
          badge: "Free",
        },
        {
          label: "Sellers",
          href: "/sellers",
          description: "Verified youth, family & SME sellers on the SCHOOL marketplace.",
          badge: "New",
        },
        {
          label: "AquaQuick",
          href: "/store/aquaquick",
          description: "Water tanks, purifiers and dispensers by Khuliso.",
        },
        {
          label: "iPhone Store",
          href: "/store/iphone",
          description: "Certified new and pre-owned iPhones.",
        },
        {
          label: "Equipment",
          href: "/store/equipment",
          description: "Open the equipment catalogue and item pages.",
        },
        {
          label: "Clothing",
          href: "/store/clothing",
          description: "Browse branded clothing and apparel entries.",
        },
        {
          label: "Cart",
          href: "/cart",
          description: "Review the current basket before paying.",
        },
        {
          label: "Checkout",
          href: "/checkout",
          description: "Confirm payment and delivery for the current basket.",        },
        {
          label: "Orders",
          href: "/orders",
          description: "Track completed and in-flight orders.",
        },
        {
          label: "Wallet",
          href: "/wallet",
          description: "See wallet balance, pricing, and credits.",
        },
        {
          label: "Commerce Stream",
          href: "/streams/commerce",
          description: "Open the commerce showcase and stream view.",
        },
      ],
    },
    {
      key: "account",
      label: "Account",
      description: "Profile, preferences, and personal platform controls.",
      features: [
        {
          label: "Settings",
          href: "/settings",
          description: "Adjust personal preferences and profile configuration.",
        },
      ],
    },
  ];
}

export function getAdminFeatureItems(): FeatureItem[] {
  return [
    {
      label: "Admin Dashboard",
      href: "/admin",
      description: "Open the main admin overview and control surface.",
      badge: "Admin",
    },
    {
      label: "Generate Lessons",
      href: "/admin/generate",
      description: "Run curriculum generation and publishing actions.",
    },
    {
      label: "Content Mapping",
      href: "/admin/content-mapping",
      description: "Map content structure to curriculum targets.",
    },
    {
      label: "Resolve Subjects",
      href: "/admin/resolve-subjects",
      description: "Fix and reconcile subject mapping issues.",
    },
    {
      label: "Content Index",
      href: "/admin/content-index",
      description: "Review the indexed curriculum and lesson assets.",
    },
    {
      label: "Past Paper Diagnostics",
      href: "/admin/diagnostics/past-papers",
      description: "Inspect past-paper import and diagnostic status.",
    },
    {
      label: "Learning Analytics",
      href: "/admin/learning-analytics",
      description: "Inspect learner engagement and content performance.",
    },
    {
      label: "Impact Scorecard",
      href: "/admin/impact",
      description: "Review platform impact tracking and reporting.",
    },
    {
      label: "Funnel Metrics",
      href: "/admin/metrics",
      description: "Monitor growth, conversion, and funnel health.",
    },
    {
      label: "Monetisation",
      href: "/admin/monetisation",
      description: "Check pricing and revenue-related controls.",
    },
    {
      label: "Wallet Health",
      href: "/admin/wallet-health",
      description: "Inspect wallet balances, liabilities, and health checks.",
    },
    {
      label: "Message Moderation",
      href: "/admin/messages",
      description: "Moderate messaging activity and reported content.",
    },
    {
      label: "Equipment Admin",
      href: "/admin/equipment",
      description: "Manage equipment inventory and catalogue state.",
    },
    {
      label: "Equipment Quotes",
      href: "/admin/equipment/quotes",
      description: "Review and process equipment quote requests.",
    },
    {
      label: "Bookstore Admin",
      href: "/admin/bookstore",
      description: "Manage bookstore inventory and product operations.",
    },
    {
      label: "Library Admin",
      href: "/admin/library",
      description: "Manage library resources: articles, books, journals, publications, and video lessons.",
    },
    {
      label: "University Generator",
      href: "/admin/university",
      description: "Generate AI-authored undergraduate study content for any institution module.",
    },
    {
      label: "BrandOS",
      href: "/admin/brand",
      description: "Open brand automation and social content tooling.",
    },
    {
      label: "Tutor Disputes",
      href: "/admin/tutor-disputes",
      description: "Resolve tutor-session disputes and escalations.",
    },
  ];
}

export function getDockFeatures(classId = "demo-class"): FeatureItem[] {
  return getFeatureGroups(classId).flatMap((group) => group.features);
}
