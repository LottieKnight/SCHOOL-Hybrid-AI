import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { UserManagementClient } from "@/components/admin/UserManagementClient";

export const metadata = { title: "User management" };

export default function AdminUsersPage() {
  return (
    <div className="glass card card-with-back">
      <h1 className="title">User management</h1>
      <p className="subtitle">Search, inspect, and moderate user accounts.</p>
      <AdminQuickLinks />
      <div className="spacer" />
      <UserManagementClient />
    </div>
  );
}
