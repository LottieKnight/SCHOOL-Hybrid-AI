import { EquipmentProductClient } from "@/components/equipment/EquipmentProductClient";

export default async function EquipmentProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolved = await params;
  return <EquipmentProductClient slug={resolved.slug} />;
}
