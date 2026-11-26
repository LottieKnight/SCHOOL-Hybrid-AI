import SellerDashboardClient from "@/components/SellerDashboardClient";

export const metadata = {
  title: "AquaQuick — Seller Dashboard (Demo)",
  description: "Demo seller dashboard for AquaQuick on the SCHOOL marketplace.",
};

export default function AquaQuickDashboard() {
  return (
    <SellerDashboardClient
      sellerName="AquaQuick"
      owner="Khuliso (AquaQuick)"
      commissionNote="6% (negotiated)"
      accent="#22a7c9"
    />
  );
}
