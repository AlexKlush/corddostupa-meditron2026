/* Кабинет клиники: координатор и врач в одном кабинете, переключатель ролей.
   Световой стол со случаями, просмотр случая, поток заключений ИИ, расписание, аналитика. */
(function () {
  "use strict";
  const { $, $$, esc, icon, fmt, plural } = U;
  const D = DATA;
  const role = () => Store.state.role;
  const ui = { tab: null, mod: "all", conf: .5, layout: "wall" };
  const ORDER = { urgent: 0, high: 1, medium: 2, routine: 3 };
  const me = () => role() === "doctor" ? D.users.doctor : D.users.coordinator;

  function sorted(ps) {
    return ps.slice().sort((a, b) => (b.lit - a.lit) || (ORDER[a.priority] - ORDER[b.priority]) || (b.since - a.since));
  }
  const needsDoctor = p => !p.decision && p.status !== "normal";

  /* ── плёнка случая на столе ── */
  function casePlate(p, k = 0) {
    const step = p.route[0];
    const urgent = p.lit && p.priority === "urgent";
    const sla = p.lit ? `<span class="sla ${p.since > 7 ? "late" : ""}" data-tip="Дней с заключения ИИ без записи">${icon("hourglass", "s14")}${U.days(p.since)}</span>` : "";
    const acts = p.lit
      ? `<div class="case-acts"><button class="btn sm" data-act="call" data-id="${p.id}">${icon("phone", "s14")}<span>Позвонить</span></button><button class="btn sm primary" data-act="open-case" data-id="${p.id}" data-focus="slots">${icon("calendar-plus", "s14")}<span>Записать</span></button></div>`
      : role() === "doctor" && needsDoctor(p) ? `<div class="case-acts"><button class="btn sm primary" data-act="open-case" data-id="${p.id}">${icon("badge-check", "s14")}<span>Решить</span></button></div>` : "";
    const st = p.booking ? UI.stamp("Записан", `${fmt.d(p.booking.off)} · ${p.booking.t}`) : p.status === "visited" ? UI.stamp("Приём был", "", "ink") : p.status === "normal" ? UI.stamp("Норма", "", "ink") : p.status === "planned" ? UI.stamp("План врача", "", "ink") : "";
    return `<div class="cell enter" style="--k:${k}" data-id="${p.id}">
      <article class="plate case clips ${p.lit ? "lit" : "off"} ${urgent ? "urgent" : ""}" data-act="open-case" data-id="${p.id}" role="button" tabindex="0" aria-label="Открыть случай: ${esc(p.short)}">
        ${UI.film(p, "sm")}
        <div class="case-body">
          <div class="case-head"><div class="np"><div class="np-name">${esc(p.short)}</div><div class="np-meta"><span>${UI.age(p.age)}</span><span>${p.sex}</span><span>${p.study.mod} ${esc(p.study.area)}</span></div></div>${UI.pri(p)}</div>
          <p class="case-find">${esc(p.ai.finding)}</p>
          <div class="case-route">${UI.stepLine(p, 0)}<span>${esc(step.sk ? D.specs[step.sk] : step.title)}</span><span class="muted">${step.sk ? "· до " + U.days(step.within) : "· " + esc(step.when || "")}</span></div>
          <div class="np-status"><span class="t">${esc(p.statusText)}</span>${sla}</div>
          ${acts}
        </div>
        ${st}
      </article></div>`;
  }

  function caseRow(p, k = 0) {
    const step = p.route[0];
    return `<div class="cell enter" style="--k:${k}" data-id="${p.id}"><div class="row-case plate ${p.lit ? "lit" : "off"} ${p.lit && p.priority === "urgent" ? "urgent" : ""}" data-act="open-case" data-id="${p.id}" role="button" tabindex="0">
      <div class="np"><div class="np-name">${esc(p.short)}</div><div class="np-meta"><span>${UI.age(p.age)}</span><span>${p.study.mod} ${esc(p.study.area)}</span></div></div>
      <div class="rc-find">${esc(p.ai.finding)}</div>
      <div class="rc-p mono">${fmt.num(p.ai.prob)}</div>
      <div class="case-route">${UI.stepLine(p, 0)}<span>${esc(step.sk ? D.specs[step.sk] : step.title)}</span></div>
      <div class="rc-st">${esc(p.statusText)}</div>
      ${UI.pri(p)}
    </div></div>`;
  }

  function filtered() {
    const tab = ui.tab || (role() === "doctor" ? "decide" : "lit");
    return sorted(Store.all()).filter(p => {
      if (tab === "lit" && !p.lit) return false;
      if (tab === "urgent" && !(p.lit && p.priority === "urgent")) return false;
      if (tab === "done" && !(p.booking || p.status === "visited")) return false;
      if (tab === "decide" && !needsDoctor(p)) return false;
      if (ui.mod !== "all" && p.study.mod !== ui.mod) return false;
      if (tab === "all" && p.ai.prob < ui.conf) return false;
      return true;
    });
  }

  function gridHTML() {
    const list = filtered();
    if (!list.length) return `<div class="empty-state plate pad">${icon("lamp", "s20")}<b>На столе пусто: под фильтр не попал ни один случай</b><p>Сбросьте фильтр модальности или опустите окно уверенности, чтобы увидеть исследования с низкой вероятностью патологии.</p><button class="btn sm" data-act="wall-reset">Сбросить фильтры</button></div>`;
    return list.map((p, i) => ui.layout === "wall" ? casePlate(p, i) : caseRow(p, i)).join("");
  }

  // FLIP: оставшиеся плёнки переезжают на новые места, новые вешаются на стол
  function refreshGrid() {
    const grid = $("#wallGrid"); if (!grid) return;
    const before = new Map($$(".cell", grid).map(c => [c.dataset.id, c.getBoundingClientRect()]));
    grid.className = "wall-grid " + ui.layout;
    grid.innerHTML = gridHTML();
    $$(".cell", grid).forEach(c => {
      const was = before.get(c.dataset.id); if (!was || U.reduced()) return;
      c.classList.remove("enter");
      const now = c.getBoundingClientRect(), dx = was.left - now.left, dy = was.top - now.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" });
    });
    updateCounts();
  }

  function counts() {
    const ps = Store.all();
    return {
      lit: ps.filter(p => p.lit).length, urgent: ps.filter(p => p.lit && p.priority === "urgent").length,
      done: ps.filter(p => p.booking || p.status === "visited").length, all: ps.filter(p => p.ai.prob >= ui.conf).length,
      decide: ps.filter(needsDoctor).length, late: ps.filter(p => p.lit && p.since > 7).length, churn: ps.filter(p => p.lit && p.churn > .55).length,
    };
  }
  function updateCounts() { const c = counts(); $$("[data-cnt]").forEach(el => { el.textContent = c[el.dataset.cnt]; }); }

  /* ── вид «Стол» ── */
  function wall() {
    const c = counts(), r = role();
    const urgent = Store.all().filter(p => p.lit && p.priority === "urgent");
    const decide = Store.all().filter(needsDoctor);
    const tab = ui.tab || (r === "doctor" ? "decide" : "lit");
    const brief = r === "doctor"
      ? `${UI.greet()}, ${D.users.doctor.short}. ${decide.length} ${plural(decide.length, ["маршрут ждёт", "маршрута ждут", "маршрутов ждут"])} вашего решения: Навигатор предложил шаги по свежим заключениям ИИ, координатор начнёт запись после подтверждения. Остальные маршруты подтверждены.`
      : `${UI.greet()}, ${D.users.coordinator.short}. За ночь Навигатор разобрал 128 заключений ИИ: 41 с находками, по 37 предложен маршрут. На столе светятся ${c.lit} ${plural(c.lit, ["случай", "случая", "случаев"])}: им нужен следующий шаг. Начните со срочных.`;
    const chips = (r === "doctor" ? decide : urgent).slice(0, 3).map(p => `<button class="chip" data-act="open-case" data-id="${p.id}">${r === "doctor" ? icon("badge-check") : icon("phone-call")}${esc(p.short)}<span class="n">${r === "doctor" ? esc(p.study.mod) : U.days(p.since)}</span></button>`).join("");
    const tabs = (r === "doctor" ? [["decide", "Ждут решения", "decide"]] : []).concat([["lit", "Светятся", "lit"], ["urgent", "Срочно", "urgent"], ["done", "Записаны и приняты", "done"], ["all", "Все", "all"]]);
    return {
      title: "Световой стол", sub: `${fmt.today()} · ${r === "doctor" ? "режим врача" : "режим координатора"}`,
      html: `
      <section class="brief plate pad lit" data-reveal>
        <div class="brief-mark">${icon("sparkles", "s20")}</div>
        <div class="brief-body">
          <div class="brief-who">Навигатор · сводка на ${fmt.d(0)}</div>
          <p class="brief-text" id="briefText">${esc(brief)}</p>
          <div class="brief-chips">${chips}</div>
        </div>
        <dl class="brief-stats">
          <button data-act="wall-tab" data-tab="lit"><dt>Без записи больше 7 дней</dt><dd><b data-cnt="late">${c.late}</b>${icon("hourglass", "s16")}</dd></button>
          <button data-act="wall-tab" data-tab="lit"><dt>Риск ухода в другую клинику</dt><dd><b data-cnt="churn">${c.churn}</b>${icon("door-open", "s16")}</dd></button>
          <button data-act="wall-tab" data-tab="${r === "doctor" ? "decide" : "all"}"><dt>Ждут решения врача</dt><dd><b data-cnt="decide">${c.decide}</b>${icon("badge-check", "s16")}</dd></button>
        </dl>
      </section>
      <div class="toolbar" data-reveal>
        <div class="seg" id="wallTabs">${tabs.map(([k, l, n]) => `<button class="${tab === k ? "on" : ""}" data-act="wall-tab" data-tab="${k}">${l}<span class="n" data-cnt="${n}">${c[n]}</span></button>`).join("")}</div>
        <div class="seg" id="wallMod">${[["all", "Все"], ["КТ", "КТ"], ["ММГ", "ММГ"], ["РГ", "Рентген"]].map(([k, l]) => `<button class="${ui.mod === k ? "on" : ""}" data-act="wall-mod" data-mod="${k}">${l}</button>`).join("")}</div>
        <label class="win" data-tip="Как окно W/L в просмотрщике: во вкладке «Все» показываем исследования с вероятностью патологии не ниже порога">${icon("sliders-horizontal", "s16")}<span>Окно ≥ <b class="mono" id="confVal">${fmt.num(ui.conf)}</b></span>
          <input class="range" id="confRange" type="range" min="0" max="0.9" step="0.05" value="${ui.conf}" style="--p:${ui.conf / .9 * 100}%" aria-label="Порог вероятности"></label>
        <div class="seg sm" id="wallLayout"><button class="${ui.layout === "wall" ? "on" : ""}" data-act="wall-layout" data-l="wall" aria-label="Плёнками">${icon("layout-grid", "s16")}</button><button class="${ui.layout === "list" ? "on" : ""}" data-act="wall-layout" data-l="list" aria-label="Списком">${icon("list", "s16")}</button></div>
      </div>
      <div class="legend" data-reveal><span>${UI.lf("proposed")}предложил Навигатор</span><span>${UI.lf("confirmed")}подтвердил врач</span><span>${UI.lf("declined")}отклонено или изменено</span><span class="lit-key"><i></i>светится — нужен следующий шаг</span><span class="demo-mark"><i></i>демо-данные</span></div>
      <div id="wallGrid" class="wall-grid ${ui.layout}">${gridHTML()}</div>`,
      after(view) {
        const t = $("#briefText", view);
        if (t && !Store.seen("brief-" + r + "-" + D.today.toDateString())) U.words(t, brief, 22);
        const range = $("#confRange", view);
        range.addEventListener("input", () => {
          ui.conf = +range.value; range.style.setProperty("--p", (ui.conf / .9 * 100) + "%");
          $("#confVal").textContent = fmt.num(ui.conf);
          if ((ui.tab || "lit") !== "all") { ui.tab = "all"; $$("#wallTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === "all")); U.glide($("#wallTabs")); }
          refreshGrid();
        });
      },
    };
  }

  U.on("wall-tab", el => { ui.tab = el.dataset.tab; $$("#wallTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === ui.tab)); U.glide($("#wallTabs")); refreshGrid(); if (el.closest(".brief-stats")) U.scrollTo($("#wallTabs")); });
  U.on("wall-mod", el => { ui.mod = el.dataset.mod; $$("#wallMod button").forEach(b => b.classList.toggle("on", b.dataset.mod === ui.mod)); U.glide($("#wallMod")); refreshGrid(); });
  U.on("wall-layout", el => { ui.layout = el.dataset.l; $$("#wallLayout button").forEach(b => b.classList.toggle("on", b.dataset.l === ui.layout)); U.glide($("#wallLayout")); refreshGrid(); });
  U.on("wall-reset", () => { ui.mod = "all"; ui.conf = 0; ui.tab = "all"; App.go("admin/wall", true); });
  U.on("open-case", el => { ui.focus = el.dataset.focus || null; App.go(`admin/case/${el.dataset.id}`); });

  /* ── звонок по скрипту Навигатора ── */
  U.on("call", el => {
    const p = Store.patient(el.dataset.id), slot = Store.bestSlot(p), doc = slot && Store.doc(slot.doc);
    const step = p.route[0];
    const plain = {
      p01: "на КТ нашли небольшой очаг в лёгком, 9 мм. Это не диагноз: врач посмотрит и решит, нужен ли контроль",
      p02: "на КТ есть находка, которую нужно срочно показать торакальному хирургу",
      p03: "по маммографии врач хочет уточнить один участок слева, это нужно сделать в ближайшую неделю",
      p05: "на снимке есть признаки воспаления в лёгком, терапевту важно посмотреть вас в течение двух дней",
      p13: "на снимке видна жидкость в плевральной полости, терапевту нужно посмотреть вас сегодня или завтра",
    }[p.id] || `по результату исследования рекомендована консультация: ${step.title.toLowerCase()}`;
    U.popover(el, `<h4>${icon("phone-call", "s16")} ${esc(p.short)} · ${esc(p.phone)}</h4>
      <p class="muted">Скрипт звонка от Навигатора</p>
      <ol class="script"><li>Представиться: координатор клиники «Эгида», ${esc(D.users.coordinator.name)}.</li><li>Объяснить спокойно: ${esc(plain)}.</li><li>${slot ? `Предложить время: <b>${esc(doc.short)}, ${fmt.wdd(slot.off)}, ${slot.t}</b>, кабинет ${doc.room}.` : "Предложить ближайший свободный слот."}</li><li>Сказать, что напоминание придёт в приложение и по SMS.</li></ol>
      <div class="acts"><button class="btn sm ghost" data-act="call-out" data-r="miss" data-id="${p.id}">Не ответил</button><button class="btn sm" data-act="call-out" data-r="later" data-id="${p.id}">Перезвонить</button>${slot ? `<button class="btn sm primary" data-act="call-out" data-r="book" data-id="${p.id}" data-slot="${slot.id}" data-autofocus>Записать на ${slot.t}</button>` : ""}</div>`, { cls: "wide" });
  });
  U.on("call-out", el => {
    const id = el.dataset.id, p = Store.patient(id);
    U.closePop(true);
    if (el.dataset.r === "book") { doBook(id, el.dataset.slot); return; }
    if (el.dataset.r === "miss") { Store.setStatus(id, "no-contact", { title: "Звонок координатора", text: "Не ответил(а)", state: "overdue" }); U.toast("Звонок отмечен", `${p.short} не ответил(а). Навигатор предложит повторить через 2 часа и отправит SMS.`, { icon: "phone-missed" }); }
    else { Store.setStatus(id, "call-planned", { title: "Перезвонить", text: "Договорились созвониться позже", state: "proposed" }); U.toast("Перезвон запланирован", `${p.short}: напомню через 2 часа`, { icon: "clock" }); }
    App.rerender();
  });

  /* ── запись: свет гаснет, выноска становится сплошной, ложится штамп ── */
  function doBook(pid, slotId, opts = {}) {
    const res = Store.book(pid, slotId, "coordinator"); if (!res) { U.toast("Слот уже занят", "Выберите другое время", { icon: "circle-alert" }); return; }
    const p = Store.patient(pid);
    const label = `Записан · ${fmt.wd(res.slot.off)} ${res.slot.t}`;
    if (Leaders.has("lead")) Leaders.setState("lead", "booked", label);
    const rec = $("#recPlate");
    if (rec) {
      rec.classList.remove("lit"); rec.classList.add("off");
      rec.insertAdjacentHTML("beforeend", UI.stamp(p.sex === "Ж" ? "Записана" : "Записан", `${fmt.d(res.slot.off)} · ${res.slot.t}`, "land"));
      $$(".rec-steps .lf", rec)[0]?.setAttribute("class", "lf booked");
      const first = $(".rec-steps li", rec); if (first) first.classList.add("booked");
    }
    const q = $(`.cv-queue [data-id="${pid}"]`); if (q) { q.classList.remove("lit", "urgent"); q.classList.add("off"); }
    $$(`[data-slot="${slotId}"]`).forEach(b => { b.classList.remove("free", "best"); b.classList.add("taken", "now"); b.disabled = true; b.removeAttribute("data-act"); });
    const tl = $("#tlBox"); if (tl) tl.innerHTML = UI.timeline(p);
    App.refreshChrome();
    U.toast(`${p.short} ${p.sex === "Ж" ? "записана" : "записан"}`, `${res.doc.spec}: ${res.doc.short}, ${res.when}, каб. ${res.doc.room}. Пациенту ушли SMS и push, шаг плана загорелся в кабинете пациента.`, { icon: "calendar-check", life: 6500 });
    if (opts.rerender) App.rerender();
  }
  U.on("slot", el => {
    const s = Store.slot(el.dataset.slot), doc = Store.doc(s.doc);
    const pid = App.route.view === "case" ? App.route.id : null;
    if (pid) {
      const p = Store.patient(pid);
      U.popover(el, `<h4>Записать ${esc(p.short)}?</h4><p>${esc(doc.spec)}: ${esc(doc.short)}<br>${fmt.wdLong(s.off)}, ${s.t} · кабинет ${doc.room}</p><p class="muted">Пациенту уйдут SMS и push, шаг загорится в его плане.</p><div class="acts"><button class="btn sm ghost" data-act="pop-close">Отмена</button><button class="btn sm primary" data-act="slot-ok" data-slot="${s.id}" data-id="${pid}" data-autofocus>${icon("calendar-check", "s14")}<span>Записать</span></button></div>`);
      return;
    }
    // из расписания: кого записать в этот слот
    const cand = Store.all().filter(p => p.lit && p.route.some(r => r.sk === doc.sk)).sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
    U.popover(el, `<h4>${esc(doc.short)} · ${fmt.wdd(s.off)}, ${s.t}</h4><p class="muted">Навигатор предлагает пациентов, которым нужен ${esc(doc.spec.toLowerCase())}:</p>
      <div class="pick">${cand.length ? cand.map(p => `<button class="pick-row" data-act="slot-ok" data-slot="${s.id}" data-id="${p.id}">${UI.pri(p)}<span class="grow"><b>${esc(p.short)}</b><small>${esc(p.ai.finding)}</small></span>${icon("arrow-right", "s16")}</button>`).join("") : `<p>Сейчас никого: все пациенты с такой рекомендацией уже записаны.</p>`}</div>`, { cls: "wide" });
  });
  U.on("pop-close", () => U.closePop());
  U.on("slot-ok", el => { U.closePop(true); const inCase = App.route.view === "case"; doBook(el.dataset.id, el.dataset.slot, { rerender: !inCase }); });

  /* ── вид «Случай» ── */
  function caseView(r) {
    const p = Store.patient(r.id); if (!p) return wall();
    const queue = sorted(Store.all().filter(x => x.lit || x.id === p.id));
    const step0 = p.route[0], doc0 = step0.sk ? D.doctors.filter(d => d.sk === step0.sk && d.shift) : [];
    const best = Store.bestSlot(p);
    const bestMap = new Map(best ? [[best.id, p]] : []);
    const dayIdx = best ? best.dayIndex : 0;
    const isDoc = role() === "doctor";
    const dec = p.decision;
    const decText = dec ? `${dec.state === "confirmed" ? "Подтвердил" : dec.state === "changed" ? "Изменил" : "Отклонил"}: ${Store.doc(dec.by).short}, ${fmt.rel(-dec.ago)}` : "Ждёт решения врача";
    const churn = Math.round(p.churn * 100);
    return {
      title: p.short, sub: `${p.study.title} · ${fmt.d(-p.study.ago)} · ${esc(p.ai.service)}`,
      html: `
      <div class="case-view">
        <aside class="cv-queue" data-clip data-lenis-prevent>
          <button class="btn sm ghost back" data-act="nav" data-view="wall">${icon("arrow-left", "s14")}<span>Световой стол</span></button>
          <div class="cvq-list">${queue.map((x, i) => `<button class="cvq plate ${x.lit ? "lit" : "off"} ${x.lit && x.priority === "urgent" ? "urgent" : ""} ${x.id === p.id ? "cur" : ""}" data-act="open-case" data-id="${x.id}" style="--k:${i}">
            <span class="np-name">${esc(x.short)}</span><span class="cvq-f">${esc(x.study.mod)} · ${esc(x.ai.finding)}</span><span class="cvq-s">${UI.pri(x)}<span class="muted">${U.days(x.since)}</span></span></button>`).join("")}</div>
        </aside>

        <section class="cv-main">
          <header class="cv-head plate pad">
            ${U.avatar(p, "lg")}
            <div class="np grow"><div class="np-name">${esc(p.name)}</div>
              <div class="np-meta"><span>${UI.age(p.age)}</span><span>${p.sex === "Ж" ? "женщина" : "мужчина"}</span><span>${esc(p.policy)}</span><span class="mono">${esc(p.phone)}</span></div>
              <div class="cv-tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}<span class="tag ${p.churn > .55 ? "amber" : "line"}" data-tip="Оценка Навигатора по поведению: не отвечает, открыл и закрыл запись, визиты в другие клиники">${icon("door-open", "s14")}риск ухода ${churn} %</span></div>
            </div>
            <div class="cv-acts">${UI.pri(p)}<button class="btn" data-act="call" data-id="${p.id}">${icon("phone", "s16")}<span>Позвонить</span></button><button class="btn ghost icon" data-act="push" data-id="${p.id}" data-tip="Отправить рекомендацию в приложение">${icon("send", "s16")}</button></div>
          </header>

          <div class="cv-film plate">${UI.film(p, "lg", "ants reveal")}</div>

          <nav class="seg cv-tabs" id="cvTabs">${[["sr", "Заключение ИИ"], ["route", "Маршрут пациента"], ["acts", "Последние действия"], ["comm", "Комментарии врачей"], ["kafka", "Kafka"]].map(([k, l], i) => `<button class="${i ? "" : "on"}" data-act="cv-sec" data-sec="${k}">${l}</button>`).join("")}</nav>

          <section class="plate pad cv-sec" id="sec-sr" data-reveal><h3>${icon("scan-eye", "s16")}Заключение ИИ-сервиса (DICOM SR)</h3>${UI.sr(p)}</section>
          <section class="plate pad cv-sec" id="sec-route" data-reveal><h3>${icon("route", "s16")}Маршрут пациента: где был и что дальше</h3><div id="tlBox">${UI.timeline(p)}</div></section>
          <section class="plate pad cv-sec" id="sec-acts" data-reveal><h3>${icon("history", "s16")}Последние действия</h3>
            ${p.activity.length ? `<ul class="acts-list">${p.activity.map(a => `<li>${icon(a[0], "s16")}<div><b>${esc(a[2])}</b><span>${esc(a[1])}</span></div></li>`).join("")}</ul>` : `<p class="muted">Действий пациента после исследования не было.</p>`}</section>
          <section class="plate pad cv-sec" id="sec-comm" data-reveal><h3>${icon("message-square", "s16")}Комментарии врачей</h3>
            <ul class="comm" id="commList">${commHTML(p)}</ul>
            <form class="comm-add" data-id="${p.id}"><textarea class="area" name="t" rows="2" placeholder="${isDoc ? "Комментарий врача для координатора и коллег" : "Заметка координатора"}"></textarea><button class="btn sm primary" type="submit">${icon("send", "s14")}<span>Добавить</span></button></form></section>
          <section class="plate pad cv-sec" id="sec-kafka" data-reveal><h3>${icon("database", "s16")}Сообщение Kafka от ИИ-сервиса</h3><p class="muted small">Ключи по БФТ НПКЦ ДиТ ДЗМ: Навигатор читает их вместо разбора свободного текста.</p>${UI.kafka(p)}</section>
        </section>

        <aside class="cv-side">
          <section class="plate pad rec ${p.lit ? "lit" : "off"}" id="recPlate">
            <div id="recBox"></div>
          </section>
          ${doc0.length ? `<section class="plate pad slots-box" id="slotsBox">
            <h3>${icon("calendar-days", "s16")}${esc(D.specs[step0.sk])}: свободное время</h3>
            <div class="seg sm days" id="dayTabs">${D.slotDays.slice(0, 4).map((off, i) => `<button class="${i === dayIdx ? "on" : ""}" data-act="cv-day" data-day="${i}" data-id="${p.id}">${fmt.wdd(off)}</button>`).join("")}</div>
            <div id="capBox">${capBox(doc0, dayIdx, bestMap)}</div>
            <p class="muted small">Подсвечен слот, который Навигатор подобрал под срок «до ${U.days(step0.within)}».</p>
          </section>` : ""}
        </aside>
      </div>`,
      after(view) {
        const box = $("#recBox", view);
        const done = () => { box.innerHTML = recHTML(p); box.classList.add("swap"); connect(p, view); };
        if (Store.seen("think-" + p.id)) done(); else UI.think(box, ["Читаю DICOM SR: описание и заключение", "Сверяю с историей пациента в МИС", "Применяю правила маршрутизации", "Подбираю свободные слоты"], done);
        $(".comm-add", view)?.addEventListener("submit", e => {
          e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return;
          Store.comment(p.id, t, role() === "doctor" ? "d2" : "me");
          $("#commList").innerHTML = commHTML(Store.patient(p.id)); e.target.reset();
          U.toast("Комментарий добавлен", "Его увидят врач и координатор", { icon: "message-square" });
        });
        if (ui.focus === "slots") { ui.focus = null; setTimeout(() => $("#slotsBox") && U.scrollTo($("#slotsBox"), 100), 400); }
      },
    };
  }

  function capBox(docs, dayIdx, bestMap) {
    return docs.map(d => `<div class="cap-doc">${U.avatar(d, "sm")}<div class="grow"><b>${esc(d.short)}</b><span class="muted">каб. ${d.room} · стаж ${d.exp} ${plural(d.exp, ["год", "года", "лет"])}</span></div></div>${UI.capacity(d, dayIdx, { best: bestMap, chips: true })}`).join("");
  }

  function connect(p, view) {
    const from = $(".cv-film [data-anchor='finding']", view);
    const to = $(".tchip.best", view);
    if (from && to && !p.booking) Leaders.connect("lead", from, to, { label: `${D.specs[p.route[0].sk]} · ${U.fmt.wd(Store.slot(to.dataset.slot).off)} ${to.textContent.trim()}`, bend: .55 });
  }

  function commHTML(p) {
    if (!p.comments.length) return `<li class="muted">Комментариев пока нет.</li>`;
    return p.comments.map(c => {
      const d = c[0] === "me" ? { name: D.users.coordinator.name, short: "Белова О.", spec: "Координатор" } : Store.doc(c[0]);
      return `<li class="${c[3] ? "fresh" : ""}">${U.avatar(d, "sm")}<div><div class="c-who"><b>${esc(d.short || d.name)}</b><span>${esc(d.spec)} · ${fmt.rel(-c[1])}</span></div><p>${esc(c[2])}</p></div></li>`;
    }).join("");
  }

  function recHTML(p) {
    const isDoc = role() === "doctor", dec = p.decision;
    const steps = p.route.map((s, i) => `<li class="${i === 0 && p.booking ? "booked" : ""}">${UI.stepLine(p, i)}<div><b>${esc(s.sk ? "Консультация: " + D.specs[s.sk].toLowerCase() : s.title)}</b><span>${esc(s.sk ? `в течение ${U.days(s.within)} · ${s.why}` : `${s.when || "в течение " + U.days(s.within)} · ${s.why}`)}</span></div></li>`).join("");
    const reasons = p.reasons.map(([t, src]) => `<li><span>${esc(t)}</span><em>${esc(src)}</em></li>`).join("");
    const decRow = dec
      ? `<p class="rec-dec">${UI.lf(dec.state === "confirmed" ? "confirmed" : "declined")}<span>${dec.state === "confirmed" ? "Маршрут подтвердил" : dec.state === "changed" ? "Маршрут изменил" : "Маршрут отклонил"} ${esc(Store.doc(dec.by).short)}, ${fmt.rel(-dec.ago)}${dec.note ? `: «${esc(dec.note)}»` : ""}</span></p>`
      : `<p class="rec-dec wait">${UI.lf("proposed")}<span>Маршрут ждёт решения врача</span></p>`;
    const docActs = isDoc && !dec ? `<div class="rec-acts"><button class="btn sm primary" data-act="decide" data-st="confirmed" data-id="${p.id}">${icon("badge-check", "s14")}<span>Подтвердить</span></button><button class="btn sm" data-act="decide-pop" data-st="changed" data-id="${p.id}">Изменить</button><button class="btn sm ghost warn" data-act="decide-pop" data-st="declined" data-id="${p.id}">Отклонить</button></div>` : "";
    const st = p.booking ? UI.stamp(p.sex === "Ж" ? "Записана" : "Записан", `${fmt.d(p.booking.off)} · ${p.booking.t}`) : "";
    return `<div class="rec-head"><span class="rec-mark">${icon("sparkles", "s16")}</span><div><b>Навигатор предлагает</b><span class="muted">уверенность маршрута ${fmt.num(p.routeConf)}</span></div></div>
      <ol class="rec-steps">${steps}</ol>
      <details class="rec-why" open><summary>Почему так ${icon("chevron-down", "s14")}</summary><ul>${reasons}</ul></details>
      ${decRow}${docActs}
      <p class="rec-note">${icon("info", "s14")}Навигатор не ставит диагноз: он ведёт пациента по заключению ИИ-сервиса, решение принимает врач.</p>${st}`;
  }

  U.on("cv-sec", el => { $$("#cvTabs button").forEach(b => b.classList.toggle("on", b === el)); U.glide($("#cvTabs")); U.scrollTo($("#sec-" + el.dataset.sec), 128); });
  U.on("cv-day", el => {
    const p = Store.patient(el.dataset.id), step0 = p.route[0];
    $$("#dayTabs button").forEach(b => b.classList.toggle("on", b === el)); U.glide($("#dayTabs"));
    const best = Store.bestSlot(p);
    const box = $("#capBox"); box.innerHTML = capBox(D.doctors.filter(d => d.sk === step0.sk && d.shift), +el.dataset.day, new Map(best ? [[best.id, p]] : [])); box.classList.remove("swap"); box.getBoundingClientRect(); box.classList.add("swap");
    Leaders.remove("lead"); connect(p, document);
  });
  U.on("push", el => {
    const p = Store.patient(el.dataset.id);
    Store.setStatus(p.id, p.status, { title: "Рекомендация отправлена в приложение", text: "Push и SMS", state: "done" });
    Store.state.notif.patient.unshift({ id: "n" + Date.now(), icon: "route", title: "Новый шаг в вашем плане", text: p.route[0].title, pid: p.id, fresh: true });
    U.toast("Отправлено в приложение", `${p.short} получит push и SMS со ссылкой на запись`, { icon: "send" });
    const tl = $("#tlBox"); if (tl) tl.innerHTML = UI.timeline(Store.patient(p.id));
    App.refreshChrome();
  });
  U.on("decide", el => {
    const id = el.dataset.id; Store.decide(id, el.dataset.st);
    const p = Store.patient(id);
    $$("#recBox .rec-steps .lf").forEach(l => l.setAttribute("class", "lf confirmed"));
    $("#recBox").innerHTML = recHTML(p); $("#tlBox").innerHTML = UI.timeline(p);
    U.toast("Маршрут подтверждён", "Пунктир стал сплошным: координатор увидит случай в очереди на запись", { icon: "badge-check" });
    App.refreshChrome();
  });
  U.on("decide-pop", el => {
    const st = el.dataset.st, id = el.dataset.id;
    const opts = st === "declined" ? ["Находка не требует действий", "Пациент уже наблюдается у профильного врача", "Нужен другой специалист"] : ["Другой специалист", "Другой срок", "Только наблюдение"];
    U.popover(el, `<h4>${st === "declined" ? "Отклонить маршрут" : "Изменить маршрут"}</h4><p class="muted">Причина вернётся в Навигатор и поможет улучшить рекомендации.</p>
      <div class="pick">${opts.map(o => `<button class="pick-row" data-act="decide-ok" data-st="${st}" data-id="${id}" data-note="${esc(o)}"><span class="grow"><b>${esc(o)}</b></span>${icon("arrow-right", "s16")}</button>`).join("")}</div>`);
  });
  U.on("decide-ok", el => {
    U.closePop(true);
    Store.decide(el.dataset.id, el.dataset.st, el.dataset.note);
    U.toast(el.dataset.st === "declined" ? "Маршрут отклонён" : "Маршрут изменён", "Причина сохранена для обучения Навигатора", { icon: "pen-line" });
    App.rerender();
  });

  /* ── вид «Поток заключений» ── */
  let feedTimer = 0, feedIdx = 0, feedPaused = false;
  const feedStats = { total: 128, path: 41, route: 37 };
  function feedItem(f, isNew) {
    const now = new Date(), t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const art = f.mod === "КТ" ? Art.ct(null, f.age) : f.mod === "ММГ" ? Art.mmg(null, f.age) : f.area === "ОПН" ? Art.sinus(null) : Art.cxr(null, f.age);
    const keys = Object.assign({ pathologyFlag: f.flag, confidenceLevel: Math.round(f.prob * 100) }, f.keys);
    return `<article class="plate feed-item ${f.flag ? "lit" : "off"} ${f.flag && f.pri === "urgent" ? "urgent" : ""} ${isNew ? "new" : ""}">
      <div class="fi-film film xs">${art}</div>
      <div class="fi-main">
        <div class="fi-top"><span class="mono muted">${t}</span><span class="tag ${f.flag ? "teal" : ""}">${f.flag ? "Патология" : "Норма"}</span><span class="muted">${esc(f.svc)}</span></div>
        <div class="np-name">${esc(f.name)}, ${f.age}</div>
        <p>${esc(f.mod)} ${esc(f.area)}: ${esc(f.find)}</p>
        <div class="keys">${Object.entries(keys).map(([k, v]) => `<span class="kv">${esc(k)}: ${esc(String(v))}</span>`).join("")}</div>
      </div>
      <div class="fi-route">${f.flag ? `${UI.pri({ priority: f.pri })}<span class="case-route">${UI.lf("proposed")}${esc(f.route)}</span>` : `<span class="case-route muted">${UI.lf("confirmed")}${esc(f.route)}</span>`}</div>
    </article>`;
  }
  function pushFeed() {
    const box = $("#feed"); if (!box) { clearInterval(feedTimer); return; }
    if (feedPaused || document.hidden) return;
    const f = D.feed[feedIdx++ % D.feed.length];
    box.insertAdjacentHTML("afterbegin", feedItem(f, true));
    const el = box.firstElementChild;
    if (!U.reduced()) { const h = el.offsetHeight; el.animate([{ height: "0px", opacity: 0, marginBottom: "-12px" }, { height: h + "px", opacity: 1, marginBottom: "0px" }], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" }); }
    while (box.children.length > 9) box.lastElementChild.remove();
    feedStats.total++; if (f.flag) { feedStats.path++; feedStats.route++; }
    $("#fsTotal") && ($("#fsTotal").textContent = feedStats.total);
    $("#fsPath") && ($("#fsPath").textContent = feedStats.path);
    $("#fsRoute") && ($("#fsRoute").textContent = feedStats.route);
    const pipe = $(".pipe-svg"); if (pipe) { pipe.classList.remove("pulse"); pipe.getBoundingClientRect(); pipe.classList.add("pulse"); }
  }
  function inbox() {
    clearInterval(feedTimer);
    const first = [];
    for (let i = 0; i < 5; i++) first.push(D.feed[(i + 3) % D.feed.length]);
    feedIdx = 0;
    const nodes = [["МИС / РИС", "исследование и данные пациента", "database"], ["ИИ-сервис", "DICOM SR + Kafka", "scan-eye"], ["Навигатор", "ключи SR · правила · ранжирование", "sparkles"], ["Координатор и врач", "очередь на столе", "users"], ["Пациент", "план и запись в приложении", "smartphone"]];
    return {
      title: "Поток заключений", sub: "Новые DICOM SR от ИИ-сервисов · имитация интеграции",
      html: `
      <section class="plate pad pipe" data-reveal>
        <div class="pipe-head"><h2>Как заключение становится маршрутом</h2><span class="live"><i></i>поток идёт</span><button class="btn sm" data-act="feed-pause">${icon("pause", "s14")}<span>Пауза</span></button></div>
        <div class="pipe-svg">${nodes.map((n, i) => `<div class="pnode" style="--k:${i}"><span class="pn-ico">${icon(n[2], "s20")}</span><b>${n[0]}</b><span>${n[1]}</span></div>${i < nodes.length - 1 ? `<div class="pedge" style="--k:${i}"><i></i></div>` : ""}`).join("")}</div>
      </section>
      <div class="feed-stats" data-reveal><span>Сегодня</span><b id="fsTotal">${feedStats.total}</b><span>заключений</span><b id="fsPath">${feedStats.path}</b><span>с находками</span><b id="fsRoute">${feedStats.route}</b><span>маршрутов предложено</span><span class="demo-mark"><i></i>демо-поток</span></div>
      <div class="feed" id="feed">${first.map(f => feedItem(f)).join("")}</div>`,
      after() { feedTimer = setInterval(pushFeed, 6500); setTimeout(pushFeed, 1600); },
    };
  }
  U.on("feed-pause", el => { feedPaused = !feedPaused; el.innerHTML = feedPaused ? `${icon("play", "s14")}<span>Дальше</span>` : `${icon("pause", "s14")}<span>Пауза</span>`; $(".live")?.classList.toggle("paused", feedPaused); });

  /* ── вид «Расписание» ── */
  const sch = { day: 0, sk: "all" };
  function schedule() {
    const bestMap = new Map();
    Store.all().filter(p => p.lit).forEach(p => { const b = Store.bestSlot(p); if (b && !bestMap.has(b.id)) bestMap.set(b.id, p); });
    const docs = D.doctors.filter(d => d.shift && (sch.sk === "all" || d.sk === sch.sk));
    const skList = [["all", "Все"]].concat(Object.entries(D.specs));
    return {
      title: "Расписание врачей", sub: "Свободные слоты · подсвечены те, что Навигатор подобрал пациентам со стола",
      html: `
      <div class="toolbar" data-reveal>
        <div class="seg" id="schDays">${D.slotDays.map((off, i) => `<button class="${i === sch.day ? "on" : ""}" data-act="sch-day" data-day="${i}">${fmt.wdd(off)}</button>`).join("")}</div>
        <div class="chips">${skList.map(([k, l]) => `<button class="chip ${sch.sk === k ? "on" : ""}" data-act="sch-sk" data-sk="${k}">${esc(l)}</button>`).join("")}</div>
      </div>
      <div class="legend" data-reveal><span class="k free"><i></i>свободно</span><span class="k best"><i></i>подобрано Навигатором</span><span class="k busy"><i></i>занято</span><span class="k taken"><i></i>записано сейчас</span></div>
      <div class="sched" id="sched">${docs.map((d, i) => `<div class="sch-row plate cell enter" style="--k:${i}">
          <div class="sch-doc">${U.avatar(d, "lg")}<div><b>${esc(d.short)}</b><span>${esc(d.spec)}</span><span class="muted">каб. ${d.room} · ★ ${fmt.num(d.rating, 1)}</span></div></div>
          <div class="sch-cap">${UI.capacity(d, sch.day, { best: bestMap })}</div>
        </div>`).join("")}</div>`,
    };
  }
  U.on("sch-day", el => { sch.day = +el.dataset.day; App.rerender(true); });
  U.on("sch-sk", el => { sch.sk = el.dataset.sk; App.rerender(true); });

  /* ── вид «Аналитика» ── */
  function analytics() {
    const A = D.analytics;
    const max = A.funnel[0][1];
    return {
      title: "Аналитика", sub: "Как Навигатор влияет на конверсию в повторный приём",
      html: `
      <p class="demo-banner" data-reveal>${icon("info", "s16")}Все цифры на этой странице синтетические: они показывают, каким будет отчёт для клиники и «Третьего мнения», а не результат пилота.</p>
      <div class="an-grid">
        <section class="plate pad an-conv" data-reveal><h3>Конверсия в повторный приём</h3><p class="muted small">Доля пациентов с находкой, дошедших до следующего шага, по неделям</p>
          ${Charts.line({ series: [{ values: A.conversion, area: true, endLabel: A.conversion[A.conversion.length - 1] + " %" }], labels: A.weeks, min: 30, max: 70, ticks: 4, fmtY: v => Math.round(v) + " %", marker: A.launchWeek, markerLabel: "Навигатор включён", aria: "Конверсия по неделям" })}</section>
        <section class="plate pad an-funnel" data-reveal><h3>Воронка маршрутов за месяц</h3>
          <ol class="funnel">${A.funnel.map(([l, v], i) => `<li style="--k:${i}"><div class="fl-top"><span>${esc(l)}</span><b data-count="${v}">${v}</b></div><div class="fl-bar"><i style="--w:${(v / max * 100).toFixed(1)}%"></i></div>${i ? `<span class="fl-conv">${Math.round(v / A.funnel[i - 1][1] * 100)} % от шага выше</span>` : ""}</li>`).join("")}</ol></section>
        <section class="plate pad an-dec" data-reveal><h3>Решения врачей по маршрутам</h3><p class="muted small">Форма линии та же, что на столе</p>
          <div class="dec-bar">${A.decisions.map(([l, v, st]) => `<i class="${st}" style="--w:${v}%" data-tip="${esc(l)}: ${v} %"></i>`).join("")}</div>
          <ul class="dec-leg">${A.decisions.map(([l, v, st]) => `<li>${UI.lf(st === "confirmed" ? "confirmed" : st === "changed" ? "proposed" : "declined")}<span>${esc(l)}</span><b>${v} %</b></li>`).join("")}</ul></section>
        <section class="plate pad an-mod" data-reveal><h3>Конверсия по модальностям</h3>
          <ul class="mods">${A.byMod.map(([m, now, was]) => `<li><span>${esc(m)}</span><div class="mbar"><i class="was" style="--w:${was}%"></i><i class="now" style="--w:${now}%"></i></div><b>${was} → ${now} %</b></li>`).join("")}</ul>
          <p class="muted small"><span class="kd was"></span>до Навигатора <span class="kd now"></span>с Навигатором</p></section>
        <section class="plate pad an-time" data-reveal><h3>Скорость и потери</h3>
          <div class="pair"><div><span>Дней от заключения до записи</span><b><s>${fmt.num(A.daysToBook[0], 1)}</s> ${fmt.num(A.daysToBook[1], 1)}</b></div><div><span>Ушли в другую клинику, на 100 пациентов с находкой</span><b><s>${A.lost[0]}</s> ${A.lost[1]}</b></div></div></section>
      </div>`,
      after(view) { Charts.play(view); U.counters(view); },
    };
  }

  window.Admin = {
    home: "wall",
    nav: () => [
      { view: "wall", label: "Световой стол", short: "Стол", icon: "layout-grid", count: () => Store.all().filter(p => p.lit).length },
      { view: "inbox", label: "Поток заключений", short: "Поток", icon: "radio", count: () => null, live: true },
      { view: "schedule", label: "Расписание", icon: "calendar-days" },
      { view: "analytics", label: "Аналитика", icon: "chart-column" },
    ],
    views: { wall, case: caseView, inbox, schedule, analytics },
    me, role,
    leave() { clearInterval(feedTimer); },
  };
})();
