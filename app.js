(() => {
  const $ = (id) => document.getElementById(id);
  const PFX = "spinpath:";
  const MODES = [
    { id: "roadmap", label: "Learn", blurb: "Pick a goal. Every spin is a random concept toward it. We keep track of what you've covered." },
    { id: "speak", label: "Speak", blurb: "Pick a drill and talk. No prep, a clear structure, a running clock." },
    { id: "research", label: "Deep research", blurb: "Spin a topic, research it, then speak when you're ready." },
  ];

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PFX + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch {} },
  };
  const S = {
    mode: store.get("mode", "roadmap") === "cuff" ? "speak" : store.get("mode", "roadmap"),
    drill: store.get("drill", "debate"),
    scope: store.get("scope", {}),
    learned: store.get("learned", {}),
    speech: store.get("speech", 2),
    research: store.get("research", 5),
    sound: store.get("sound", false),
    days: store.get("days", []),
    last: null,
    current: null,
  };
  const save = (k) => store.set(k, S[k]);

  /* ---------- helpers ---------- */
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => n.append(k));
    return n;
  };
  /* Custom dropdown over a hidden native <select>, so menu colours are fully ours
     (native popups ignore page colours in some browsers). */
  const ddSync = [];
  function makeSelect(sel) {
    const label = document.querySelector(`label[for="${sel.id}"]`);
    const wrap = el("div", { className: "dd" });
    const btn = el("button", { type: "button", className: "dd-btn" });
    const list = el("ul", { className: "dd-list", role: "listbox", tabIndex: -1 });
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (label) btn.setAttribute("aria-label", label.textContent);
    list.hidden = true;
    sel.classList.add("dd-src");
    wrap.append(btn, list);
    sel.after(wrap);
    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      btn.textContent = o ? o.textContent : "";
      wrap.hidden = sel.hidden;
    };
    const close = (focus) => { list.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); };
    const items = () => [...list.children];
    const mark = (i) => { items().forEach((li, k) => li.classList.toggle("act", k === i)); const li = items()[i]; if (li) li.scrollIntoView({ block: "nearest" }); };
    const choose = (value) => { close(true); if (sel.value !== value) { sel.value = value; sel.dispatchEvent(new Event("change")); } sync(); };
    const open = () => {
      document.querySelectorAll(".dd-list").forEach((l) => { l.hidden = true; });
      list.replaceChildren(...[...sel.options].map((o) => {
        const li = el("li", { textContent: o.textContent });
        li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(o.value === sel.value)); li.dataset.value = o.value;
        li.onclick = () => choose(o.value);
        return li;
      }));
      list.hidden = false; btn.setAttribute("aria-expanded", "true");
      list.focus(); mark(sel.selectedIndex);
    };
    btn.onclick = () => (list.hidden ? open() : close(true));
    btn.onkeydown = (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } };
    list.onkeydown = (e) => {
      const n = items().length; let i = items().findIndex((li) => li.classList.contains("act"));
      if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(n - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(0, i - 1)); }
      else if (e.key === "Home") { e.preventDefault(); mark(0); }
      else if (e.key === "End") { e.preventDefault(); mark(n - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) choose(items()[i].dataset.value); }
      else if (e.key === "Escape" || e.key === "Tab") { e.stopPropagation(); close(e.key === "Escape"); }
    };
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(false); });
    ddSync.push(sync); sync();
  }
  const roadmap = () => ROADMAPS.find((r) => r.id === S.scope.roadmap) || ROADMAPS[0];
  const byId = (r, id) => r.concepts.find((c) => c.id === id);
  const learnedSet = (r) => new Set(S.learned[r.id] || []);
  const unlocks = (r, id) => r.concepts.filter((c) => c.prereqs.includes(id));

  /* ---------- connected spin ---------- */
  const remaining = (r) => { const done = learnedSet(r); return r.concepts.filter((c) => !done.has(c.id)); };
  const neighbours = (r, c) => new Set([...c.prereqs, ...unlocks(r, c.id).map((x) => x.id)]);
  function pickConcept(r) {
    const left = remaining(r);
    if (!left.length) return null;
    const last = S.last && S.last.roadmap === r.id ? byId(r, S.last.id) : null;
    const done = r.concepts.filter((c) => learnedSet(r).has(c.id));
    const near = new Set(last ? neighbours(r, last) : []);
    const knownNear = new Set(done.flatMap((c) => [...neighbours(r, c)]));
    const pool = left.filter((c) => !last || c.id !== last.id);
    // Any unlearned concept can come up. Ideas connected to the last one, or to things
    // you already know, are a bit more likely so each spin tends to build on the last.
    const w = (c) => 1 + (near.has(c.id) ? 2 : 0) + (knownNear.has(c.id) ? 1 : 0);
    const bag = (pool.length ? pool : left).flatMap((c) => Array(w(c)).fill(c));
    return rand(bag);
  }
  const DRILLS = [
    { id: "debate", label: "Debate motion", src: () => DEBATES },
    { id: "news", label: "Fresh read" },
    { id: "interview", label: "Interview seat", src: () => INTERVIEWS },
    { id: "explain", label: "Explain it to…" },
  ];
  const isReading = () => S.mode === "speak" && S.drill === "news";
  const scopeKey = () => (S.mode === "speak" ? "speak:" + S.drill : S.mode);
  const catPool = (src, key) => (key === "any" || !src[key] ? Object.keys(src) : [key]).flatMap((cat) => src[cat].map((text) => ({ cat, text })));
  const otherPool = () => catPool(RESEARCH_TOPICS, S.scope.research || "any");

  /* articles: articles.json is refreshed daily by a GitHub Action (rolling 7 days).
     If it's missing, we fall back to a live Hacker News query for the past week. */
  const DAY = 864e5;
  async function getJson(url) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw 0; return await r.json(); } finally { clearTimeout(t); }
  }
  const httpUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol) ? u : null; } catch { return null; } };
  let articleCache = null;
  async function loadArticles() {
    if (articleCache) return articleCache;
    let items = [];
    try { items = (await getJson(`articles.json?h=${Math.floor(Date.now() / 36e5)}`)).items || []; } catch {}
    if (!items.length) {
      try {
        const since = Math.floor((Date.now() - 7 * DAY) / 1000);
        const j = await getJson(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${since},points>120&hitsPerPage=50`);
        items = j.hits.filter((h) => h.url).map((h) => ({ title: h.title, url: h.url, source: "Hacker News", topic: "Tech", published: h.created_at_i * 1000 }));
      } catch {}
    }
    return (articleCache = items.filter((a) => a.title && httpUrl(a.url)));
  }
  const ago = (t) => { const d = Math.floor((Date.now() - t) / DAY); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  async function articlePrompt() {
    const key = S.scope["speak:news"] || "any", now = Date.now();
    const week = (await loadArticles()).filter((a) => now - a.published <= 7 * DAY);
    let pool = key === "any" ? week : key === "Past 24 hours" ? week.filter((a) => now - a.published <= DAY) : week.filter((a) => a.topic === key);
    pool = pool.filter((a) => !S.last || S.last.url !== a.url);
    if (!pool.length) pool = week; // a narrow filter came up empty: widen to the whole week
    if (!pool.length) return { text: rand(ARTICLE_FALLBACK), kicker: "Fresh read · offline prompt", tag: "No articles loaded", hook: "Couldn't load articles, so here's a prompt instead.", arc: ARTICLE_ARC, key: {} };
    const a = rand(pool);
    return { text: a.title, kicker: `Fresh read · ${a.source} · ${ago(a.published)}`, tag: a.source, hook: "Skim the article, then give your take.", link: a.url, arc: ARTICLE_ARC, key: { url: a.url } };
  }
  async function speakPrompt() {
    if (S.drill === "debate") {
      const o = rand(catPool(DEBATES, S.scope["speak:debate"] || "any")), side = Math.random() < 0.5 ? "FOR" : "AGAINST";
      return { text: o.text, kicker: `Debate · ${o.cat}`, tag: `You argue ${side}`, hook: `You argue ${side}. Use your last 30 seconds to rebut yourself.`, arc: DEBATE_ARC, key: { text: o.text } };
    }
    if (S.drill === "interview") {
      const o = rand(catPool(INTERVIEWS, S.scope["speak:interview"] || "any"));
      return { text: o.text, kicker: `Interview · ${o.cat}`, tag: o.cat, hook: o.cat === "Behavioural" ? "Answer with a real story: situation, task, action, result." : "Lead with the answer, then why, then an example.", arc: o.cat === "Behavioural" ? STAR_ARC : ANSWER_ARC, key: { text: o.text } };
    }
    if (S.drill === "news") return articlePrompt();
    const r = roadmap(), done = learnedSet(r);
    const learnedList = r.concepts.filter((c) => done.has(c.id)), c = rand(learnedList.length ? learnedList : r.concepts), aud = rand(AUDIENCES);
    return { text: c.title, kicker: `Explain it to ${aud}`, tag: aud, hook: c.hook, concept: c, arc: EXPLAIN_ARC, key: { roadmap: r.id, id: c.id } };
  }

  /* ---------- rendering ---------- */
  function renderModes() {
    const box = $("modes");
    box.replaceChildren(...MODES.map((m) => {
      const b = el("button", { type: "button", className: "tab", textContent: m.label });
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(m.id === S.mode));
      b.onclick = () => { S.mode = m.id; save("mode"); S.current = null; S.last = null; renderAll(); };
      return b;
    }));
    $("blurb").textContent = MODES.find((m) => m.id === S.mode).blurb;
  }
  function renderScope() {
    const sel = $("scope"), dr = $("drill");
    sel.replaceChildren();
    dr.hidden = S.mode !== "speak";
    if (!dr.hidden) {
      dr.replaceChildren(...DRILLS.map((d) => el("option", { value: d.id, textContent: d.label })));
      dr.value = S.drill;
    }
    const goals = S.mode === "roadmap" || (S.mode === "speak" && S.drill === "explain");
    if (goals) {
      ROADMAPS.forEach((r) => sel.append(el("option", { value: r.id, textContent: r.label })));
      sel.value = roadmap().id;
    } else {
      const src = S.mode === "research" ? RESEARCH_TOPICS
        : S.drill === "debate" ? DEBATES : S.drill === "interview" ? INTERVIEWS : Object.fromEntries(ARTICLE_TOPICS.map((t) => [t, 1]));
      const news = S.mode === "speak" && S.drill === "news";
      sel.append(el("option", { value: "any", textContent: news ? "Past 7 days" : "Any category" }));
      Object.keys(src).forEach((k) => sel.append(el("option", { value: k, textContent: k })));
      sel.value = S.scope[scopeKey()] || "any";
    }
    ddSync.forEach((f) => f());
    $("progress").hidden = S.mode !== "roadmap";
    if (S.mode === "roadmap") {
      const r = roadmap(), n = learnedSet(r).size;
      $("bar").style.width = `${(n / r.concepts.length) * 100}%`;
      $("progressText").textContent = `${n} / ${r.concepts.length} learned`;
    }
  }
  const section = (label, body) => el("div", { className: "row3" }, el("h4", { textContent: label }), body);
  function renderCard() {
    const card = $("card"), cur = S.current;
    $("learned").hidden = !(cur && cur.concept);
    if (!cur || !cur.concept) { card.hidden = true; return; }
    const r = roadmap(), c = cur.concept, done = learnedSet(r);
    const chip = (id) => {
      const t = byId(r, id);
      return el("button", { type: "button", className: "chip" + (done.has(id) ? " done" : ""), textContent: (done.has(id) ? "✓ " : "") + t.title, onclick: () => showConcept(t) });
    };
    const q = encodeURIComponent(`${c.title} explained`);
    const nxt = unlocks(r, c.id);
    card.replaceChildren(
      section("Where it shows up", el("ul", {}, c.uses.map(([d, t]) => el("li", {}, el("b", { textContent: d + ". " }), el("span", { textContent: t }))))),
      section("Think about", el("ul", { className: "qs" }, c.asks.map((a) => el("li", { textContent: a })))),
      c.prereqs.length ? section("Helps to know", el("div", { className: "chips" }, c.prereqs.map(chip))) : "",
      nxt.length ? section("Leads to", el("div", { className: "chips" }, nxt.map((n) => chip(n.id)))) : "",
      section("Go deeper", el("p", { className: "links" },
        el("a", { href: `https://www.youtube.com/results?search_query=${q}`, target: "_blank", rel: "noopener", textContent: "Videos" }),
        el("a", { href: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(c.title)}`, target: "_blank", rel: "noopener", textContent: "Wikipedia" }),
        el("a", { href: `https://www.google.com/search?q=${q}`, target: "_blank", rel: "noopener", textContent: "Search" }))),
    );
    card.hidden = false;
    $("learned").textContent = done.has(c.id) ? "Mark not learned" : "I've learned this";
  }
  function renderMap() {
    const sec = $("mapSection");
    sec.hidden = S.mode !== "roadmap";
    if (sec.hidden) return;
    const r = roadmap(), done = learnedSet(r);
    $("mapTitle").textContent = `${r.label}: ${done.size} of ${r.concepts.length} learned`;
    const rows = [];
    let area = null;
    r.concepts.forEach((c) => {
      if (c.area && c.area !== area) { area = c.area; rows.push(el("li", { className: "area", textContent: area })); }
      const isDone = done.has(c.id);
      const box = el("input", { type: "checkbox", checked: isDone, title: isDone ? "Mark not learned" : "I already know this" });
      box.setAttribute("aria-label", `${c.title}: learned`);
      box.onchange = () => toggleLearned(r, c.id);
      rows.push(el("li", { className: `node ${isDone ? "done" : ""}` },
        box,
        el("button", { type: "button", className: "t", textContent: c.title, onclick: () => showConcept(c) }),
        el("span", { className: "s", textContent: isDone ? "learned" : "to learn" })));
    });
    $("mapList").replaceChildren(...rows);
  }
  function toggleLearned(r, id) {
    const set = learnedSet(r);
    set.has(id) ? set.delete(id) : set.add(id);
    S.learned[r.id] = [...set]; save("learned");
    renderScope(); renderCard(); renderMap();
  }
  function renderStreak() {
    const days = new Set(S.days), d = new Date();
    const key = (x) => x.toISOString().slice(0, 10);
    let n = 0;
    if (!days.has(key(d))) d.setDate(d.getDate() - 1);
    while (days.has(key(d))) { n++; d.setDate(d.getDate() - 1); }
    $("streak").textContent = n ? `${n}-day streak` : "";
  }
  function updateSlot() {
    const cur = S.current;
    $("kicker").textContent = cur ? cur.kicker : "Ready";
    $("topic").textContent = cur ? cur.text : "Spin to begin.";
    $("hook").textContent = cur ? (cur.hook || (cur.concept ? cur.concept.hook : "")) : "";
    const link = $("readLink");
    link.hidden = !(cur && cur.link);
    if (!link.hidden) link.href = cur.link;
    $("start").disabled = !cur || !!cur.empty;
    $("start").textContent = S.mode === "roadmap" ? "Start study timer" : S.mode === "research" || isReading() ? "Start reading timer" : `Start ${S.speech} min timer`;
  }
  function renderAll() { renderModes(); renderScope(); renderCard(); renderMap(); renderStreak(); updateSlot(); }
  function showConcept(c) {
    const r = roadmap();
    S.current = { text: c.title, kicker: r.label, concept: c };
    S.last = { roadmap: r.id, id: c.id };
    renderCard(); updateSlot();
    $("topic").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* ---------- audio: quiet, optional, no beeps ---------- */
  let ac;
  function ctx() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; }
  function tick() { // a soft wooden click
    if (!S.sound) return;
    try {
      const a = ctx(), len = 0.03, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 2; g.gain.value = 0.18;
      src.connect(f); f.connect(g); g.connect(a.destination); src.start();
    } catch {}
  }
  function chime(freqs = [392]) { // soft sine with slow decay
    if (!S.sound) return;
    try {
      const a = ctx();
      freqs.forEach((fr, i) => {
        const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.16;
        o.type = "sine"; o.frequency.value = fr;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 1.2);
      });
    } catch {}
  }

  /* ---------- spin ---------- */
  let spinning = false;
  function spin() {
    if (spinning) return;
    let result, reel;
    if (S.mode === "speak") {
      const pending = speakPrompt();
      const cat = S.drill === "debate" ? catPool(DEBATES, S.scope["speak:debate"] || "any")
        : S.drill === "interview" ? catPool(INTERVIEWS, S.scope["speak:interview"] || "any")
        : S.drill === "explain" ? roadmap().concepts.map((x) => ({ text: x.title })) : null;
      reel = cat ? cat.map((x) => x.text) : ["Finding an article…"];
      result = pending; // resolved when the reel stops
    } else if (S.mode === "roadmap") {
      const r = roadmap(), c = pickConcept(r);
      if (!c) { S.current = { text: "You've covered it all.", kicker: r.label, empty: true }; renderCard(); updateSlot(); return; }
      result = { text: c.title, kicker: r.label, concept: c, key: { roadmap: r.id, id: c.id } };
      reel = remaining(r).map((x) => x.title); // only things you haven't learned yet
    } else {
      const pool = otherPool(), o = rand(pool);
      result = { text: o.text, kicker: o.cat, key: { text: o.text } };
      reel = pool.map((x) => x.text);
    }
    spinning = true;
    const stage = $("topic").closest(".stage");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = reduce ? 0 : reel.length === 1 ? 3 : Math.min(14, 6 + reel.length);
    $("card").hidden = true; $("hook").textContent = "";
    stage.classList.add("spinning");
    let i = 0, prev = "";
    const step = async () => {
      if (i++ < steps) {
        let t; do { t = rand(reel); } while (reel.length > 1 && t === prev); prev = t;
        $("topic").textContent = t; $("kicker").textContent = "Spinning";
        // restart the drop animation
        $("topic").style.animation = "none"; void $("topic").offsetWidth; $("topic").style.animation = "";
        tick();
        setTimeout(step, 55 + i * i * 1.6);
        return;
      }
      result = await result;
      stage.classList.remove("spinning");
      S.current = result; S.last = result.key; spinning = false;
      renderCard(); updateSlot(); chime([392]);
    };
    step();
  }

  /* ---------- timer ---------- */
  let T = null;
  const hasPrep = () => S.mode !== "speak" || isReading();
  function openTimer() {
    if (!S.current || S.current.empty) return;
    $("overlay").hidden = false;
    $("oTopic").textContent = S.current.text;
    begin(hasPrep() ? "prep" : "speech");
    $("oMain").focus();
  }
  function begin(phase) {
    clearInterval(T && T.id);
    const total = (phase === "prep" ? S.research : S.speech) * 60;
    T = { phase, total, left: total, id: setInterval(tickT, 1000) };
    paint();
  }
  function tickT() {
    if (T.left > 0) T.left--;
    if (T.left <= 0) {
      clearInterval(T.id);
      if (T.phase === "prep") T.phase = "ready"; else { T.phase = "done"; logDay(); }
      chime([392, 523]);
    }
    paint();
  }
  function paint() {
    const { phase, total, left } = T;
    const rm = S.mode === "roadmap";
    $("overlay").classList.toggle("done", phase === "done");
    $("digits").textContent = mmss(phase === "ready" ? S.speech * 60 : left);
    $("line").style.width = `${phase === "ready" ? 0 : ((total - left) / total) * 100}%`;
    $("oPhase").textContent = phase === "prep" ? (rm ? "Study" : isReading() ? "Read" : "Research") : phase === "ready" ? "Up next" : phase === "speech" ? "Speak" + (S.current.tag ? " · " + S.current.tag : "") : "Finished";
    $("oStatus").textContent = phase === "prep" ? (rm ? "Read, watch, take notes." : isReading() ? "Skim the article for the key claim." : "Read up on it.")
      : phase === "ready" ? `${S.speech} min to explain it.` : phase === "speech" ? (rm ? "Explain it as if to a friend." : "Go.") : "Time.";
    const arc = rm ? ["Define it", "Show it", "Use it"] : S.mode === "speak" ? S.current.arc : null;
    const showArc = arc && (phase === "speech" || phase === "done");
    $("arc").replaceChildren(...(showArc ? arc.map((a, i) =>
      el("li", { className: phase === "done" || (total - left) / total >= i / arc.length ? "hit" : "", textContent: a })) : []));
    const main = $("oMain");
    main.textContent = phase === "prep" ? "Ready to speak" : phase === "ready" ? "Start speaking" : phase === "speech" ? "Finish early" : "Close";
    main.onclick = () => {
      if (phase === "prep" || phase === "ready") begin("speech");
      else if (phase === "speech") { clearInterval(T.id); T.phase = "done"; logDay(); paint(); }
      else closeTimer();
    };
  }
  function closeTimer() { clearInterval(T && T.id); $("overlay").hidden = true; T = null; $("start").focus(); }
  function logDay() {
    const d = new Date().toISOString().slice(0, 10);
    if (!S.days.includes(d)) { S.days.push(d); S.days = S.days.slice(-400); save("days"); renderStreak(); }
  }

  /* ---------- wiring ---------- */
  $("spin").onclick = spin;
  $("start").onclick = openTimer;
  $("oClose").onclick = closeTimer;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("overlay").hidden) closeTimer();
    if (e.key === " " && e.target === document.body && $("overlay").hidden) { e.preventDefault(); spin(); }
  });
  $("scope").onchange = (e) => {
    const goals = S.mode === "roadmap" || (S.mode === "speak" && S.drill === "explain");
    S.scope[goals ? "roadmap" : scopeKey()] = e.target.value;
    save("scope"); S.current = null; S.last = null; renderAll();
  };
  $("drill").onchange = (e) => { S.drill = e.target.value; save("drill"); S.current = null; S.last = null; renderAll(); };
  $("learned").onclick = () => {
    if (!S.current || !S.current.concept) return;
    toggleLearned(roadmap(), S.current.concept.id);
  };
  $("settingsBtn").onclick = () => $("settings").showModal();
  const sync = () => {
    $("speechMin").value = S.speech; $("researchMin").value = S.research;
    $("speechOut").textContent = S.speech; $("researchOut").textContent = S.research; $("sound").checked = S.sound;
  };
  $("speechMin").oninput = (e) => { S.speech = +e.target.value; save("speech"); sync(); updateSlot(); };
  $("researchMin").oninput = (e) => { S.research = +e.target.value; save("research"); sync(); };
  $("sound").onchange = (e) => { S.sound = e.target.checked; save("sound"); if (S.sound) chime([392]); };
  $("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ learned: S.learned, days: S.days }, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "spinpath-progress.json" });
    a.click(); URL.revokeObjectURL(a.href);
  };
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = async (e) => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (j.learned && typeof j.learned === "object") { S.learned = j.learned; save("learned"); }
      if (Array.isArray(j.days)) { S.days = j.days; save("days"); }
      renderAll();
    } catch { alert("That file isn't valid Spinpath progress."); }
    e.target.value = "";
  };
  $("resetBtn").onclick = () => {
    if (confirm(`Reset progress for ${roadmap().label}?`)) { S.learned[roadmap().id] = []; save("learned"); S.current = null; renderAll(); }
  };

  sync();
  makeSelect($("drill"));
  makeSelect($("scope"));
  renderAll();
})();
