import { loadAdminInbox } from "@/lib/messages/inbox-data";
import { Panel, PageHeading, ActionLink } from "@/app/customer/customer-ui";
import { AdminInboxList } from "./admin-inbox-list";

export async function AdminInbox({ group }: { group?: string }) {
  const entries = await loadAdminInbox();
  return (
    <>
      <PageHeading
        title="Messages"
        description="Support chats with customers and workers, and team chats for each assigned move."
      />
      {entries ? (
        <AdminInboxList
          entries={entries}
          initialFilter={group}
          now={new Date().toISOString()}
        />
      ) : (
        <Panel>
          <p role="alert">
            Conversations could not be loaded. Refresh to try again.
          </p>
          <ActionLink href="/admin/messages" outline>
            Reload messages
          </ActionLink>
        </Panel>
      )}
    </>
  );
}
