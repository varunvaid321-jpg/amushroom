import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArticleHighlighter } from "./highlight-client";

type ArticleContent = {
  title: string;
  description: string;
  category: string;
  sections: { heading: string; body: string[] }[];
};

/* ─── SVG Diagrams ────────────────────────────────────────────── */

function MushroomAnatomyDiagram() {
  return (
    <figure className="my-6 flex flex-col items-center">
      <svg viewBox="0 0 340 420" className="w-full max-w-sm" aria-label="Labeled diagram of a gilled mushroom showing cap, gills, annulus, stalk, and volva">
        {/* Cap */}
        <ellipse cx="170" cy="120" rx="120" ry="55" fill="#8B6914" opacity="0.85" />
        <ellipse cx="170" cy="120" rx="120" ry="55" fill="none" stroke="#5C4A0E" strokeWidth="2" />
        {/* Cap highlight */}
        <ellipse cx="170" cy="108" rx="80" ry="30" fill="#A07D1C" opacity="0.4" />

        {/* Gills */}
        {Array.from({ length: 17 }).map((_, i) => {
          const x = 80 + i * 10;
          return (
            <line key={i} x1={x} y1="140" x2={x + (i < 8 ? -3 : i > 8 ? 3 : 0)} y2="170" stroke="#D4A574" strokeWidth="1.5" opacity="0.7" />
          );
        })}
        {/* Gill underside arc */}
        <path d="M 65 140 Q 170 185 275 140" fill="none" stroke="#5C4A0E" strokeWidth="1.5" />

        {/* Stalk */}
        <rect x="148" y="165" width="44" height="170" rx="8" fill="#E8D5B7" />
        <rect x="148" y="165" width="44" height="170" rx="8" fill="none" stroke="#B8A080" strokeWidth="1.5" />

        {/* Annulus (ring) */}
        <ellipse cx="170" cy="220" rx="32" ry="8" fill="none" stroke="#B8A080" strokeWidth="2" />
        <path d="M 138 220 Q 170 240 202 220" fill="#E8D5B7" stroke="#B8A080" strokeWidth="1.5" />

        {/* Volva (cup at base) */}
        <path d="M 135 330 Q 130 370 155 380 Q 170 385 185 380 Q 210 370 205 330" fill="#E8D5B7" stroke="#B8A080" strokeWidth="2" />

        {/* Labels with lines */}
        {/* Cap label */}
        <line x1="280" y1="100" x2="250" y2="110" stroke="#9CA3AF" strokeWidth="1" />
        <text x="284" y="104" fill="#9CA3AF" fontSize="13" fontFamily="sans-serif">Cap</text>

        {/* Gills label */}
        <line x1="280" y1="155" x2="250" y2="155" stroke="#9CA3AF" strokeWidth="1" />
        <text x="284" y="159" fill="#9CA3AF" fontSize="13" fontFamily="sans-serif">Gills</text>

        {/* Ring label */}
        <line x1="55" y1="225" x2="138" y2="222" stroke="#9CA3AF" strokeWidth="1" />
        <text x="10" y="229" fill="#9CA3AF" fontSize="13" fontFamily="sans-serif">Ring</text>

        {/* Stalk label */}
        <line x1="280" y1="270" x2="195" y2="270" stroke="#9CA3AF" strokeWidth="1" />
        <text x="284" y="274" fill="#9CA3AF" fontSize="13" fontFamily="sans-serif">Stalk</text>

        {/* Volva label */}
        <line x1="55" y1="365" x2="140" y2="360" stroke="#9CA3AF" strokeWidth="1" />
        <text x="10" y="369" fill="#9CA3AF" fontSize="13" fontFamily="sans-serif">Volva</text>
      </svg>
      <figcaption className="mt-3 text-xs text-muted-foreground text-center">
        Anatomy of a gilled mushroom (Amanita-type) — cap, gills, ring, stalk, and volva
      </figcaption>
    </figure>
  );
}

