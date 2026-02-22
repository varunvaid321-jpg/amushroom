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

  function setStatus(message) {
    statusText.textContent = message || '';
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
        signedOut.hidden = false;
        signedIn.hidden = true;
        setStatus('');
        return;
      }

      signedOut.hidden = true;
      signedIn.hidden = false;
      userLine.textContent = `${data.user.email}${data.user.name ? ` (${data.user.name})` : ''}`;
      setStatus('Signed in.');
      await loadUploads();
    } catch (error) {
      setStatus(error.message || 'Failed to load account state.');
    }
  }

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);

    try {
      await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          password: String(form.get('password') || '')
        }
      });
      setStatus('Account created successfully.');
      registerForm.reset();
      await refreshAuthState();
    } catch (error) {
      setStatus(error.message || 'Registration failed.');
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);

    try {
      await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: String(form.get('email') || ''),
          password: String(form.get('password') || '')
        }
      });
      setStatus('Signed in successfully.');
      loginForm.reset();
      await refreshAuthState();
    } catch (error) {
      setStatus(error.message || 'Login failed.');
    }
  });

  logoutButton.addEventListener('click', async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
      setStatus('Signed out.');
      await refreshAuthState();
    } catch (error) {
      setStatus(error.message || 'Logout failed.');
    }
  });

  googleButton.addEventListener('click', async () => {
    try {
      const config = await request('/api/auth/config');
      if (!config.googleAuthEnabled) {
        setStatus('Google sign-in is not configured yet.');
        return;
      }
      window.location.href = '/api/auth/google?returnTo=/auth.html';
    } catch (error) {
      setStatus(error.message || 'Unable to start Google sign-in.');
    }
  });

  const url = new URL(window.location.href);
  const errorCode = url.searchParams.get('error');
  if (errorCode) {
    setStatus(`Google sign-in error: ${errorCode}`);
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());
  }

  refreshAuthState();
})();
