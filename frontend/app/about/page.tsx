import { Container } from "@/components/layout/container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Orangutany",
  description:
    "Orangutany is an AI-powered mushroom identification platform with a glocal mindset — global AI, local foraging knowledge. Learn about our mission to make mushroom education safe, free, and accessible.",
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
            Orangutany was born out of a deep love for mushrooms, foraging, and
            the quiet magic of walking through the woods with your eyes on the
            forest floor. We believe that nature&rsquo;s most fascinating kingdom
            deserves modern tools&mdash;accessible to anyone, anywhere.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Why We Started Orangutany
            </h2>
            <p>
              After years of squinting at field guides and cross-referencing blurry
              photos on forums, our team set out to build something better. Something that could
              look at a photo and give you a confident, well-reasoned
              identification&mdash;with edibility info, look-alike warnings, and
              the humility to say &ldquo;not sure&rdquo; when
              confidence is low.
            </p>
            <p>
              Orangutany is that tool. We built it for curious, self-taught,
              cautious people who are deeply in love with the world
              beneath the canopy. Whether you&rsquo;re a beginner picking your
              first field mushroom or a seasoned forager chasing morels in
              spring&mdash;wherever you are in the world&mdash;this is for you.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Think Global, Forage Local
            </h2>
            <p>
              Mushrooms don&rsquo;t respect borders. The same chanterelle
              that grows in Ontario woodlands fruits in Scandinavian forests and
              Indian hill stations. Our identification engine is trained on species
              from every continent, but we know that foraging is always local&mdash;shaped
              by your climate, your soil, and the trees around you.
            </p>
            <p>
              That&rsquo;s why Orangutany pairs global AI with regional
              context: local look-alike warnings, habitat-aware suggestions, and
              educational content that respects the diversity of ecosystems
              worldwide. We&rsquo;re building a platform for the global foraging
              community, one identification at a time.
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