function SporePrintDiagram() {
  return (
    <figure className="my-6 flex flex-col items-center">
      <svg viewBox="0 0 300 200" className="w-full max-w-xs" aria-label="Diagram showing how to make a spore print">
        {/* Paper - half white, half dark */}
        <rect x="30" y="130" width="240" height="60" rx="4" fill="#F5F5F0" stroke="#D1D1C7" strokeWidth="1.5" />
        <rect x="150" y="130" width="120" height="60" rx="0" fill="#2A2A2A" />
        <path d="M 266 130 L 270 130 Q 270 130 270 134 L 270 186 Q 270 190 266 190" fill="#2A2A2A" />

        {/* Spore print pattern */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const cx = 150;
          const cy = 155;
          const r1 = 15;
          const r2 = 35;
          return (
            <line
              key={i}
              x1={cx + r1 * Math.cos(angle)}
              y1={cy + r1 * Math.sin(angle) * 0.5}
              x2={cx + r2 * Math.cos(angle)}
              y2={cy + r2 * Math.sin(angle) * 0.5}
              stroke="#8B6914"
              strokeWidth="3"
              opacity="0.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Cap on paper */}
        <ellipse cx="150" cy="125" rx="55" ry="25" fill="#8B6914" opacity="0.9" />
        <ellipse cx="150" cy="125" rx="55" ry="25" fill="none" stroke="#5C4A0E" strokeWidth="1.5" />
        <ellipse cx="150" cy="120" rx="35" ry="14" fill="#A07D1C" opacity="0.3" />

        {/* Arrow pointing to spore pattern */}
        <line x1="230" y1="110" x2="195" y2="145" stroke="#9CA3AF" strokeWidth="1" />
        <text x="232" y="108" fill="#9CA3AF" fontSize="11" fontFamily="sans-serif">Spores</text>

        {/* Label for paper */}
        <text x="65" y="180" fill="#9CA3AF" fontSize="10" fontFamily="sans-serif">White half</text>
        <text x="185" y="180" fill="#606060" fontSize="10" fontFamily="sans-serif">Dark half</text>
      </svg>
      <figcaption className="mt-3 text-xs text-muted-foreground text-center">
        Place the cap gill-side down on half-white, half-dark paper to reveal spore colour
      </figcaption>
    </figure>
  );
}

function GillAttachmentDiagram() {
  return (
    <figure className="my-6 flex flex-col items-center">
      <svg viewBox="0 0 400 140" className="w-full max-w-md" aria-label="Three types of gill attachment: free, attached, and decurrent">
        {/* Free gills */}
        <g>
          <rect x="55" y="20" width="16" height="80" rx="4" fill="#E8D5B7" stroke="#B8A080" strokeWidth="1.5" />
          <line x1="40" y1="25" x2="50" y2="55" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="35" y1="20" x2="48" y2="50" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="85" y1="25" x2="75" y2="55" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="90" y1="20" x2="78" y2="50" stroke="#D4A574" strokeWidth="1.5" />
          {/* Gap between gills and stalk */}
          <text x="38" y="125" fill="#9CA3AF" fontSize="12" fontFamily="sans-serif" textAnchor="middle">Free</text>
        </g>

        {/* Attached gills */}
        <g>
          <rect x="185" y="20" width="16" height="80" rx="4" fill="#E8D5B7" stroke="#B8A080" strokeWidth="1.5" />
          <line x1="170" y1="20" x2="185" y2="45" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="165" y1="15" x2="185" y2="40" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="216" y1="20" x2="201" y2="45" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="221" y1="15" x2="201" y2="40" stroke="#D4A574" strokeWidth="1.5" />
          <text x="173" y="125" fill="#9CA3AF" fontSize="12" fontFamily="sans-serif" textAnchor="middle">Attached</text>
        </g>

        {/* Decurrent gills */}
        <g>
          <rect x="315" y="20" width="16" height="80" rx="4" fill="#E8D5B7" stroke="#B8A080" strokeWidth="1.5" />
          <line x1="300" y1="15" x2="315" y2="60" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="295" y1="10" x2="315" y2="55" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="346" y1="15" x2="331" y2="60" stroke="#D4A574" strokeWidth="1.5" />
          <line x1="351" y1="10" x2="331" y2="55" stroke="#D4A574" strokeWidth="1.5" />
          <text x="303" y="125" fill="#9CA3AF" fontSize="12" fontFamily="sans-serif" textAnchor="middle">Decurrent</text>
        </g>
      </svg>
      <figcaption className="mt-3 text-xs text-muted-foreground text-center">
        Gill attachment types — free (not touching stalk), attached (meeting stalk), decurrent (running down stalk)
      </figcaption>
    </figure>
  );
}

/* ─── FAQ Data (for Google rich results) ─────────────────────── */

const articleFAQs: Record<string, { question: string; answer: string }[]> = {
  "what-is-a-mushroom": [
    { question: "Is a mushroom a plant?", answer: "No. Mushrooms belong to the kingdom Fungi, which is entirely separate from plants. Fungi cannot photosynthesize and are actually more closely related to animals than to plants." },
    { question: "What is the largest organism on Earth?", answer: "A honey fungus (Armillaria ostoyae) in Oregon, USA. Its underground mycelium covers over 2,400 acres and is estimated to be thousands of years old." },
    { question: "How do mushrooms reproduce?", answer: "Mushrooms reproduce by releasing microscopic spores from structures like gills, pores, or teeth beneath the cap. A single mushroom can release billions of spores, which drift on air currents to colonize new substrates." },
  ],
  "types-of-mushrooms": [
    { question: "What are the main types of mushrooms?", answer: "The major groups include gilled mushrooms, boletes (sponge-like pores), polypores (bracket fungi on wood), puffballs, morels and false morels, chanterelles, coral fungi, and jelly fungi." },
    { question: "Are boletes safe to eat?", answer: "Many boletes are excellent edibles, including the prized porcini. However, boletes with red or orange pore surfaces should be avoided as some are toxic. Always identify each species individually." },
    { question: "What is a polypore?", answer: "Polypores are tough, shelf-like fungi that grow on wood. They have pores instead of gills and are typically woody or leathery. Turkey Tail is one of the most common examples." },
  ],
  "mushroom-anatomy": [
    { question: "What are the parts of a mushroom?", answer: "The main parts are the cap (pileus), gills or pores underneath, stalk (stipe), annulus (ring on the stalk), and volva (cup at the base). Not all mushrooms have every feature." },
    { question: "How do you make a spore print?", answer: "Cut off the cap, place it gill-side down on half-white, half-black paper, cover with a bowl, and wait several hours. The spores will drop and reveal their colour, which is a key identification feature." },
    { question: "What is a volva on a mushroom?", answer: "A volva is a cup-like structure at the very base of the stalk, often buried in soil. It is a remnant of the universal veil and is a key feature of the Amanita genus, which includes both deadly and edible species." },
  ],
  "ecology-of-fungi": [
    { question: "What role do fungi play in ecosystems?", answer: "Fungi serve as decomposers (breaking down dead matter), form symbiotic partnerships with plant roots (mycorrhizae), act as pathogens that regulate populations, and serve as food for countless animals. They are essential to nutrient cycling." },
    { question: "Can any organism break down lignin?", answer: "Only white-rot fungi can fully break down lignin, the tough structural molecule in wood. Without them, fallen trees would persist essentially forever and nutrients would remain locked up." },
    { question: "Do fungi affect climate change?", answer: "Yes. Mycorrhizal fungi transfer an estimated 5 billion tonnes of carbon from plant photosynthesis into the soil annually, where it can be stored long-term. Protecting fungal networks may help address climate change." },
  ],
  "mycorrhizal-networks": [
    { question: "What is the Wood Wide Web?", answer: "The Wood Wide Web refers to underground mycorrhizal networks that connect trees and plants through fungal hyphae. These networks allow trees to share nutrients, water, and even chemical warning signals." },
    { question: "What percentage of plants depend on mycorrhizal fungi?", answer: "Over 80% of all plant species form mycorrhizal partnerships. Most temperate forest trees — oaks, birches, pines — cannot thrive without their fungal partners." },
    { question: "Can trees communicate through fungi?", answer: "Research suggests yes. Trees under insect attack can send chemical signals through mycorrhizal networks to neighbouring trees, which then increase their own defenses. Dying trees may also transfer resources to neighbours through the network." },
  ],
  "foraging-safety": [
    { question: "What is the most important rule of mushroom foraging?", answer: "Never eat a wild mushroom unless you are 100% certain of its identity. Not 95%, not 99% — absolute certainty. If there is any doubt, do not eat it." },
    { question: "Can you tell if a mushroom is poisonous by looking at it?", answer: "There are no reliable visual shortcuts. Folk tests (silver spoon, garlic, peeling) are myths and have contributed to poisonings. Identification requires checking multiple features: cap, gills, stalk, spore colour, smell, and habitat." },
    { question: "What should you do if someone eats a poisonous mushroom?", answer: "Call emergency services or a poison control centre immediately. Save any remaining mushroom material (including scraps and cooking water) for identification. Do not wait for symptoms — some deadly mushrooms cause delayed symptoms 6-12 hours after ingestion." },
  ],
  "deadly-mushrooms": [
    { question: "What is the most dangerous mushroom in the world?", answer: "The Death Cap (Amanita phalloides) is responsible for the majority of fatal mushroom poisonings worldwide. It contains amatoxins that destroy liver cells, and symptoms may not appear until 6-12 hours after ingestion, by which time serious damage has occurred." },
    { question: "What does a Destroying Angel look like?", answer: "Destroying Angels (Amanita virosa/bisporigera) are entirely white — white cap, white gills, white stalk with a ring, and a white volva at the base. They can be mistaken for common edible species like field mushrooms or puffballs." },
    { question: "Are there antidotes for mushroom poisoning?", answer: "There is no reliable home antidote. Hospital treatment may include silibinin (milk thistle extract) and aggressive supportive care. In severe cases, liver transplant may be the only option. Prevention through correct identification is the only safe approach." },
  ],
  "edible-mushrooms-beginners": [
    { question: "What are the safest mushrooms for beginners to forage?", answer: "Giant Puffballs, Chicken of the Woods, Oyster Mushrooms, Chanterelles, and Morels are considered good beginner species because they are relatively distinctive and have few dangerous look-alikes when properly identified." },
    { question: "Are chanterelles easy to identify?", answer: "Chanterelles have a distinctive funnel shape, egg-yolk colour, and forked ridges (not true gills) underneath. They smell faintly of apricots. The main look-alike is the Jack O'Lantern, which grows in clusters on wood and has true gills." },
    { question: "Can you eat wild mushrooms raw?", answer: "Most wild mushrooms should be cooked before eating. Cooking breaks down tough cell walls (made of chitin), improves digestibility, and neutralizes mild toxins present in some species. Some edible species can cause stomach upset if eaten raw." },
  ],
  "seasonal-foraging-guide": [
    { question: "When is the best time to forage for mushrooms?", answer: "Autumn (September-November) is peak season with the greatest diversity. However, every season offers something — spring has morels, summer brings chanterelles and boletes, and even winter has oyster mushrooms and velvet shank." },
    { question: "What mushrooms grow in spring?", answer: "Spring is famous for morels (Morchella species), which appear when soil temperatures reach about 10°C. St George's Mushroom, Dryad's Saddle, and oyster mushrooms also fruit in spring." },
    { question: "Can you find mushrooms in winter?", answer: "Yes. Oyster mushrooms can fruit after frost, Velvet Shank (Flammulina velutipes) fruits in cold weather even through snow, and Turkey Tail and other polypores are visible year-round on logs." },
  ],
};

/* Section images — photo shown above the section text */
function SectionImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-4 overflow-hidden rounded-lg border border-border/30">
      <img
        src={src}
        alt={alt}
        className="w-full object-cover"
        style={{ maxHeight: "360px" }}
        loading="lazy"
      />
      <figcaption className="px-3 py-2 text-xs text-muted-foreground/60">
        {caption}
      </figcaption>
    </figure>
  );
}

