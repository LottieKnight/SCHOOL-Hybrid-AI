import SellerDashboardClient from "@/components/SellerDashboardClient";

export const metadata = {
  title: "iPhone Supplier — Seller Dashboard (Demo)",
  description: "Demo seller dashboard for the SCHOOL iPhone supplier on the marketplace.",
};

export default function IphoneDashboard() {
  return (
    <SellerDashboardClient
      sellerName="SCHOOL iPhone Supplier"
      owner="Verified iPhone reseller"
      commissionNote="6% (per transaction)"
      accent="#0a0e1a"
    />
  );
}
