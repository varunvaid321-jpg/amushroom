import { Container } from "@/components/layout/container";
import Image from "next/image";

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

          {/* Lancaster */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Where It All Started
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1611843467160-25afb8df1074?w=600&q=80"
                  alt="Wild mushrooms growing in English woodland"
                  width={600}
                  height={400}
                  className="h-48 w-full object-cover"
                />
              </div>
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1518110925495-5fe2f8cf4918?w=600&q=80"
                  alt="Rolling green hills of the English countryside"
                  width={600}
                  height={400}
                  className="h-48 w-full object-cover"
                />
              </div>
            </div>
            <p>
              It started in the green rolling hills of Lancaster, UK. Walking
              through damp meadows and ancient woodlands, I stumbled upon my
              first cluster of chanterelles hiding under oak leaves. That
              moment&mdash;the golden glow against the dark soil, the apricot
              smell, the thrill of finding something wild and edible&mdash;changed
              everything. I was hooked.
            </p>
            <p>
              I became a self-taught mushroom hunter. No formal mycology training,
              just field guides, online forums, early morning walks, and a lot of
              trial and error. I learned to tell a penny bun from a bitter bolete,
              a field mushroom from a yellow stainer. Every season brought new
              species, new habitats, new lessons.
            </p>
          </div>

          {/* Escapades */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Foraging Across Continents
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80"
                  alt="Misty mountain landscape in the Indian Himalayas"
                  width={400}
                  height={300}
                  className="h-40 w-full object-cover"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">Indian Himalayas</p>
              </div>
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400&q=80"
                  alt="Dense forest in the German countryside"
                  width={400}
                  height={300}
                  className="h-40 w-full object-cover"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">German Forests</p>
              </div>
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80"
                  alt="Autumn forest in Ontario, Canada"
                  width={400}
                  height={300}
                  className="h-40 w-full object-cover"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">Ontario, Canada</p>
              </div>
            </div>
            <p>
              In the <strong>Indian mountains</strong>, I foraged morels in the
              foothills of the Himalayas&mdash;locals called them
              &ldquo;guchhi&rdquo; and sold them for a fortune at market. The
              forests there are unlike anything in Europe: dense, humid, teeming
              with life. I found species I&rsquo;d never seen in any field guide.
            </p>
            <p>
              In <strong>Germany</strong>, foraging is practically a national
              pastime. Autumn weekends in the Black Forest and Bavarian woods
              meant baskets of steinpilze (porcini), pfifferlinge (chanterelles),
              and the occasional fly agaric standing guard like a fairy tale
              sentinel. The Germans take their mushroom hunting seriously&mdash;and
              so did I.
            </p>
            <p>
              Back in the <strong>UK</strong>, it was the New Forest, the Lake
              District, the Scottish Highlands. Each region had its own character:
              ceps under beech trees, hedgehog fungi in pine plantations, giant
              puffballs the size of footballs in September meadows.
            </p>
          </div>

          {/* Canada */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              A New Chapter in Canada
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1604275304445-9e21d66a18d5?w=600&q=80"
                  alt="Hen of the woods mushroom growing at the base of a tree"
                  width={600}
                  height={400}
                  className="h-48 w-full object-cover"
                />
              </div>
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1570824104453-508955ab713e?w=600&q=80"
                  alt="Golden chanterelle mushrooms"
                  width={600}
                  height={400}
                  className="h-48 w-full object-cover"
                />
              </div>
            </div>
            <p>
              When I moved to Canada, I wasn&rsquo;t sure what to expect. But
              Ontario turned out to be a forager&rsquo;s paradise. My first hunt
              was at <strong>Bob Hunter Memorial Park</strong> in the GTA&mdash;a
              modest patch of forest that surprised me with oyster mushrooms
              cascading down a dead elm.
            </p>
            <p>
              Since then, I&rsquo;ve explored forests across Ontario: the hardwood
              ridges near Haliburton, the pine stands of Algonquin, the ravines of
              Rouge Valley. Canada&rsquo;s autumn is extraordinary for
              mushrooms&mdash;hen of the woods at the base of old oaks, lobster
              mushrooms glowing orange in the underbrush, and if you&rsquo;re very
              lucky, the elusive black trumpet hidden in the leaf litter.
            </p>
          </div>

          {/* Edible showcase */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Some Favourites From the Field
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Chanterelle", scientific: "Cantharellus cibarius", img: "https://images.unsplash.com/photo-1571162722311-886bbad4f464?w=300&q=80" },
                { name: "Porcini", scientific: "Boletus edulis", img: "https://images.unsplash.com/photo-1563074666-77484e0b2d5b?w=300&q=80" },
                { name: "Oyster Mushroom", scientific: "Pleurotus ostreatus", img: "https://images.unsplash.com/photo-1621506289937-a8e450e7b75c?w=300&q=80" },
                { name: "Lion's Mane", scientific: "Hericium erinaceus", img: "https://images.unsplash.com/photo-1668548385756-6c7ac3bf1c07?w=300&q=80" },
              ].map((m) => (
                <div key={m.name} className="overflow-hidden rounded-xl border border-border/50 bg-card">
                  <Image
                    src={m.img}
                    alt={m.name}
                    width={300}
                    height={200}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <p className="text-xs italic text-muted-foreground">{m.scientific}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Orangutany */}
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
