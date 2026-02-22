(function () {
  async function initAuthLink() {
    const accountLink = document.getElementById('accountLink');
    if (!accountLink) return;

    try {
      const response = await fetch('/api/auth/me');
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.user) {
        const label = payload.user.name || payload.user.email || 'Account';
        accountLink.textContent = `Account (${label})`;
      }
    } catch {
      // Silent fallback to default label.
    }
  }

  initAuthLink();
})();
