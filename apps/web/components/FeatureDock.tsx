import Link from "next/link";
import { getDockFeatures } from "@/lib/featureCatalog";

export function FeatureDock() {
  const features = getDockFeatures();

  return (
    <section className="feature-dock glass" aria-label="Feature shortcuts">
      <div className="feature-dock-copy">
        <span className="feature-dock-eyebrow">Everything in SCHOOL</span>
        <h2>Visible shortcuts</h2>
        <p>Jump straight to the platform sections instead of hunting through the sidebar.</p>
      </div>
      <div className="feature-dock-links">
        {features.map((feature) => (
          <Link
            key={feature.href}
            className="feature-dock-link"
            href={feature.href}
            prefetch={false}
          >
            <strong>{feature.label}</strong>
            <span>{feature.badge ? `${feature.badge}: ${feature.description}` : feature.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
