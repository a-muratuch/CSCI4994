import type { Metadata } from "next";
import { adminCustomers } from "@/lib/profiles/admin-customers";
import { PageHeading, Panel } from "../admin-ui";
import { CustomersList } from "./customers-list";

export default async function Page() {
  const result = await adminCustomers();
  if (result.error)
    return (
      <>
        <PageHeading title="Customers" description="Saved customer profiles." />
        <Panel>
          <p role="alert">
            Customer profiles could not be loaded. Reload this page to try
            again.
          </p>
        </Panel>
      </>
    );
  return (
    <CustomersList
      customers={result.customers.map(({ id, name }) => ({ id, name }))}
    />
  );
}

export const metadata: Metadata = { title: "Customers" };
