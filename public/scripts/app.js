(function () {
  const photoInput = document.getElementById('photoInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusText = document.getElementById('statusText');
  const previewGrid = document.getElementById('previewGrid');
  const resultsSection = document.getElementById('results');
  const analysisSummary = document.getElementById('analysisSummary');
  const resultCards = document.getElementById('resultCards');

  const slotNames = [
    'Photo 1 - Top of cap',
    'Photo 2 - Bottom / gills',
    'Photo 3 - Stalk',
    'Photo 4 - Environment',
    'Photo 5 - Extra detail'
  ];

  function roleForIndex(index) {
    const roles = ['top', 'gills', 'stalk', 'environment', 'extra'];
    return roles[index] || 'extra';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function chipClass(label) {
    const value = String(label || '').toLowerCase();
    if (value.includes('poison') || value.includes('inedible') || value.includes('deadly') || value.includes('not edible')) {
      return 'chip chip--danger';
    }
    if (value.startsWith('edible')) return 'chip chip--edible';
    if (value.includes('yes') || value.includes('psychoactive')) return 'chip chip--psychedelic';
    return 'chip chip--neutral';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function renderSlots(files) {
    previewGrid.innerHTML = '';

    for (let index = 0; index < 5; index += 1) {
      const card = document.createElement('article');
      card.className = 'preview-card';

      const label = document.createElement('p');
      label.className = 'preview-card__label';
      label.textContent = slotNames[index];
      card.appendChild(label);

      const file = files[index];
      if (file) {
        const image = document.createElement('img');
        image.className = 'preview-card__image';
        image.src = URL.createObjectURL(file);
        image.alt = slotNames[index];
        card.appendChild(image);

        const fileName = document.createElement('p');
        fileName.className = 'preview-card__file';
        fileName.textContent = file.name;
        card.appendChild(fileName);
      } else {
        const empty = document.createElement('div');
        empty.className = 'preview-card__empty';
        empty.textContent = 'No image';
        card.appendChild(empty);
      }

      previewGrid.appendChild(card);
    }
  }

  function renderSummary(uploadGuidance, consistencyCheck) {
    const uploaded = Array.isArray(uploadGuidance?.uploadedRoles) ? uploadGuidance.uploadedRoles : [];
    const missing = Array.isArray(uploadGuidance?.missingRecommendedRoles) ? uploadGuidance.missingRecommendedRoles : [];
    const uploadedLine = uploaded.length ? uploaded.join(', ') : 'No role metadata';
    const missingLine = missing.length ? missing.join(', ') : 'none';
    const consistencyLine = consistencyCheck?.message
      ? `<strong>Photo consistency:</strong> ${escapeHtml(consistencyCheck.message)}`
      : '<strong>Photo consistency:</strong> Consistency check unavailable.';

    analysisSummary.innerHTML = [
      `<strong>What you uploaded:</strong> ${escapeHtml(uploadedLine)}`,
      `<strong>Missing recommended shots:</strong> ${escapeHtml(missingLine)}`,
      consistencyLine,
      '<strong>Interpretation quality:</strong> best when top + gills + stalk are clear.'
    ].join('<br/>');
  }

  function renderMatches(matches) {
    resultCards.innerHTML = '';

    matches.forEach((mushroom, index) => {
      const card = document.createElement('article');
      card.className = 'match-card';

      const commonName = escapeHtml(mushroom.commonName || 'Unknown species');
      const scientificName = escapeHtml(mushroom.scientificName || commonName);
      const edibilityRaw = mushroom.edible || 'Unknown';
      const psychedelicRaw = mushroom.psychedelic || 'Unknown';
      const edibility = escapeHtml(edibilityRaw);
      const psychedelic = escapeHtml(psychedelicRaw);
      const caution = escapeHtml(mushroom.caution || 'Do not consume without local expert verification.');
      const description = mushroom.description ? escapeHtml(mushroom.description) : '';
      const wikiUrl = mushroom.wikiUrl ? escapeHtml(mushroom.wikiUrl) : '';
      const representativeImage = mushroom.representativeImage ? escapeHtml(mushroom.representativeImage) : '';
      const traits = Array.isArray(mushroom.traits) ? mushroom.traits.map(escapeHtml) : [];
      const lookAlikes = Array.isArray(mushroom.lookAlikes) ? mushroom.lookAlikes.map(escapeHtml) : [];
      const whyMatch = Array.isArray(mushroom.whyMatch) ? mushroom.whyMatch.map(escapeHtml) : [];
      const taxonomy = mushroom.taxonomy && typeof mushroom.taxonomy === 'object' ? mushroom.taxonomy : null;
      const score = Number.isFinite(Number(mushroom.score)) ? Number(mushroom.score) : 0;

      const taxonomyParts = [];
      if (taxonomy?.genus) taxonomyParts.push(`Genus: ${escapeHtml(taxonomy.genus)}`);
      if (taxonomy?.family) taxonomyParts.push(`Family: ${escapeHtml(taxonomy.family)}`);
      if (taxonomy?.order) taxonomyParts.push(`Order: ${escapeHtml(taxonomy.order)}`);
      if (taxonomy?.class) taxonomyParts.push(`Class: ${escapeHtml(taxonomy.class)}`);

      const ids = [];
      if (mushroom.gbifId) ids.push(`GBIF: ${escapeHtml(mushroom.gbifId)}`);
      if (mushroom.inaturalistId) ids.push(`iNaturalist: ${escapeHtml(mushroom.inaturalistId)}`);

      const whyMatchMarkup = whyMatch.length
        ? `<ul class="why-list">${whyMatch.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '<p class="meta">No specific reason text was available for this match.</p>';

      card.innerHTML = `
        <div class="match-card__head">
          <div>
            <p class="match-card__name">#${index + 1} ${commonName}</p>
            <p class="match-card__latin">${scientificName}</p>
          </div>
          <span class="match-card__score">Confidence ${score}%</span>
        </div>

        <div class="chips">
          <span class="${chipClass(edibilityRaw)}">Edibility: ${edibility}</span>
          <span class="${chipClass(psychedelicRaw)}">Psychedelic: ${psychedelic}</span>
        </div>

        <ul class="list">
          <li><strong>Key traits:</strong> ${traits.length ? traits.join('; ') : 'Key visible markers were limited in this photo set. Add clear close-ups of cap, gills, and stalk.'}</li>
        </ul>

        ${description ? `<p class="meta"><strong>Overview:</strong> ${description}</p>` : ''}
        ${taxonomyParts.length ? `<p class="meta"><strong>Taxonomy:</strong> ${taxonomyParts.join(' | ')}</p>` : ''}
        ${lookAlikes.length ? `<p class="meta"><strong>Look-alikes:</strong> ${lookAlikes.join(', ')}</p>` : ''}
        ${ids.length ? `<p class="meta"><strong>IDs:</strong> ${ids.join(' | ')}</p>` : ''}
        ${wikiUrl ? `<p class="meta"><a class="link" href="${wikiUrl}" target="_blank" rel="noopener noreferrer">Open species reference</a></p>` : ''}
        ${representativeImage ? `<img class="ref-image" src="${representativeImage}" alt="${commonName} reference image" loading="lazy" />` : ''}

        <p class="meta"><strong>Why this is a good match:</strong></p>
        ${whyMatchMarkup}

        <p class="warning">Caution: ${caution}</p>
      `;

      resultCards.appendChild(card);
    });
  }

  async function identifyWithApi(files) {
    const images = await Promise.all(files.map(fileToBase64));
    const photoRoles = files.map((_, index) => roleForIndex(index));
    const imageMeta = files.map((file) => ({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size
    }));

    const response = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, photoRoles, imageMeta })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Identification failed.');
    }

    return {
      matches: payload.matches || [],
      uploadGuidance: payload.uploadGuidance || null,
      consistencyCheck: payload.consistencyCheck || null
    };
  }

  photoInput.addEventListener('change', () => {
    const allFiles = Array.from(photoInput.files || []).filter((file) => file.type.startsWith('image/'));
    const selected = allFiles.slice(0, 5);

    renderSlots(selected);
    analyzeBtn.disabled = selected.length === 0;
    statusText.textContent = '';
    resultsSection.hidden = true;
    analysisSummary.textContent = '';

    if (allFiles.length > 5) {
      alert('You selected more than 5 images. Only the first 5 will be used.');
    }
  });

  analyzeBtn.addEventListener('click', async () => {
    const selected = Array.from(photoInput.files || [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 5);

    if (!selected.length) return;

    analyzeBtn.disabled = true;
    statusText.textContent = 'Analyzing photos...';

    try {
      const result = await identifyWithApi(selected);
      if (!result.matches.length) {
        throw new Error('No matches returned. Try clearer photos from multiple angles.');
      }

      renderSummary(result.uploadGuidance, result.consistencyCheck);
      renderMatches(result.matches);
      statusText.textContent = `Done. Showing top ${result.matches.length} matches.`;
      resultsSection.hidden = false;
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      statusText.textContent = error?.message || 'Identification failed.';
      resultsSection.hidden = true;
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  renderSlots([]);
})();
