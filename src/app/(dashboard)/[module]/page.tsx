import ComingSoon from "@/components/ComingSoon";

export default function ModulePlaceholderPage({
  params,
}: {
  params: { module: string };
}) {
  return <ComingSoon module={params.module} />;
}
