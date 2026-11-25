import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import {
  administrationReady,
  invitationsConfigured,
} from "@/lib/administration/data";
import { PageHeading, Panel } from "../admin-ui";
import { WorkerInvitation } from "../management-controls";
import { AccountsList, type AccountAccessRecord } from "./accounts-list";
export const metadata: Metadata = { title: "Account access" };
export default async function Page() {
  const account = await requireRole("admin");
  const ready = await administrationReady();
  if (!ready)
    return (
      <>
        <PageHeading
          title="Account access"
          description="Manage worker invitations and account access."
        />
        <Panel>
          <p>Account administration is not available yet.</p>
        </Panel>
      </>
    );
  const client = await serverSupabase();
  const accounts: AccountAccessRecord[] = [];
  let unavailable = false;
  // Read ordered pages so filters include accounts beyond the API row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("profiles")
      .select("id,full_name,role,active")
      .order("full_name")
      .order("id")
      .range(offset, offset + 499);
    if (error) {
      unavailable = true;
      break;
    }
    accounts.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  return (
    <>
      <PageHeading
        title="Account access"
        description="Manage access without deleting operational history."
      />
      <Panel>
        <WorkerInvitation configured={invitationsConfigured()} />
      </Panel>
      <h2 className="mt-8 mb-3 text-[17px] font-semibold">Accounts</h2>
      {unavailable ? (
        <Panel>
          <p role="alert">Accounts could not be loaded. Reload to try again.</p>
        </Panel>
      ) : (
        <AccountsList accounts={accounts} currentId={account.id} />
      )}
    </>
  );
}
