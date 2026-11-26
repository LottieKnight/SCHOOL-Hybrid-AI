import Link from "next/link";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SiteFooter } from "@/components/ui/SiteFooter";

export const metadata = {
  title: "RE1 Exam Preparation - SCHOOL",
  description: "Prepare for Regulatory Examination 1 (RE1) with SCHOOL's comprehensive study materials, practice exams, and expert guidance.",
};

export default function RE1PrepPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Header */}
      <header className="border-b pb-0 border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center space-x-3">
              <SchoolLogo className="h-8 w-8" />
              <h1 className="text-2xl font-semibold tracking-tighter">
                RE1 Exam Preparation
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
            Master the RE1 Examination
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Essential preparation for the foundational regulatory requirement 
            for financial services professionals in South Africa.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#overview" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Course Overview
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

      {/* Why RE1 Matters */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why the RE1 Certification is Essential
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">📋</span>
                <span>Legal Requirement</span>
              </h3>
              <p className="text-gray-600">
                RE1 is the mandatory entry-level qualification for anyone 
                wishing to render financial services in South Africa under 
                the FAIS Act.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">⚖️</span>
                <span>Foundation for Advancement</span>
              </h3>
              <p className="text-gray-600">
                RE1 provides the essential knowledge base required before 
                pursuing specialist qualifications like RE5 or other 
                regulatory exams.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🤝</span>
                <span>Client Trust & Confidence</span>
              </h3>
              <p className="text-gray-600">
                Holding RE1 demonstrates to clients and employers that you 
                understand your legal and ethical obligations as a financial 
                services provider.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Overview */}
      <section id="overview" className="py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            RE1 Curriculum Overview
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Comprehensive coverage of the regulatory environment, ethical 
            standards, and practical knowledge required for financial 
            services compliance.
          </p>
          
          <div className="space-y-12">
            {/* Core Modules */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Core Study Modules
              </h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">FAIS Act & Regulations</h4>
                  <p className="text-gray-600">
                    Detailed study of the Financial Advisory and 
                    Intermediary Services Act, including licensing 
                    requirements, representative duties, and 
                    compliance obligations.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Financial Products & Services</h4>
                  <p className="text-gray-600">
                    Understanding various financial products, their 
                    features, risks, and suitability requirements for 
                    different client profiles.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Ethical Conduct & Professionalism</h4>
                  <p className="text-gray-600">
                    FSPA code of conduct, treating customers fairly (TCF), 
                    confidentiality requirements, and managing conflicts 
                    of interest.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Risk Management</h4>
                  <p className="text-gray-600">
                    Identifying, assessing, and mitigating operational 
                    risks in financial services, including business 
                    continuity and insurance requirements.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Administrative Requirements</h4>
                  <p className="text-gray-600">
                    Record keeping, reporting obligations, disclosure 
                    requirements, and complaint handling procedures.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Legislative Framework</h4>
                  <p className="text-gray-600">
                    Overview of related acts including the National Credit 
                    Act, POPIA, and other consumer protection legislation 
                    affecting financial services.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Study Materials */}
      <section id="study-materials" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Your RE1 Study Resources
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Expertly crafted materials designed specifically for RE1 
            examination success.
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
                    <h4 className="font-medium mb-1">Concept Mastery</h4>
                    <p className="text-gray-600">
                      In-depth video lessons and reading materials covering 
                      each syllabus topic with real-world examples and 
                      case studies.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Knowledge Application</h4>
                    <p className="text-gray-600">
                      Interactive exercises, scenario-based learning, and 
                      practical assignments to reinforce understanding.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Exam Preparation</h4>
                    <p className="text-gray-600">
                      Practice questions, mock exams, and targeted revision 
                      materials with detailed explanations and feedback.
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
                    explanations, organized by topic and difficulty level.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Mock Exams</h4>
                  <p className="text-gray-600">
                    Full-length simulated exams that mirror the actual 
                    RE1 format, timing, and question distribution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice & Assessment */}
      <section id="practice" className="py-20">
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
            Ready to Begin Your RE1 Journey?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join hundreds of successful financial services professionals 
            who have passed their RE1 examination with SCHOOL's 
            preparation program.
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

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <SiteFooter />
      </footer>
    </div>
  );
}