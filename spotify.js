/* SOLC · connexió amb Spotify.
   Inici de sessió amb PKCE (sense servidor) + Web Playback SDK: el navegador es converteix
   en un dispositiu Spotify anomenat "SOLC giradiscs" i les cançons sonen dins l'app.
   Requisits: Spotify Premium i un Client ID de developer.spotify.com amb la URL de l'app
   registrada com a Redirect URI. */
(() => {
  "use strict";

  const LS = "solc-spotify";
  const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";
  const API = "https://api.spotify.com/v1";
  const disabled = !!window.SOLC_NO_SPOTIFY;

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(pub.status));

  let auth = read();
  let player = null, deviceId = null, profile = null, lastError = "";
  let onStateCb = null;

  function read() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (_) { return {}; } }
  function write() { try { localStorage.setItem(LS, JSON.stringify(auth)); } catch (_) {} }

  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
  const clientId = () => auth.clientId || (window.SOLC_CONFIG && window.SOLC_CONFIG.spotifyClientId) || "";

  function b64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* ---------------- inici de sessió (PKCE) ---------------- */
  async function login() {
    if (!clientId()) throw new Error("Falta el Client ID de Spotify.");
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
    auth.verifier = verifier; auth.state = state; write();
    const q = new URLSearchParams({
      response_type: "code", client_id: clientId(), scope: SCOPES, redirect_uri: redirectUri(),
      code_challenge_method: "S256", code_challenge: challenge, state
    });
    location.assign("https://accounts.spotify.com/authorize?" + q);
  }

  async function tokenRequest(params) {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId(), ...params })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || "Error d'autenticació");
    auth.access = data.access_token;
    auth.expires = Date.now() + (data.expires_in - 60) * 1000;
    if (data.refresh_token) auth.refresh = data.refresh_token;
    write();
  }

  // Tornada de Spotify amb ?code=…
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has("code") && !q.has("error")) return;
    history.replaceState(null, "", redirectUri() + location.hash);
    if (q.get("error")) { lastError = "Has cancel·lat la connexió amb Spotify."; return; }
    if (q.get("state") !== auth.state) { lastError = "La resposta de Spotify no coincideix. Torna-ho a provar."; return; }
    await tokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri(), code_verifier: auth.verifier });
    delete auth.verifier; delete auth.state; write();
  }

  async function token() {
    if (auth.access && Date.now() < auth.expires) return auth.access;
    if (!auth.refresh) throw new Error("Sessió de Spotify caducada.");
    await tokenRequest({ grant_type: "refresh_token", refresh_token: auth.refresh });
    return auth.access;
  }

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts, headers: { Authorization: "Bearer " + (await token()), "Content-Type": "application/json", ...(opts.headers || {}) }
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error && data.error.message) || `Spotify ha respost ${res.status}`);
    return data;
  }

  function logout() {
    try { player && player.disconnect(); } catch (_) {}
    player = null; deviceId = null; profile = null;
    const keep = auth.clientId; auth = keep ? { clientId: keep } : {}; write();
    emit();
  }

  /* ---------------- reproductor dins el navegador ---------------- */
  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.onerror = () => reject(new Error("No s'ha pogut carregar el reproductor de Spotify."));
      document.head.appendChild(s);
    });
  }

  async function startPlayer() {
    await loadSdk();
    player = new window.Spotify.Player({
      name: "SOLC giradiscs",
      getOAuthToken: (cb) => token().then(cb).catch(() => {}),
      volume: .85
    });
    player.addListener("ready", ({ device_id }) => { deviceId = device_id; lastError = ""; emit(); });
    player.addListener("not_ready", () => { deviceId = null; emit(); });
    player.addListener("account_error", () => { lastError = "Spotify només deixa reproduir dins d'apps amb un compte Premium."; deviceId = null; emit(); });
    player.addListener("authentication_error", ({ message }) => { lastError = "Error d'autenticació: " + message; emit(); });
    player.addListener("initialization_error", ({ message }) => { lastError = "Aquest navegador no pot reproduir Spotify: " + message; emit(); });
    player.addListener("playback_error", ({ message }) => { lastError = message; emit(); });
    player.addListener("player_state_changed", (s) => { if (onStateCb) onStateCb(s); });
    await player.connect();
  }

  async function init() {
    if (disabled) return;
    try {
      await handleRedirect();
      if (!auth.refresh) { emit(); return; }
      profile = await api("/me");
      emit();
      await startPlayer();
    } catch (e) {
      lastError = e.message; emit();
    }
  }

  /* ---------------- API per a l'app ---------------- */
  const clean = (s) => String(s).replace(/["()]/g, " ").trim();

  async function find(rec) {
    const attempts = [
      `album:${clean(rec.title)} artist:${clean(rec.artist)}`,
      `${clean(rec.artist)} ${clean(rec.title)}`
    ];
    for (const q of attempts) {
      const r = await api(`/search?type=album&limit=5&q=${encodeURIComponent(q)}`);
      const items = (r && r.albums && r.albums.items) || [];
      const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const hit = items.find((a) => a.artists.some((ar) => norm(ar.name) === norm(rec.artist))) || items[0];
      if (hit) return hit;
    }
    return null;
  }

  // Cridar dins del clic: desbloqueja l'àudio als navegadors mòbils.
  function prime() { try { player && player.activateElement && player.activateElement(); } catch (_) {} }

  async function play(rec) {
    if (!pub.ready) return null;
    const album = await find(rec);
    if (!album) return null;
    await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT", body: JSON.stringify({ context_uri: album.uri })
    });
    return {
      name: album.name,
      artist: album.artists.map((a) => a.name).join(", "),
      year: (album.release_date || "").slice(0, 4),
      image: album.images && album.images[0] && album.images[0].url,
      url: album.external_urls && album.external_urls.spotify
    };
  }

  async function pause() { try { player && (await player.pause()); } catch (_) {} }

  function setClientId(id) { auth.clientId = id.trim(); write(); emit(); }

  const pub = {
    init, login, logout, play, pause, prime, setClientId, redirectUri,
    onChange: (fn) => { listeners.add(fn); fn(pub.status); },
    onState: (fn) => { onStateCb = fn; },
    get disabled() { return disabled; },
    get hasClientId() { return !!clientId(); },
    get connected() { return !!auth.refresh; },
    get ready() { return !!(player && deviceId); },
    get status() {
      return { disabled, connected: !!auth.refresh, ready: !!(player && deviceId), name: profile && profile.display_name, error: lastError };
    }
  };
  window.SolcSpotify = pub;
})();
