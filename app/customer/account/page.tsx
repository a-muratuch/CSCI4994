import { PasswordForm } from "@/components/password-form";
import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";
import AccountForm from "./account-form";
import { customerProfile } from "@/lib/profiles/data";
import { PageHeading, Panel } from "../customer-ui";

export default async function AccountPage() {
  const { profile } = await customerProfile();
  if (!profile)
    return (
      <>
        <PageHeading
          title="Account settings"
          description="Manage your profile details."
        />
        <Panel>
          <p role="alert">
            Your saved profile could not be loaded. Reload this page to try
            again.
          </p>
          <SignOutButton className="max-w-xs" />
        </Panel>
      </>
    );
  const initials = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <>
      <PageHeading
        title="Account settings"
        description="Manage your profile details."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <AccountForm profile={profile} />
          <PasswordForm mode="change" />
        </div>
        <Panel className="gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold [overflow-wrap:anywhere]">
                {profile.name}
              </h2>
              <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                Customer · {profile.email}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Sign out of this browser session and return to the homepage.
          </p>
          <SignOutButton />
        </Panel>
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Account settings" };
