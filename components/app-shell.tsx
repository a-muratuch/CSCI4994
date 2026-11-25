"use client";

import { NotificationProvider } from "@/components/notifications/provider";
import { NotificationBell } from "@/components/notifications/bell";
import { Collapsible } from "@base-ui/react/collapsible";
import { Brand } from "@/components/brand";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Settings,
  ClipboardList,
  Users,
  HardHat,
  CalendarDays,
  Clock,
  History,
  MessageSquare,
  Menu,
  Package,
  Plus,
  Truck,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { focusClass } from "@/lib/ui";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { useHydrated } from "@/lib/use-hydrated";

type NavigationLink = { href: string; label: string; icon: typeof Users };

const groupLabelClass = "text-[11px] font-semibold tracking-wider uppercase";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
const administratorLinks: NavigationLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
];
const administratorGroups = [
  {
    id: "operations",
    label: "Operations",
    links: [
      { href: "/admin/requests", label: "Requests", icon: ClipboardList },
      { href: "/admin/estimates", label: "Estimates", icon: FileText },
      { href: "/admin/jobs", label: "Jobs & schedule", icon: CalendarDays },
      { href: "/admin/trucks", label: "Trucks", icon: Truck },
      {
        href: "/admin/inventory",
        label: "Inventory & pricing",
        icon: Package,
      },
    ],
  },
  {
    id: "people",
    label: "People",
    links: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/workers", label: "Workers", icon: HardHat },
      { href: "/admin/accounts", label: "Account access", icon: Users },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    links: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
      },
      { href: "/admin/activity", label: "Activity log", icon: History },
    ],
  },
] as const;

const navigationByRole = {
  customer: [
    { href: "/customer", label: "Overview", icon: LayoutDashboard },
    { href: "/customer/moves", label: "My moves", icon: Truck },
    { href: "/customer/estimates", label: "Estimates", icon: FileText },
    { href: "/customer/messages", label: "Messages", icon: MessageSquare },
    { href: "/customer/help", label: "Help & contact", icon: CircleHelp },
    { href: "/customer/account", label: "Account settings", icon: Settings },
  ],
  worker: [
    { href: "/worker", label: "Assigned jobs", icon: Truck },
    { href: "/worker/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/worker/availability", label: "Availability", icon: Clock },
    { href: "/worker/messages", label: "Messages", icon: MessageSquare },
    { href: "/worker/history", label: "Job history", icon: History },
  ],
  admin: [
    ...administratorLinks,
    ...administratorGroups.flatMap((group) => [...group.links]),
  ],
};

