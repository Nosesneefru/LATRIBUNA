/* Tribuna Live: browser client uses only the Supabase publishable key. */
(() => {
  const SUPABASE_URL = 'https://oavyveaynodcdpmegbhj.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nxFcQMjax_scxX4iQT0-tw_Zd7ygmek';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = (id) => document.getElementById(id);
  const toast = (message) => window.tribunaToast?.(message);
  const authModal = $('authModal');
  let currentUser = null;
  let isAdmin = false;
  let hasMembership = false;

  function setLocked(locked) {
    document.body.classList.toggle('locked', locked);
    $('memberGate').hidden = !locked;
  }

  function openAuth(mode = 'login') {
    const account = mode === 'account';
    $('authMode').value = account ? 'login' : mode;
    $('authTitle').textContent = account ? 'Mi cuenta' : mode === 'signup' ? 'Crear cuenta' : 'Ingresar';
    $('authSubmit').textContent = mode === 'signup' ? 'Crear cuenta' : 'Ingresar';
    $('authSwitch').textContent = mode === 'signup' ? 'Ya tengo cuenta' : 'Crear cuenta';
    $('authForm').querySelectorAll('.field').forEach((field) => { field.hidden = account; });
    $('authSwitch').hidden = account;
    $('authSubmit').hidden = account;
    $('authMessage').textContent = account ? currentUser?.email || '' : '';
    $('signOutButton').hidden = !account;
    authModal.classList.add('open');
  }

  async function loadAccess(session) {
    currentUser = session?.user ?? null;
    isAdmin = false;
    hasMembership = false;
    $('accountButton').textContent = currentUser ? 'Mi cuenta' : 'Ingresar';
    $('accountButton').title = currentUser?.email || '';
    $('openAdmin').hidden = true;
    if (currentUser) {
      const [adminResult, membershipResult] = await Promise.all([
        client.from('content_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle(),
        client.from('subscriptions').select('status,current_period_end').eq('user_id', currentUser.id).maybeSingle()
      ]);
      isAdmin = !adminResult.error && !!adminResult.data;
      const membership = membershipResult.data;
      hasMembership = !membershipResult.error && membership?.status === 'active' &&
        (!membership.current_period_end || new Date(membership.current_period_end) > new Date());
    }
    $('openAdmin').hidden = !isAdmin;
    $('authEmailLabel').textContent = currentUser ? `Sesión: ${currentUser.email}` : 'Ingresá con tu cuenta para ver las señales.';
    $('signOutButton').hidden = !currentUser;
    setLocked(!(isAdmin || hasMembership));
    if (isAdmin || hasMembership) await loadStreams();
    else if (currentUser) $('gateStatus').textContent = 'Tu cuenta está creada. Cuando confirmemos el pago, activamos tu acceso.';
  }

  async function loadStreams() {
    const status = $('playlistStatus');
    status.textContent = 'Cargando señales autorizadas…';
    const { data, error } = await client.from('streams').select('id,name,stream_url').order('created_at', { ascending: false });
    if (error) {
      status.textContent = `No se pudieron cargar las señales: ${error.message}`;
      return;
    }
    renderChannels((data || []).map((item) => ({ id: item.id, name: item.name, url: item.stream_url })));
  }

  $('accountButton').addEventListener('click', () => currentUser ? openAuth('account') : openAuth());
  $('gateLogin').addEventListener('click', () => openAuth());
  $('gateSignup').addEventListener('click', () => openAuth('signup'));
  $('authSwitch').addEventListener('click', () => openAuth($('authMode').value === 'signup' ? 'login' : 'signup'));
  $('closeAuth').addEventListener('click', () => authModal.classList.remove('open'));
  $('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('authSubmit');
    button.disabled = true;
    $('authMessage').textContent = 'Conectando…';
    try {
      const email = $('authEmail').value.trim();
      const password = $('authPassword').value;
      const result = $('authMode').value === 'signup'
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if ($('authMode').value === 'signup' && !result.data.session) {
        $('authMessage').textContent = 'Te mandamos un correo para confirmar la cuenta. Después volvé e ingresá.';
      } else {
        authModal.classList.remove('open');
        await loadAccess(result.data.session);
        toast('Sesión iniciada');
      }
    } catch (error) {
      $('authMessage').textContent = error.message || 'No se pudo completar el acceso.';
    } finally { button.disabled = false; }
  });
  $('signOutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    authModal.classList.remove('open');
    await loadAccess(null);
  });

  const originalImport = $('importPlaylist');
  originalImport.addEventListener('click', async (event) => {
    event.stopImmediatePropagation();
    if (!currentUser || !isAdmin) { toast('Solo el administrador puede agregar señales.'); return; }
    const url = $('playlistUrl').value.trim();
    if (!/^https:\/\//i.test(url)) { toast('Pegá una URL segura (https://).'); return; }
    originalImport.disabled = true;
    $('playlistStatus').textContent = 'Leyendo lista M3U…';
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
      const channels = parseM3u(await response.text(), url);
      if (!channels.length) throw new Error('La lista no contiene canales compatibles.');
      const rows = channels.map(({ name, url: stream_url }) => ({ name, stream_url, rights_confirmed: true, created_by: currentUser.id }));
      const { error } = await client.from('streams').upsert(rows, { onConflict: 'stream_url', ignoreDuplicates: true });
      if (error) throw error;
      await loadStreams();
      $('playlistStatus').textContent = `${channels.length} señales revisadas y guardadas en Supabase.`;
      toast('Señales guardadas en Supabase');
    } catch (error) {
      $('playlistStatus').textContent = `No se pudo importar: ${error.message} Revisá CORS y que tengas autorización para publicar estas señales.`;
    } finally { originalImport.disabled = false; }
  }, true);

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      await loadAccess(session);
      client.auth.onAuthStateChange((_event, session) => setTimeout(() => loadAccess(session), 0));
    } catch (error) {
      $('gateStatus').textContent = 'No se pudo conectar con Supabase. Revisá la URL y la clave pública.';
      setLocked(true);
    }
  });
})();
