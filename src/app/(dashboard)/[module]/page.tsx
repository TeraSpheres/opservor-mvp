import ComingSoon from "@/components/ComingSoon";

const VALID_MODULES = [
  "fleet",
  "inventory",
  "finance",
  "hr",
  "safety",
  "reports",
];

export const dynamicParams = false;

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