const sectionImages: Record<string, Record<string, ReactNode>> = {
  "types-of-mushrooms": {
    "Gilled Mushrooms": (
      <>
        <SectionImage
          src="/images/learn/gilled.jpg"
          alt="Oyster mushrooms (Pleurotus ostreatus) growing on tree bark showing gills clearly visible underneath the caps"
          caption="Oyster Mushroom (Pleurotus ostreatus) — the thin blade-like gills underneath the cap are clearly visible. Gills are the defining feature of this group. Photo: Famberhorst, Wikimedia Commons, CC BY-SA 4.0"
        />
        <SectionImage
          src="/images/learn/gilled-underside.jpg"
          alt="Common Bonnet mushroom (Mycena galericulata) viewed from below showing delicate radiating gills"
          caption="Common Bonnet (Mycena galericulata) — gill underside view showing the delicate radiating lamellae that produce spores. Photo: Famberhorst, Wikimedia Commons, CC BY-SA 4.0"
        />
      </>
    ),
    "Boletes": (
      <SectionImage
        src="/images/learn/boletes.jpg"
        alt="Two porcini mushrooms (Boletus edulis) growing among ferns on forest floor"
        caption="Porcini (Boletus edulis) — boletes have a spongy pore surface instead of gills. Photo: Wikimedia Commons, CC BY-SA 3.0"
      />
    ),
    "Polypores (Bracket Fungi)": (
      <SectionImage
        src="/images/learn/polypores.jpg"
        alt="Turkey Tail bracket fungus with concentric color bands growing on a mossy log"
        caption="Turkey Tail (Trametes versicolor) — a polypore showing shelf-like growth with colorful concentric bands. Photo: Wikimedia Commons, CC BY-SA 3.0"
      />
    ),
    "Puffballs": (
      <SectionImage
        src="/images/learn/puffballs.jpg"
        alt="Two white giant puffball mushrooms sitting in green grass"
        caption="Giant Puffball (Calvatia gigantea) — round fungi that release clouds of spores when mature. Photo: Wikimedia Commons, CC BY-SA 3.0"
      />
    ),
    "Morels": (
      <SectionImage
        src="/images/learn/morels.jpg"
        alt="Single morel mushroom with honeycomb-patterned cap growing on forest floor"
        caption="Morel (Morchella conica) — distinctive honeycomb cap, hollow from top to bottom. Wikimedia Commons Featured Picture. Photo: Beentree, CC BY-SA 4.0"
      />
    ),
    "Other Types": (
      <SectionImage
        src="/images/learn/other-types.jpg"
        alt="Pink-tipped coral fungus (Ramaria botrytis) branching upward like underwater coral"
        caption="Coral Fungus (Ramaria botrytis) — fungi come in extraordinary forms beyond the classic cap-and-stalk shape. Photo: Wikimedia Commons, CC BY-SA 3.0"
      />
    ),
  },
};

