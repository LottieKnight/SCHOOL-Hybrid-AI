import type { Metadata } from "next";
import Link from "next/link";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SiteFooter } from "@/components/ui/SiteFooter";

export const metadata: Metadata = {
  title: "Professional Qualifications - SCHOOL",
  description: "Prepare for industry-recognized certifications and regulatory exams including RE1 and RE5 with SCHOOL's comprehensive learning paths.",
};

export default function ProfessionalLearningPath() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Header */}
      <header className="border-b pb-0 border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center space-x-3">
              <SchoolLogo className="h-8 w-8" />
              <h1 className="text-2xl font-semibold tracking-tighter">
                Professional Qualifications
              </h1>
            </div>
            <nav className="hidden sm:flex space-x-6 text-sm font-medium text-gray-600 hover:text-gray-900">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/learn" className="hover:underline">
                Learning Paths
              </Link>
              <Link href="/community" className="hover:underline">
                Community
              </Link>
              <Link href="/messages" className="hover:underline">
                Messages
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tighter mb-6">
            Master Your Professional Certification
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Comprehensive preparation for Regulatory Examination 1 (RE1) and 
            Regulatory Examination 5 (RE5) – essential credentials for financial 
            services professionals in South Africa.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#re1" className="inline-flex items-center px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
              RE1 Exam Prep
            </a>
            <a href="#re5" className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium shadow-sm">
              RE5 Exam Prep
            </a>
          </div>
        </div>
      </section>

      {/* Why Professional Certification */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Pursue Professional Certification?
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🎯</span>
                <span>Career Advancement</span>
              </h3>
              <p className="text-gray-600">
                RE1 and RE5 qualifications are mandatory for many financial 
                services roles and open doors to senior positions, higher 
                earning potential, and specialized career paths.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">💰</span>
                <span>Increased Earning Potential</span>
              </h3>
              <p className="text-gray-600">
                Certified professionals typically earn 20-35% more than their 
                non-certified counterparts in the financial services industry.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🛡️</span>
                <span>Professional Credibility</span>
              </h3>
              <p className="text-gray-600">
                Demonstrate your commitment to excellence, ethical standards, 
                and ongoing professional development to clients and employers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RE1 Section */}
      <section id="re1" className="py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Regulatory Examination 1 (RE1)
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            The RE1 qualification is the foundational regulatory requirement 
            for individuals wishing to render financial services in South 
            Africa. It covers the generic regulatory environment, the 
            Financial Advisory and Intermediary Services Act (FAIS), and 
            related legislation.
          </p>
          
          <div className="space-y-12">
            {/* Curriculum Overview */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                What You'll Learn
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Financial Advisory Framework</h4>
                  <p className="text-gray-600">
                    Understand the FAIS Act, regulatory bodies, licensing 
                    requirements, and the professional obligations of 
                    financial service providers.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Compliance & Ethics</h4>
                  <p className="text-gray-600">
                    Master ethical conduct, conflicts of interest, privacy 
                    protection (POPIA), market conduct, and treating 
                    customers fairly (TCF) principles.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Risk Management</h4>
                  <p className="text-gray-600">
                    Learn about operational risk, business continuity planning, 
                    insurance requirements, and complaint handling procedures.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Legislative Environment</h4>
                  <p className="text-gray-600">
                    Study the National Credit Act, Protection of Personal 
                    Information Act, and other relevant financial sector 
                    legislation.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Study Materials */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Your RE1 Study Journey
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Foundational Knowledge</h4>
                    <p className="text-gray-600">
                      Begin with core concepts of financial regulation, 
                      governance structures, and the South African financial 
                      services landscape.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Practical Application</h4>
                    <p className="text-gray-600">
                      Apply regulatory principles to real-world scenarios 
                      through case studies, role-playing exercises, and 
                      situational judgment tests.
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
                      Access practice questions, mock exams, and targeted 
                      revision materials designed specifically for the RE1 
                      assessment format.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RE5 Section */}
      <section id="re5" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Regulatory Examination 5 (RE5)
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            The RE5 qualification is the specialist regulatory requirement for 
            individuals wishing to render advice or intermediary services 
            concerning specific financial products. It builds upon the 
            foundational knowledge gained in RE1.
          </p>
          
          <div className="space-y-12">
            {/* Product Specializations */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                RE5 Product Specializations
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Securities & Instruments</h4>
                  <p className="text-gray-600">
                    Equities, bonds, derivatives, collective investment schemes, 
                    and structured products – covering trading, settlement, 
                    and regulatory requirements.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Insurance Products</h4>
                  <p className="text-gray-600">
                    Long-term and short-term insurance, policy administration, 
                    claims processing, and regulatory compliance specific to 
                    the insurance sector.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Retirement Funds</h4>
                  <p className="text-gray-600">
                    Pension funds, provident funds, retirement annuities, and 
                    the regulatory framework governing retirement savings 
                    in South Africa.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Deposits & Savings</h4>
                  <p className="text-gray-600">
                    Bank deposits, savings accounts, fixed-term investments, 
                    and the regulatory requirements surrounding deposit-taking 
                    institutions.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Foreign Exchange</h4>
                  <p className="text-gray-600">
                    Currency exchange, international money transfers, and 
                    the regulatory framework governing forex transactions 
                    and dealing.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-100">
                  <h4 className="font-medium mb-2">Structured Products</h4>
                  <p className="text-gray-600">
                    Complex financial instruments, underlying assets, 
                    risk-return profiles, and the specialized regulatory 
                    requirements for these products.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Learning Path */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold mb-4">
                Structured Learning Approach
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    Foundation
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">RE1 Completion</h4>
                    <p className="text-gray-600">
                      Start with RE1 to build your regulatory foundation 
                      before specializing. Many candidates complete RE1 
                      first, then proceed to their chosen RE5 specialty.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    Specialization
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Choose Your Path</h4>
                    <p className="text-gray-600">
                      Select the RE5 specialization that aligns with your 
                      career goals: securities, insurance, retirement funds, 
                      or another product area.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5 text-[#e8c15a]">
                    Mastery
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Practice & Prepare</h4>
                    <p className="text-gray-600">
                      Utilize question banks, simulated exams, and 
                      targeted revision to ensure you're fully prepared 
                      for assessment day.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Career Opportunities */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Career Opportunities with RE1 & RE5 Qualifications
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Holding RE1 and/or RE5 qualifications significantly enhances your 
            employability and career prospects in the South African financial 
            services industry.
          </p>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🏦</span>
                <span>Banking & Wealth Management</span>
              </h3>
              <p className="text-gray-600">
                Retail banking, private wealth management, investment 
                advisory, and portfolio management roles often require 
                RE1 as a minimum qualification, with RE5 preferred for 
                specialized product advice.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">🛡️</span>
                <span>Insurance & Risk Management</span>
              </h3>
              <p className="text-gray-600">
                Short-term and long-term insurance underwriting, claims 
                adjustment, brokerage, and risk assessment positions 
                frequently require RE5 insurance specialization.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-medium mb-3 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-[#e8c15a]">📈</span>
                <span>Investment & Securities</span>
              </h3>
              <p className="text-gray-600">
                Stockbroking, financial analysis, portfolio management, 
                and investment advisory roles often require RE5 securities 
                specialization for providing product-specific advice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Success Stories
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Hear from professionals who achieved their RE1 and RE5 
            qualifications through SCHOOL's learning paths.
          </p>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-white p-6 rounded-lg border border-gray-100">
              <div className="space-y-4">
                <p className="font-medium text-gray-900">
                  "The RE1 course gave me the solid foundation I needed 
                  to understand the financial regulatory landscape. 
                  The practical examples made complex concepts easy to grasp."
                </p>
                <p className="text-sm text-gray-500">
                  — Thandiwe M., Financial Advisor
                </p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-100">
              <div className="space-y-4">
                <p className="font-medium text-gray-900">
                  "Specializing in RE5 for retirement funds helped me 
                  transition into a pension fund administrator role. 
                  The specialized content was exactly what I needed."
                </p>
                <p className="text-sm text-gray-500">
                  — Sipho K., Retirement Funds Specialist
                </p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-100">
              <div className="space-y-4">
                <p className="font-medium text-gray-900">
                  "Passing both RE1 and RE5 opened doors to a senior 
                  compliance officer position. The investment in my 
                  education paid off within months."
                </p>
                <p className="text-sm text-gray-500">
                  — Amanda V., Compliance Officer
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Start Your Certification Journey?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of South African professionals who have 
            advanced their careers with SCHOOL's RE1 and RE5 preparation 
            programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#re1" className="flex-1 px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
              Start with RE1
            </a>
            <a href="#re5" className="flex-1 px-8 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm">
              Explore RE5 Specializations
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