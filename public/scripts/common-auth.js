(function () {
  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed.');
    }
    return payload;
  }

  function formatSavedDate(value) {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function displayNameForGreeting(user) {
    const name = String(user?.name || '').trim();
    if (name) return name.split(/\s+/)[0];
    const email = String(user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return 'there';
  }

  function setModalOpen(modal, open) {
    if (!modal) return;
    modal.hidden = !open;
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  async function initAuthLink() {
    const accountLink = document.getElementById('accountLink');
    if (!accountLink) return;

    const signInModal = document.getElementById('signInModal');
    const signInModalClose = document.getElementById('signInModalClose');
    const inlineForm = document.getElementById('inlineSignInForm');
    const inlineStatus = document.getElementById('inlineSignInStatus');
    const heroAuthGreeting = document.getElementById('heroAuthGreeting');
    const savedLibrary = document.getElementById('savedLibrary');
    const savedLibraryList = document.getElementById('savedLibraryList');
    const savedLibraryMeta = document.getElementById('savedLibraryMeta');
    let signedIn = false;

    function setInlineStatus(message) {
      if (inlineStatus) inlineStatus.textContent = message || '';
    }

    function closeAuthModal() {
      setModalOpen(signInModal, false);
      setInlineStatus('');
    }

    function openAuthModal() {
      setModalOpen(signInModal, true);
      const firstInput = inlineForm?.querySelector('input[name="email"]');
      if (firstInput) {
        firstInput.focus();
        firstInput.select?.();
      }
    }

    function renderGreeting(user) {
      if (!heroAuthGreeting) return;
      heroAuthGreeting.textContent = `Welcome ${displayNameForGreeting(user)}!`;
      heroAuthGreeting.hidden = false;
    }

    function hideGreeting() {
      if (!heroAuthGreeting) return;
      heroAuthGreeting.hidden = true;
      heroAuthGreeting.textContent = '';
    }

    function renderSavedLibrary(uploads) {
      if (!savedLibrary || !savedLibraryList || !savedLibraryMeta) return;
      const items = Array.isArray(uploads) ? uploads : [];
      savedLibrary.hidden = false;
      savedLibraryMeta.textContent = `${items.length} saved ${items.length === 1 ? 'entry' : 'entries'}`;

      if (!items.length) {
        savedLibraryList.innerHTML = '<article class="saved-library__card"><p class="saved-library__line">No saved mushrooms yet. Sign in and analyze photos to build your library.</p></article>';
        return;
      }

      savedLibraryList.innerHTML = items
        .map((item) => {
          const top = Array.isArray(item.topMatches) ? item.topMatches[0] : null;
          const primaryName = item.primaryMatch || top?.scientificName || 'Unknown species';
          const confidence = item.primaryConfidence ?? top?.confidence ?? 'N/A';
          const imageCount = item.imageCount ?? 0;
          const createdAt = formatSavedDate(item.createdAt);
          return [
            '<article class="saved-library__card">',
            `  <p class="saved-library__name">${escapeHtml(primaryName)}</p>`,
            `  <p class="saved-library__line">Confidence: ${escapeHtml(confidence)}%</p>`,
            `  <p class="saved-library__line">Photos: ${escapeHtml(imageCount)}</p>`,
            `  <p class="saved-library__line">Saved: ${escapeHtml(createdAt)}</p>`,
            '</article>'
          ].join('');
        })
        .join('');
    }

    function hideSavedLibrary() {
      if (!savedLibrary || !savedLibraryList || !savedLibraryMeta) return;
      savedLibrary.hidden = true;
      savedLibraryList.innerHTML = '';
      savedLibraryMeta.textContent = '';
    }

    async function loadSavedLibrary() {
      if (!savedLibrary) return;
      try {
        const data = await requestJson('/api/user/uploads?limit=12');
        renderSavedLibrary(data.uploads || []);
      } catch {
        savedLibrary.hidden = false;
        savedLibraryMeta.textContent = 'Unavailable';
        savedLibraryList.innerHTML = '<article class="saved-library__card"><p class="saved-library__line">Unable to load saved mushrooms right now.</p></article>';
      }
    }

    function applySignedOutUi() {
      signedIn = false;
      accountLink.textContent = 'Sign in / Account';
      accountLink.setAttribute('href', '/auth.html');
      hideGreeting();
      hideSavedLibrary();
    }

    function applySignedInUi(user) {
      signedIn = true;
      const label = user?.name || user?.email || 'Account';
      accountLink.textContent = `Account (${label})`;
      accountLink.setAttribute('href', '/auth.html');
      renderGreeting(user);
      loadSavedLibrary();
    }

    try {
      const payload = await requestJson('/api/auth/me');
      if (payload.user) applySignedInUi(payload.user);
      else applySignedOutUi();
    } catch {
      applySignedOutUi();
    }

    accountLink.addEventListener('click', (event) => {
      if (signedIn) return;
      event.preventDefault();
      openAuthModal();
    });

    if (signInModalClose) {
      signInModalClose.addEventListener('click', closeAuthModal);
    }

    if (signInModal) {
      signInModal.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.closeAuthModal === 'true') {
          closeAuthModal();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && signInModal && !signInModal.hidden) {
        closeAuthModal();
      }
    });

    if (!inlineForm) return;

    inlineForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(inlineForm);
      const submitButton = inlineForm.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      setInlineStatus('Signing in...');

      try {
        const payload = await requestJson('/api/auth/login', {
          method: 'POST',
          body: {
            email: String(form.get('email') || ''),
            password: String(form.get('password') || '')
          }
        });
        inlineForm.reset();
        applySignedInUi(payload.user || null);
        closeAuthModal();
      } catch (error) {
        setInlineStatus(error?.message || 'Sign-in failed.');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  initAuthLink();
})();
