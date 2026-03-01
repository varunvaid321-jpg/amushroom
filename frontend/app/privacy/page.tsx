import { Container } from "@/components/layout/container";

export default function PrivacyPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <article className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 1, 2026
          </p>

          <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            When you use Orangutany, we may collect: your email address and name (if you register),
            photos you upload for identification, and identification results. We also collect basic
            usage data such as IP addresses and browser type for security and analytics.
          </p>

          <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>
            We use your information to provide mushroom identification services, maintain your
            account and saved identifications, improve our service, and communicate with you
            about your account.
          </p>

          <h2 className="text-xl font-semibold text-foreground">3. Data Storage</h2>
          <p>
            Your uploaded photos and identification results are stored securely. Photos are processed
            by our AI identification engine and may be stored for your personal identification library
            if you have an account.
          </p>

          <h2 className="text-xl font-semibold text-foreground">4. Third-Party Services</h2>
          <p>
            We use third-party AI services (Kindwise API) for mushroom identification. Photos you
            upload are sent to this service for processing. We may also use Google OAuth for
            authentication if you choose to sign in with Google.
          </p>

          <h2 className="text-xl font-semibold text-foreground">5. Data Deletion</h2>
          <p>
            You may request deletion of your account and associated data by contacting{" "}
            <a href="mailto:support@orangutany.com" className="text-primary hover:underline">
              support@orangutany.com
            </a>
            .
          </p>

          <h2 className="text-xl font-semibold text-foreground">6. Contact</h2>
          <p>
            For privacy inquiries, contact{" "}
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
