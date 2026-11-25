import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { heroActionClass } from "@/components/hero-panel";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { PageHeading, Panel } from "../customer-ui";

const questions = [
  [
    "Does accepting an estimate confirm my moving date?",
    "Only when the estimate shows a proposed date and arrival window: accepting then books that time if the crew and truck are still free, and your move page shows the confirmed appointment. Otherwise your decision is saved and we confirm a date with you.",
  ],
  [
    "What does an estimate include?",
    "Open an estimate to review its pricing, inclusions, exclusions, and terms. Estimates are not binding offers and no payment is collected.",
  ],
  [
    "How does scheduling work?",
    "Your request includes a preferred date and, if you choose one, an arrival window. Your move page shows a confirmed appointment once it is booked, either when you accept an estimate with a proposed time or when we schedule it. Long-distance moves also show their delivery date. Customers cannot assign a team or change appointments here.",
  ],
  [
    "Can I edit or cancel a request?",
    "Eligible requests show Edit and Cancel controls in move details. These are available only before an estimate is published. Contact company support about scheduled changes.",
  ],
  [
    "How should I prepare for a move?",
    "List your major items, describe stairs and elevator access at both addresses, and note parking or loading restrictions. Label boxes and keep essential personal items with you.",
  ],
  [
    "Are my changes saved?",
    "Your requests, estimate decisions, account details and messages remain available after refreshing or signing in again.",
  ],
];

export default function HelpPage() {
  return (
    <>
      <PageHeading
        title="Help & contact"
        description="Answers about estimates, scheduling and moving preparation."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel className="gap-0">
          <h2 className="mb-2 text-[17px] font-semibold">
            Frequently asked questions
          </h2>
          {questions.map(([question, answer], index) => (
            <details
              key={question}
              open={index === 0}
              className="group border-t py-1 first-of-type:border-t-0"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-2 text-[15px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
                />
              </summary>
              <p className="max-w-[680px] pb-3 text-sm leading-6 text-muted-foreground">
                {answer}
              </p>
            </details>
          ))}
        </Panel>
        <section
          aria-labelledby="contact-heading"
          className="flex flex-col gap-3 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6"
        >
          <h2 id="contact-heading" className="text-[17px] font-semibold">
            Contact the company
          </h2>
          <p className="text-sm leading-6 text-primary-foreground/80">
            Use Messages to contact the company. For a scheduled move, open the
            move-team chat from your move details. Team chats close when the
            move is completed or cancelled; company support stays open.
          </p>
          <Link
            href="/customer/messages"
            className={cn(heroActionClass, focusClass, "self-start")}
          >
            Message support
          </Link>
        </section>
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Help & contact" };
