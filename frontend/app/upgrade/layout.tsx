import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upgrade to Pro",
  description:
    "Upgrade to Orangutany Pro for full mushroom identification with edibility info, look-alike warnings, and detailed safety data.",
  alternates: { canonical: "/upgrade" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
