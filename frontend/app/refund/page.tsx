import { Metadata } from "next";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = {
  title: "Refund Policy",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <article className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Refund Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 7, 2026
          </p>

          <h2 className="text-xl font-semibold text-foreground">1. Our Promise</h2>
          <p>
            We have no interest in keeping your money if you are not satisfied.
            Orangutany offers both monthly and lifetime paid plans, and we stand
            behind the quality of our service. If you are unhappy for any reason,
            we will make it right.
          </p>

          <h2 className="text-xl font-semibold text-foreground">2. Refund Eligibility</h2>
          <p>
            You are eligible for a full refund if:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>You are not satisfied with the service for any reason.</li>
            <li>You experienced a technical issue that prevented you from using the product.</li>
            <li>You were charged in error or did not intend to subscribe.</li>
          </ul>
          <p>
            We ask only that your usage of the tool has been reasonable at the time of
            the refund request. We trust our users to be fair, and we will always
            honor legitimate refund requests.
          </p>

          <h2 className="text-xl font-semibold text-foreground">3. How to Request a Refund</h2>
          <p>
            Email{" "}
            <a href="mailto:support@orangutany.com" className="text-primary hover:underline">
              support@orangutany.com
            </a>{" "}
            with your account email and a brief reason. We aim to process all
            refunds within 3 business days. No hoops, no hassle.
          </p>

          <h2 className="text-xl font-semibold text-foreground">4. Lifetime Plans</h2>
          <p>
            Lifetime plan purchases are eligible for a refund within 30 days of
            purchase. After 30 days, refunds are considered on a case-by-case
            basis. We will always be fair.
          </p>

          <h2 className="text-xl font-semibold text-foreground">5. Contact</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href="mailto:support@orangutany.com" className="text-primary hover:underline">
              support@orangutany.com
            </a>
            .
          </p>
        </article>
      </Container>
    </section>
  );
}
