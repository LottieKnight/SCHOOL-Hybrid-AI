import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { RouteHeader } from "@/components/ui/RouteHeader";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://school.ditshego-ventures.co.za";
const BOOK_SLUG = "becoming-el-matador";

export const metadata = {
  title: "Becoming El Matador — Free Financial Literacy & AI Trading Book",
  description:
    "Download Becoming El Matador by Moloti Ditshego — a free guide to market psychology, algorithmic trading, and the AI-engineer mindset for South African youth. Classified as Financial Literacy / Entrepreneurship, not Religious Studies.",
  openGraph: {
    type: "book" as const,
    url: `${SITE_URL}/book/${BOOK_SLUG}`,
    title: "Becoming El Matador — Free Financial Literacy Book",
    description:
      "Master market psychology, algorithmic trading and AI-assisted trading systems. 100% free PDF.",
    images: [`${SITE_URL}/covers/becoming-el-matador.jpg`],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Becoming El Matador — Free Financial Literacy Book",
    description: "Free PDF by Moloti Ditshego. Financial literacy, trading psychology, and AI.",
    images: [`${SITE_URL}/covers/becoming-el-matador.jpg`],
  },
};

export default function BecomingElMatadorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        name: "Becoming El Matador",
        author: { "@type": "Person", name: "Moloti Ditshego" },
        bookEdition: "First",
        inLanguage: "en",
        description:
          "A free guide to market psychology, algorithmic trading and the AI-engineer mindset for South African youth. Covers AMD framework, order flow, liquidity, regulatory exams (RE1/RE5) and building a trading-business ecosystem.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "ZAR",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/book/${BOOK_SLUG}`,
        },
        isAccessibleForFree: true,
      },
      {
        "@type": "EducationalResource",
        name: "Becoming El Matador",
        description:
          "Financial-literacy and entrepreneurship resource for FET learners (Grades 10-12) and tertiary students.",
        educationalUse: ["textbook", "self-paced learning"],
        typicalAgeRange: "16-24",
        learningResourceType: "book",
        educationalAlignment: {
          "@type": "AlignmentObject",
          targetName: "Financial Literacy (CAPS aligned)",
          targetUrl: `${SITE_URL}/learn`,
          educationalFramework: "CAPS",
          targetDescription:
            "South African National Curriculum Statement for Economic & Management Sciences — Financial Literacy strand",
          alignmentType: "teaches",
        },
      },
    ],
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <JsonLd data={jsonLd} />
      <RouteHeader
        eyebrow="Free Book · Financial Literacy"
        title="Becoming El Matador"
        description="By Moloti Ditshego — market psychology, algorithmic trading, and the AI-engineer mindset for South African youth. Free to download."
      />

      <div className="glass card">
        <h2 className="title">About this book</h2>
        <p className="subtitle">
          Becoming El Matador is a free financial-literacy and entrepreneurship resource. It is
          <strong> not</strong> a religious-studies text — it is classified under
          <strong> Financial Literacy</strong> and <strong>Entrepreneurship</strong> to align with
          SCHOOL&apos;s mission of democratising money and technology skills for African youth.
        </p>
        <ul className="subtitle" style={{ lineHeight: 1.8 }}>
          <li>Market microstructure: liquidity, order flow, the AMD framework.</li>
          <li>Algorithmic &amp; AI-assisted trading systems.</li>
          <li>Regulatory Examination prep context (RE1 &amp; RE5).</li>
          <li>Building a trading-business ecosystem and risk models.</li>
        </ul>
        <div className="outline-actions">
          <a className="button" href={`${SITE_URL}/pdfs/becoming-el-matador.pdf`} download>
            Download free PDF
          </a>
          <Link className="button" href="/learn">
            Explore aligned lessons
          </Link>
        </div>
      </div>

      <div className="glass card">
        <h2 className="title">Ask the AI Tutor</h2>
        <p className="subtitle">
          The SCHOOL AI Tutor can summarise chapters, pull exact page references, and generate
          quizzes from this book. Open any learning page and ask it to explain a concept from
          Becoming El Matador.
        </p>
        <div className="outline-actions">
          <Link className="button" href="/tutor">
            Open AI Tutor
          </Link>
        </div>
      </div>
    </div>
  );
}
