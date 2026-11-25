import type { Metadata } from "next";

/** Each auth page picks AuthSplit or AuthCentered from ./auth-shell. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

export const metadata: Metadata = {
  title: { default: "Rebel Move", template: "%s | Rebel Move" },
};
