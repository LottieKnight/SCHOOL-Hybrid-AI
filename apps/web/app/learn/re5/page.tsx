import Link from "next/link";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RE5 Exam Preparation - SCHOOL",
  description: "Prepare for Regulatory Examination 5 (RE5) with SCHOOL's comprehensive study materials, practice exams, and expert guidance for specialist financial advice.",
};

export default function RE5PrepPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Header */}
      <header className="border-b pb-0 border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center space-x-3">
              <SchoolLogo className="h-8 w-8" />
              <h1 className="text-2xl font-semibold tracking-tighter">
                RE5 Exam Preparation
              </h1>
            </div>
            <nav className="hidden sm:flex space-x-6 text-sm font-medium text-gray-600 hover:text-gray-900">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/learn/professional" className="hover:underline">
                Professional Qualifications
              </Link>
              <Link href="/learn" className="hover:underline">
                Learning Paths
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tighter mb-6">
            Master the RE5 Examination
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Specialist qualification for providing investment advice and 
            intermediary services in South Africa's financial sector.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#overview" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Course Overview
            </a>
            <a href="#specialisations" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Specialist Areas
            </a>
            <a href="#study-materials" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Study Materials
            </a>
            <a href="#practice" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Practice & Assessment
            </a>
          </div>
        </div>
      </section>

      {/* Why RE5 Matters */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why the RE5 Certification is Essential for Financial Advice
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">📋</span>
                <span>Specialist Qualification</span>
              </h3>
              <p className="text-gray-600">
                RE5 is required for individuals wishing to furnish advice 
                and intermediary services related to investment products 
                under the FAIS Act.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">💰</span>
                <span>Higher Earning Potential</span>
              </h3>
              <p className="text-gray-600">
                RE5 specialists typically command higher salaries due to 
                their specialised knowledge in investment products and 
                markets.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🛡️</span>
                <span>Professional Credibility</span>
              </h3>
              <p className="text-gray-600">
                Holding RE5 demonstrates to clients and employers that you 
                have the expertise to provide suitable investment advice 
                and manage client portfolios responsibly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Overview */}
      <section id="overview" className="py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            RE5 Curriculum Overview
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Comprehensive coverage of the regulatory environment for investment 
            advice, product knowledge, and suitability requirements.
          </p>
          
          <div className="space-y-12">
            {/* Core Modules */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Core Study Modules
              </h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">RE1 Foundations</h4>
                  <p className="text-gray-600">
                    Review of the FAIS Act, regulatory bodies, licensing 
                    requirements, and general compliance obligations 
                    (assumed knowledge for RE5).
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Investment Products & Markets</h4>
                  <p className="text-gray-600">
                    Detailed study of equities, bonds, money market 
                    instruments, derivatives, collective investment 
                    schemes, and structured products.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Portfolio Construction & Management</h4>
                  <p className="text-gray-600">
                    Principles of diversification, asset allocation, 
                    risk profiling, and ongoing portfolio management 
                    based on client objectives and risk tolerance.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Financial Planning & Advice Process</h4>
                  <p className="text-gray-600">
                    The six-step financial planning process, gathering 
                    client information, analysing needs, developing 
                    recommendations, implementing strategies, and 
                    reviewing progress.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Ethics & Professional Conduct</h4>
                  <p className="text-gray-600">
                    FSPA code of conduct, treating customers fairly (TCF), 
                    suitability requirements, disclosure obligations, 
                    and managing conflicts of interest in advice situations.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Regulatory Environment</h4>
                  <p className="text-gray-600">
                    Collective Investment Schemes Control Act, Financial 
                    Markets Act, and other legislation governing 
                    investment products and advice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialist Areas */}
      <section id="specialisations" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            RE5 Specialist Areas
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Choose your area of specialisation based on the investment 
            products you wish to advise on.
          </p>
          
          <div className="space-y-12">
            {/* Specialist Categories */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Available Specialist Categories
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Securities & Instruments</h4>
                  <p className="text-gray-600">
                    Equities, bonds, money market instruments, derivatives, 
                    and structured products traded on regulated exchanges.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Investment Products</h4>
                  <p className="text-gray-600">
                    Collective investment schemes (unit trusts, ETFs, 
                    hedge funds), linked investment products, and 
                    retirement annuities.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Retirement Funding</h4>
                  <p className="text-gray-600">
                    Pension funds, provident funds, retirement annuities, 
                    and other retirement funding vehicles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Study Materials */}
      <section id="study-materials" className="py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Your RE5 Study Resources
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Expertly crafted materials designed specifically for RE5 
            examination success in your chosen specialisation.
          </p>
          
          <div className="space-y-12">
            {/* Learning Path */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Structured Learning Approach
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">RE1 Knowledge Refresh</h4>
                    <p className="text-gray-600">
                      Brief review of essential RE1 concepts (regulatory 
                      environment, ethics, compliance) to ensure a solid 
                      foundation for specialist study.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Specialist Product Knowledge</h4>
                    <p className="text-gray-600">
                      In-depth study of the investment products, markets, 
                      and regulations relevant to your chosen specialisation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Advice Process Application</h4>
                    <p className="text-gray-600">
                      Applying the financial planning process to recommend 
                      suitable investment products based on client profiles.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Exam Preparation</h4>
                    <p className="text-gray-600">
                      Practice questions, mock exams, and targeted revision 
                      materials specific to your specialisation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Resource Types */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Available Learning Resources
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Video Lectures</h4>
                  <p className="text-gray-600">
                    Engaging, bite-sized video lessons (5-15 minutes each) 
                    covering key concepts with visual aids and examples.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Study Guides</h4>
                  <p className="text-gray-600">
                    Comprehensive PDF notes with summaries, key points, 
                    and quick-reference sheets for efficient review.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Practice Questions</h4>
                  <p className="text-gray-600">
                    Hundreds of exam-style questions with detailed 
                    explanations, organised by topic and difficulty level.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Mock Exams</h4>
                  <p className="text-gray-600">
                    Full-length simulated exams that mirror the actual 
                    RE5 format, timing, and question distribution for 
                    each specialisation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice & Assessment */}
      <section id="practice" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Practice & Assessment Tools
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Build confidence and identify knowledge gaps through 
            targeted practice and assessment.
          </p>
          
          <div className="space-y-12">
            {/* Assessment Methods */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Progressive Assessment Approach
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Topic Quizzes</h4>
                  <p className="text-gray-600">
                    Short, focused quizzes after each study module to 
                    validate understanding before moving forward.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Progress Tracking</h4>
                  <p className="text-gray-600">
                    Personal dashboard showing completion percentages, 
                    strengths, weaknesses, and recommended study areas.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Timed Practice</h4>
                  <p className="text-gray-600">
                    Practice exams under timed conditions to build 
                    stamina and improve time management skills.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Error Analysis</h4>
                  <p className="text-gray-600">
                    Detailed feedback on incorrect answers with references 
                    to study materials for targeted remediation.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Success Tips */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Study Strategies for Success
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Consistent Schedule</h4>
                  <p className="text-gray-600">
                    Study regularly in shorter sessions rather than 
                    cramming – consistency beats intensity for retention.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Active Recall</h4>
                  <p className="text-gray-600">
                    Test yourself frequently rather than just re-reading 
                    material – this builds stronger neural connections.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Teach Others</h4>
                  <p className="text-gray-600">
                    Explain concepts to friends or family – teaching 
                    reinforces your own understanding and reveals gaps.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Simulate Exam Conditions</h4>
                  <p className="text-gray-600">
                    Practice in a quiet environment with no distractions, 
                    using only permitted materials, exactly as in the 
                    actual exam.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Begin Your RE5 Journey?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join hundreds of financial services professionals who have 
            passed their RE5 examination with SCHOOL's preparation 
            program and are now providing specialist investment advice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#study-materials" className="flex-1 px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Access Study Materials
            </a>
            <a href="#practice" className="flex-1 px-8 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm">
              Start Practicing
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Free to start. No credit card required. Begin learning today.
          </p>
        </div>
      </section>

    </div>
  );
}