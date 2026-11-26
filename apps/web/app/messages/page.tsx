import dynamic from "next/dynamic";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";

const MessagesClientPage = dynamic(() => import("./MessagesClientPage"), {
  loading: () => (
    <div className="page-shell">
      <RouteHeader
        eyebrow="Messages"
        title="Conversation workspace"
        description="Loading channels, threads, reminders, and message context."
      />
      <StateCard title="Loading messages" description="SCHOOL is opening your conversation workspace." />
    </div>
  ),
});

export default function MessagesPage() {
  return <MessagesClientPage />;
}
