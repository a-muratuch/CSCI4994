"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { ResponsiveTable, TableHead } from "@/components/responsive-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { roleLabel, isRole } from "@/lib/auth/roles";
import { useHydrated } from "@/lib/use-hydrated";
import { Panel, controlClass } from "../admin-ui";
import { AccessControl } from "../management-controls";

export type AccountAccessRecord = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
};

function AccessStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? "bg-success-surface text-success" : "bg-muted text-foreground"}`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function AccountsList({
  accounts,
  currentId,
}: {
  accounts: AccountAccessRecord[];
  currentId: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const hydrated = useHydrated();
  const nameOf = (person: AccountAccessRecord) =>
    person.full_name.trim() || "Name not provided";
  const visible = accounts.filter(
    (person) =>
      nameOf(person)
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (role === "all" || person.role === role) &&
      (status === "all" || person.active === (status === "active")),
  );
  const filtered = !!query || role !== "all" || status !== "all";
  function reset() {
    setQuery("");
    setRole("all");
    setStatus("all");
  }
  const identity = (person: AccountAccessRecord) => (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="font-semibold [overflow-wrap:anywhere]">
        {nameOf(person)}
      </span>
      {person.id === currentId && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          You
        </span>
      )}
    </span>
  );
  const action = (person: AccountAccessRecord) =>
    person.role === "admin" || person.id === currentId ? (
      <p className="max-w-xs text-xs leading-5 text-muted-foreground">
        Administrator access changes require owner review.
      </p>
    ) : (
      <AccessControl
        id={person.id}
        active={person.active}
        name={nameOf(person)}
        onResult={setMessage}
      />
    );

  return (
    <>
      <FilterBar
        role="search"
        aria-label="Filter accounts"
        onSubmit={(event) => event.preventDefault()}
      >
        <FilterField label="Search accounts" className="flex-[2_1_18rem]">
          <span className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              disabled={!hydrated}
              className="pl-10"
            />
          </span>
        </FilterField>
        <FilterField label="Role">
          <select
            className={controlClass}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={!hydrated}
          >
            <option value="all">All roles</option>
            <option value="customer">Customers</option>
            <option value="worker">Workers</option>
            <option value="admin">Administrators</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            className={controlClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!hydrated}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterField>
        {filtered && (
          <Button
            variant="outline"
            type="button"
            onClick={reset}
            disabled={!hydrated}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className="mb-3 rounded-lg text-sm outline-none empty:hidden focus-visible:ring-3 focus-visible:ring-ring"
      >
        {message}
      </p>
      <p
        role="status"
        className="mb-3 text-sm text-muted-foreground tabular-nums"
      >
        {visible.length} of {accounts.length}{" "}
        {accounts.length === 1 ? "account" : "accounts"}
      </p>
      {!visible.length ? (
        <Panel className="items-center py-10 text-center">
          <h3 className="font-semibold">
            {accounts.length ? "No matching accounts" : "No accounts yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {accounts.length
              ? "Try another name, role or status."
              : "Accounts will appear here when they are created."}
          </p>
          {filtered && (
            <Button variant="outline" onClick={reset}>
              Show all accounts
            </Button>
          )}
        </Panel>
      ) : (
        <>
          <ResponsiveTable
            label="Accounts"
            minWidth="660px"
            className="hidden md:block"
          >
            <caption className="sr-only">
              Account names, roles, access status and available actions
            </caption>
            <TableHead columns={["Name", "Role", "Status", "Actions"]} />
            <tbody>
              {visible.map((person) => (
                <tr key={person.id}>
                  <td>{identity(person)}</td>
                  <td>
                    {isRole(person.role)
                      ? roleLabel(person.role)
                      : "Unknown role"}
                  </td>
                  <td>
                    <AccessStatus active={person.active} />
                  </td>
                  <td>{action(person)}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          <ul aria-label="Accounts" className="space-y-3 md:hidden">
            {visible.map((person) => (
              <li key={person.id}>
                <Panel>
                  <h3>{identity(person)}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {isRole(person.role)
                        ? roleLabel(person.role)
                        : "Unknown role"}
                    </span>
                    <AccessStatus active={person.active} />
                  </div>
                  {action(person)}
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
