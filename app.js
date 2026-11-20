/* SOLC — app d'intercanvi de vinils punk/rock. Sense dependències. */
(() => {
  "use strict";

  const KEY = "solc-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------------- estat ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* sense storage: fem servir la llavor */ }
    return { ...structuredClone(window.SOLC_SEED), deals: [] };
  }
  const state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }

  /* ---------------- portades generatives ---------------- */
  const PALETTES = [
    ["#ff2e88", "#121212", "#f4e300"],
    ["#f4e300", "#121212", "#ff2e88"],
    ["#121212", "#ece5d6", "#ff2e88"],
    ["#ece5d6", "#121212", "#e5322d"],
    ["#e5322d", "#121212", "#ece5d6"],
    ["#121212", "#f4e300", "#ece5d6"],
    ["#1ed760", "#121212", "#ece5d6"],
    ["#ece5d6", "#e5322d", "#121212"]
  ];

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const coverCache = new Map();
  let svgSeq = 0;
  // cada instància a la pàgina necessita IDs propis per als filtres i patrons
  const withId = (c) => ({ label: c.label, svg: c.tpl.replaceAll("__ID__", "s" + (++svgSeq)) });
  function cover(rec) {
    const k = rec.artist + "|" + rec.title;
    if (coverCache.has(k)) return withId(coverCache.get(k));
    const h = hash(k), r = rng(h);
    const [bg, fg, ac] = PALETTES[h % PALETTES.length];
    const style = (h >>> 8) % 5;
    const id = "__ID__";
    const artist = esc(rec.artist.toUpperCase());
    const title = esc(rec.title.toUpperCase());
    let body = "";

    if (style === 0) {
      // semitò: un gran cercle de punts
      let dots = "";
      const cx = 30 + r() * 40, cy = 30 + r() * 40;
      for (let y = 4; y < 100; y += 6) for (let x = 4; x < 100; x += 6) {
        const d = Math.hypot(x - cx, y - cy);
        const rad = Math.max(0, 2.8 - d / 16);
        if (rad > .3) dots += `<circle cx="${x}" cy="${y}" r="${rad.toFixed(2)}"/>`;
      }
      body = `<g fill="${fg}">${dots}</g>
        <rect x="0" y="74" width="100" height="16" fill="${ac}"/>
        <text x="4" y="86.5" font-family="Anton" font-size="11" fill="${fg}" textLength="92" lengthAdjust="spacingAndGlyphs">${artist}</text>
        <text x="4" y="97" font-family="Special Elite" font-size="5" fill="${fg}">${title}</text>`;
    } else if (style === 1) {
      // nota de segrest: lletres retallades
      const words = rec.artist.toUpperCase().split(/\s+/).filter(Boolean);
      const sizes = words.map((w) => [...w].map(() => 11 + r() * 5));
      const total = sizes.flat().reduce((a, b) => a + b * .78, 0) + words.length * 5;
      const k = Math.min(1, 300 / total); // encongeix noms molt llargs perquè hi càpiguen
      let x = 6, y = 24, out = "";
      words.forEach((word, wi) => {
        const wlen = sizes[wi].reduce((a, b) => a + b * k * .78, 0);
        if (x > 6 && x + wlen > 94) { x = 6; y += 20 * k + 2; }
        [...word].forEach((ch, ci) => {
          const s = sizes[wi][ci] * k;
          const p = PALETTES[Math.floor(r() * PALETTES.length)];
          const rot = (r() * 24 - 12).toFixed(1);
          const font = r() > .5 ? "Anton" : "Special Elite";
          out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})"><rect x="-1" y="${(-s + 1).toFixed(1)}" width="${(s * .72).toFixed(1)}" height="${(s + 2).toFixed(1)}" fill="${p[0]}" stroke="${fg}" stroke-width=".4"/><text x="${(s * .08).toFixed(1)}" y="0" font-family="${font}" font-size="${s.toFixed(1)}" fill="${p[1]}">${esc(ch)}</text></g>`;
          x += s * .78;
        });
        x += 5 * k;
      });
      body = `${out}<text x="6" y="94" font-family="Permanent Marker" font-size="7" fill="${fg}">${title}</text>`;
    } else if (style === 2) {
      // franges diagonals
      const w = 6 + r() * 8;
      body = `<defs><pattern id="${id}p" width="${w * 2}" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(${(r() * 90 - 45).toFixed(0)})"><rect width="${w}" height="10" fill="${ac}"/></pattern></defs>
        <rect width="100" height="100" fill="url(#${id}p)"/>
        <rect x="8" y="34" width="84" height="34" fill="${bg}" stroke="${fg}" stroke-width="2"/>
        <text x="50" y="53" text-anchor="middle" font-family="Anton" font-size="13" fill="${fg}" textLength="76" lengthAdjust="spacingAndGlyphs">${artist}</text>
        <text x="50" y="63" text-anchor="middle" font-family="Special Elite" font-size="5.5" fill="${fg}">${title}</text>`;
    } else if (style === 3) {
      // diana mod: cercles concèntrics descentrats
      const cx = 35 + r() * 30, cy = 30 + r() * 25;
      let rings = "";
      for (let i = 9; i > 0; i--) rings += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${i * 7}" fill="${i % 2 ? fg : (i % 4 === 0 ? ac : bg)}"/>`;
      body = `${rings}<rect x="0" y="82" width="100" height="18" fill="${bg}"/><line x1="0" y1="82" x2="100" y2="82" stroke="${fg}" stroke-width="1.5"/>
        <text x="50" y="91.5" text-anchor="middle" font-family="Anton" font-size="8" fill="${fg}" letter-spacing="1">${artist}</text>
        <text x="50" y="97.5" text-anchor="middle" font-family="Special Elite" font-size="4.4" fill="${fg}">${title}</text>`;
    } else {
      // tipografia gegant + X de cinta
      body = `<text x="-4" y="62" font-family="Anton" font-size="58" fill="${ac}" opacity=".9" textLength="108" lengthAdjust="spacingAndGlyphs">${esc(rec.artist.slice(0, 3).toUpperCase())}</text>
        <g stroke="${fg}" stroke-width="7" opacity=".85"><line x1="-5" y1="${10 + r() * 20}" x2="105" y2="${70 + r() * 20}"/><line x1="105" y1="${10 + r() * 20}" x2="-5" y2="${70 + r() * 20}"/></g>
        <rect x="0" y="80" width="100" height="20" fill="${fg}"/>
        <text x="5" y="90" font-family="Anton" font-size="7.5" fill="${bg}">${artist}</text>
        <text x="5" y="97" font-family="Special Elite" font-size="4.6" fill="${bg}">${title}</text>`;
    }

    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${artist} — ${title}">
      <defs><filter id="${id}x"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .25"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
      <g filter="url(#${id}x)"><rect width="100" height="100" fill="${bg}"/>${body}</g></svg>`;
    const out = { tpl: svg, label: ac === "#121212" ? bg : ac };
    coverCache.set(k, out);
    return withId(out);
  }

  /* ---------------- utilitats ---------------- */
  const spotifyUrl = (rec) => "https://open.spotify.com/search/" + encodeURIComponent(`${rec.artist} ${rec.title}`);
  const ownsTitle = (title) => state.myCrate.some((m) => norm(m.title) === norm(title));
  const inWishlist = (rec) => state.wishlist.some((w) => norm(w.title) === norm(rec.title) && norm(w.artist) === norm(rec.artist));
  const collectorWantsMine = (c) => c.wants.some(ownsTitle);
  const findOffer = (offerId) => {
    for (const c of state.collectors) { const o = c.offers.find((x) => x.id === offerId); if (o) return { c, o }; }
    return null;
  };

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  function sleeveHTML(rec, extra = "") {
    const cv = cover(rec);
    return `<div class="sleeve-wrap" style="--lbl:${cv.label}">${extra}<div class="disc"></div><div class="sleeve">${cv.svg}</div></div>`;
  }

  /* ---------------- render: caixa ---------------- */
  function renderCrate() {
    const q = norm($("#search").value);
    const g = $("#genre-filter").value;
    const list = state.myCrate.filter((r) => (!g || r.genre === g) && (!q || norm(r.artist + " " + r.title).includes(q)));
    $("#crate-grid").innerHTML = list.length ? list.map((r) => `
      <article class="card" data-open="mine:${r.id}" tabindex="0">
        ${sleeveHTML(r, r.forTrade ? '<span class="sticker trade">ES CANVIA</span>' : "")}
        <div class="card-info">
          <div class="t">${esc(r.title)}</div>
          <div class="a">${esc(r.artist)}</div>
          <div class="card-meta"><span class="chip">${esc(r.year || "—")}</span><span class="chip">${esc(r.genre)}</span><span class="chip">${esc(r.condition)}</span></div>
        </div>
      </article>`).join("") : `<p class="empty">Res per aquí. Caixa buida = ànima buida.</p>`;
  }

  function renderGenres() {
    const genres = [...new Set([...state.myCrate, ...state.collectors.flatMap((c) => c.offers)].map((r) => r.genre))].sort();
    const sel = $("#genre-filter"), cur = sel.value;
    sel.innerHTML = `<option value="">Tots els gèneres</option>` + genres.map((g) => `<option${g === cur ? " selected" : ""}>${esc(g)}</option>`).join("");
  }

  /* ---------------- render: mercat ---------------- */
  function renderMarket() {
    const items = state.collectors.flatMap((c) => c.offers.map((o) => ({ c, o })));
    items.sort((a, b) => score(b) - score(a));
    function score({ c, o }) { return (inWishlist(o) ? 2 : 0) + (collectorWantsMine(c) ? 1 : 0); }
    $("#market-grid").innerHTML = items.length ? items.map(({ c, o }) => {
      const wish = inWishlist(o), match = wish && collectorWantsMine(c);
      const stick = match ? '<span class="sticker">MATCH!</span>' : wish ? '<span class="sticker wish">EL VOLS</span>' : "";
      return `
      <article class="card" data-open="offer:${o.id}" tabindex="0">
        ${sleeveHTML(o, stick)}
        <div class="card-info">
          <div class="t">${esc(o.title)}</div>
          <div class="a">${esc(o.artist)}</div>
          <div class="card-meta"><span class="chip owner">${c.avatar} ${esc(c.name)}</span><span class="chip">${esc(c.city)}</span><span class="chip">${esc(o.condition)}</span></div>
        </div>
      </article>`;
    }).join("") : `<p class="empty">Ningú ofereix res ara mateix. Torna després del concert.</p>`;
  }

  /* ---------------- render: desitjos ---------------- */
  function renderWish() {
    const available = state.collectors.flatMap((c) => c.offers.map((o) => ({ c, o })));
    $("#wish-list").innerHTML = state.wishlist.length ? state.wishlist.map((w, i) => {
      const hit = available.find(({ o }) => norm(o.title) === norm(w.title) && norm(o.artist) === norm(w.artist));
      return `<li style="--r:${(i % 3 - 1) * .6}deg">
        <div class="mini">${cover(w).svg}</div>
        <div class="w-text"><b>${esc(w.title)}</b>${esc(w.artist)}
          ${hit ? `<div class="found">★ ${esc(hit.c.name)} el té! <a href="#" data-open="offer:${hit.o.id}">Mira-ho</a></div>` : ""}
        </div>
        <button class="x" data-unwish="${w.id}" aria-label="Treu de la llista">✕</button>
      </li>`;
    }).join("") : `<li class="empty">No desitges res? Mentida.</li>`;
  }

  /* ---------------- render: tractes ---------------- */
  const STATUS = { pending: "ESPERANT…", accepted: "FET!", rejected: "REBUTJAT" };
  function renderDeals() {
    const pend = state.deals.filter((d) => d.status === "pending").length;
    const b = $("#deals-count"); b.hidden = !pend; b.textContent = pend;
    $("#deals-list").innerHTML = state.deals.length ? state.deals.slice().reverse().map((d) => `
      <div class="deal">
        <div class="mini">${cover(d.give).svg}</div>
        <div class="swap">⇄</div>
        <div class="mini">${cover(d.get).svg}</div>
        <div class="d-text">Dones <b>${esc(d.give.title)}</b> (${esc(d.give.artist)})<br>per <b>${esc(d.get.title)}</b> (${esc(d.get.artist)})<br><small>amb ${esc(d.with)}</small></div>
        <span class="status ${d.status}">${STATUS[d.status]}</span>
      </div>`).join("") : `<p class="empty">Encara cap tracte. Ves a <a href="#" data-goto="market">Intercanvi</a> i fes soroll.</p>`;
  }

  function renderStats() {
    const trade = state.myCrate.filter((r) => r.forTrade).length;
    const matches = state.collectors.reduce((n, c) => n + c.offers.filter((o) => inWishlist(o) && collectorWantsMine(c)).length, 0);
    const done = state.deals.filter((d) => d.status === "accepted").length;
    $("#stats").innerHTML = [
      ["vinils", state.myCrate.length, "-2deg"], ["per canviar", trade, "1.5deg"],
      ["matches", matches, "-1deg"], ["tractes fets", done, "2deg"]
    ].map(([l, n, r]) => `<div class="stat" style="--r:${r}"><b>${n}</b>${l}</div>`).join("");
  }

  function renderAll() { renderGenres(); renderCrate(); renderMarket(); renderWish(); renderDeals(); renderStats(); }

  /* ---------------- giradiscs ---------------- */
  let playing = null;
  function play(rec) {
    const tt = $("#turntable"), disc = $("#tt-record"), cv = cover(rec);
    playing = rec;
    tt.classList.remove("playing");
    disc.classList.remove("spinning");
    disc.classList.add("dropping");
    setTimeout(() => {
      $("#tt-label").style.background = cv.label;
      $("#tt-label").innerHTML = `<span>${esc(rec.artist)}</span>`;
      disc.classList.remove("dropping");
      setTimeout(() => { tt.classList.add("playing"); disc.classList.add("spinning"); }, 450);
    }, 380);
    $("#now-title").textContent = rec.title;
    $("#now-artist").textContent = `${rec.artist}${rec.year ? " · " + rec.year : ""}`;
    const sp = $("#now-spotify"); sp.href = spotifyUrl(rec); sp.hidden = false;
    $("#now-stop").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function stop() {
    playing = null;
    $("#turntable").classList.remove("playing");
    $("#tt-record").classList.remove("spinning");
    $("#now-title").innerHTML = "Silenci.<br>Massa silenci.";
    $("#now-artist").textContent = "Posa un altre disc, va.";
    $("#now-stop").hidden = true;
  }

  /* ---------------- detall ---------------- */
  function openDetail(ref) {
    const [kind, id] = ref.split(":");
    let rec, owner = null;
    if (kind === "mine") rec = state.myCrate.find((r) => r.id === id);
    else { const f = findOffer(id); if (f) { rec = f.o; owner = f.c; } }
    if (!rec) return;

    const wantsMine = owner ? owner.wants.filter(ownsTitle) : [];
    $("#detail-body").innerHTML = `
      <div class="detail detail-grid">
        ${sleeveHTML(rec)}
        <div>
          <h3>${esc(rec.title)}</h3>
          <p class="a">${esc(rec.artist)}</p>
          <dl>
            <dt>Any</dt><dd>${esc(rec.year || "—")}</dd>
            <dt>Gènere</dt><dd>${esc(rec.genre)}</dd>
            <dt>Estat</dt><dd>${esc(rec.condition)}</dd>
            ${owner ? `<dt>De</dt><dd>${owner.avatar} ${esc(owner.name)} · ${esc(owner.city)} · ★ ${owner.rep}</dd>
                       <dt>Busca</dt><dd>${owner.wants.map((w) => ownsTitle(w) ? `<mark>${esc(w)}</mark>` : esc(w)).join(", ")}</dd>` : ""}
          </dl>
          <div class="actions">
            <button class="btn btn-yellow" data-play="${ref}">◉ Posa'l al plat</button>
            <a class="btn btn-spotify" href="${spotifyUrl(rec)}" target="_blank" rel="noopener">▶ Spotify</a>
            ${kind === "mine"
              ? `<button class="btn btn-pink" data-toggle-trade="${rec.id}">${rec.forTrade ? "Ja no el canvio" : "Posa'l per canviar"}</button>
                 <button class="btn btn-ghost btn-sm" data-remove="${rec.id}">Treu de la caixa</button>`
              : `<button class="btn btn-pink" data-propose="${rec.id}">⇄ Proposa canvi</button>
                 ${inWishlist(rec) ? "" : `<button class="btn btn-ghost btn-sm" data-wish-add="${rec.id}">♥ Als desitjos</button>`}`}
          </div>
          ${wantsMine.length ? `<p style="margin-top:16px"><mark>PISTA</mark> ${esc(owner.name)} vol ${wantsMine.map(esc).join(" i ")}, i tu ho tens.</p>` : ""}
        </div>
      </div>`;
    $("#detail").showModal();
  }

  /* ---------------- proposar tracte ---------------- */
  function openPropose(offerId) {
    const f = findOffer(offerId); if (!f) return;
    const { c, o } = f;
    const mine = state.myCrate.slice().sort((a, b) => (c.wants.includes(b.title) - c.wants.includes(a.title)) || (b.forTrade - a.forTrade));
    $("#propose-body").innerHTML = `
      <h3 class="tape">Proposa un canvi</h3>
      <p style="margin-top:18px">Vols <b>${esc(o.title)}</b> de ${c.avatar} ${esc(c.name)}. Què li dones a canvi?</p>
      <form id="propose-form">
        <div class="pick">
          ${mine.map((m, i) => `<label>
            <input type="radio" name="give" value="${m.id}"${i === 0 ? " checked" : ""}>
            <div class="mini">${cover(m).svg}</div>
            <small>${esc(m.title)}${c.wants.some((w) => norm(w) === norm(m.title)) ? '<br><span class="wanted">★ EL VOL!</span>' : m.forTrade ? "<br>es canvia" : ""}</small>
          </label>`).join("")}
        </div>
        <button class="btn btn-pink" type="submit">Envia la proposta</button>
      </form>`;
    $("#propose-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const giveId = new FormData(e.target).get("give");
      const give = state.myCrate.find((m) => m.id === giveId);
      if (!give) return;
      const deal = { id: uid(), offerId: o.id, collectorId: c.id, with: c.name, give: { ...give }, get: { ...o }, status: "pending" };
      state.deals.push(deal); save();
      $("#propose").close(); $("#detail").close();
      renderDeals(); toast(`Proposta enviada a ${c.name}!`);
      simulateReply(deal.id);
    });
    $("#propose").showModal();
  }

  // Simulació: l'altre col·leccionista respon al cap d'uns segons.
  function simulateReply(dealId) {
    setTimeout(() => {
      const d = state.deals.find((x) => x.id === dealId);
      if (!d || d.status !== "pending") return;
      const c = state.collectors.find((x) => x.id === d.collectorId);
      const stillMine = state.myCrate.find((m) => m.id === d.give.id);
      const offer = c && c.offers.find((x) => x.id === d.offerId);
      if (!c || !stillMine || !offer) { d.status = "rejected"; save(); renderAll(); return; }
      const wanted = c.wants.some((w) => norm(w) === norm(d.give.title));
      const yes = wanted || Math.random() < .4;
      d.status = yes ? "accepted" : "rejected";
      if (yes) {
        state.myCrate = state.myCrate.filter((m) => m.id !== d.give.id);
        state.myCrate.unshift({ ...offer, id: uid(), forTrade: false });
        c.offers = c.offers.filter((x) => x.id !== offer.id);
        c.offers.push({ ...d.give, id: uid() });
        c.wants = c.wants.filter((w) => norm(w) !== norm(d.give.title));
        state.wishlist = state.wishlist.filter((w) => !(norm(w.title) === norm(offer.title) && norm(w.artist) === norm(offer.artist)));
        toast(`${c.name} ha acceptat! ${offer.title} és teu 🤘`);
      } else {
        toast(`${c.name} passa. Prova amb un altre disc.`);
      }
      save(); renderAll();
    }, 2500 + Math.random() * 2500);
  }

  /* ---------------- esdeveniments ---------------- */
  function goto(view) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => goto(t.dataset.view)));

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open],[data-play],[data-propose],[data-toggle-trade],[data-remove],[data-wish-add],[data-unwish],[data-goto]");
    if (!el) return;
    const d = el.dataset;
    if (d.open) { e.preventDefault(); openDetail(d.open); }
    else if (d.goto) { e.preventDefault(); goto(d.goto); }
    else if (d.play) {
      const [k, id] = d.play.split(":");
      const rec = k === "mine" ? state.myCrate.find((r) => r.id === id) : findOffer(id)?.o;
      $("#detail").close(); if (rec) play(rec);
    } else if (d.propose) openPropose(d.propose);
    else if (d.toggleTrade) {
      const r = state.myCrate.find((x) => x.id === d.toggleTrade);
      r.forTrade = !r.forTrade; save(); renderAll(); openDetail("mine:" + r.id);
      toast(r.forTrade ? "Al calaix d'intercanvi" : "Te'l quedes. Bona decisió.");
    } else if (d.remove) {
      const r = state.myCrate.find((x) => x.id === d.remove);
      if (r && !el.dataset.armed) {
        // primer clic: demana confirmació al mateix botó
        el.dataset.armed = "1"; el.textContent = "Segur? Clica per treure'l";
        el.classList.add("btn-pink");
      } else if (r) {
        state.myCrate = state.myCrate.filter((x) => x.id !== r.id);
        if (playing && playing.id === r.id) stop();
        save(); renderAll(); $("#detail").close(); toast("Fora!");
      }
    } else if (d.wishAdd) {
      const o = findOffer(d.wishAdd)?.o;
      if (o) { state.wishlist.push({ id: uid(), artist: o.artist, title: o.title }); save(); renderAll(); openDetail("offer:" + o.id); toast("Afegit als desitjos ♥"); }
    } else if (d.unwish) {
      state.wishlist = state.wishlist.filter((w) => w.id !== d.unwish); save(); renderAll();
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card[data-open]")) { e.preventDefault(); openDetail(e.target.dataset.open); }
  });

  $("#now-stop").addEventListener("click", stop);
  $("#search").addEventListener("input", renderCrate);
  $("#genre-filter").addEventListener("change", renderCrate);
  $("#add-btn").addEventListener("click", () => $("#add").showModal());

  $("#add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const rec = {
      id: uid(), artist: f.get("artist").trim(), title: f.get("title").trim(),
      year: Number(f.get("year")) || "", genre: f.get("genre"), condition: f.get("condition"), forTrade: f.get("forTrade") === "on"
    };
    state.myCrate.unshift(rec); save(); renderAll();
    e.target.reset(); $("#add").close(); toast(`${rec.title} a la caixa!`);
  });

  $("#wish-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.wishlist.push({ id: uid(), artist: f.get("artist").trim(), title: f.get("title").trim() });
    save(); renderAll(); e.target.reset(); toast("Desig apuntat. Que l'univers et senti.");
  });

  // tancar modal clicant fora
  $$("dialog").forEach((dlg) => dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }));

  // tractes que s'havien quedat a mitges
  state.deals.filter((d) => d.status === "pending").forEach((d) => simulateReply(d.id));

  // les fonts del SVG s'han de carregar abans de pintar per no veure-hi la tipografia per defecte
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(renderAll);
  renderAll();
})();
