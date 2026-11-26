import SellerDashboardClient from "@/components/SellerDashboardClient";

export const metadata = {
  title: "Cosmic Cotton — Seller Dashboard (Demo)",
  description: "Demo seller dashboard for Cosmic Cotton on the SCHOOL marketplace.",
};

export default function CosmicCottonDashboard() {
  return (
    <SellerDashboardClient
      sellerName="Cosmic Cotton"
      owner="Justin"
      commissionNote="6% (negotiable)"
      accent="#7c5cff"
    />
  );
}
