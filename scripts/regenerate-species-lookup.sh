#!/bin/bash
# Regenerate species-lookup.json from the guide database
# Run this after adding new species to orangutany-seo
#
# Usage: ./scripts/regenerate-species-lookup.sh

set -e

GUIDE_DIR="/Users/varunvaid/orangutany-seo"
OUTPUT="$(dirname "$0")/../species-lookup.json"

if [ ! -d "$GUIDE_DIR" ]; then
  echo "Error: Guide repo not found at $GUIDE_DIR"
  exit 1
fi

cd "$GUIDE_DIR"

npx tsx -e "
import { allSpecies } from './data/species';
const map: Record<string, any> = {};
allSpecies.forEach(s => {
  map[s.scientificName.toLowerCase()] = {
    slug: s.slug,
    commonName: s.commonName,
    lookAlikes: (s.lookAlikes || []).slice(0, 3).map(la => ({
      name: la.name,
      slug: la.slug || null,
      imageUrl: la.image ? 'https://guide.orangutany.com/images/species/' + s.slug + '/' + la.image : null,
      distinction: la.distinction ? la.distinction.split('.')[0] + '.' : null,
    }))
  };
});
process.stdout.write(JSON.stringify(map, null, 2));
" > "$OUTPUT"

COUNT=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$OUTPUT','utf8'))).length)")
echo "✓ Generated species-lookup.json with $COUNT species"