function AdministratorNavigation({
  pathname,
  renderLink,
}: {
  pathname: string;
  renderLink: (item: NavigationLink) => React.ReactNode;
}) {
  const hydrated = useHydrated();
  const activeGroup = administratorGroups.find((group) =>
    group.links.some(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    ),
  );
  const [state, setState] = useState(() => ({
    pathname,
    expanded: {
      operations: true,
      people: activeGroup?.id === "people",
      reports: activeGroup?.id === "reports",
    },
  }));
  let expanded = state.expanded;
  // Reveal a newly visited group before paint, preserving the other choices.
  if (state.pathname !== pathname) {
    expanded = activeGroup ? { ...expanded, [activeGroup.id]: true } : expanded;
    setState({ pathname, expanded });
  }
  return (
    <>
      {administratorLinks.map(renderLink)}
      {administratorGroups.map((group) => (
        <Collapsible.Root
          key={group.id}
          disabled={!hydrated}
          open={expanded[group.id]}
          onOpenChange={(value) =>
            setState((previous) => ({
              ...previous,
              expanded: { ...previous.expanded, [group.id]: value },
            }))
          }
        >
          <Collapsible.Trigger
            render={
              <Button
                disabled={!hydrated}
                variant="ghost"
                className={cn(
                  "mt-3 min-h-11 w-full justify-between rounded-[10px] px-3 aria-expanded:bg-transparent hover:aria-expanded:bg-muted",
                  groupLabelClass,
                  // The group holding the current page stays emphasized.
                  activeGroup?.id === group.id
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              />
            }
          >
            {group.label}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4", !expanded[group.id] && "-rotate-90")}
            />
          </Collapsible.Trigger>
          <Collapsible.Panel keepMounted={false} inert={!expanded[group.id]}>
            <ul className="space-y-0.5">
              {group.links.map((item) => (
                <li key={item.href}>{renderLink(item)}</li>
              ))}
            </ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </>
  );
}

type ShellProps = {
  children: React.ReactNode;
  role: Role;
  account: { name: string; unread?: number };
};
export function AppShell(props: ShellProps) {
  return (
    <NotificationProvider role={props.role}>
      <WorkspaceShell {...props} />
    </NotificationProvider>
  );
}
function WorkspaceShell({ children, role, account }: ShellProps) {
  const navigation = navigationByRole[role];
  const label = roleLabel(role);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  function renderNavigationLink({ href, label, icon: Icon }: NavigationLink) {
    const active =
      pathname === href ||
      (href !== `/${role}` && pathname.startsWith(href + "/")) ||
      (href === "/worker" && pathname.startsWith("/worker/jobs/"));
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          setOpen(false);
          requestAnimationFrame(() =>
            document.getElementById("workspace-content")?.focus(),
          );
        }}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors",
          focusClass,
          active
            ? "bg-primary font-semibold text-primary-foreground"
            : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{label}</span>
        {label === "Messages" && !!account.unread && (
          <span
            className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums"
            aria-label={`${account.unread} unread messages`}
          >
            {account.unread > 99 ? "99+" : account.unread}
          </span>
        )}
      </Link>
    );
  }

  function closeNavigation() {
    setOpen(false);
    requestAnimationFrame(() => menu.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const media = window.matchMedia("(min-width: 768px)");
    const resize = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      media.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <div
      className="min-h-dvh bg-surface text-foreground md:grid md:grid-cols-[240px_minmax(0,1fr)]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          closeNavigation();
        }
      }}
    >
      <a
        href="#workspace-content"
        className="sr-only z-50 rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-3 focus:ring-ring"
      >
        Skip to content
      </a>
      <div ref={content} inert={open} className="contents">
        <div className="px-4 pt-3 md:hidden">
          <Button
            ref={menu}
            size="icon"
            variant="outline"
            className="size-11"
            aria-label={
              open
                ? `Close ${label.toLowerCase()} navigation`
                : `Open ${label.toLowerCase()} navigation`
            }
            aria-expanded={open}
            aria-controls="workspace-sidebar"
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
        <main
          id="workspace-content"
          tabIndex={-1}
          className="min-w-0 p-4 py-6 outline-none focus-visible:outline-2 focus-visible:outline-ring md:col-start-2 md:row-start-1 md:p-[30px]"
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeNavigation}
          aria-hidden="true"
        />
      )}
      <aside
        id="workspace-sidebar"
        ref={drawer}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={`${label} navigation`}
        onKeyDown={(event) => {
          if (!open || event.key !== "Tab") return;
          const targets = drawer.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          );
          if (!targets?.length) return;
          const first = targets[0],
            last = targets[targets.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(85vw,280px)] overflow-y-auto md:relative md:z-auto md:w-auto flex-col border-b bg-background px-3.5 pb-5 md:sticky md:top-0 md:col-start-1 md:row-start-1 md:flex md:h-dvh md:overflow-y-auto md:border-r md:border-b-0",
          open ? "flex" : "hidden",
        )}
      >
        <Button
          variant="outline"
          size="icon"
          className="mt-3 size-11 self-end md:hidden"
          aria-label="Close navigation"
          onClick={closeNavigation}
        >
          <X aria-hidden="true" />
        </Button>
        <div className="flex h-[74px] shrink-0 items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center rounded-lg font-bold tracking-tight",
              focusClass,
            )}
            aria-label="Rebel Move home"
          >
            <Brand />
          </Link>
          <NotificationBell key={pathname} />
        </div>
        {role === "customer" && (
          <Link
            href="/customer/request"
            aria-current={pathname === "/customer/request" ? "page" : undefined}
            onClick={() => {
              setOpen(false);
              requestAnimationFrame(() =>
                document.getElementById("workspace-content")?.focus(),
              );
            }}
            className={cn(buttonVariants(), "mb-5 w-full")}
          >
            <Plus aria-hidden="true" />
            Request a move
          </Link>
        )}
        <nav
          aria-label={`${label} navigation`}
          className="flex flex-1 flex-col gap-0.5"
        >
          {role === "admin" ? (
            <AdministratorNavigation
              pathname={pathname}
              renderLink={renderNavigationLink}
            />
          ) : role === "customer" ? (
            <>
              {navigation.slice(0, 4).map(renderNavigationLink)}
              <p
                className={cn(
                  groupLabelClass,
                  "mt-4 mb-1 px-3 text-muted-foreground",
                )}
              >
                Account
              </p>
              {navigation.slice(4).map(renderNavigationLink)}
            </>
          ) : (
            navigation.map(renderNavigationLink)
          )}
        </nav>
        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t px-1 pt-4">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(account.name)}
          </span>
          <span className="min-w-0 flex-[1_1_7rem] text-[13px] leading-tight break-words">
            <span className="block font-semibold">{account.name}</span>
            <span className="text-muted-foreground">{label}</span>
          </span>
          <SignOutButton compact />
        </div>
      </aside>
    </div>
  );
}
