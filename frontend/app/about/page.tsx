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
        </article>
      </Container>
    </section>
  );
}
