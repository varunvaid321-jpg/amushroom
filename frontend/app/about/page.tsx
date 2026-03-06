import { Container } from "@/components/layout/container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Orangutany",
  description:
    "Orangutany takes the guesswork out of mushroom identification. AI trained on millions of images — species matches, distribution maps, seasonality. Think global, forage local.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <article className="prose prose-invert max-w-none space-y-8 text-foreground/80">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            About Orangutany
          </h1>
          <p className="text-lg leading-relaxed">
            Orangutany takes the guesswork out of mushroom identification. Snap a
            photo, and our AI&mdash;trained on millions of mushroom
            images&mdash;instantly identifies the species with confidence scores,
            edibility info, and look-alike warnings.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              What We Offer
            </h2>
            <p>
              <strong>AI Identification</strong> &mdash; Our machine learning models are
              trained on millions of mushroom datasets. Scan any photo and get species
              matches with confidence scores, so you always know how certain the result is.
            </p>
            <p>
              <strong>Distribution Maps</strong> &mdash; See exactly where each species
              grows around the world. Know whether that mushroom is common in your region
              or an unusual find.
            </p>
            <p>
              <strong>Seasonality</strong> &mdash; Find out when to expect each species.
              Plan your foraging trips around peak fruiting seasons.
            </p>
            <p>
              <strong>Safety First</strong> &mdash; Edibility info, look-alike warnings,
              and the honesty to say &ldquo;not sure&rdquo; when confidence is low.
              Matches below 50% are flagged so you never get a false sense of certainty.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Think Global, Forage Local
            </h2>
            <p>
              Mushrooms don&rsquo;t respect borders. The same chanterelle
              that grows in Ontario woodlands fruits in Scandinavian forests and
              Indian hill stations. Our AI is trained on species from every continent,
              but foraging is always local&mdash;shaped by your climate, your soil,
              and the trees around you.
            </p>
            <p>
              That&rsquo;s why Orangutany pairs global machine learning with
              local context: distribution maps that show where species grow,
              seasonality data for your region, and educational content that
              respects the diversity of ecosystems worldwide.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Our Mission
            </h2>
            <p>
              We&rsquo;re on a mission to make mushroom education safe, free, and
              accessible to everyone. From free educational guides and species
              databases to AI-powered identification, we want to lower the barrier
              to understanding fungi&mdash;while never compromising on safety.
            </p>
            <p className="text-sm text-muted-foreground">
              Always verify identifications with local experts before consuming
              wild mushrooms. No app is a substitute for hands-on experience and
              expert guidance.
            </p>
          </div>
        </article>
      </Container>
    </section>
  );
}
