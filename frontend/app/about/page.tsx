import { Container } from "@/components/layout/container";

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
            forest floor.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Why I Built Orangutany
            </h2>
            <p>
              After years of squinting at field guides and cross-referencing blurry
              photos on forums, I wanted something better. Something that could
              look at a photo and give you a confident, well-reasoned
              identification&mdash;with edibility info, look-alike warnings, and
              the humility to say &ldquo;I&rsquo;m not sure&rdquo; when
              confidence is low.
            </p>
            <p>
              Orangutany is that tool. It&rsquo;s built for people like me:
              curious, self-taught, cautious, and deeply in love with the world
              beneath the canopy. Whether you&rsquo;re a beginner picking your
              first field mushroom or a seasoned forager chasing morels in
              spring, this is for you.
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
