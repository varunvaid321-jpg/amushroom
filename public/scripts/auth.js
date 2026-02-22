(function () {
  const statusText = document.getElementById('authStatus');
  const signedOut = document.getElementById('signedOut');
  const signedIn = document.getElementById('signedIn');
  const userLine = document.getElementById('userLine');
  const uploadsList = document.getElementById('uploadsList');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const logoutButton = document.getElementById('logoutButton');
  const googleButton = document.getElementById('googleButton');

  const registerSubmitButton = registerForm ? registerForm.querySelector('button[type="submit"]') : null;
  const loginSubmitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  function inferStatusState(message) {
    const value = String(message || '').toLowerCase();
    if (!value) return 'info';
    if (
      value.includes('failed') ||
      value.includes('error') ||
      value.includes('invalid') ||
      value.includes('unable') ||
      value.includes('not configured')
    ) {
      return 'error';
    }
    if (value.includes('redirecting') || value.includes('loading')) return 'info';
    if (
      value.includes('success') ||
      value.includes('signed in') ||
      value.includes('signed out') ||
      value.includes('created')
    ) {
      return 'success';
    }
    return 'info';
  }

  function setStatus(message, state) {
    if (!statusText) return;
    const text = String(message || '');
    statusText.textContent = text;
    if (!text) {
      delete statusText.dataset.state;
      return;
    }
    statusText.dataset.state = state || inferStatusState(text);
  }

  function setButtonLoading(button, loading, loadingLabel) {
    if (!button) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || '';
    }

    if (loading) {
      button.disabled = true;
      button.dataset.loading = 'true';
      button.setAttribute('aria-busy', 'true');
      if (loadingLabel) button.textContent = loadingLabel;
      return;
    }

    button.disabled = false;
    button.removeAttribute('data-loading');
    button.removeAttribute('aria-busy');
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
    }
  }

  async function withButtonLoading(button, loadingLabel, task) {
    setButtonLoading(button, true, loadingLabel);
    try {
      return await task();
    } finally {
      setButtonLoading(button, false);
    }
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-password-toggle][aria-controls]').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const targetId = toggle.getAttribute('aria-controls');
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input || input.tagName !== 'INPUT') return;

        const nextType = input.type === 'password' ? 'text' : 'password';
        const showing = nextType === 'text';
        input.type = nextType;
        toggle.textContent = showing ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', showing ? 'true' : 'false');
        toggle.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
      });
    });
  }

  function resetPasswordToggles(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-password-toggle][aria-controls]').forEach((toggle) => {
      const targetId = toggle.getAttribute('aria-controls');
      const input = targetId ? document.getElementById(targetId) : null;
      if (input && input.tagName === 'INPUT') {
        input.type = 'password';
      }
      toggle.textContent = 'Show';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Show password');
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function request(url, options = {}) {
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

  async function loadUploads() {
    if (!uploadsList) return;
    uploadsList.innerHTML = '';
    try {
      const data = await request('/api/user/uploads?limit=20');
      const uploads = Array.isArray(data.uploads) ? data.uploads : [];
      if (!uploads.length) {
        uploadsList.innerHTML = '<div class="upload-item"><p>No uploads yet.</p></div>';
        return;
      }

      uploadsList.innerHTML = uploads
        .map((item) => {
          const top = Array.isArray(item.topMatches) ? item.topMatches[0] : null;
          return `
            <article class="upload-item">
              <p><strong>${escapeHtml(item.primaryMatch || top?.scientificName || 'Unknown')}</strong></p>
              <p>Confidence: ${escapeHtml(item.primaryConfidence ?? top?.confidence ?? 'N/A')}%</p>
              <p>Images: ${escapeHtml(item.imageCount ?? 0)} | Uploaded: ${escapeHtml(item.createdAt || '')}</p>
            </article>
          `;
        })
        .join('');
    } catch (error) {
      uploadsList.innerHTML = `<div class="upload-item"><p>${escapeHtml(error.message || 'Failed to load uploads.')}</p></div>`;
    }
  }

  async function refreshAuthState() {
    try {
      const data = await request('/api/auth/me');
      if (!data.user) {
        if (signedOut) signedOut.hidden = false;
        if (signedIn) signedIn.hidden = true;
        setStatus('');
        return;
      }

      if (signedOut) signedOut.hidden = true;
      if (signedIn) signedIn.hidden = false;
      if (userLine) {
        userLine.textContent = `${data.user.email}${data.user.name ? ` (${data.user.name})` : ''}`;
      }
      setStatus('Signed in.', 'success');
      await loadUploads();
    } catch (error) {
      setStatus(error.message || 'Failed to load account state.', 'error');
    }
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(registerForm);

      await withButtonLoading(registerSubmitButton, 'Creating account', async () => {
        setStatus('Creating account...', 'info');
        try {
          await request('/api/auth/register', {
            method: 'POST',
            body: {
              name: String(form.get('name') || ''),
              email: String(form.get('email') || ''),
              password: String(form.get('password') || '')
            }
          });
          setStatus('Account created successfully.', 'success');
          registerForm.reset();
          resetPasswordToggles(registerForm);
          await refreshAuthState();
        } catch (error) {
          setStatus(error.message || 'Registration failed.', 'error');
        }
      });
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(loginForm);

      await withButtonLoading(loginSubmitButton, 'Signing in', async () => {
        setStatus('Signing in...', 'info');
        try {
          await request('/api/auth/login', {
            method: 'POST',
            body: {
              email: String(form.get('email') || ''),
              password: String(form.get('password') || '')
            }
          });
          setStatus('Signed in successfully.', 'success');
          loginForm.reset();
          resetPasswordToggles(loginForm);
          await refreshAuthState();
        } catch (error) {
          setStatus(error.message || 'Login failed.', 'error');
        }
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await withButtonLoading(logoutButton, 'Signing out', async () => {
        setStatus('Signing out...', 'info');
        try {
          await request('/api/auth/logout', { method: 'POST' });
          setStatus('Signed out.', 'success');
          await refreshAuthState();
        } catch (error) {
          setStatus(error.message || 'Logout failed.', 'error');
        }
      });
    });
  }

  if (googleButton) {
    googleButton.addEventListener('click', async () => {
      await withButtonLoading(googleButton, 'Redirecting', async () => {
        setStatus('Checking Google sign-in configuration...', 'info');
        try {
          const config = await request('/api/auth/config');
          if (!config.googleAuthEnabled) {
            setStatus('Google sign-in is not configured yet.', 'warning');
            return;
          }
          setStatus('Redirecting to Google sign-in...', 'info');
          window.location.href = '/api/auth/google?returnTo=/auth.html';
        } catch (error) {
          setStatus(error.message || 'Unable to start Google sign-in.', 'error');
        }
      });
    });
  }

  const url = new URL(window.location.href);
  const errorCode = url.searchParams.get('error');
  if (errorCode) {
    setStatus(`Google sign-in error: ${errorCode}`, 'error');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());
  }

  bindPasswordToggles();
  refreshAuthState();
})();
