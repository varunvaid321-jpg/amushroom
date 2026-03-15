#!/bin/bash
# Regenerate species-lookup.json from the guide database
# Run this after adding new species to orangutany-seo
#
# Usage: ./scripts/regenerate-species-lookup.sh

set -e

GUIDE_DIR="/Users/varunvaid/orangutany-seo"
OUTPUT="$(cd "$(dirname "$0")/.." && pwd)/species-lookup.json"

if [ ! -d "$GUIDE_DIR" ]; then
  echo "Error: Guide repo not found at $GUIDE_DIR"
  exit 1
fi

cd "$GUIDE_DIR"

npx tsx -e "
import { allSpecies } from './data/species';
import * as fs from 'fs';

// Build slug -> hero image URL lookup
const slugHero: Record<string, string> = {};
allSpecies.forEach(s => {
  const heroFile = s.images?.[0]?.filename;
  if (heroFile) {
    slugHero[s.slug] = 'https://guide.orangutany.com/images/species/' + s.slug + '/' + heroFile;
  }
});

const map: Record<string, any> = {};
allSpecies.forEach(s => {
  const heroFile = s.images?.[0]?.filename;
  map[s.scientificName.toLowerCase()] = {
    slug: s.slug,
    commonName: s.commonName,
    heroImage: heroFile ? 'https://guide.orangutany.com/images/species/' + s.slug + '/' + heroFile : null,
    lookAlikes: (s.lookAlikes || []).slice(0, 3).map(la => {
      // Resolve look-alike image: dedicated file on disk > look-alike species hero > null
      let imageUrl: string | null = null;
      if (la.image) {
        const filePath = 'public/images/species/' + s.slug + '/' + la.image;
        if (fs.existsSync(filePath)) {
          imageUrl = 'https://guide.orangutany.com/images/species/' + s.slug + '/' + la.image;
        }
      }
      if (!imageUrl && la.slug && slugHero[la.slug]) {
        imageUrl = slugHero[la.slug];
      }
      return {
        name: la.name,
        slug: la.slug || null,
        imageUrl,
        distinction: la.distinction ? la.distinction.split('.')[0] + '.' : null,
      };
    })
  };
});
process.stdout.write(JSON.stringify(map, null, 2));
" > "$OUTPUT"

COUNT=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$OUTPUT','utf8'))).length)")
echo "✓ Generated species-lookup.json with $COUNT species"
