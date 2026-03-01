import { Container } from "@/components/layout/container";

export default function TermsPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <article className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 1, 2026
          </p>

          <h2 className="text-xl font-semibold text-foreground">1. Acceptance</h2>
          <p>
            By accessing orangutany.com (&ldquo;Orangutany&rdquo;), you agree to these Terms of Service.
            If you do not agree, do not use our service.
          </p>

          <h2 className="text-xl font-semibold text-foreground">2. Service Description</h2>
          <p>
            Orangutany provides AI-powered mushroom identification from user-uploaded photos.
            Identifications are for educational and informational purposes only and should not be
            relied upon as the sole basis for determining the safety or edibility of any wild mushroom.
          </p>

          <h2 className="text-xl font-semibold text-foreground">3. Disclaimer</h2>
          <p>
            <strong>Orangutany is not a substitute for expert mycological advice.</strong> Misidentification
            of mushrooms can result in serious illness or death. Always consult a qualified mycologist
            before consuming any wild mushroom. We are not liable for any harm resulting from reliance
            on our AI identifications.
          </p>

          <h2 className="text-xl font-semibold text-foreground">4. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree to provide accurate information during registration and to keep your account
            information up to date.
          </p>

          <h2 className="text-xl font-semibold text-foreground">5. Intellectual Property</h2>
          <p>
            All content and technology on Orangutany, excluding user-uploaded photos, is the property
            of Orangutany and protected by applicable intellectual property laws.
          </p>

          <h2 className="text-xl font-semibold text-foreground">6. Contact</h2>
          <p>
            Questions about these terms? Email{" "}
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
