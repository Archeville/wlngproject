const button = document.querySelector('#auth-button');
const status = document.querySelector('#auth-status');
const showStatus = (message) => { status.textContent = message; status.hidden = !message; };

async function initializeAuth() {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
    const { supabaseUrl, supabaseKey } = window.WLNG_CONFIG;
    const client = createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce' } });
    let signedIn = false;
    client.auth.onAuthStateChange((_event, session) => {
      signedIn = Boolean(session);
      button.textContent = signedIn ? 'Sign out' : 'Sign in with Google';
      button.disabled = false;
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
