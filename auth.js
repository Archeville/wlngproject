const button = document.querySelector('#auth-button');
const status = document.querySelector('#auth-status');
const showStatus = (message) => { status.textContent = message; status.hidden = !message; };

async function initializeAuth() {
  try {
    const { createClient } = await import('./assets/vendor/supabase.mjs');
    const { supabaseUrl, supabaseKey } = window.WLNG_CONFIG;
    const client = createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce' } });
    window.WLNG_AUTH = { getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token || null };
    let signedIn = false;
    client.auth.onAuthStateChange((_event, session) => {
      signedIn = Boolean(session);
      button.textContent = signedIn ? 'Sign out' : 'Sign in with Google';
      button.disabled = false;
      window.WLNG_AUTH_USER = session?.user?.id || null;
      window.dispatchEvent(new CustomEvent('wlng-auth', { detail: { userId: session?.user?.id || null } }));
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      showStatus('');
      try {
        const result = signedIn
          ? await client.auth.signOut()
          : await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('./', window.location.href).href } });
        if (result.error) throw result.error;
        if (signedIn) button.disabled = false;
      } catch {
        showStatus('Could not complete sign-in. Please try again.');
        button.disabled = false;
      }
    });
  } catch {
    button.textContent = 'Account unavailable';
    showStatus('Could not load account services. Please refresh and try again.');
  }
}

initializeAuth();
