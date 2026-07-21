import ComingSoon from "@/components/ComingSoon";

const VALID_MODULES = [
  "fleet",
  "warehouse",
  "inventory",
  "finance",
  "hr",
  "safety",
  "reports",
];

export function generateStaticParams() {
  return VALID_MODULES.map((module) => ({ module }));
}

export default function ModulePlaceholderPage({
  params,
}: {
  params: { module: string };
}) {
  return <ComingSoon module={params.module} />;
}
