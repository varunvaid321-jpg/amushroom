import { Container } from "@/components/layout/container";

export default function RefundPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <article className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Refund Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 1, 2026
          </p>

          <h2 className="text-xl font-semibold text-foreground">1. Free Service</h2>
          <p>
            Orangutany is currently offered as a free service. As there are no paid features
            at this time, no refunds are applicable.
          </p>

          <h2 className="text-xl font-semibold text-foreground">2. Future Paid Features</h2>
          <p>
            If we introduce paid features in the future, this refund policy will be updated
            to reflect the terms for those services.
          </p>

          <h2 className="text-xl font-semibold text-foreground">3. Contact</h2>
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
