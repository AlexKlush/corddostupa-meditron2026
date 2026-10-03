/* Общие помощники: DOM, даты по-русски, иконки, световой отклик на нажатие, уведомления,
   плавная прокрутка (Lenis), поповеры, смена темы, делегирование действий. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(window.ICONS || {})[name] || ""}</svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* в песочнице Streamlit хранилище может быть недоступно */ } },
  };

  /* ── даты и числа ── */
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const WDF = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const pad2 = n => String(n).padStart(2, "0");
  function plural(n, f) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return f[2]; if (n1 > 1 && n1 < 5) return f[1]; if (n1 === 1) return f[0]; return f[2]; }
  const days = n => `${n} ${plural(n, ["день", "дня", "дней"])}`;
  const fmt = {
    d: off => { const x = DATA.at(off); return `${pad2(x.getDate())}.${pad2(x.getMonth() + 1)}`; },
    long: off => { const x = DATA.at(off); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; },
    wd: off => WD[DATA.at(off).getDay()],
    wdd: off => `${WD[DATA.at(off).getDay()]}, ${fmt.d(off)}`,
    wdLong: off => `${WDF[DATA.at(off).getDay()]}, ${fmt.long(off)}`,
    rel: off => off === 0 ? "сегодня" : off === -1 ? "вчера" : off === 1 ? "завтра" : off === 2 ? "послезавтра" : off < 0 ? `${days(-off)} назад` : `через ${days(off)}`,
    num: (v, d = 2) => Number(v).toFixed(d).replace(".", ","),
    int: v => Math.round(v).toLocaleString("ru-RU"),
    today: () => { const x = DATA.today; return `${WDF[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`; },
  };

  /* ── аватар: фото или монограмма ── */
  function initials(name) {
    const p = String(name).replace(/\./g, "").split(/\s+/).filter(Boolean);
    if (p.length >= 3) return (p[1][0] + p[0][0]).toUpperCase();
    if (p.length === 2) return (p[0][0] + p[1][0]).toUpperCase();
    return (p[0] || "?").slice(0, 2).toUpperCase();
  }
  function avatar(person, cls = "") {
    const n = person.name || "";
    return person.photo
      ? `<span class="av ${cls}"><img src="${esc(person.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`
      : `<span class="av ${cls}" aria-hidden="true">${esc(initials(n))}</span>`;
  }

  /* ── световой отклик: от точки нажатия расходится свет ── */
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest(".btn, .chip, .slot, .seg button, .nav, [data-ripple]");
    if (!t || reduced() || t.disabled) return;
    const r = t.getBoundingClientRect();
    const s = Math.max(r.width, r.height) * 2.4;
    const el = document.createElement("span");
    el.className = "ripple";
    el.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${s}px;height:${s}px`;
    t.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }, { passive: true });

  /* ── уведомления ── */
  function toast(title, text = "", opts = {}) {
    const box = $("#toasts"); if (!box) return;
    const life = opts.life || 4800;
    const el = document.createElement("div");
    el.className = "toast";
    el.style.setProperty("--life", life + "ms");
    el.innerHTML = `<span class="ti">${icon(opts.icon || "check", "s16")}</span><div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ""}</div><button class="ib" type="button" aria-label="Закрыть уведомление">${icon("x", "s16")}</button><span class="bar"></span>`;
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add("out"); setTimeout(() => el.remove(), 300); };
    el.querySelector("button").addEventListener("click", close);
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(close, life);
  }

  /* ── счётчики ── */
  function countUp(el, to, dur = 900, dec = 0) {
    if (reduced()) { el.textContent = dec ? fmt.num(to, dec) : fmt.int(to); return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4), v = to * e;
      el.textContent = dec ? fmt.num(v, dec) : fmt.int(v);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function counters(root = document) { $$("[data-count]", root).forEach(el => countUp(el, parseFloat(el.dataset.count), +(el.dataset.dur || 900), +(el.dataset.dec || 0))); }

  /* ── сегменты: «бегунок» скользит под выбранной кнопкой ── */
  function glide(seg, instant) {
    let g = seg.querySelector(".glider");
    if (!g) { g = document.createElement("span"); g.className = "glider"; seg.prepend(g); instant = true; }
    const on = seg.querySelector("button.on");
    if (!on) { g.style.opacity = "0"; return; }
    if (instant) g.style.transition = "none";
    g.style.opacity = "1";
    g.style.width = on.offsetWidth + "px";
    g.style.transform = `translateX(${on.offsetLeft - 3}px)`;
    if (instant) { g.getBoundingClientRect(); g.style.transition = ""; }
  }
  const glideAll = (root = document, instant) => $$(".seg", root).forEach(s => glide(s, instant));

  /* ── появление при прокрутке ── */
  const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px 6% 0px", threshold: 0 }) : null; // проявляем чуть до входа в кадр, без пустоты внизу экрана
  function reveal(root = document) { $$("[data-reveal]:not(.in)", root).forEach(el => io ? io.observe(el) : el.classList.add("in")); }

  /* ── плавная прокрутка ── */
  let lenis = null;
  function initScroll() {
    if (lenis || !window.Lenis || reduced()) return;
    try {
      lenis = new window.Lenis({ lerp: .13, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1 });
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      lenis.on("scroll", () => window.Leaders && window.Leaders.redraw());
    } catch (e) { lenis = null; }
  }
  function scrollTo(target, offset = 84) {
    if (lenis) { lenis.scrollTo(target, { offset: -offset, duration: 1.1 }); return; }
    const y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: reduced() ? "auto" : "smooth" });
  }
  function scrollTop() { if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0); }
  function lockScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); document.documentElement.classList.toggle("locked", on); }

  /* ── поповер, привязанный к элементу ── */
  let pop = null;
  function popover(anchor, html, opts = {}) {
    closePop(true);
    const scrim = document.createElement("div"); scrim.className = "pop-scrim";
    const el = document.createElement("div"); el.className = "pop" + (opts.cls ? " " + opts.cls : ""); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "false");
    el.innerHTML = html;
    document.body.append(scrim, el);
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    const x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    let y = r.bottom + 10, oy = "0%";
    if (y + h > window.innerHeight - 12) { y = Math.max(12, r.top - h - 10); oy = "100%"; }
    el.style.left = x + "px"; el.style.top = y + "px";
    el.style.setProperty("--ox", (r.left + r.width / 2 - x) + "px"); el.style.setProperty("--oy", oy);
    scrim.addEventListener("click", () => closePop());
    pop = { el, scrim, onClose: opts.onClose };
    const f = el.querySelector("[data-autofocus]"); if (f) setTimeout(() => f.focus(), 30);
    return el;
  }
  function closePop(silent) {
    if (!pop) return;
    const { el, scrim, onClose } = pop; pop = null;
    scrim.remove(); el.classList.add("out"); setTimeout(() => el.remove(), 180);
    if (!silent && onClose) onClose();
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePop(); });

  /* ── делегирование действий: data-act="имя" ── */
  const acts = {};
  const on = (name, fn) => { acts[name] = fn; };
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("[data-act][role='button']");
    if (!el || el.tagName === "BUTTON") return;
    e.preventDefault(); el.click();
  });

  /* ── текст Навигатора появляется по словам ── */
  function words(el, text, step = 26) {
    if (reduced()) { el.textContent = text; return 0; }
    const parts = text.split(/(\s+)/);
    let i = 0;
    el.innerHTML = parts.map(p => /^\s+$/.test(p) ? p : `<span class="w" style="--d:${(i++) * step}ms">${esc(p)}</span>`).join("");
    return i * step + 450;
  }

  /* ── шкала по краю стола ── */
  function ruler(el) {
    if (!el) return;
    const w = el.clientWidth; let h = "";
    for (let x = 80, n = 10; x < w - 20; x += 80, n += 10) h += `<span style="left:${x}px">${n}</span>`;
    el.innerHTML = h + `<span style="left:0">мм</span>`;
  }

  /* ── смена темы: новая тема раскрывается кругом от кнопки ── */
  function setTheme(next, ev) {
    const apply = () => { document.documentElement.dataset.theme = next; store.set("aegis-theme", next); };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const x = ev ? ev.clientX : window.innerWidth - 40, y = ev ? ev.clientY : 30;
    const rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      { duration: 700, easing: "cubic-bezier(.16,1,.3,1)", pseudoElement: "::view-transition-new(root)" }
    )).catch(() => {});
  }

  window.U = { $, $$, esc, icon, sleep, reduced, store, fmt, plural, days, initials, avatar, toast, countUp, counters, glide, glideAll, reveal, initScroll, scrollTo, scrollTop, lockScroll, popover, closePop, on, words, ruler, setTheme };
})();
