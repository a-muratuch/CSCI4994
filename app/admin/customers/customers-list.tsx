"use client";
import { useState } from "react";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Input } from "@/components/ui/input";
import type { SavedCustomer } from "@/lib/profiles/admin-customers";
import { ActionLink, PageHeading, Panel } from "../admin-ui";

export function CustomersList({
  customers,
}: {
  customers: Pick<SavedCustomer, "id" | "name">[];
}) {
  const [search, setSearch] = useState("");
  const rows = customers.filter((row) =>
    `${row.name || "Customer"} ${row.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Customers"
        description="Review customer contact details, requests and moves."
      />
      <FilterBar
        role="search"
        aria-label="Search customers"
        onSubmit={(event) => event.preventDefault()}
      >
        <FilterField label="Search customers" className="flex-[1_1_16rem]">
          <Input
            id="directory-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>
      </FilterBar>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "customer" : "customers"}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!rows.length && (
          <Panel>
            <p>
              {customers.length
                ? "No matching customers."
                : "No customer profiles yet."}
            </p>
          </Panel>
        )}
        {rows.map((row) => (
          <Panel key={row.id} className="gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold"
              >
                {(row.name || "Customer")
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <h2 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                {row.name || "Customer"}
              </h2>
            </div>
            <ActionLink href={`/admin/customers/${row.id}`} outline>
              View {row.name || "Customer"}
            </ActionLink>
          </Panel>
        ))}
      </div>
    </>
  );
}
