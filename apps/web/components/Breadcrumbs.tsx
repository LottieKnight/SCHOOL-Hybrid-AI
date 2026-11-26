import Link from "next/link";

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <div className="crumbs">
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`}>
          {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          {idx < items.length - 1 ? " / " : ""}
        </span>
      ))}
    </div>
  );
}
