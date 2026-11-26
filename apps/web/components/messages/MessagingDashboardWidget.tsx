import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/Card";

type MessagingDashboardWidgetProps = {
  role: "learner" | "tutor" | "admin";
};

export default function MessagingDashboardWidget({ role }: MessagingDashboardWidgetProps) {
  const roleLabel = {
    learner: "Student",
    tutor: "Tutor",
    admin: "Admin",
  }[role] ?? role;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{roleLabel} Messaging Overview</CardTitle>
      </CardHeader>
      <CardBody>
        <p>Placeholder for messaging dashboard content for {roleLabel}s.</p>
      </CardBody>
    </Card>
  );
}
