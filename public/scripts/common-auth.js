(function () {
  function firstNameFromUser(user) {
    if (!user) return '';
    const name = String(user.name || '').trim();
    if (name) return name.split(/\s+/)[0];
    const email = String(user.email || '').trim();
    return email ? email.split('@')[0] : '';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function renderTopMatches(item) {
    const topMatches = Array.isArray(item.topMatches) ? item.topMatches.slice(0, 3) : [];
    if (!topMatches.length) {
      return '<p class="portfolio-card__meta">Top matches unavailable for this saved scan.</p>';
    }

    return `
      <div class="portfolio-card__results" aria-label="Saved match results">
        ${topMatches
          .map((match) => {
            const label = match.commonName || match.scientificName || 'Unknown species';
            const confidence = Number.isFinite(Number(match.confidence)) ? `${Number(match.confidence)}%` : 'N/A';
            return `
              <div class="portfolio-card__result">
                <span class="portfolio-card__result-name">${escapeHtml(label)}</span>
                <span class="portfolio-card__result-score">${escapeHtml(confidence)}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function renderThumbGrid(item) {
    const previews = Array.isArray(item.previewImages) ? item.previewImages.slice(0, 4) : [];
    if (!previews.length) {
      return '<div class="portfolio-card__thumbs portfolio-card__thumbs--empty"><div class="portfolio-card__thumb portfolio-card__thumb--empty">No image</div></div>';
    }

    const extraCount = Math.max(0, Number(item.imageCount || 0) - previews.length);
    const cells = previews
      .map((image, index) => {
        const alt = image.filename || image.role || `Uploaded photo ${index + 1}`;
        return `
          <div class="portfolio-card__thumb-cell">
            <img class="portfolio-card__thumb" src="${escapeHtml(image.previewUrl || '')}" alt="${escapeHtml(alt)}" loading="lazy" />
          </div>
        `;
      })
      .join('');

    const extraBadge = extraCount > 0 ? `<span class="portfolio-card__more">+${escapeHtml(extraCount)} more</span>` : '';

    return `
      <div class="portfolio-card__thumbs" aria-label="Uploaded photos preview">
        ${cells}
        ${extraBadge}
      </div>
    `;
  }

  function renderPortfolioStats(statsEl, uploads) {
    if (!statsEl) return;
    if (!Array.isArray(uploads) || !uploads.length) {
      statsEl.innerHTML = '';
      return;
    }

    const totalScans = uploads.length;
    const totalPhotos = uploads.reduce((sum, item) => sum + (Number(item.imageCount) || 0), 0);
    const confidenceValues = uploads
      .map((item) => Number(item.primaryConfidence ?? (Array.isArray(item.topMatches) ? item.topMatches[0]?.confidence : null)))
      .filter((value) => Number.isFinite(value));
    const avgConfidence = confidenceValues.length
      ? `${Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)}%`
      : 'N/A';

    const species = new Set();
    uploads.forEach((item) => {
      const top = Array.isArray(item.topMatches) ? item.topMatches[0] : null;
      const label = String(item.primaryMatch || top?.scientificName || top?.commonName || '').trim();
      if (label) species.add(label.toLowerCase());
    });

    const latestScan = uploads[0]?.createdAt ? formatDateTime(uploads[0].createdAt) : 'N/A';

    const cards = [
      { label: 'Saved scans', value: String(totalScans), hint: 'Recently loaded results' },
      { label: 'Uploaded photos', value: String(totalPhotos), hint: 'Across visible saved scans' },
      { label: 'Avg top confidence', value: avgConfidence, hint: 'Top saved recommendation only' },
      { label: 'Unique species', value: String(species.size), hint: `Latest scan: ${latestScan}` }
    ];

    statsEl.innerHTML = cards
      .map((card) => `
        <article class="portfolio-stat">
          <p class="portfolio-stat__label">${escapeHtml(card.label)}</p>
          <p class="portfolio-stat__value">${escapeHtml(card.value)}</p>
          <p class="portfolio-stat__hint">${escapeHtml(card.hint)}</p>
        </article>
      `)
      .join('');
  }

  async function initHomeAuth() {
    const topbarWelcome = document.getElementById('topbarWelcome');
    const topbarRegisterLink = document.getElementById('topbarRegisterLink');
    const topbarLoginButton = document.getElementById('topbarLoginButton');
    const topbarAccountLink = document.getElementById('topbarAccountLink');
    const topbarLogoutButton = document.getElementById('topbarLogoutButton');
    const topbarLoginDrawer = document.getElementById('topbarLoginDrawer');
    const topbarLoginForm = document.getElementById('topbarLoginForm');
    const topbarLoginSubmit = document.getElementById('topbarLoginSubmit');
    const topbarGoogleButton = document.getElementById('topbarGoogleButton');
    const topbarLoginStatus = document.getElementById('topbarLoginStatus');
    const libraryCallout = document.getElementById('libraryCallout');
    const portfolioSection = document.getElementById('portfolioSection');
    const portfolioGrid = document.getElementById('portfolioGrid');
    const portfolioStats = document.getElementById('portfolioStats');

    let currentUser = null;

    function flashLoginStatus() {
      if (!topbarLoginStatus) return;
      topbarLoginStatus.classList.remove('is-flash');
      void topbarLoginStatus.offsetWidth;
      topbarLoginStatus.classList.add('is-flash');
    }

    function setLoginStatus(message, type) {
      if (!topbarLoginStatus) return;
      topbarLoginStatus.textContent = message || '';
      topbarLoginStatus.dataset.state = type || 'info';
      if (message) {
        flashLoginStatus();
      } else {
        topbarLoginStatus.classList.remove('is-flash');
      }
    }

    function closeLoginDrawer() {
      if (topbarLoginDrawer) topbarLoginDrawer.hidden = true;
      if (topbarLoginButton) topbarLoginButton.setAttribute('aria-expanded', 'false');
    }

    function openLoginDrawer() {
      if (!topbarLoginDrawer) return;
      topbarLoginDrawer.hidden = false;
      if (topbarLoginButton) topbarLoginButton.setAttribute('aria-expanded', 'true');
      setLoginStatus('Sign in to view Saved Identifications.', 'info');
      const firstInput = topbarLoginForm?.querySelector('input[name="email"]');
      if (firstInput) firstInput.focus();
    }

    function toggleLoginDrawer() {
      if (!topbarLoginDrawer) return;
      if (topbarLoginDrawer.hidden) {
        openLoginDrawer();
      } else {
        closeLoginDrawer();
      }
    }

    function renderSignedOut() {
      currentUser = null;
      if (topbarWelcome) {
        topbarWelcome.hidden = true;
        topbarWelcome.textContent = '';
      }
      if (topbarRegisterLink) topbarRegisterLink.hidden = false;
      if (topbarLoginButton) topbarLoginButton.hidden = false;
      if (topbarAccountLink) {
        topbarAccountLink.hidden = true;
        topbarAccountLink.textContent = 'Account';
      }
      if (topbarLogoutButton) topbarLogoutButton.hidden = true;
      if (libraryCallout) libraryCallout.hidden = false;
      if (portfolioSection) portfolioSection.hidden = true;
      if (portfolioGrid) portfolioGrid.innerHTML = '';
      if (portfolioStats) portfolioStats.innerHTML = '';
    }

    function renderSignedIn(user) {
      currentUser = user || null;
      const firstName = firstNameFromUser(user);
      if (topbarWelcome) {
        topbarWelcome.hidden = false;
        topbarWelcome.textContent = firstName ? `Welcome, ${firstName}!` : 'Welcome!';
      }
      if (topbarRegisterLink) topbarRegisterLink.hidden = true;
      if (topbarLoginButton) topbarLoginButton.hidden = true;
      if (topbarAccountLink) {
        topbarAccountLink.hidden = false;
        topbarAccountLink.textContent = 'Account';
      }
      if (topbarLogoutButton) topbarLogoutButton.hidden = false;
      if (libraryCallout) libraryCallout.hidden = true;
      if (portfolioSection) portfolioSection.hidden = false;
      closeLoginDrawer();
    }

    async function loadPortfolio() {
      if (!portfolioGrid) return;
      portfolioGrid.innerHTML = '<div class="portfolio-card portfolio-card--placeholder">Loading saved identifications...</div>';
      if (portfolioStats) portfolioStats.innerHTML = '';

      try {
        const response = await fetch('/api/user/uploads?limit=12');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to load portfolio.');

        const uploads = Array.isArray(payload.uploads) ? payload.uploads : [];
        renderPortfolioStats(portfolioStats, uploads);

        if (!uploads.length) {
          portfolioGrid.innerHTML = '<div class="portfolio-card portfolio-card--placeholder">No saved identifications yet. Run a scan while signed in.</div>';
          return;
        }

        portfolioGrid.innerHTML = uploads
          .map((item) => {
            const top = Array.isArray(item.topMatches) ? item.topMatches[0] : null;
            const primaryName = item.primaryMatch || top?.scientificName || top?.commonName || 'Unknown species';
            const primaryConfidence = item.primaryConfidence ?? top?.confidence;
            const confidenceText = Number.isFinite(Number(primaryConfidence)) ? `${Number(primaryConfidence)}%` : 'N/A';
            const uploadedAt = formatDateTime(item.createdAt) || '';
            const imageCount = Number.isFinite(Number(item.imageCount)) ? Number(item.imageCount) : 0;

            return `
              <button class="portfolio-card" type="button" data-upload-id="${escapeHtml(item.id)}" aria-label="Open saved result ${escapeHtml(primaryName)}">
                ${renderThumbGrid(item)}
                <div class="portfolio-card__body">
                  <div class="portfolio-card__row portfolio-card__row--top">
                    <div class="portfolio-card__title-block">
                      <p class="portfolio-card__eyebrow">Best match</p>
                      <p class="portfolio-card__name">${escapeHtml(primaryName)}</p>
                    </div>
                    <p class="portfolio-card__meta portfolio-card__meta--date">${uploadedAt ? escapeHtml(uploadedAt) : 'Date unavailable'}</p>
                  </div>
                  <div class="portfolio-card__row">
                    <p class="portfolio-card__meta">${imageCount} photo${imageCount === 1 ? '' : 's'} scanned</p>
                    <span class="portfolio-card__stamp">${escapeHtml(confidenceText)}</span>
                  </div>
                  <p class="portfolio-card__meta">Click to reopen the saved photos and match results.</p>
                  ${renderTopMatches(item)}
                </div>
              </button>
            `;
          })
          .join('');

        portfolioGrid.querySelectorAll('[data-upload-id]').forEach((button) => {
          button.addEventListener('click', async () => {
            const uploadId = button.getAttribute('data-upload-id');
            if (!uploadId) return;

            portfolioGrid.querySelectorAll('.portfolio-card--active').forEach((card) => {
              card.classList.remove('portfolio-card--active');
            });
            button.classList.add('portfolio-card--active');

            const appApi = window.aMushroomApp;
            if (appApi && typeof appApi.openSavedUpload === 'function') {
              try {
                await appApi.openSavedUpload(uploadId, { scrollToResults: true, updateUrl: true });
                return;
              } catch {
                // Fall back to full navigation if inline restore fails.
              }
            }

            window.location.href = `/?uploadId=${encodeURIComponent(uploadId)}`;
          });
        });
      } catch (error) {
        if (portfolioStats) portfolioStats.innerHTML = '';
        portfolioGrid.innerHTML = `<div class="portfolio-card portfolio-card--placeholder">${escapeHtml(error.message || 'Failed to load portfolio.')}</div>`;
      }
    }

    async function loadAuthState() {
      try {
        const response = await fetch('/api/auth/me');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) {
          renderSignedOut();
          return null;
        }
        renderSignedIn(payload.user);
        await loadPortfolio();
        return payload.user;
      } catch {
        renderSignedOut();
        return null;
      }
    }


    async function startGoogleLoginFromDrawer() {
      if (topbarGoogleButton) topbarGoogleButton.disabled = true;
      setLoginStatus('Checking Google sign-in...', 'info');

      try {
        const response = await fetch('/api/auth/config');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Could not start Google sign-in.');
        }
        if (!payload.googleAuthEnabled) {
          setLoginStatus('Google sign-in is unavailable. Use email sign-in.', 'warning');
          return;
        }

        setLoginStatus('Redirecting to Google...', 'info');
        window.location.href = '/api/auth/google?returnTo=/';
      } catch (error) {
        setLoginStatus(error.message || 'Could not start Google sign-in. Try again.', 'error');
      } finally {
        if (topbarGoogleButton) topbarGoogleButton.disabled = false;
      }
    }

    if (topbarLoginButton) {
      topbarLoginButton.addEventListener('click', () => {
        if (currentUser) return;
        // Use the dedicated auth page instead of the inline drawer for the primary login flow.
        window.location.href = '/auth.html?mode=login';
      });
    }

    if (topbarLoginForm) {
      topbarLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (topbarLoginSubmit) topbarLoginSubmit.disabled = true;
        setLoginStatus('Signing you in...', 'info');

        try {
          const form = new FormData(topbarLoginForm);
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: String(form.get('email') || ''),
              password: String(form.get('password') || '')
            })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || 'Unable to sign in.');
          }

          setLoginStatus(
            payload?.user?.emailVerified
              ? 'Signed in. Loading your library...'
              : 'Signed in. Email verification pending. Loading your library...',
            'success'
          );
          topbarLoginForm.reset();
          await loadAuthState();
        } catch (error) {
          setLoginStatus(error.message || 'Login failed. Check your email and password and try again.', 'error');
        } finally {
          if (topbarLoginSubmit) topbarLoginSubmit.disabled = false;
        }
      });
    }


    if (topbarGoogleButton) {
      topbarGoogleButton.addEventListener('click', async () => {
        if (currentUser) return;
        await startGoogleLoginFromDrawer();
      });
    }

    if (topbarLoginDrawer) {
      document.addEventListener('click', (event) => {
        if (topbarLoginDrawer.hidden) return;
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (topbarLoginDrawer.contains(target)) return;
        if (topbarLoginButton && topbarLoginButton.contains(target)) return;
        closeLoginDrawer();
      });
    }

    if (topbarLogoutButton) {
      topbarLogoutButton.addEventListener('click', async () => {
        topbarLogoutButton.disabled = true;
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
          await loadAuthState();
        } catch {
          topbarLogoutButton.disabled = false;
          alert('Logout failed. Please try again.');
          return;
        }
        topbarLogoutButton.disabled = false;
      });
    }

    window.addEventListener('amushroom:upload-saved', async () => {
      if (!currentUser) return;
      if (!portfolioSection || portfolioSection.hidden) return;
      await loadPortfolio();
    });

    await loadAuthState();
  }

  initHomeAuth();
})();
