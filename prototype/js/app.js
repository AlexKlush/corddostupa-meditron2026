/* Оболочка: маршрутизация по #/..., боковая панель, верхняя строка, выезжающая правая панель, уведомления, поиск.
   В Streamlit страница живёт в iframe без истории: тогда маршрут держится в памяти. */
(function () {
  "use strict";
  const { $, $$, esc, icon } = U;
  const CABS = { admin: window.Admin, patient: window.Patient };
  let route = { cab: null, view: null, id: null };
  let mem = "";
  let token = 0;

  const readHash = () => { try { return location.hash || mem; } catch (e) { return mem; } };
  const parse = h => { const p = h.replace(/^#\/?/, "").split("/").filter(Boolean); return { cab: p[0] || null, view: p[1] || null, id: p[2] || null }; };

  function go(path, replace) {
    const h = "#/" + String(path).replace(/^#?\/?/, "");
    mem = h;
    try { if (location.hash !== h) history[replace ? "replaceState" : "pushState"](null, "", h); } catch (e) { /* srcdoc-iframe: живём на памяти */ }
    render();
  }
  window.addEventListener("popstate", () => { try { mem = location.hash; } catch (e) { /* */ } render(); });
  window.addEventListener("hashchange", () => { try { mem = location.hash; } catch (e) { /* */ } render(); });

  function render() {
    const r = parse(readHash());
    const app = $("#app");
    if (!r.cab || !CABS[r.cab]) {
      if (route.cab === "admin") Admin.leave();
      route = { cab: null, view: null, id: null };
      Leaders.clear(); U.closePop(true);
      document.documentElement.dataset.cab = "";
      Chooser.mount(app);
      document.title = "Эгида · Навигатор маршрута пациента";
      U.scrollTop();
      return;
    }
    const cab = CABS[r.cab];
    if (!r.view || !cab.views[r.view]) r.view = cab.home;
    const fresh = route.cab !== r.cab || !$(".app", app);
    if (route.cab === "admin" && (r.cab !== "admin" || r.view !== "inbox")) Admin.leave();
    if (fresh) shell(app, r);
    route = r;
    swap(r, !fresh);
  }

  function shell(app, r) {
    const cab = CABS[r.cab], isAdmin = r.cab === "admin";
    document.documentElement.dataset.cab = r.cab;
    const role = Store.state.role;
    app.innerHTML = `
    <div class="app" data-cab="${r.cab}">
      <aside class="side" aria-label="Навигация">
        <div class="side-top">
          <a class="brand" href="#/" data-act="home" aria-label="Эгида: выбор кабинета">${Art.logo()}<span class="word">Эгида</span></a>
          <button class="ib side-btn" data-act="side" aria-label="Свернуть или развернуть панель">${icon("panel-left-close", "close")}${icon("panel-left-open", "open")}</button>
        </div>
        ${isAdmin
          ? `<div class="seg role-seg" id="roleSeg" aria-label="Роль"><button class="${role === "coordinator" ? "on" : ""}" data-act="role" data-r="coordinator">${icon("phone-call", "s14")}<span>Координатор</span></button><button class="${role === "doctor" ? "on" : ""}" data-act="role" data-r="doctor">${icon("stethoscope", "s14")}<span>Врач</span></button></div>`
          : `<button class="btn primary side-cta" data-act="p-book" data-sk="pulm">${icon("calendar-plus", "s16")}<span>Записаться</span></button>`}
        <nav class="side-nav" id="sideNav"><span class="nav-glider" aria-hidden="true"></span>${cab.nav().map(n => `<a class="nav" href="#/${r.cab}/${n.view}" data-act="nav" data-view="${n.view}" data-tip="${esc(n.label)}">${icon(n.icon)}<span class="label">${esc(n.label)}</span>${n.live ? `<span class="live-pip" aria-label="идёт поток"></span>` : `<span class="count" data-navcount="${n.view}" hidden></span>`}</a>`).join("")}</nav>
        <div class="side-foot">
          <div class="me" id="meCard"></div>
          <div class="side-tools">
            <button class="ib" data-act="theme" aria-label="Сменить тему">${icon("sun", "sun")}${icon("moon", "moon")}</button>
            <button class="ib" data-act="swap-cab" aria-label="${isAdmin ? "Открыть кабинет пациента" : "Открыть кабинет клиники"}">${icon("repeat")}</button>
            <button class="ib" data-act="home" aria-label="Выйти к выбору кабинета">${icon("log-out")}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="bar" id="bar">
          <a class="brand m-only" href="#/" data-act="home" aria-label="Эгида">${Art.logo()}</a>
          <div class="bar-title"><h1 id="pageTitle"></h1><span class="sub" id="pageSub"></span></div>
          <div class="bar-tools">
            ${isAdmin ? `<div class="search-wrap"><label class="field search">${icon("search")}<input id="searchIn" placeholder="Найти пациента" autocomplete="off" aria-label="Найти пациента"><kbd>/</kbd></label><div class="search-res" id="searchRes" hidden></div></div>` : ""}
            <button class="btn sm swapper" data-act="swap-cab">${icon(isAdmin ? "user-round" : "building-2", "s14")}<span>${isAdmin ? "Кабинет пациента" : "Кабинет клиники"}</span></button>
            <button class="ib" data-act="bell" aria-label="Уведомления" id="bellBtn">${icon("bell")}<span class="pip" hidden></span></button>
            <button class="ib m-only" data-act="theme" aria-label="Сменить тему">${icon("sun", "sun")}${icon("moon", "moon")}</button>
          </div>
        </header>
        <div class="ruler" id="ruler" aria-hidden="true"></div>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
      <aside class="panel" id="panel" data-lenis-prevent aria-label="Панель записи"><div class="panel-head"><b id="panelTitle"></b><button class="ib" data-act="panel-close" aria-label="Закрыть панель">${icon("x")}</button></div><div class="panel-body" id="panelBody"></div></aside>
      <div class="scrim" data-act="panel-close" aria-hidden="true"></div>
      <nav class="tabbar" aria-label="Разделы">${cab.nav().slice(0, 5).map(n => `<a class="tab" href="#/${r.cab}/${n.view}" data-act="nav" data-view="${n.view}">${icon(n.icon)}<span>${esc(n.label.split(" ").pop())}</span></a>`).join("")}</nav>
    </div>`;
    U.ruler($("#ruler"));
    U.glideAll(app, true);
    refreshChrome();
    if (isAdmin) wireSearch();
  }

  async function swap(r, animate, keep) {
    const my = ++token;
    const cab = CABS[r.cab], view = $("#view");
    Leaders.clear(); U.closePop(true);
    if (animate && !U.reduced()) { view.classList.add("leaving"); await U.sleep(150); }
    if (my !== token) return;
    const y = window.scrollY;
    const out = cab.views[r.view](r);
    $("#pageTitle").textContent = out.title;
    $("#pageSub").innerHTML = out.sub || "";
    document.title = `${out.title} · Эгида`;
    view.className = `view v-${r.view}`;
    view.innerHTML = out.html;
    Array.from(view.children).forEach((c, i) => c.style.setProperty("--i", Math.min(i, 8)));
    if (!keep) view.classList.add("entering");
    markNav(r.view);
    if (keep) window.scrollTo(0, y); else U.scrollTop();
    U.glideAll(view, true);
    U.reveal(view);
    if (out.after) out.after(view);
    clearTimeout(swap.t); swap.t = setTimeout(() => view.classList.remove("entering"), 1100);
  }

  function rerender(keep) { if (!route.cab) { render(); return; } swap(route, false, keep); }

  function markNav(view) {
    const v = view === "case" ? "wall" : view;
    $$(".nav, .tab").forEach(a => a.classList.toggle("on", a.dataset.view === v));
    const on = $(".side-nav .nav.on"), g = $(".nav-glider");
    if (on && g) { g.style.height = on.offsetHeight + "px"; g.style.transform = `translateY(${on.offsetTop}px)`; g.style.opacity = "1"; }
  }

  function refreshChrome() {
    if (!route.cab || !$(".app")) return;
    const cab = CABS[route.cab];
    cab.nav().forEach(n => { const el = $(`[data-navcount="${n.view}"]`); if (el && n.count) { const v = n.count(); el.textContent = v || ""; el.hidden = !v; } });
    const pip = $("#bellBtn .pip"), c = Store.unread(route.cab);
    if (pip) { const was = !pip.hidden; pip.hidden = !c; if (c && !was) { pip.classList.remove("pop"); pip.getBoundingClientRect(); pip.classList.add("pop"); } }
    const me = route.cab === "admin" ? Admin.me() : Patient.me();
    const card = $("#meCard"); if (card) card.innerHTML = `${U.avatar(me)}<div class="me-t"><b>${esc(me.short || me.name)}</b><span>${esc(me.role)}</span></div>`;
  }

  /* ── правая панель ── */
  const panel = {
    onClose: null,
    open(html, o = {}) {
      $("#panelTitle").textContent = o.title || "";
      const b = $("#panelBody"); b.innerHTML = html; b.scrollTop = 0;
      $(".app").classList.add("panel-open"); U.lockScroll(window.innerWidth <= 860);
      U.glideAll(b, true); Leaders.follow(700); panel.onClose = o.onClose || null;
    },
    update(html) { const b = $("#panelBody"); if (!b) return; b.innerHTML = html; U.glideAll(b, true); },
    close(silent) {
      const a = $(".app"); if (!a || !a.classList.contains("panel-open")) return;
      a.classList.remove("panel-open"); U.lockScroll(false); Leaders.follow(700);
      if (!silent && panel.onClose) panel.onClose();
    },
  };

  /* ── уведомления ── */
  const SEED = {
    admin: [{ icon: "phone-call", title: "Кузнецова Е. И. просит перезвонить", text: "Сегодня после 11:00" }, { icon: "scan-eye", title: "Срочное заключение ИИ", text: "Ким А. Е.: признаки гидроторакса справа" }],
    patient: [{ icon: "route", title: "Новый шаг в вашем плане", text: "Консультация пульмонолога после КТ" }, { icon: "droplet", title: "Анализы готовы", text: "Общий анализ крови, биохимия, витамин D" }],
  };
  U.on("bell", el => {
    const cab = route.cab, list = Store.notifs(cab).slice(0, 4).concat(SEED[cab]);
    U.popover(el, `<h4>Уведомления</h4><ul class="notifs">${list.map(n => `<li class="${n.fresh ? "fresh" : ""}">${icon(n.icon, "s16")}<div><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div></li>`).join("")}</ul>`, { onClose: () => { Store.readAll(cab); refreshChrome(); } });
  });

  /* ── поиск пациента ── */
  function wireSearch() {
    const inp = $("#searchIn"), res = $("#searchRes"); if (!inp) return;
    const show = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { res.hidden = true; return; }
      const found = Store.all().filter(p => (p.name + " " + p.ai.finding + " " + p.study.mod).toLowerCase().includes(q)).slice(0, 6);
      res.innerHTML = found.length ? found.map(p => `<button class="sr-item" data-act="open-case" data-id="${p.id}"><span class="dotlit ${p.lit ? "on" : ""}"></span><span class="grow"><b>${esc(p.short)}</b><small>${esc(p.study.mod)} · ${esc(p.ai.finding)}</small></span>${UI.pri(p)}</button>`).join("") : `<p class="muted">Никого не нашли</p>`;
      res.hidden = false;
    };
    inp.addEventListener("input", show);
    inp.addEventListener("focus", show);
    inp.addEventListener("keydown", e => { if (e.key === "Escape") { inp.value = ""; res.hidden = true; inp.blur(); } if (e.key === "Enter") { const b = $(".sr-item", res); if (b) b.click(); } });
    document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) res.hidden = true; });
  }

  /* ── действия оболочки ── */
  U.on("nav", el => { panel.close(true); go(`${route.cab}/${el.dataset.view}`); });
  U.on("home", () => { panel.close(true); go(""); });
  U.on("theme", (el, e) => U.setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", e));
  U.on("side", () => {
    const closed = document.documentElement.dataset.side === "closed";
    document.documentElement.dataset.side = closed ? "" : "closed";
    U.store.set("aegis-side", closed ? "" : "closed");
    Leaders.follow(700);
    setTimeout(() => { U.ruler($("#ruler")); markNav(route.view); U.glideAll(document, true); }, 560);
  });
  U.on("swap-cab", () => { panel.close(true); go(route.cab === "admin" ? "patient" : "admin"); });
  U.on("role", el => {
    Store.setRole(el.dataset.r);
    $$("#roleSeg button").forEach(b => b.classList.toggle("on", b === el)); U.glide($("#roleSeg"));
    refreshChrome(); rerender();
    const doc = el.dataset.r === "doctor";
    U.toast(doc ? "Режим врача" : "Режим координатора", doc ? "Сначала случаи, где нужно подтвердить маршрут" : "Сначала случаи, где нужно позвонить и записать", { icon: doc ? "stethoscope" : "phone-call", life: 2800 });
  });
  U.on("panel-close", () => panel.close());
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") panel.close();
    if (e.key === "/" && route.cab === "admin" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); const s = $("#searchIn"); if (s) s.focus(); }
  });

  function start() {
    Art.defs();
    const side = U.store.get("aegis-side", ""); if (side) document.documentElement.dataset.side = side;
    document.documentElement.classList.add("js");
    U.initScroll();
    render();
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { U.ruler($("#ruler")); if (route.cab) markNav(route.view); U.glideAll(document, true); }, 120); });
    window.addEventListener("scroll", () => { const b = $("#bar"); if (b) b.classList.toggle("scrolled", window.scrollY > 4); }, { passive: true });
    Store.subscribe(refreshChrome);
  }

  window.App = { go, rerender, refreshChrome, panel, get route() { return route; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
