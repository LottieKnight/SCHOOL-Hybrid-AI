import Link from "next/link";

type BackLinkProps = {
  href: string;
  label?: string;
};

export function BackLink({ href, label = "Back" }: BackLinkProps) {
  return (
    <Link className="button back-button" href={href} aria-label="Go back">
      {"<-"} {label}
    </Link>
  );
}
