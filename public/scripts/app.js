(function () {
  const photoInput = document.getElementById('photoInput');
  const cameraInput = document.getElementById('cameraInput');
  const selectPhotosBtn = document.getElementById('selectPhotosBtn');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const analyzeQuickBtn = document.getElementById('analyzeQuickBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearScanBtn = document.getElementById('clearScanBtn');
  const statusText = document.getElementById('statusText');
  const previewGrid = document.getElementById('previewGrid');
  const resultsSection = document.getElementById('results');
  const analysisSummary = document.getElementById('analysisSummary');
  const resultCards = document.getElementById('resultCards');
  const resultsSubheading = document.getElementById('resultsSubheading');
  const resultIdle = document.getElementById('resultIdle');
  const resultLoading = document.getElementById('resultLoading');
  const resultReady = document.getElementById('resultReady');
  const profileTitle = document.getElementById('profileTitle');
  const profileSubtitle = document.getElementById('profileSubtitle');
  const profileSections = document.getElementById('profileSections');

  let selectedSlots = Array.from({ length: 5 }, () => null);
  let pendingUploadSlotIndex = null;
  let hasLoadedResult = false;

  const slotNames = [
    'Photo 1 - Top of cap',
    'Photo 2 - Bottom / gills',
    'Photo 3 - Stalk',
    'Photo 4 - Environment',
    'Photo 5 - Extra detail'
  ];
  const slotRoles = ['top', 'gills', 'stalk', 'environment', 'extra'];
  const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const UPLOAD_OPTIMIZE_MIN_BYTES = 350 * 1024;
  const UPLOAD_MAX_DIMENSION_PX = 1800;
  const UPLOAD_MIN_DIMENSION_PX = 1280;
  const UPLOAD_JPEG_QUALITY = 0.84;
  const UPLOAD_MIN_JPEG_QUALITY = 0.68;
  const UPLOAD_TARGET_BYTES = 5 * 1024 * 1024;
  const IMAGE_DETAIL_CHECK_MAX_DIMENSION_PX = 96;

  function createEmptySlotState() {
    return Array.from({ length: 5 }, () => null);
  }

  function countSelectedSlots() {
    return selectedSlots.filter(Boolean).length;
  }

  function setAnalyzeButtonsDisabled(disabled) {
    if (analyzeBtn) analyzeBtn.disabled = disabled;
    if (analyzeQuickBtn) analyzeQuickBtn.disabled = disabled;
  }

  function selectedSlotEntries() {
    return selectedSlots
      .map((file, slotIndex) => (file ? { file, slotIndex } : null))
      .filter(Boolean);
  }

  function normalizeSlotIndex(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    if (parsed < 0 || parsed >= 5) return null;
    return parsed;
  }

  function roleForIndex(index) {
    return slotRoles[index] || 'extra';
  }

  function indexForRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    const index = slotRoles.indexOf(normalized);
    return index >= 0 ? index : null;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function ensureSentence(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    if (/[.!?]$/.test(value)) return value;
    return `${value}.`;
  }

  function formatNaturalList(items) {
    const values = Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean) : [];
    if (!values.length) return '';
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
  }

  function summarizeUploadedViews(uploadedRoles) {
    const uploaded = Array.isArray(uploadedRoles) ? uploadedRoles.filter(Boolean) : [];
    if (!uploaded.length) return 'No labeled views were recorded.';
    return ensureSentence(formatNaturalList(uploaded));
  }

  function summarizeMissingViews(missingRoles) {
    const missing = Array.isArray(missingRoles) ? missingRoles.filter(Boolean) : [];
    if (!missing.length) return 'None. You included all recommended views.';
    return ensureSentence(formatNaturalList(missing));
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


  function technicalWhyMatchItems(items) {
    const values = Array.isArray(items) ? items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean) : [];
    return values.filter((item) => {
      const lower = item.toLowerCase();
      if (lower.startsWith('high confidence prediction')) return false;
      if (lower.startsWith('moderate confidence prediction')) return false;
      if (lower.startsWith('low confidence prediction')) return false;
      if (lower.startsWith('for better quality, add:')) return false;
      if (lower.startsWith('you provided all core angles')) return false;
      if (lower.startsWith('safety signal indicates')) return false;
      if (lower.startsWith('this species is known to contain psychoactive compounds')) return false;
      return true;
    }).map(ensureSentence);
  }


  function formatTraitPairHtml(text) {
    const value = ensureSentence(String(text || '').trim());
    if (!value) return '';
    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) return escapeHtml(value);

    const label = value.slice(0, colonIndex + 1).trim();
    const answer = value.slice(colonIndex + 1).trim();
    if (!answer) return `<span class="trait-label">${escapeHtml(label)}</span>`;

    return `<span class="trait-pair"><span class="trait-label">${escapeHtml(label)}</span> <span class="trait-value">${escapeHtml(answer)}</span></span>`;
  }

  function formatTraitListHtml(items, maxItems = 4) {
    const values = Array.isArray(items) ? items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean).slice(0, maxItems) : [];
    if (!values.length) return '';
    return values.map(formatTraitPairHtml).filter(Boolean).join(' <span class="trait-divider" aria-hidden="true">•</span> ');
  }

  function formatInlineTraitPairHtml(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';

    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) return escapeHtml(value);

    const label = value.slice(0, colonIndex + 1).trim();
    const answer = value.slice(colonIndex + 1).trim();
    if (!answer) return `<span class="trait-label">${escapeHtml(label)}</span>`;

    return `<span class="trait-pair"><span class="trait-label">${escapeHtml(label)}</span> <span class="trait-value">${escapeHtml(answer)}</span></span>`;
  }

  function formatTechnicalMarkerHtml(text) {
    const value = ensureSentence(String(text || '').trim());
    if (!value) return '';

    const markerPrefix = /^Key visual traits align:\s*/i;
    if (!markerPrefix.test(value)) {
      return escapeHtml(value);
    }

    const prefixMatch = value.match(/^([^:]+:)\s*(.*)$/);
    if (!prefixMatch) return escapeHtml(value);

    const prefix = prefixMatch[1];
    let remainder = prefixMatch[2] || '';
    let trailingPunctuation = '';

    if (/[.!?]$/.test(remainder)) {
      trailingPunctuation = remainder.slice(-1);
      remainder = remainder.slice(0, -1);
    }

    const parts = remainder
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!parts.length) {
      return escapeHtml(value);
    }

    const formattedParts = parts.map(formatInlineTraitPairHtml).filter(Boolean);
    if (!formattedParts.length) {
      return escapeHtml(value);
    }

    return `${escapeHtml(prefix)} ${formattedParts.join('; ')}${escapeHtml(trailingPunctuation)}`;
  }

  function firstSentence(text, fallback = '') {
    const value = String(text || '').trim();
    if (!value) return fallback;
    const normalized = value.replace(/\s+/g, ' ').trim();
    const match = normalized.match(/^(.{20,240}?[.!?])(?:\s|$)/);
    if (match && match[1]) return match[1].trim();
    return normalized.length > 240 ? `${normalized.slice(0, 237).trim()}...` : normalized;
  }

  function excerptSentences(text, maxSentences = 2, maxChars = 420) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';

    const matches = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const picked = [];
    let length = 0;
    for (const raw of matches) {
      const sentence = ensureSentence(raw.trim());
      if (!sentence) continue;
      const nextLength = length + (picked.length ? 1 : 0) + sentence.length;
      if (picked.length >= maxSentences || nextLength > maxChars) break;
      picked.push(sentence);
      length = nextLength;
    }

    if (picked.length) return picked.join(' ');
    return value.length > maxChars ? ensureSentence(`${value.slice(0, maxChars - 3).trim()}...`) : ensureSentence(value);
  }

  function buildReferenceProfileSummary(match) {
    if (!match || typeof match !== 'object') {
      return 'Species details are limited for this result.';
    }

    const label = String(match.commonName || match.scientificName || 'this mushroom').trim();
    const description = firstSentence(match.description || '');
    const traits = Array.isArray(match.traits) ? match.traits.filter(Boolean).slice(0, 3) : [];

    if (description) {
      return `Species profile for ${label}: ${ensureSentence(description)}`;
    }

    if (traits.length) {
      return `Species profile for ${label}: reported identification markers include ${traits.join(', ')}.`;
    }

    return `Species profile for ${label}: detailed field notes were limited in the current source data.`;
  }

  function buildConfidenceGuidance(score, missingRoles = []) {
    const n = Number(score);
    const missing = Array.isArray(missingRoles) ? missingRoles.filter(Boolean) : [];
    const missingHint = missing.length ? ` Helpful next photos: ${missing.slice(0, 3).join(', ')}.` : '';

    if (!Number.isFinite(n)) {
      return 'Use this as a starting point only and confirm with additional photos.';
    }
    if (n < 25) {
      return `Low-confidence visual match. Treat this as a lead, not an identification.${missingHint || ' Add clearer cap, gill, and stalk photos.'}`;
    }
    if (n < 55) {
      return `Tentative visual match. More angles and sharper close-ups may improve the result.${missingHint}`;
    }
    if (n < 80) {
      return `Moderate visual match. A clearer gill and stalk view can help confirm it.${missingHint}`;
    }
    return 'Strong visual match signal. Confirm locally before handling or consuming any wild mushroom.';
  }

  function friendlyConsistencyMessage(consistencyCheck, context = {}) {
    if (!consistencyCheck || typeof consistencyCheck !== 'object') {
      return 'We could not run the photo cross-check this time, but the result can still be used as a starting point.';
    }

    const perPhoto = Array.isArray(consistencyCheck.perPhoto) ? consistencyCheck.perPhoto : [];
    const topScore = Number(context.topScore);
    const uploadedCount = Number(context.uploadedCount);

    if (consistencyCheck.likelyMixed) {
      const strong = perPhoto
        .filter((item) => Number(item?.confidence) >= 60 && String(item?.topMatch || '').trim())
        .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));

      const first = strong[0] || perPhoto[0] || null;
      const second = strong.find((item) => first && item.photoNumber !== first.photoNumber && item.topMatch !== first.topMatch) || perPhoto.find((item) => first && item.photoNumber !== first.photoNumber) || null;

      if (first && second) {
        const firstLabel = String(first.commonName || first.topMatch || `photo ${first.photoNumber}`).trim();
        const secondLabel = String(second.commonName || second.topMatch || `photo ${second.photoNumber}`).trim();
        return `These photos may show more than one mushroom. Photo ${first.photoNumber} looks closer to ${firstLabel}, while photo ${second.photoNumber} looks closer to ${secondLabel}. For better results, scan one mushroom at a time.`;
      }

      return 'These photos may show more than one mushroom. For better results, scan one mushroom at a time.';
    }

    const reason = String(consistencyCheck.reason || '').toLowerCase();
    const raw = String(consistencyCheck.message || '').toLowerCase();
    const onePhoto = reason === 'single_photo' || raw.includes('only one photo') || (Number.isFinite(uploadedCount) && uploadedCount <= 1) || perPhoto.length === 1;
    if (onePhoto) {
      return 'You uploaded one photo, so there was nothing to compare across photos. Add 2-4 angles for a stronger cross-check.';
    }

    const skipped = reason === 'high_confidence' || raw.includes('skipped') || raw.includes('high-confidence') || raw.includes('clearly ahead');
    if (skipped) {
      if (Number.isFinite(topScore) && topScore < 40) {
        return 'We skipped the extra photo cross-check on this scan. The match is still low confidence, so add clearer cap, gill, and stalk photos before relying on it.';
      }
      return 'We skipped the extra photo cross-check because the first result scored much higher than the other options in this scan.';
    }

    if (reason === 'disabled') {
      return 'We could not run the extra photo cross-check right now, but the result can still be used as a starting point.';
    }

    return 'Your photos appear consistent with one mushroom specimen, which helps improve match quality.';
  }

  function setResultsState(state) {
    if (!resultsSection) return;
    if (resultIdle) resultIdle.hidden = state !== 'idle';
    if (resultLoading) resultLoading.hidden = state !== 'loading';
    if (resultReady) resultReady.hidden = state !== 'ready';
    resultsSection.dataset.state = state;
  }

  function replayProfileSectionFlyout() {
    if (!profileSections) return;
    profileSections.classList.remove('profile-sections--animate');

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (profileSections.childElementCount > 0) {
          profileSections.classList.add('profile-sections--animate');
        }
      });
    });
  }

  function flashRestoredResultsPanel() {
    if (!resultsSection) return;
    resultsSection.classList.remove('results--restored-focus');
    window.requestAnimationFrame(() => {
      resultsSection.classList.add('results--restored-focus');
      window.setTimeout(() => {
        resultsSection.classList.remove('results--restored-focus');
      }, 1400);
    });
  }

  function blobToBase64(blob, label = 'image') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Failed to read ${label}`));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
    });
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load ${file.name}`));
      };
      image.src = url;
    });
  }

  function assessImageVisualQuality(image) {
    try {
      const width = Number(image?.naturalWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.height || 0);
      if (!width || !height) return { lowDetail: false, blankLike: false };

      const scale = Math.min(1, IMAGE_DETAIL_CHECK_MAX_DIMENSION_PX / Math.max(width, height));
      const targetWidth = Math.max(8, Math.round(width * scale));
      const targetHeight = Math.max(8, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) return { lowDetail: false, blankLike: false };

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
      if (!data || !data.length) return { lowDetail: false, blankLike: false };

      let min = 255;
      let max = 0;
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      let edgeSum = 0;
      let edgeCount = 0;
      const prevRow = new Float32Array(targetWidth);

      for (let y = 0; y < targetHeight; y += 1) {
        let left = null;
        for (let x = 0; x < targetWidth; x += 1) {
          const idx = (y * targetWidth + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          if (luma < min) min = luma;
          if (luma > max) max = luma;
          sum += luma;
          sumSq += luma * luma;
          count += 1;

          if (left !== null) {
            edgeSum += Math.abs(luma - left);
            edgeCount += 1;
          }
          if (y > 0) {
            edgeSum += Math.abs(luma - prevRow[x]);
            edgeCount += 1;
          }

          prevRow[x] = luma;
          left = luma;
        }
      }

      if (!count) return { lowDetail: false, blankLike: false };

      const mean = sum / count;
      const variance = Math.max(0, (sumSq / count) - (mean * mean));
      const dynamicRange = max - min;
      const edgeMean = edgeCount ? edgeSum / edgeCount : 0;

      const blankLike = dynamicRange < 10 && variance < 20 && edgeMean < 2.2;
      const lowDetail = blankLike || (dynamicRange < 22 && variance < 110 && edgeMean < 4.8);

      return { lowDetail, blankLike, dynamicRange, variance, edgeMean };
    } catch {
      return { lowDetail: false, blankLike: false };
    }
  }

  async function prepareImageForUpload(file) {
    let loadedImage = null;
    let quality = null;

    const fallback = async () => ({
      base64: await blobToBase64(file, file.name),
      mimeType: file.type || 'application/octet-stream',
      size: Number(file.size) || 0,
      optimized: false,
      quality
    });

    const mimeType = String(file.type || '').toLowerCase();
    const originalSize = Number(file.size) || 0;

    try {
      loadedImage = await loadImageFromFile(file);
      quality = assessImageVisualQuality(loadedImage);
    } catch {
      loadedImage = null;
      quality = null;
    }

    if (!COMPRESSIBLE_IMAGE_TYPES.has(mimeType) || originalSize < UPLOAD_OPTIMIZE_MIN_BYTES) {
      return fallback();
    }

    if (!loadedImage) {
      return fallback();
    }

    try {
      const image = loadedImage;
      const srcWidth = Number(image.naturalWidth || image.width || 0);
      const srcHeight = Number(image.naturalHeight || image.height || 0);
      if (!srcWidth || !srcHeight) {
        return fallback();
      }

      let scale = Math.min(1, UPLOAD_MAX_DIMENSION_PX / Math.max(srcWidth, srcHeight));
      let qualityLevel = UPLOAD_JPEG_QUALITY;
      let bestBlob = null;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const targetWidth = Math.max(1, Math.round(srcWidth * scale));
        const targetHeight = Math.max(1, Math.round(srcHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          return fallback();
        }

        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        const candidate = await canvasToBlob(canvas, 'image/jpeg', qualityLevel);
        if (candidate && candidate.size) {
          if (!bestBlob || candidate.size < bestBlob.size) {
            bestBlob = candidate;
          }
          if (candidate.size <= UPLOAD_TARGET_BYTES) {
            bestBlob = candidate;
            break;
          }
        }

        qualityLevel = Math.max(UPLOAD_MIN_JPEG_QUALITY, qualityLevel - 0.06);
        const maxCurrent = Math.max(targetWidth, targetHeight);
        if (maxCurrent > UPLOAD_MIN_DIMENSION_PX) {
          scale = Math.max(UPLOAD_MIN_DIMENSION_PX / Math.max(srcWidth, srcHeight), scale * 0.88);
        }
      }

      if (!bestBlob || !bestBlob.size) {
        return fallback();
      }

      if (bestBlob.size >= originalSize * 0.98 && scale >= 0.999) {
        return fallback();
      }

      return {
        base64: await blobToBase64(bestBlob, file.name),
        mimeType: 'image/jpeg',
        size: bestBlob.size,
        optimized: true,
        quality
      };
    } catch {
      return fallback();
    }
  }

  function normalizeIdentifyErrorMessage(error) {
    const raw = String(error?.message || '').trim();
    const lower = raw.toLowerCase();
    if (!raw) return 'Analysis failed.';

    if (lower.includes('too large') || (lower.includes('exceeds') && lower.includes('mb'))) {
      return 'One photo is too large after optimization. Try a closer crop or a lower-resolution photo.';
    }

    if (lower.includes('blank') || lower.includes('low-detail')) {
      return 'The uploaded photo looks blank or too low-detail for identification. Try a closer, well-lit mushroom photo.';
    }

    return ensureSentence(raw);
  }



  function createEmptySlotPlaceholder(index) {
    const shell = document.createElement('div');
    shell.className = 'preview-card__empty preview-card__empty--action';
    shell.dataset.uploadSource = 'select';
    shell.dataset.slotIndex = String(index);
    shell.setAttribute('role', 'button');
    shell.setAttribute('tabindex', '0');
    shell.setAttribute('aria-label', `Add ${slotNames[index]}`);

    const plus = document.createElement('span');
    plus.className = 'preview-card__plus';
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';

    const text = document.createElement('span');
    text.className = 'preview-card__empty-text';
    text.textContent = 'Add photo';

    const actions = document.createElement('div');
    actions.className = 'preview-card__empty-actions';

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'preview-card__slot-action';
    selectBtn.dataset.uploadSource = 'select';
    selectBtn.dataset.slotIndex = String(index);
    selectBtn.textContent = 'Select';
    selectBtn.setAttribute('aria-label', `Select a photo for ${slotNames[index]}`);

    const cameraBtn = document.createElement('button');
    cameraBtn.type = 'button';
    cameraBtn.className = 'preview-card__slot-action preview-card__slot-action--camera';
    cameraBtn.dataset.uploadSource = 'camera';
    cameraBtn.dataset.slotIndex = String(index);
    cameraBtn.textContent = 'Camera';
    cameraBtn.setAttribute('aria-label', `Take a photo for ${slotNames[index]}`);

    actions.appendChild(selectBtn);
    actions.appendChild(cameraBtn);
    shell.appendChild(plus);
    shell.appendChild(text);
    shell.appendChild(actions);
    return shell;
  }

  function clearRenderedResultsForNewSelection() {
    hasLoadedResult = false;
    statusText.textContent = '';
    analysisSummary.textContent = '';
    analysisSummary.hidden = true;
    resultCards.innerHTML = '';
    if (resultsSubheading) resultsSubheading.textContent = 'Similar Matches';
    if (profileSections) profileSections.innerHTML = '';
    if (profileTitle) profileTitle.textContent = 'Top Match';
    if (profileSubtitle) profileSubtitle.textContent = '';
    const url = new URL(window.location.href);
    if (url.searchParams.has('uploadId')) {
      url.searchParams.delete('uploadId');
      window.history.replaceState({}, '', url.toString());
    }
    setResultsState('idle');
    refreshActionButtons();
  }

  function refreshActionButtons() {
    const selectedCount = countSelectedSlots();
    setAnalyzeButtonsDisabled(selectedCount === 0);
    if (clearScanBtn) {
      clearScanBtn.disabled = selectedCount === 0 && !hasLoadedResult;
    }
  }

  function refreshSelectedFilesUi() {
    renderSlots(selectedSlots);
    refreshActionButtons();
  }

  function orderedEmptySlotIndexes(preferredSlotIndex = null) {
    const preferred = normalizeSlotIndex(preferredSlotIndex);
    const ordered = [];
    if (preferred !== null && !selectedSlots[preferred]) {
      ordered.push(preferred);
    }

    if (preferred === null) {
      for (let i = 0; i < 5; i += 1) {
        if (!selectedSlots[i]) ordered.push(i);
      }
      return ordered;
    }

    for (let i = preferred + 1; i < 5; i += 1) {
      if (!selectedSlots[i]) ordered.push(i);
    }
    for (let i = 0; i < preferred; i += 1) {
      if (!selectedSlots[i]) ordered.push(i);
    }
    return ordered;
  }

  function mergeIncomingFiles(fileList, sourceLabel, preferredSlotIndex = null) {
    const picked = Array.from(fileList || []);
    const incoming = picked.filter((file) => String(file.type || '').startsWith('image/'));
    if (!incoming.length) {
      if (picked.length) {
        statusText.textContent = 'Please choose a photo file (JPG, PNG, or WebP).';
      }
      return;
    }

    const availableTargets = orderedEmptySlotIndexes(preferredSlotIndex);
    if (!availableTargets.length) {
      statusText.textContent = 'You already have 5 photos. Analyze or start a new scan.';
      return;
    }

    const accepted = incoming.slice(0, availableTargets.length);
    const nextSlots = selectedSlots.slice();
    const placedIndexes = [];

    accepted.forEach((file, idx) => {
      const slotIndex = availableTargets[idx];
      nextSlots[slotIndex] = file;
      placedIndexes.push(slotIndex);
    });

    selectedSlots = nextSlots;

    refreshSelectedFilesUi();
    clearRenderedResultsForNewSelection();

    const addedCount = accepted.length;
    const selectedCount = countSelectedSlots();
    const droppedCount = Math.max(0, incoming.length - accepted.length);

    if (addedCount === 1 && placedIndexes.length === 1) {
      const slotLabel = slotNames[placedIndexes[0]] || `Photo ${placedIndexes[0] + 1}`;
      statusText.textContent = `Added photo to ${slotLabel}. ${selectedCount}/5 selected.`;
      return;
    }

    if (droppedCount > 0) {
      statusText.textContent = `Added ${addedCount} photos from ${sourceLabel}. Max 5 photos per scan.`;
      return;
    }

    statusText.textContent = `Added ${addedCount} photo${addedCount === 1 ? '' : 's'} from ${sourceLabel}. ${selectedCount}/5 selected.`;
  }

  function openPhotoSource(source, slotIndex = null) {
    pendingUploadSlotIndex = normalizeSlotIndex(slotIndex);
    if (source === 'camera') {
      if (cameraInput) cameraInput.click();
      return;
    }
    if (photoInput) photoInput.click();
  }

  function clearCurrentScan() {
    selectedSlots = createEmptySlotState();
    pendingUploadSlotIndex = null;
    clearRenderedResultsForNewSelection();
    renderSlots(selectedSlots);
    if (photoInput) photoInput.value = '';
    if (cameraInput) cameraInput.value = '';
    statusText.textContent = 'Ready for a new scan. Add photos to start.';
    document.querySelectorAll('.portfolio-card--active').forEach((card) => {
      card.classList.remove('portfolio-card--active');
    });
    refreshActionButtons();
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
        card.appendChild(createEmptySlotPlaceholder(index));
      }

      previewGrid.appendChild(card);
    }
  }

  function renderSavedSlots(images) {
    previewGrid.innerHTML = '';
    const incoming = Array.isArray(images) ? images.slice(0, 5) : [];
    const saved = createEmptySlotState();
    const overflow = [];

    incoming.forEach((imageItem) => {
      const preferredIndex = indexForRole(imageItem?.role);
      if (preferredIndex !== null && !saved[preferredIndex]) {
        saved[preferredIndex] = imageItem;
        return;
      }
      overflow.push(imageItem);
    });

    overflow.forEach((imageItem) => {
      const nextIndex = saved.findIndex((slot) => !slot);
      if (nextIndex >= 0) saved[nextIndex] = imageItem;
    });

    for (let index = 0; index < 5; index += 1) {
      const card = document.createElement('article');
      card.className = 'preview-card';

      const label = document.createElement('p');
      label.className = 'preview-card__label';
      label.textContent = slotNames[index];
      card.appendChild(label);

      const imageItem = saved[index];
      if (imageItem && imageItem.previewUrl) {
        const image = document.createElement('img');
        image.className = 'preview-card__image';
        image.src = imageItem.previewUrl;
        image.alt = imageItem.filename || slotNames[index];
        card.appendChild(image);

        const fileName = document.createElement('p');
        fileName.className = 'preview-card__file';
        fileName.textContent = imageItem.filename || `Saved image ${index + 1}`;
        card.appendChild(fileName);
      } else {
        card.appendChild(createEmptySlotPlaceholder(index));
      }

      previewGrid.appendChild(card);
    }
  }

  function renderSummary(uploadGuidance, consistencyCheck, topScore = null, options = {}) {
    if (!analysisSummary) return;
    analysisSummary.textContent = '';
    analysisSummary.hidden = true;
  }

  function renderProfileSections(matches, uploadGuidance, consistencyCheck) {
    if (!profileSections) return;

    const allMatches = Array.isArray(matches) ? matches : [];
    const topMatch = allMatches[0] || null;
    if (!topMatch) {
      profileSections.innerHTML = '';
      if (profileTitle) profileTitle.textContent = 'Top Match';
      if (profileSubtitle) profileSubtitle.textContent = '';
      return;
    }

    const commonName = topMatch.commonName || topMatch.scientificName || 'Unknown species';
    const scientificName = topMatch.scientificName || commonName;
    const score = Number.isFinite(Number(topMatch.score)) ? Number(topMatch.score) : 0;
    const edibility = topMatch.edible || 'Unknown';
    const psychedelic = topMatch.psychedelic || 'Unknown';
    const traits = Array.isArray(topMatch.traits) ? topMatch.traits.filter(Boolean) : [];
    const whyMatch = technicalWhyMatchItems(topMatch.whyMatch);
    const lookAlikes = Array.isArray(topMatch.lookAlikes) ? topMatch.lookAlikes.filter(Boolean) : [];
    const representativeImage = String(topMatch.representativeImage || '').trim();
    const description = String(topMatch.description || '').trim();
    const caution = ensureSentence(String(topMatch.caution || 'Do not consume without expert verification.').trim());
    const wikiUrl = String(topMatch.wikiUrl || '').trim();
    const taxonomy = topMatch.taxonomy && typeof topMatch.taxonomy === 'object' ? topMatch.taxonomy : null;
    const educationalOverview = excerptSentences(description, 3, 560);

    if (profileTitle) profileTitle.textContent = commonName;
    if (profileSubtitle) {
      profileSubtitle.innerHTML = `${escapeHtml(scientificName)} <span aria-hidden="true">•</span> <strong>${escapeHtml(`${score}% confidence`)}</strong>`;
    }

    const uploadedRoles = Array.isArray(uploadGuidance?.uploadedRoles) ? uploadGuidance.uploadedRoles : [];
    const missingRoles = Array.isArray(uploadGuidance?.missingRecommendedRoles) ? uploadGuidance.missingRecommendedRoles : [];

    const taxonomyParts = [];
    if (taxonomy?.genus) taxonomyParts.push(`Genus: ${taxonomy.genus}`);
    if (taxonomy?.family) taxonomyParts.push(`Family: ${taxonomy.family}`);
    if (taxonomy?.order) taxonomyParts.push(`Order: ${taxonomy.order}`);

    const keyTraitsHtml = formatTraitListHtml(traits, 4);

    const topPanelItems = [];
    topPanelItems.push(`<div class="chips"><span class="${chipClass(edibility)}">Edibility: ${escapeHtml(edibility)}</span><span class="${chipClass(psychedelic)}">Psychedelic: ${escapeHtml(psychedelic)}</span></div>`);
    topPanelItems.push(`<p class="profile-copy">${escapeHtml(buildReferenceProfileSummary(topMatch))}</p>`);
    if (representativeImage) {
      topPanelItems.push(`<img class="profile-ref-image" src="${escapeHtml(representativeImage)}" alt="${escapeHtml(commonName)} reference image" loading="lazy" />`);
    }
    if (educationalOverview) {
      topPanelItems.push(`<p class="profile-copy"><strong>About this species:</strong> ${escapeHtml(educationalOverview)}</p>`);
    }
    topPanelItems.push(`<p class="profile-copy"><strong>Confidence:</strong> ${escapeHtml(`${score}%`)} <span aria-hidden="true">•</span> ${escapeHtml(buildConfidenceGuidance(score, missingRoles))}</p>`);
    topPanelItems.push(`<p class="profile-copy"><strong>Photo cross-check:</strong> ${escapeHtml(friendlyConsistencyMessage(consistencyCheck, { topScore: score, uploadedCount: uploadedRoles.length }))}</p>`);
    topPanelItems.push(`<p class="profile-copy"><strong>Key traits:</strong> ${keyTraitsHtml || 'Technical field markers were limited for this result.'}</p>`);
    topPanelItems.push(`<p class="profile-copy"><strong>Labeled views:</strong> ${escapeHtml(summarizeUploadedViews(uploadedRoles))}</p>`);
    topPanelItems.push(`<p class="profile-copy"><strong>Recommended views still helpful:</strong> ${escapeHtml(summarizeMissingViews(missingRoles))}</p>`);
    topPanelItems.push('<p class="profile-copy"><strong>View labels:</strong> Based on the photo box you used.</p>');

    if (taxonomyParts.length) {
      topPanelItems.push(`<p class="profile-copy"><strong>Taxonomy:</strong> ${escapeHtml(taxonomyParts.join(' | '))}</p>`);
    }
    if (lookAlikes.length) {
      topPanelItems.push(`<p class="profile-copy"><strong>Look-alikes:</strong> ${escapeHtml(ensureSentence(lookAlikes.join(', ')))}</p>`);
    }
    if (whyMatch.length) {
      topPanelItems.push(`<p class="profile-copy"><strong>Technical match markers:</strong></p><ul class="profile-list">${whyMatch.slice(0, 3).map((item) => `<li>${formatTechnicalMarkerHtml(item)}</li>`).join('')}</ul>`);
    }
    topPanelItems.push(`<p class="profile-copy profile-copy--warning">${escapeHtml(caution)}</p>`);
    if (wikiUrl) {
      topPanelItems.push(`<p class="profile-copy"><a class="link" href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener noreferrer">Learn more about this mushroom!</a></p>`);
    }

    profileSections.innerHTML = `
      <section class="profile-section profile-section--accent profile-section--single" style="--fly-delay:0ms">
        <div class="profile-section__body">${topPanelItems.join('')}</div>
      </section>
    `;
  }

  function renderMatches(matches, uploadGuidance, consistencyCheck) {
    resultCards.innerHTML = '';
    renderProfileSections(matches, uploadGuidance, consistencyCheck);

    if (analysisSummary) {
      analysisSummary.hidden = true;
      analysisSummary.textContent = '';
    }

    const similarMatches = Array.isArray(matches) ? matches.slice(1, 3) : [];
    if (resultsSubheading) {
      resultsSubheading.textContent = similarMatches.length ? 'Similar Matches' : 'Other Matches';
    }

    if (!similarMatches.length) {
      const empty = document.createElement('article');
      empty.className = 'match-card match-card--compact';
      empty.innerHTML = '<p class="meta">No additional similar matches were returned for this scan.</p>';
      resultCards.appendChild(empty);
      return;
    }

    similarMatches.forEach((mushroom, index) => {
      const card = document.createElement('article');
      card.className = 'match-card match-card--compact';
      card.style.setProperty('--match-delay', `${index * 60}ms`);

      const commonName = escapeHtml(mushroom.commonName || 'Unknown species');
      const scientificName = escapeHtml(mushroom.scientificName || commonName);
      const edibilityRaw = mushroom.edible || 'Unknown';
      const psychedelicRaw = mushroom.psychedelic || 'Unknown';
      const edibility = escapeHtml(edibilityRaw);
      const psychedelic = escapeHtml(psychedelicRaw);
      const caution = escapeHtml(ensureSentence(mushroom.caution || 'Do not consume without expert verification.'));
      const description = mushroom.description ? escapeHtml(excerptSentences(mushroom.description, 2, 320)) : '';
      const wikiUrl = mushroom.wikiUrl ? escapeHtml(mushroom.wikiUrl) : '';
      const traitItems = Array.isArray(mushroom.traits) ? mushroom.traits.filter(Boolean).slice(0, 3) : [];
      const traitsHtml = formatTraitListHtml(traitItems, 3);
      const lookAlikes = Array.isArray(mushroom.lookAlikes) ? mushroom.lookAlikes.filter(Boolean).slice(0, 3).map((item) => escapeHtml(item)) : [];
      const whyMatch = technicalWhyMatchItems(mushroom.whyMatch).slice(0, 2).map(formatTechnicalMarkerHtml);
      const score = Number.isFinite(Number(mushroom.score)) ? Number(mushroom.score) : 0;

      const whyMatchMarkup = whyMatch.length
        ? `<ul class="why-list why-list--compact">${whyMatch.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '';

      card.innerHTML = `
        <div class="match-card__head">
          <div>
            <p class="match-card__name">#${index + 2} ${commonName}</p>
            <p class="match-card__latin">${scientificName}</p>
          </div>
          <span class="match-card__score">Confidence ${score}%</span>
        </div>

        <div class="chips">
          <span class="${chipClass(edibilityRaw)}">Edibility: ${edibility}</span>
          <span class="${chipClass(psychedelicRaw)}">Psychedelic: ${psychedelic}</span>
        </div>

        <p class="meta"><strong>Key traits:</strong> ${traitsHtml || 'Technical field markers were limited for this result.'}</p>
        ${description ? `<p class="meta"><strong>About this species:</strong> ${description}</p>` : ''}
        ${lookAlikes.length ? `<p class="meta"><strong>Look-alikes:</strong> ${escapeHtml(ensureSentence(lookAlikes.join(', ')))}</p>` : ''}
        ${whyMatchMarkup ? `<p class="meta"><strong>Technical match markers:</strong></p>${whyMatchMarkup}` : ''}
        ${wikiUrl ? `<p class="meta"><a class="link" href="${wikiUrl}" target="_blank" rel="noopener noreferrer">Learn more about this mushroom!</a></p>` : ''}
        <p class="warning">Caution: ${caution}</p>
      `;

      resultCards.appendChild(card);
    });
  }

  async function identifyWithApi(slotEntries) {
    const preparedImages = await Promise.all(slotEntries.map((entry) => prepareImageForUpload(entry.file)));
    const images = preparedImages.map((item) => item.base64);
    const photoRoles = slotEntries.map((entry) => roleForIndex(entry.slotIndex));

    const blankLikeCount = preparedImages.filter((item) => Boolean(item?.quality?.blankLike)).length;
    const lowDetailCount = preparedImages.filter((item) => Boolean(item?.quality?.lowDetail) && !Boolean(item?.quality?.blankLike)).length;
    if (images.length > 0 && blankLikeCount === images.length) {
      throw new Error('All selected photos look blank or too low-detail for identification.');
    }

    const imageMeta = slotEntries.map((entry, index) => ({
      filename: entry.file.name,
      mimeType: preparedImages[index]?.mimeType || entry.file.type || 'application/octet-stream',
      size: preparedImages[index]?.size || entry.file.size
    }));

    const response = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, photoRoles, imageMeta })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Analysis failed.');
    }

    const optimizedCount = preparedImages.filter((item) => item && item.optimized).length;

    let qualityNotice = '';
    if (blankLikeCount > 0) {
      qualityNotice = blankLikeCount === 1
        ? 'One uploaded photo looked blank or nearly blank and may reduce accuracy.'
        : `${blankLikeCount} uploaded photos looked blank or nearly blank and may reduce accuracy.`;
    } else if (lowDetailCount > 0) {
      qualityNotice = lowDetailCount === 1
        ? 'One uploaded photo had very little visual detail (for example blur, darkness, or a blank surface) and may reduce accuracy.'
        : `${lowDetailCount} uploaded photos had very little visual detail (for example blur, darkness, or blank surfaces) and may reduce accuracy.`;
    }

    return {
      matches: payload.matches || [],
      uploadGuidance: payload.uploadGuidance || null,
      consistencyCheck: payload.consistencyCheck || null,
      uploadId: payload.uploadId || null,
      optimizedCount,
      qualityNotice
    };
  }

  async function loadSavedUpload(uploadId, options = {}) {
    const savedUploadId = String(uploadId || '').trim();
    if (!savedUploadId) return;

    const shouldScroll = Boolean(options.scrollToResults);
    const shouldUpdateUrl = options.updateUrl !== false;

    statusText.textContent = 'Loading saved result...';
    setResultsState('loading');
    try {
      const response = await fetch(`/api/user/uploads/${encodeURIComponent(savedUploadId)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Could not load saved result.');
      }

      const upload = payload.upload || null;
      if (!upload || !Array.isArray(upload.matches) || !upload.matches.length) {
        throw new Error('Saved result data is incomplete.');
      }

      selectedSlots = createEmptySlotState();
      pendingUploadSlotIndex = null;
      hasLoadedResult = true;
      renderSavedSlots(Array.isArray(upload.images) ? upload.images : []);
      renderSummary(upload.uploadGuidance, upload.consistencyCheck, upload.matches?.[0]?.score);
      renderMatches(upload.matches, upload.uploadGuidance, upload.consistencyCheck);
      setResultsState('ready');
      replayProfileSectionFlyout();
      refreshActionButtons();
      statusText.textContent = 'Showing saved result. Add photos for a new scan.';

      if (shouldUpdateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('uploadId', savedUploadId);
        window.history.pushState({}, '', url.toString());
      }

      if (shouldScroll) {
        flashRestoredResultsPanel();
        const scrollTarget = previewGrid || resultsSection;
        if (scrollTarget) {
          const top = Math.max(0, window.scrollY + scrollTarget.getBoundingClientRect().top - 110);
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }
    } catch (error) {
      statusText.textContent = error?.message || 'Could not load saved result.';
      setResultsState('idle');
    }
  }

  async function loadSavedUploadFromQuery() {
    const url = new URL(window.location.href);
    const uploadId = String(url.searchParams.get('uploadId') || '').trim();
    if (!uploadId) {
      setResultsState('idle');
      return;
    }
    await loadSavedUpload(uploadId, { scrollToResults: false, updateUrl: false });
  }

  previewGrid.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest('[data-upload-source]');
    if (!action) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const source = String(action.getAttribute('data-upload-source') || 'select').trim().toLowerCase();
    const slotIndex = normalizeSlotIndex(action.getAttribute('data-slot-index'));
    openPhotoSource(source === 'camera' ? 'camera' : 'select', slotIndex);
  });

  previewGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest('[data-upload-source]');
    if (!action) return;
    const source = String(action.getAttribute('data-upload-source') || 'select').trim().toLowerCase();
    const slotIndex = normalizeSlotIndex(action.getAttribute('data-slot-index'));
    openPhotoSource(source === 'camera' ? 'camera' : 'select', slotIndex);
  });

  if (selectPhotosBtn) {
    selectPhotosBtn.addEventListener('click', () => {
      openPhotoSource('select');
    });
  }

  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', () => {
      openPhotoSource('camera');
    });
  }

  if (clearScanBtn) {
    clearScanBtn.addEventListener('click', () => {
      clearCurrentScan();
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const targetSlotIndex = pendingUploadSlotIndex;
      mergeIncomingFiles(photoInput.files, 'Select Photos', targetSlotIndex);
      pendingUploadSlotIndex = null;
      photoInput.value = '';
    });
  }

  if (cameraInput) {
    cameraInput.addEventListener('change', () => {
      const targetSlotIndex = pendingUploadSlotIndex;
      mergeIncomingFiles(cameraInput.files, 'Camera', targetSlotIndex);
      pendingUploadSlotIndex = null;
      cameraInput.value = '';
    });
  }

  async function runAnalyze() {
    const selected = selectedSlotEntries();

    if (!selected.length) {
      statusText.textContent = 'Add at least one photo before analyzing.';
      setResultsState('idle');
      refreshActionButtons();
      return;
    }

    setAnalyzeButtonsDisabled(true);
    statusText.textContent = 'Optimizing and analyzing...';
    setResultsState('loading');

    try {
      const result = await identifyWithApi(selected);
      if (!result.matches.length) {
        throw new Error('No matches returned. Try clearer photos.');
      }

      renderSummary(result.uploadGuidance, result.consistencyCheck, result.matches?.[0]?.score, { qualityNotice: result.qualityNotice });
      renderMatches(result.matches, result.uploadGuidance, result.consistencyCheck);

      const baseStatus = result.optimizedCount
        ? `Done. Optimized ${result.optimizedCount} photo${result.optimizedCount === 1 ? '' : 's'} and showed top ${result.matches.length} matches.`
        : `Done. Showing top ${result.matches.length} matches.`;
      statusText.textContent = result.qualityNotice ? `${baseStatus} ${ensureSentence(result.qualityNotice)}` : baseStatus;

      hasLoadedResult = true;
      setResultsState('ready');
      replayProfileSectionFlyout();
      refreshActionButtons();

      if (result.uploadId) {
        const url = new URL(window.location.href);
        url.searchParams.set('uploadId', result.uploadId);
        window.history.replaceState({}, '', url.toString());
        window.dispatchEvent(new CustomEvent('amushroom:upload-saved', {
          detail: { uploadId: result.uploadId }
        }));
      }
    } catch (error) {
      statusText.textContent = normalizeIdentifyErrorMessage(error);
      setResultsState('idle');
    } finally {
      refreshActionButtons();
    }
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      runAnalyze();
    });
  }

  if (analyzeQuickBtn) {
    analyzeQuickBtn.addEventListener('click', () => {
      runAnalyze();
    });
  }

  window.aMushroomApp = window.aMushroomApp || {};
  window.aMushroomApp.openSavedUpload = (uploadId, options = {}) => loadSavedUpload(uploadId, {
    scrollToResults: false,
    updateUrl: true,
    ...options
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    const uploadId = String(url.searchParams.get('uploadId') || '').trim();
    if (uploadId) {
      loadSavedUpload(uploadId, { scrollToResults: false, updateUrl: false });
      return;
    }
    setResultsState('idle');
  });

  selectedSlots = createEmptySlotState();
  refreshSelectedFilesUi();
  setResultsState('idle');
  loadSavedUploadFromQuery();
})();
