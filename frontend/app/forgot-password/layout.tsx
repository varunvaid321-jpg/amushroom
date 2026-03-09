import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false, follow: true },
  alternates: { canonical: "/forgot-password" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