/* Mapping of slug → section heading → diagram to render after that section */
const sectionDiagrams: Record<string, Record<string, ReactNode>> = {
  "mushroom-anatomy": {
    "Parts of a Gilled Mushroom": <MushroomAnatomyDiagram />,
    "Making a Spore Print": <SporePrintDiagram />,
    "Field Identification Tips": <GillAttachmentDiagram />,
  },
};

const articles: Record<string, ArticleContent> = {
  "what-is-a-mushroom": {
    title: "What Is a Mushroom?",
    description:
      "A mushroom is the visible fruiting body of a fungus. Learn how fungi differ from plants, how they reproduce, and why they are essential to every ecosystem on Earth.",
    category: "Basics",
    sections: [
      {
        heading: "Not a Plant, Not an Animal",
        body: [
          "A mushroom is not a plant. While plants use sunlight to produce energy through photosynthesis, fungi — like animals — cannot. They must obtain nutrients from their environment. Fungi belong to their own kingdom, separate from both plants and animals, and are in fact more closely related to animals than to plants.",
          "Fungi are incredibly diverse — second only to insects in total number of species. Mycologists estimate there are over a million fungal species on Earth, though only about 100,000 have been formally described. Of those, roughly 14,000 produce the visible structures we call mushrooms.",
        ],
      },
      {
        heading: "The Iceberg Analogy",
        body: [
          "Think of a mushroom like the tip of an iceberg. The mushroom you see above ground is just the reproductive structure — the fruiting body. The real organism lives hidden below the surface as a vast network of microscopic filaments called hyphae, which together form a mycelium.",
          "A single mycelium can spread across enormous areas underground. The largest known organism on Earth is actually a honey fungus (Armillaria ostoyae) in Oregon, whose mycelium covers over 2,400 acres and is estimated to be thousands of years old.",
        ],
      },
      {
        heading: "The Life Cycle",
        body: [
          "A fungus begins as a spore — much smaller than a plant seed, typically one-hundredth of a millimetre across. When conditions are right, the spore germinates into hyphae. Sexually compatible hyphae mate and develop into a mycelium. The mycelium feeds and grows in its substrate — soil, wood, leaf litter — until conditions trigger it to fruit, producing a mushroom.",
          "The mushroom's job is to produce and release spores. A single mushroom can release billions of spores into the air. The gills, pores, or teeth beneath the cap are the spore-producing surfaces. Once released, spores drift on air currents to find new substrates, and the cycle begins again.",
        ],
      },
      {
        heading: "Why Mushrooms Matter",
        body: [
          "Without fungi, life on Earth as we know it would collapse. They are nature's primary recyclers, breaking down dead organic matter and returning nutrients to the soil. Without wood-decay fungi, fallen trees would never decompose and forests would suffocate under their own dead wood.",
          "Fungi also form essential partnerships with living plants. Over 80% of plant species depend on mycorrhizal fungi in their roots to absorb water and nutrients. Many of our food crops, forests, and wild plants simply could not survive without their fungal partners.",
        ],
      },
    ],
  },
  "types-of-mushrooms": {
    title: "Types of Mushrooms",
    description:
      "A guide to the major groups of mushrooms you'll encounter in the wild — from gilled mushrooms and boletes to puffballs, morels, and coral fungi.",
    category: "Basics",
    sections: [
      {
        heading: "Gilled Mushrooms",
        body: [
          "The classic mushroom shape: a cap on a stalk with thin blade-like gills underneath. This is the largest and most diverse group, including edible species like chanterelles and oyster mushrooms, as well as deadly ones like the Destroying Angel. The gills produce and release spores. Some gilled mushrooms also have a ring (annulus) on the stalk and a cup (volva) at the base — features critical for identification.",
        ],
      },
      {
        heading: "Boletes",
        body: [
          "Boletes look similar to gilled mushrooms but instead of gills, they have a sponge-like layer of tiny tubes underneath the cap. The tube mouths appear as pores when viewed from below. Many boletes are prized edibles — the famous porcini (Boletus edulis) is a bolete. A general rule of thumb: boletes with red or orange pore surfaces should be avoided, as some are toxic.",
        ],
      },
      {
        heading: "Polypores (Bracket Fungi)",
        body: [
          "Polypores are tough, shelf-like fungi that grow on wood. Like boletes, they have pores, but they are typically woody or leathery in texture and lack a distinct stalk. Many are perennial, growing larger each year. Turkey Tail (Trametes versicolor) is one of the most common — look for its colourful concentric bands on dead logs.",
        ],
      },
      {
        heading: "Puffballs",
        body: [
          "Round, often white fungi that release clouds of spores when mature. Giant puffballs (Calvatia gigantea) can grow to the size of a football and are edible when the interior is pure white. As they age, the interior turns yellow, then olive-brown with billions of powdery spores. Always slice puffballs open to check — the interior should be uniformly white with no outline of a developing mushroom inside.",
        ],
      },
      {
        heading: "Morels",
        body: [
          "Highly prized edibles with distinctive honeycomb-patterned caps. True morels (Morchella species) are hollow from top to bottom when sliced in half. They fruit in spring, often after forest fires or in disturbed soil. Beware of false morels (Gyromitra species), which have brain-like wrinkled caps and contain toxins — they are not hollow inside.",
        ],
      },
      {
        heading: "Other Types",
        body: [
          "The fungal world extends far beyond these common groups. Coral fungi branch upward like underwater coral. Tooth fungi have spine-like structures hanging below the cap — Lion's Mane is a spectacular example. Stinkhorns emerge from egg-like structures and produce foul-smelling slime to attract insects that spread their spores. Bird's nest fungi look like tiny cups filled with eggs. Jelly fungi are translucent and gelatinous. Cup fungi form small bowl-shaped fruiting bodies. Each group has evolved unique strategies for producing and dispersing spores.",
        ],
      },
    ],
  },
  "mushroom-anatomy": {
    title: "Mushroom Anatomy & Identification",
    description:
      "Understanding the parts of a mushroom — cap, gills, stalk, annulus, volva — is essential for identification. Learn what to look for and how to make a spore print.",
    category: "Identification",
    sections: [
      {
        heading: "Parts of a Gilled Mushroom",
        body: [
          "Cap (pileus): The top of the mushroom. Note its shape (convex, flat, funnel-shaped), colour, size, surface texture (smooth, scaly, slimy), and whether the margin is smooth, lined, or wavy.",
          "Gills (lamellae): The blade-like structures underneath the cap where spores are produced. Note how they attach to the stalk (free, attached, running down the stalk), their spacing (crowded or distant), and their colour — which may change as the mushroom matures.",
          "Stalk (stipe): The stem supporting the cap. Note its colour, texture, whether it is solid or hollow, and if it has a bulbous base.",
          "Annulus (ring): A skirt-like remnant of tissue on the stalk, left behind as the cap expanded. Not all mushrooms have one — its presence or absence is an important identification clue.",
          "Volva: A cup-like structure at the very base of the stalk, often buried in soil. This is a remnant of the universal veil that enclosed the entire young mushroom. The volva is a key feature of the Amanita genus, which includes both deadly and edible species.",
        ],
      },
      {
        heading: "Making a Spore Print",
        body: [
          "Spore colour is one of the most reliable identification features. To determine it, make a spore print: cut off the cap of a mature specimen, place it gill-side down on a piece of paper (half white, half black to catch both light and dark spores), cover with a bowl, and wait several hours or overnight.",
          "The spores will drop onto the paper, revealing their colour. Spore colours range from white, cream, and pale yellow to pink, brown, rust, purple-brown, and black. This single piece of information can narrow down the genus of a mushroom significantly.",
        ],
      },
      {
        heading: "Field Identification Tips",
        body: [
          "Always examine multiple features: cap shape and colour, gill attachment and colour, stalk features, presence of ring or volva, spore colour, smell (some mushrooms smell like anise, meal, or radish), and habitat (what trees are nearby, what substrate is it growing on).",
          "Take photos from multiple angles — top of cap, underside showing gills, full stalk including the very base (dig carefully), and the surrounding environment. This is exactly what Orangutany is designed to work with.",
          "Remember: no single feature is enough for a confident identification. It is the combination of many features, along with habitat and season, that allows a mushroom to be identified. When in doubt, leave it — never eat a wild mushroom unless you are absolutely certain of its identity.",
        ],
      },
    ],
  },
  "ecology-of-fungi": {
    title: "The Ecology of Fungi",
    description:
      "Fungi are nature's recyclers, decomposing dead organic matter and forming vital partnerships with living plants. Discover the ecological roles that make fungi indispensable.",
    category: "Ecology",
    sections: [
      {
        heading: "Saprobes: Nature's Recyclers",
        body: [
          "Fungi that decompose dead organic matter are called saprobes. They break down everything from leaf litter and twigs to massive fallen trees. Without saprobes, dead plant material would pile up indefinitely and the nutrients locked within it would never return to the soil.",
          "Wood-decay fungi fall into two categories. Brown-rot fungi break down cellulose (the main component of plant cell walls), leaving behind brownish cubes of residual lignin. White-rot fungi are the only organisms on Earth capable of breaking down lignin — the tough structural molecule that gives wood its strength. Without white-rot fungi, fallen wood would persist essentially forever.",
        ],
      },
      {
        heading: "Pathogens and Parasites",
        body: [
          "Some fungi cause disease in living organisms. Fungal pathogens like Armillaria (honey fungus) can kill trees, while others attack crops, insects, or even other fungi. Parasitic fungi live on living hosts without necessarily killing them. These relationships, while seemingly destructive, play important ecological roles — they thin weak individuals, create habitats for other organisms, and drive the constant evolutionary arms race that keeps ecosystems dynamic.",
        ],
      },
      {
        heading: "Fungi as Food",
        body: [
          "Mushrooms are eaten by an enormous range of animals — from slugs, beetles, and fly larvae to squirrels, deer, and bears. Some insects have evolved remarkable farming relationships with fungi. Leaf-cutter ants harvest leaves not to eat directly, but to cultivate fungal gardens underground — the ants eat the fungus, not the leaves. Certain beetles farm fungi inside the bark of trees in a similar way.",
        ],
      },
      {
        heading: "Climate and Carbon",
        body: [
          "Fungi play a significant role in the global carbon cycle. Mycorrhizal fungi channel enormous quantities of carbon from plant photosynthesis into the soil, where it can be stored for long periods. Some researchers estimate that mycorrhizal networks transfer 5 billion tonnes of carbon underground every year. Understanding and protecting these fungal networks may be important for addressing climate change.",
        ],
      },
    ],
  },
  "mycorrhizal-networks": {
    title: "Mycorrhizal Networks: The Wood Wide Web",
    description:
      "Over 80% of plant species form partnerships with fungi in their roots. These underground networks allow trees to share nutrients and communicate — a hidden internet connecting the forest.",
    category: "Ecology",
    sections: [
      {
        heading: "What Is a Mycorrhiza?",
        body: [
          "The word mycorrhiza comes from Greek mykes (fungus) and Latin rhiza (root). A mycorrhizal fungus forms a symbiotic partnership with plant roots: the fungus provides the plant with water and mineral nutrients (especially phosphorus) that its fine hyphae can reach far better than roots alone. In return, the plant provides the fungus with sugars produced through photosynthesis.",
          "This is not a minor relationship — over 80% of all plant species depend on mycorrhizal fungi. Most trees in temperate forests (oaks, birches, beeches, pines) cannot thrive without their fungal partners. Many of the most prized edible mushrooms — porcini, chanterelles, truffles — are the fruiting bodies of mycorrhizal fungi.",
        ],
      },
      {
        heading: "The Underground Network",
        body: [
          "A single mycorrhizal fungus can connect to multiple trees simultaneously, forming a network that links trees of the same or even different species. These networks, sometimes called the Wood Wide Web, allow resources to flow between connected trees.",
          "Research has shown that large established trees (mother trees) can channel nutrients through mycorrhizal networks to smaller seedlings growing in the shade below. Trees under attack by insects may send chemical warning signals through the network to neighbouring trees, which then ramp up their own defenses. Dying trees have been observed dumping their remaining carbon into the network, effectively bequeathing their resources to their neighbours.",
        ],
      },
      {
        heading: "Ghost Plants and Cheaters",
        body: [
          "Some plants have evolved to exploit mycorrhizal networks without giving anything back. The Ghost Plant (Monotropa uniflora) is a striking example — it is completely white, lacking chlorophyll entirely. It obtains all its energy by tapping into mycorrhizal networks and siphoning sugars that the fungus obtained from green plants. Some orchids do the same during their seedling stage. These cheaters reveal how valuable the mycorrhizal network is — it is worth evolving an entirely new lifestyle to exploit it.",
        ],
      },
    ],
  },
  "foraging-safety": {
    title: "Foraging Safety: Rules Every Beginner Must Know",
    description:
      "The most important thing in mushroom foraging is coming home safely. Learn the golden rules, understand the risks, and know what to do in an emergency.",
    category: "Safety",
    sections: [
      {
        heading: "The Golden Rules",
        body: [
          "1. Never eat a wild mushroom unless you are 100% certain of its identity. Not 95%, not 99% — absolute certainty. If there is any doubt at all, do not eat it.",
          "2. Learn the deadly species first. Before learning which mushrooms are edible, learn which ones can kill you. Know the Destroying Angel, the Death Cap, and the deadly Galerina in your area.",
          "3. Learn from experienced foragers. Books and apps (including Orangutany) are valuable tools, but nothing replaces hands-on guidance from someone with years of field experience. Join a local mycological society.",
          "4. Start with distinctive species. Begin with mushrooms that are easy to identify and have no dangerous look-alikes — Giant Puffballs, Chicken of the Woods, and Morels are good starting points.",
          "5. Check every single specimen. Even in a cluster of the same species, inspect each mushroom individually. Different species can grow side by side.",
        ],
      },
      {
        heading: "Common Mistakes",
        body: [
          "Relying on a single feature for identification. No single characteristic — colour, shape, location — is enough. Always check multiple features.",
          "Assuming that if an animal eats it, humans can too. Squirrels and slugs can safely eat mushrooms that are lethal to humans.",
          "Trusting folk tests. There are no reliable folk tests for edibility — no silver spoon test, no garlic test, no peeling test. These myths have contributed to poisonings.",
          "Assuming all mushrooms in a group are the same species. Always examine specimens individually.",
        ],
      },
      {
        heading: "If Someone Is Poisoned",
        body: [
          "Call poison control or emergency services immediately. If possible, save a sample of the mushroom that was eaten (or a photo) — this helps medical professionals determine the correct treatment.",
          "Note the time of ingestion and the time symptoms appeared. Delayed symptoms (more than 6 hours after eating) are particularly dangerous, as they may indicate poisoning by amatoxin-containing species like the Destroying Angel or Death Cap, which cause liver failure.",
          "Do not wait for symptoms to worsen before seeking help. Early treatment dramatically improves outcomes in serious mushroom poisonings.",
        ],
      },
    ],
  },
  "deadly-mushrooms": {
    title: "Deadly Mushrooms You Must Recognize",
    description:
      "Some of the most dangerous mushrooms look deceptively innocent. Learn to identify the species responsible for the majority of fatal mushroom poisonings worldwide.",
    category: "Safety",
    sections: [
      {
        heading: "Destroying Angel (Amanita virosa / A. bisporigera)",
        body: [
          "A tall, elegant, completely white mushroom that emerges from an egg-like structure in the soil. The cap can reach 12 cm across, the stalk up to 15 cm. Key features: white gills, a ring on the stalk, and a cup-like volva at the base (often buried — dig carefully to see it).",
          "This mushroom is responsible for numerous deaths worldwide. It contains amatoxins that destroy the liver and kidneys. Symptoms are delayed 8-12 hours after ingestion, which is dangerously misleading — by the time symptoms appear, significant organ damage has already occurred. A period of apparent recovery often follows, before catastrophic liver failure sets in days later. Without aggressive medical treatment, the victim will likely die.",
        ],
      },
      {
        heading: "Death Cap (Amanita phalloides)",
        body: [
          "The single most deadly mushroom species in the world, responsible for the majority of fatal mushroom poisonings globally. The cap is typically olive-green to yellowish-green, though it can be pale or almost white. Like the Destroying Angel, it has white gills, a ring on the stalk, and a volva at the base.",
          "The Death Cap contains the same amatoxins as the Destroying Angel. It was originally a European species but has spread to other continents, likely transported with imported trees. It is particularly dangerous because it can resemble edible species like paddy straw mushrooms, leading to fatal confusion among foragers unfamiliar with the local fungi.",
        ],
      },
      {
        heading: "Deadly Galerina (Galerina marginata)",
        body: [
          "A small, brown, unremarkable-looking mushroom that grows on dead wood. It is easily overlooked or mistaken for harmless wood-decay species. Critically, it can also be confused with edible honey mushrooms or hallucinogenic Psilocybe species — with potentially fatal consequences.",
          "Despite its small size, Deadly Galerina contains the same amatoxins found in Destroying Angels and Death Caps. Its ordinariness is what makes it so dangerous — it does not look like a killer.",
        ],
      },
      {
        heading: "Fly Agaric (Amanita muscaria)",
        body: [
          "The iconic red-and-white fairy tale mushroom. While rarely fatal, it contains ibotenic acid and muscimol, which cause unpredictable neurological effects including confusion, delirium, and seizures. In North America, the common variety has a yellow-orange cap rather than the classic European red. Its cultural familiarity can create a false sense of safety.",
        ],
      },
    ],
  },
  "edible-mushrooms-beginners": {
    title: "Best Edible Mushrooms for Beginners",
    description:
      "Start your foraging journey with species that are distinctive, delicious, and relatively safe to identify. These beginner-friendly mushrooms are excellent first finds.",
    category: "Foraging",
    sections: [
      {
        heading: "Chanterelles (Cantharellus cibarius)",
        body: [
          "Golden-yellow, funnel-shaped mushrooms with blunt, forking ridges (not true gills) running down the stalk. They have a distinctive fruity, apricot-like smell. Found on the ground in hardwood and mixed forests from summer through autumn. Their false ridges, golden colour, and apricot scent make them quite distinctive once you know what to look for.",
          "Look-alike warning: Jack O'Lantern mushrooms (Omphalotus olearius) are orange and grow in clusters on wood — they have true, sharp gills (not blunt ridges) and cause severe gastrointestinal distress. Always check that your chanterelle has blunt, forking ridges and grows from soil, not wood.",
        ],
      },
      {
        heading: "Giant Puffball (Calvatia gigantea)",
        body: [
          "Unmistakable when large — a round white ball that can grow bigger than a football. Edible when the interior is pure, uniform white. Always slice open to confirm: if you see any hint of yellow, brown, or the outline of a developing mushroom inside (which would indicate an Amanita egg), discard it. Best sliced into steaks and fried in butter.",
        ],
      },
      {
        heading: "Oyster Mushroom (Pleurotus ostreatus)",
        body: [
          "Fan-shaped mushrooms growing in overlapping shelves on dead or dying hardwood trees. White to grey-brown with white gills running down a short, off-centre stalk. They have a mild, pleasant smell. Available year-round in mild climates — they can even fruit in winter. One of the easiest edible mushrooms to learn.",
        ],
      },
      {
        heading: "Morels (Morchella species)",
        body: [
          "Distinctive honeycomb-patterned caps on a white stalk. The key identification test: true morels are completely hollow from top to bottom when sliced in half. They fruit in spring, often in disturbed soil, old orchards, or recently burned areas.",
          "Critical warning: False morels (Gyromitra species) have brain-like wrinkled caps (not honeycomb pits) and are not hollow inside. They contain gyromitrin, which can cause serious illness or death. Always slice your morel in half to confirm it is hollow.",
        ],
      },
      {
        heading: "Chicken of the Woods (Laetiporus sulphureus)",
        body: [
          "Bright orange-and-yellow bracket fungus growing in large shelves on trees. Young specimens are tender with a texture often compared to chicken. Found from late spring through autumn on oaks and other hardwoods. Its vivid colours and growth form make it one of the most recognizable edible fungi.",
          "Note: some people experience gastrointestinal reactions, especially from specimens growing on eucalyptus or conifers. Always cook thoroughly and try a small amount first.",
        ],
      },
    ],
  },
  "seasonal-foraging-guide": {
    title: "A Seasonal Foraging Calendar",
    description:
      "Know what to look for and when. A month-by-month overview of the mushroom year for temperate North American climates.",
    category: "Foraging",
    sections: [
      {
        heading: "Spring (March–May)",
        body: [
          "The mushroom year begins with morels — the most celebrated spring mushroom. Look for them in disturbed soil, old apple orchards, near dying elms, and in areas burned the previous year. Oyster mushrooms also fruit on dead wood in spring. Dryad's Saddle (Pheasant Back) appears on hardwood logs and stumps. As temperatures warm, early polypores begin appearing on fallen trees.",
        ],
      },
      {
        heading: "Summer (June–August)",
        body: [
          "Chanterelles begin appearing in mid-summer, often after warm rains, in hardwood and mixed forests. Boletes (including porcini in some regions) fruit under oaks and conifers. Chicken of the Woods makes its first appearance on hardwood trees. Amanitas (both deadly and edible species) emerge in wooded areas. Summer is also prime time for many small, often overlooked species in leaf litter and on dead wood.",
        ],
      },
      {
        heading: "Autumn (September–November)",
        body: [
          "The peak season for mushroom diversity. Hen of the Woods (Maitake) appears at the base of old oaks. Porcini and chanterelles continue. Honey mushrooms fruit in large clusters on dead wood. Giant puffballs appear in meadows and lawns. Lobster mushrooms glow orange in the forest. Lion's Mane grows on dead hardwood. Late autumn brings blewits and wood blewits in leaf litter. This is the season that rewards dedicated foragers most richly.",
        ],
      },
      {
        heading: "Winter (December–February)",
        body: [
          "The quietest season, but not entirely barren. Oyster mushrooms can fruit on dead wood even after frost. Velvet Shank (Flammulina velutipes) — the wild relative of enoki — fruits on dead hardwood in cold weather, sometimes even through snow. Turkey Tail and other tough polypores are visible year-round on logs. Winter is an excellent time to study tree bark, fallen wood, and lichen — and to plan your spring foraging routes.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(articles).map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const article = articles[slug];
    if (!article) return { title: "Not Found" };
    return {
      title: article.title,
      description: article.description,
      alternates: { canonical: `/learn/${slug}` },
    };
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug];
  if (!article) notFound();

  const faqs = articleFAQs[slug] || [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.description,
        author: {
          "@type": "Organization",
          name: "Orangutany",
          url: "https://orangutany.com",
        },
        publisher: {
          "@type": "Organization",
          name: "Orangutany",
          logo: {
            "@type": "ImageObject",
            url: "https://orangutany.com/images/appicon.png",
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://orangutany.com/learn/${slug}`,
        },
        about: {
          "@type": "Thing",
          name: "Fungi",
          sameAs: "https://en.wikipedia.org/wiki/Fungus",
        },
        articleSection: article.category,
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://orangutany.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Learn",
            item: "https://orangutany.com/learn",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `https://orangutany.com/learn/${slug}`,
          },
        ],
      },
      ...(faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <section className="py-16">
      <Suspense>
        <ArticleHighlighter />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container className="max-w-3xl">
        <Link
          href="/learn"
          className="text-sm text-primary hover:underline"
        >
          &larr; Back to Learn
        </Link>
        <article className="mt-6 space-y-8">
          <header>
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              {article.category}
            </span>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
              {article.title}
            </h1>
            <p className="mt-3 text-lg text-foreground/70 leading-relaxed">
              {article.description}
            </p>
          </header>
          {article.sections.map((section) => (
            <div key={section.heading} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {section.heading}
              </h2>
              {sectionImages[slug]?.[section.heading]}
              {section.body.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-foreground/80 leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
              {sectionDiagrams[slug]?.[section.heading]}
            </div>
          ))}
          <div className="border-t border-border/50 pt-8">
            <p className="text-xs text-muted-foreground/60">
              By the Orangutany Team
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Always verify identifications with local experts before consuming
              wild mushrooms. No app or article is a substitute for hands-on
              experience and expert guidance.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              &larr; More articles
            </Link>
          </div>
        </article>
      </Container>
    </section>
  );
}
