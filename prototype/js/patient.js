/* Кабинет пациента. Тот же световой стол, но для одного человека: светится следующий шаг плана.
   Объясняем простыми словами, без диагнозов; запись в два нажатия. Пациентка: Соколова Галина Петровна. */
(function () {
  "use strict";
  const { $, $$, esc, icon, fmt, plural } = U;
  const D = DATA, P = D.persona, PID = "p01";
  const me = () => Store.patient(PID);
  const studyDate = () => fmt.long(-me().study.ago);

  const plain = {
    what: () => `На КТ от ${studyDate()} в правом лёгком нашли небольшой очаг размером 9 мм. Очаг — это маленький участок уплотнения лёгочной ткани.`,
    why: "Чаще всего такие находки оказываются безобидными, например след перенесённого воспаления. Решить это может только врач, поэтому снимок важно показать пульмонологу и не откладывать.",
    next: "Пульмонолог посмотрит снимок и решит, что дальше. Обычно в таких случаях назначают контрольную КТ через 3 месяца, чтобы проверить, меняется ли очаг.",
  };

  function upcoming() {
    const p = me(), list = [];
    if (p.booking) { const d = Store.doc(p.booking.doc); list.push({ off: p.booking.off, t: p.booking.t, title: "Консультация пульмонолога", sub: `${d.short} · кабинет ${d.room}`, doc: d, lit: true, id: "bk" }); }
    Store.visits(PID).forEach((s, i) => { const d = Store.doc(s.doc); list.push({ off: s.off, t: s.t, title: d.spec, sub: `${d.short} · кабинет ${d.room}`, doc: d, id: "x" + i }); });
    P.upcoming.forEach(u => { const d = u.doc && Store.doc(u.doc); list.push({ off: u.off, t: u.t, title: u.title, sub: d ? `${d.short} · кабинет ${d.room}` : u.place, doc: d, note: u.note, id: u.id }); });
    return list.sort((a, b) => a.off - b.off || a.t.localeCompare(b.t));
  }

  function dateBlock(off, t) { const x = D.at(off); return `<div class="dblock"><b>${x.getDate()}</b><span>${fmt.wd(off)}</span>${t ? `<em>${t}</em>` : ""}</div>`; }

  function visitRow(v, k = 0) {
    return `<li class="visit ${v.lit ? "lit" : ""}" style="--k:${k}">${dateBlock(v.off, v.t)}<div class="grow"><b>${esc(v.title)}</b><span>${esc(v.sub || "")}</span>${v.note ? `<span class="muted">${esc(v.note)}</span>` : ""}</div>${v.doc ? U.avatar(v.doc, "sm") : `<span class="av sm">${icon("droplet", "s14")}</span>`}</li>`;
  }

  function quickSlots() {
    const s = Store.freeSlots("pulm").slice(0, 3);
    return `<div class="quick">${s.map((x, i) => { const d = Store.doc(x.doc); return `<button class="qslot ${i ? "" : "first"}" data-act="p-quick" data-slot="${x.id}" ${i ? "" : 'data-anchor="slot0"'}><b>${fmt.wdd(x.off)} · ${x.t}</b><span>${esc(d.short)}${i ? "" : " · ближайшее"}</span></button>`; }).join("")}
      <button class="btn ghost" data-act="p-book" data-sk="pulm">${icon("calendar-days", "s16")}<span>Другое время</span></button></div>`;
  }

  function bookedBlock(p) {
    const d = Store.doc(p.booking.doc);
    return `<div class="booked-box">${U.avatar(d, "lg")}<div class="grow"><b>${fmt.wdLong(p.booking.off)}, ${p.booking.t}</b><span>${esc(d.name)}, ${esc(d.spec.toLowerCase())} · кабинет ${d.room}</span><span class="muted">${esc(D.clinic.address)}. Напомним за день и за 2 часа.</span></div></div>
      <div class="row wrap"><button class="btn sm" data-act="p-cal">${icon("calendar-plus", "s14")}<span>В календарь</span></button><button class="btn sm" data-act="p-way">${icon("map-pin", "s14")}<span>Как пройти</span></button><button class="btn sm ghost" data-act="p-book" data-sk="pulm">${icon("repeat", "s14")}<span>Перенести</span></button></div>`;
  }

  /* ── Главная ── */
  function home() {
    const p = me(), bk = p.booking;
    const n = Store.notifs("patient").find(x => x.fresh);
    const v = P.vitals, last = a => a[a.length - 1];
    const vit = [
      ["heart-pulse", "Давление", `${last(v.sys)}/${last(v.dia)}`, "мм рт. ст.", v.sys.slice(-14), last(v.sys) > 135 ? "amber" : ""],
      ["activity", "Пульс", last(v.pulse), "уд/мин", v.pulse.slice(-14), ""],
      ["weight", "Вес", fmt.num(last(v.weight), 1), "кг", v.weight.slice(-30), ""],
      ["footprints", "Шаги", fmt.int(last(v.steps)), "вчера", v.steps.slice(-14), ""],
    ];
    const checks = P.checks.map((c, i) => `<li style="--k:${i}" class="chk ${c.state}">${icon(c.icon, "s16")}<div class="grow"><b>${esc(c.title)}</b><span>${esc(c.why)}</span></div>${c.state === "due" ? `<button class="btn sm" data-act="p-book" data-sk="${c.icon === "ribbon" ? "mamm" : c.icon === "bone" ? "endo" : "ther"}">Записаться</button>` : `<span class="tag ${c.state === "done" ? "" : "teal"}">${esc(c.due)}</span>`}</li>`).join("");
    const rem = P.reminders.filter(r => r.group === "Каждый день").map(r => `<li>${icon(r.icon, "s16")}<div class="grow"><b>${esc(r.title)}</b><span>${esc(r.when)}</span></div><button class="switch" role="switch" aria-checked="${Store.reminderOn(r.id, r.on)}" data-act="p-rem" data-id="${r.id}" aria-label="${esc(r.title)}"></button></li>`).join("");
    return {
      title: "Главная", sub: fmt.today(),
      html: `
      ${n ? `<div class="p-banner plate lit" data-reveal>${icon(n.icon, "s20")}<div class="grow"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div><button class="btn sm" data-act="p-seen">Понятно</button></div>` : ""}
      <section class="ph-hero" data-reveal>
        <h1>${UI.greet()}, ${esc(P.first)}</h1>
        <p>${bk ? `Следующий шаг назначен: консультация пульмонолога, ${fmt.wdLong(bk.off)} в ${bk.t}.` : "В вашем плане светится один шаг: консультация пульмонолога. Записаться можно прямо здесь, это займёт минуту."}</p>
      </section>
      <section class="plate next ${bk ? "off" : "lit"}" id="nextPlate">
        <div class="next-film">${UI.film(p, "md", "live reveal")}</div>
        <div class="next-body">
          <h2>Консультация пульмонолога</h2>
          <p class="next-when muted">${bk ? "Вы записаны" : "Рекомендуем в ближайшие 2 недели"} · по ОМС, бесплатно</p>
          <p class="plain">${esc(plain.what())} ${esc(plain.why)}</p>
          <p class="verified">${UI.lf("confirmed")}<span>План проверил врач: ${esc(Store.doc("d2").short)}, терапевт. Находку на снимке подтвердил рентгенолог.</span></p>
          <div id="nextAct">${bk ? bookedBlock(p) : quickSlots()}</div>
        </div>
        ${bk ? UI.stamp("Записана", `${fmt.d(bk.off)} · ${bk.t}`) : ""}
      </section>
      <div class="ph-grid">
        <section class="plate pad" data-reveal><h3>${icon("calendar", "s16")}Ближайшие визиты<button class="btn sm ghost push" data-act="nav" data-view="visits">Все ${icon("arrow-right", "s14")}</button></h3><ul class="visits">${upcoming().slice(0, 3).map(visitRow).join("")}</ul></section>
        <section class="plate pad" data-reveal><h3>${icon("activity", "s16")}Показатели<button class="btn sm ghost push" data-act="nav" data-view="health">Подробно ${icon("arrow-right", "s14")}</button></h3>
          <div class="vit">${vit.map(x => `<button class="vit-c" data-act="nav" data-view="health"><span class="vit-k">${icon(x[0], "s14")}${x[1]}</span><b class="${x[5]}">${x[2]}</b><span class="muted">${x[3]}</span>${Charts.spark(x[4], { cls: x[5] })}</button>`).join("")}</div>
          <p class="muted small">${last(v.sys) > 135 ? "Давление чуть выше целевого (до 135/85). Обсудите с терапевтом на приёме." : "Показатели в пределах ваших целей."}</p></section>
        <section class="plate pad" data-reveal><h3>${icon("list-checks", "s16")}Что стоит проверить</h3><ul class="checks">${checks}</ul></section>
        <section class="plate pad photo-plate clips" data-reveal><div class="film photo"><img src="${D.scenes.xrayTalk}" alt="" loading="lazy" onerror="this.closest('.photo-plate').classList.add('noimg')"></div>
          <div class="pp-body"><b>Что спросить у пульмонолога</b><ul class="ask"><li>Нужна ли контрольная КТ и когда</li><li>Нужно ли что-то менять в образе жизни</li><li>Какие симптомы — повод прийти раньше</li></ul><button class="btn sm" data-act="nav" data-view="plan">Мой план ${icon("arrow-right", "s14")}</button></div></section>
        <section class="plate pad" data-reveal><h3>${icon("bell-ring", "s16")}Напоминания на сегодня</h3><ul class="rems">${rem}</ul></section>
      </div>`,
      after(view) { if (!p.booking) connectHome(view); U.counters(view); },
    };
  }

  function connectHome(root) {
    const from = $(".next-film [data-anchor='finding']", root), to = $("[data-anchor='slot0']", root);
    if (from && to) Leaders.connect("plead", from, to, { label: "ближайшее время", bend: .35 });
  }

  U.on("p-quick", el => {
    const s = Store.slot(el.dataset.slot), d = Store.doc(s.doc);
    U.popover(el, `<h4>Записаться к пульмонологу?</h4><p><b>${esc(d.name)}</b><br>${fmt.wdLong(s.off)}, ${s.t} · кабинет ${d.room}</p><p class="muted">По ОМС, бесплатно. Напомним за день и за 2 часа.</p><div class="acts"><button class="btn sm ghost" data-act="pop-close">Не сейчас</button><button class="btn sm primary" data-act="p-quick-ok" data-slot="${s.id}" data-autofocus>${icon("calendar-check", "s14")}<span>Записаться</span></button></div>`);
  });
  U.on("p-quick-ok", el => { U.closePop(true); patientBook(el.dataset.slot); });

  function patientBook(slotId) {
    const res = Store.book(PID, slotId, "patient"); if (!res) { U.toast("Это время уже заняли", "Выберите другое", { icon: "circle-alert" }); return null; }
    if (Leaders.has("plead")) Leaders.setState("plead", "booked", `записана · ${res.slot.t}`);
    const plate = $("#nextPlate");
    if (plate) {
      plate.classList.remove("lit"); plate.classList.add("off");
      plate.insertAdjacentHTML("beforeend", UI.stamp("Записана", `${fmt.d(res.slot.off)} · ${res.slot.t}`, "land"));
      const box = $("#nextAct"); box.innerHTML = bookedBlock(me()); box.classList.add("swap");
      $(".next-when", plate).textContent = "Вы записаны · по ОМС, бесплатно";
      $(".ph-hero p").textContent = `Следующий шаг назначен: консультация пульмонолога, ${fmt.wdLong(res.slot.off)} в ${res.slot.t}.`;
    }
    App.refreshChrome();
    U.toast("Вы записаны", `${res.doc.short}, ${res.when}, кабинет ${res.doc.room}. Координатор клиники видит запись.`, { icon: "calendar-check", life: 6000 });
    setTimeout(() => Leaders.remove("plead"), 2600);
    return res;
  }

  U.on("p-seen", el => { Store.readAll("patient"); const b = el.closest(".p-banner"); b.style.transition = "opacity .3s, transform .3s"; b.style.opacity = "0"; b.style.transform = "translateY(-6px)"; setTimeout(() => { b.remove(); Leaders.redraw(); }, 300); App.refreshChrome(); });
  U.on("p-rem", el => { const on = el.getAttribute("aria-checked") !== "true"; el.setAttribute("aria-checked", on); Store.reminder(el.dataset.id, on); U.toast(on ? "Напоминание включено" : "Напоминание выключено", el.getAttribute("aria-label"), { icon: on ? "bell-ring" : "bell", life: 2600 }); });
  U.on("p-cal", () => U.toast("Добавлено в календарь", "Файл события .ics для телефона и почты", { icon: "calendar-plus" }));
  U.on("p-way", () => U.toast("Как пройти", `${D.clinic.address}: вход с торца, лифт на 2 этаж, кабинет 214 налево`, { icon: "map-pin", life: 6000 }));

  /* ── Мой план ── */
  const pv = { mode: "plain" };
  function plan() {
    const p = me(), bk = p.booking, d1 = bk && Store.doc(bk.doc);
    const steps = [
      { st: "done", icon: "scan-line", title: "КТ органов грудной клетки", when: fmt.long(-p.study.ago), text: "Выполнено. Снимок проверил ИИ-сервис, находку подтвердил врач-рентгенолог.", act: `<button class="btn sm" data-act="nav" data-view="results">Результат ${icon("arrow-right", "s14")}</button>` },
      { st: bk ? "booked" : "next", icon: "stethoscope", title: "Консультация пульмонолога", when: bk ? `${fmt.wdLong(bk.off)}, ${bk.t}` : "в ближайшие 2 недели", text: bk ? `${d1.name}, кабинет ${d1.room}.` : "Врач посмотрит снимок и решит, что делать дальше.", act: bk ? "" : `<button class="btn sm primary" data-act="p-book" data-sk="pulm">${icon("calendar-plus", "s14")}<span>Записаться</span></button>`,
        more: [["Зачем", "Оценить очаг и решить, нужен ли контроль."], ["Как подготовиться", "Возьмите паспорт и полис ОМС. Диск со снимками не нужен: врач откроет КТ в системе клиники."], ["Сколько длится", "Около 30 минут."], ["Оплата", "Бесплатно по ОМС."]] },
      { st: "future", icon: "scan-line", title: "Контрольная КТ", when: "через 3 месяца, если назначит пульмонолог", text: "Покажет, меняется ли очаг. Напомним заранее.", act: `<button class="btn sm ghost" data-act="p-remind-ct">${icon("bell", "s14")}<span>Напомнить</span></button>` },
      { st: "future", icon: "droplet", title: "Липидограмма", when: `${fmt.wdLong(P.upcoming[0].off)}, ${P.upcoming[0].t}`, text: "Назначил терапевт: холестерин выше нормы. Натощак.", act: "" },
    ];
    const LINE = { done: "confirmed", booked: "booked", next: "proposed", future: "proposed" };
    return {
      title: "Мой план", sub: "Маршрут после КТ: что сделано и что дальше",
      html: `
      <div class="plan">
        <ol class="route">${steps.map((s, i) => `<li class="rt ${s.st}" style="--k:${i}">
          <div class="rt-rail"><span class="rt-dot">${s.st === "done" ? icon("check", "s14") : icon(s.icon, "s14")}</span>${i < steps.length - 1 ? `<svg class="rt-seg lf ${LINE[steps[i + 1].st]}" viewBox="0 0 8 100" preserveAspectRatio="none" aria-hidden="true"><line x1="4" y1="0" x2="4" y2="100"/></svg>` : ""}</div>
          <article class="plate rt-plate ${s.st === "next" ? "lit" : s.st === "done" ? "off" : ""} ${s.st === "future" ? "ghost" : ""}">
            <div class="rt-top"><div class="grow"><b>${esc(s.title)}</b><span class="muted">${esc(s.when)}</span></div>${s.act}</div>
            <p>${esc(s.text)}</p>
            ${s.more ? `<button class="more-btn" data-act="p-more" aria-expanded="false">Подробнее ${icon("chevron-down", "s14")}</button><div class="more"><div><dl>${s.more.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></div></div>` : ""}
            ${s.st === "booked" ? UI.stamp("Записана", `${fmt.d(bk.off)} · ${bk.t}`) : ""}
          </article></li>`).join("")}</ol>

        <aside class="plan-side">
          <section class="plate pad explain" data-reveal>
            <h3>${icon("book-open", "s16")}Что написано в заключении</h3>
            <div class="seg sm" id="explSeg"><button class="${pv.mode === "plain" ? "on" : ""}" data-act="p-expl" data-m="plain">Простыми словами</button><button class="${pv.mode === "med" ? "on" : ""}" data-act="p-expl" data-m="med">Как в заключении</button></div>
            <div id="explBox">${explHTML()}</div>
            <p class="disclaimer">${icon("info", "s14")}Это пояснение, а не диагноз. Выводы о лечении делает врач на приёме.</p>
          </section>
          <section class="plate pad photo-plate clips" data-reveal><div class="film photo"><img src="${D.scenes.video}" alt="" loading="lazy" onerror="this.closest('.photo-plate').classList.add('noimg')"></div>
            <div class="pp-body"><b>Можно начать с онлайн-консультации</b><p class="muted">Терапевт ответит на вопросы о результате по видеосвязи, без поездки в клинику.</p><button class="btn sm" data-act="p-book" data-sk="ther">Выбрать время</button></div></section>
        </aside>
      </div>`,
    };
  }
  function explHTML() {
    const p = me();
    if (pv.mode === "med") return `<blockquote class="medq"><p><b>Описание.</b> ${esc(p.ai.fields[1][1])}</p><p><b>Заключение.</b> ${esc(p.ai.conclusion)}</p><footer>${esc(p.ai.service)} ${p.ai.version} · проверено врачом-рентгенологом</footer></blockquote>`;
    return `<div class="plainx"><p><b>Что нашли.</b> ${esc(plain.what())}</p><p><b>Насколько это опасно.</b> ${esc(plain.why)}</p><p><b>Что дальше.</b> ${esc(plain.next)}</p>
      <ul class="gloss"><li><abbr data-tip="Небольшой участок уплотнения в лёгком, обычно до 3 см">очаг</abbr></li><li><abbr data-tip="Один из 10 сегментов правого лёгкого, в нижней доле со стороны спины">S6</abbr></li><li><abbr data-tip="Плотный, однородный очаг, без участков «матового стекла»">солидный</abbr></li><li><abbr data-tip="Международные правила наблюдения очагов в лёгких">Fleischner</abbr></li></ul></div>`;
  }
  U.on("p-expl", el => { pv.mode = el.dataset.m; $$("#explSeg button").forEach(b => b.classList.toggle("on", b === el)); U.glide($("#explSeg")); const box = $("#explBox"); box.innerHTML = explHTML(); box.classList.remove("swap"); box.getBoundingClientRect(); box.classList.add("swap"); });
  U.on("p-more", el => { const open = el.getAttribute("aria-expanded") !== "true"; el.setAttribute("aria-expanded", open); el.nextElementSibling.classList.toggle("open", open); });
  U.on("p-remind-ct", el => { el.disabled = true; el.innerHTML = `${icon("check", "s14")}<span>Напомним</span>`; U.toast("Напомним о контрольной КТ", "За 2 недели до срока, если её назначит пульмонолог", { icon: "bell-ring" }); });

  /* ── Визиты ── */
  const vv = { tab: "up" };
  function visits() {
    const up = upcoming();
    const past = P.past.map(x => ({ off: x.off, title: x.title, sub: x.doc ? Store.doc(x.doc).short : x.place, note: x.note, doc: x.doc && Store.doc(x.doc) }));
    return {
      title: "Визиты", sub: `${up.length} ${plural(up.length, ["предстоящий", "предстоящих", "предстоящих"])} · история за год`,
      html: `
      <div class="toolbar" data-reveal><div class="seg" id="visSeg"><button class="${vv.tab === "up" ? "on" : ""}" data-act="p-vtab" data-t="up">Предстоящие<span class="n">${up.length}</span></button><button class="${vv.tab === "past" ? "on" : ""}" data-act="p-vtab" data-t="past">Прошедшие<span class="n">${past.length}</span></button></div>
        <button class="btn primary" data-act="p-book" data-sk="${me().booking ? "ther" : "pulm"}">${icon("calendar-plus", "s16")}<span>Записаться</span></button></div>
      <div class="vis-grid">
        <section class="plate pad" id="visBox">${vv.tab === "up" ? `<ul class="visits big">${up.map(visitRow).join("")}</ul>` : `<ul class="visits big past">${past.map(visitRow).join("")}</ul>`}</section>
        <section class="plate pad photo-plate clips" data-reveal><div class="film photo"><img src="${D.scenes.video}" alt="" loading="lazy" onerror="this.closest('.photo-plate').classList.add('noimg')"></div>
          <div class="pp-body"><b>Онлайн-консультация</b><p class="muted">Терапевт по видеосвязи: обсудить результаты анализов и давление без поездки.</p><button class="btn sm" data-act="p-book" data-sk="ther">Выбрать время</button></div></section>
      </div>`,
    };
  }
  U.on("p-vtab", el => { vv.tab = el.dataset.t; App.rerender(true); });

  /* ── Запись: пошагово в правой панели ── */
  const bk = { step: 1, sk: "pulm", doc: null, slot: null, day: 0 };
  U.on("p-book", el => { Object.assign(bk, { step: el.dataset.sk ? 2 : 1, sk: el.dataset.sk || "pulm", doc: null, slot: null, day: 0 }); openBooking(); });
  function openBooking() { App.panel.open(bookHTML(), { title: "Запись на приём", onClose: () => {} }); }
  function stepper() {
    const names = ["Что нужно", "Врач", "Время", "Проверка"];
    return `<ol class="stepper">${names.map((n, i) => `<li class="${i + 1 < bk.step ? "done" : i + 1 === bk.step ? "now" : ""}"><span>${i + 1 < bk.step ? icon("check", "s14") : i + 1}</span>${n}</li>`).join("")}</ol>`;
  }
  function bookHTML() {
    const rec = !me().booking;
    let body = "";
    if (bk.step === 1) {
      body = `<h3>Что нужно?</h3>${rec ? `<button class="pick-row lit plate" data-act="bk-sk" data-sk="pulm">${icon("sparkles", "s16")}<span class="grow"><b>Пульмонолог</b><small>Навигатор рекомендует по КТ от ${studyDate()}</small></span>${icon("arrow-right", "s16")}</button>` : ""}
        <div class="pick">${Object.entries(D.specs).filter(([k]) => !(rec && k === "pulm")).map(([k, l]) => `<button class="pick-row" data-act="bk-sk" data-sk="${k}"><span class="grow"><b>${esc(l)}</b></span>${icon("arrow-right", "s16")}</button>`).join("")}</div>`;
    } else if (bk.step === 2) {
      const docs = D.doctors.filter(d => d.sk === bk.sk && d.shift);
      body = `<h3>${esc(D.specs[bk.sk])}: выберите врача</h3><div class="docs">${docs.map(d => { const s = Store.freeSlots(bk.sk).find(x => x.doc === d.id); return `<button class="doc plate" data-act="bk-doc" data-doc="${d.id}">${U.avatar(d, "xl")}<span class="grow"><b>${esc(d.name)}</b><small>${esc(d.spec)} · стаж ${d.exp} ${plural(d.exp, ["год", "года", "лет"])} · ★ ${fmt.num(d.rating, 1)}</small><em>${s ? `Ближайшее: ${fmt.wdd(s.off)}, ${s.t}` : "Нет свободного времени"}</em></span>${icon("arrow-right", "s16")}</button>`; }).join("")}</div>`;
    } else if (bk.step === 3) {
      const d = Store.doc(bk.doc);
      const daySlots = i => D.slots.filter(s => s.doc === d.id && s.dayIndex === i && Store.slotFree(s));
      if (!daySlots(bk.day).length) { const f = D.slotDays.findIndex((_, i) => daySlots(i).length); if (f >= 0) bk.day = f; }
      body = `<h3>${esc(d.short)}: выберите время</h3>
        <div class="seg sm days" id="bkDays">${D.slotDays.map((off, i) => `<button class="${i === bk.day ? "on" : ""}" data-act="bk-day" data-day="${i}" ${daySlots(i).length ? "" : "disabled"}>${fmt.wdd(off)}</button>`).join("")}</div>
        <div class="tgrid swap">${daySlots(bk.day).map(s => `<button class="slot free ${bk.slot === s.id ? "sel" : ""}" data-act="bk-slot" data-slot="${s.id}"><span>${s.t}</span></button>`).join("") || `<p class="muted">В этот день мест нет.</p>`}</div>`;
    } else if (bk.step === 4) {
      const s = Store.slot(bk.slot), d = Store.doc(s.doc);
      body = `<h3>Проверьте запись</h3><div class="sum plate pad">${U.avatar(d, "xl")}<div><b>${esc(d.name)}</b><span>${esc(d.spec)} · кабинет ${d.room}</span><span class="big">${fmt.wdLong(s.off)}, ${s.t}</span><span class="muted">${esc(D.clinic.address)} · по ОМС</span></div></div>
        <ul class="rems"><li>${icon("bell-ring", "s16")}<div class="grow"><b>Напомнить за день</b><span>push и SMS</span></div><button class="switch" role="switch" aria-checked="true" data-act="bk-sw" aria-label="Напомнить за день"></button></li><li>${icon("clock", "s16")}<div class="grow"><b>Напомнить за 2 часа</b><span>push</span></div><button class="switch" role="switch" aria-checked="true" data-act="bk-sw" aria-label="Напомнить за 2 часа"></button></li></ul>
        <button class="btn primary lg wide" data-act="bk-ok">${icon("calendar-check", "s16")}<span>Записаться</span></button>`;
    } else {
      const b = me().booking || {}, s = Store.slot(bk.slot), d = Store.doc(s.doc);
      void b;
      body = `<div class="done-box"><span class="done-ico">${icon("calendar-check", "s20")}</span><h3>Вы записаны</h3><p>${esc(d.short)}, ${fmt.wdLong(s.off)} в ${s.t}, кабинет ${d.room}.</p><p class="muted">Запись появилась в плане и у координатора клиники.</p>
        <div class="row wrap center"><button class="btn sm" data-act="p-cal">${icon("calendar-plus", "s14")}<span>В календарь</span></button><button class="btn sm primary" data-act="bk-done">Готово</button></div></div>`;
    }
    return `${bk.step <= 4 ? stepper() : ""}<div class="bk-body swap">${body}</div>${bk.step > 1 && bk.step <= 4 ? `<button class="btn sm ghost back" data-act="bk-back">${icon("arrow-left", "s14")}<span>Назад</span></button>` : ""}`;
  }
  const rebook = () => App.panel.update(bookHTML());
  U.on("bk-sk", el => { bk.sk = el.dataset.sk; bk.step = 2; rebook(); });
  U.on("bk-doc", el => { bk.doc = el.dataset.doc; bk.step = 3; bk.day = 0; rebook(); });
  U.on("bk-day", el => { bk.day = +el.dataset.day; rebook(); });
  U.on("bk-slot", el => { bk.slot = el.dataset.slot; bk.step = 4; rebook(); });
  U.on("bk-back", () => { bk.step = Math.max(1, bk.step - 1); rebook(); });
  U.on("bk-sw", el => el.setAttribute("aria-checked", el.getAttribute("aria-checked") !== "true"));
  U.on("bk-ok", el => {
    el.classList.add("busy");
    setTimeout(() => {
      const s = Store.slot(bk.slot), d = Store.doc(s.doc);
      if (d.sk === "pulm" && !me().booking) { if (!patientBookSilent(bk.slot)) return; }
      else if (!Store.addVisit(PID, bk.slot)) { el.classList.remove("busy"); U.toast("Это время уже заняли", "Выберите другое", { icon: "circle-alert" }); bk.step = 3; rebook(); return; }
      bk.step = 5; rebook();
      U.toast("Вы записаны", `${d.short}, ${fmt.wdd(s.off)}, ${s.t}`, { icon: "calendar-check" });
      App.refreshChrome();
    }, U.reduced() ? 0 : 650);
  });
  U.on("bk-done", () => { App.panel.close(); App.rerender(true); });
  function patientBookSilent(slotId) { return Store.book(PID, slotId, "patient"); }

  /* ── Результаты ── */
  const rv = { tab: "all", mode: "plain" };
  function results() {
    const p = me();
    const labs = P.labs.map((l, i) => `<section class="plate pad lab" style="--k:${i}" data-reveal><h3>${icon("droplet", "s16")}${esc(l.title)}<span class="muted push">${fmt.long(l.off)}</span></h3>
      <table class="labt"><thead><tr><th>Показатель</th><th>Результат</th><th class="hide-sm">Где относительно нормы</th><th>Норма</th></tr></thead><tbody>
      ${l.rows.map(([n, v, u, lo, hi]) => { const st = v > hi ? "hi" : v < lo ? "lo" : "ok"; return `<tr class="${st}"><td>${esc(n)}</td><td><b>${String(v).replace(".", ",")}</b> <span class="muted">${u}</span>${st !== "ok" ? `<span class="flag">${st === "hi" ? "выше нормы" : "ниже нормы"}</span>` : ""}</td><td class="hide-sm">${Charts.range(v, lo, hi)}</td><td class="muted mono">${lo ? String(lo).replace(".", ",") + "–" : "до "}${String(hi).replace(".", ",")}</td></tr>`; }).join("")}
      </tbody></table>${l.note ? `<p class="lab-note">${icon("sparkles", "s14")}${esc(l.note)}</p>` : ""}</section>`).join("");
    const chol = P.cholesterol;
    const study = `<section class="plate pad res-study" data-reveal><h3>${icon("scan-line", "s16")}${esc(p.study.title)}<span class="muted push">${fmt.long(-p.study.ago)}</span></h3>
      <div class="rs-grid">${UI.film(p, "lg", "live reveal")}<div>
        <div class="seg sm" id="resSeg"><button class="${rv.mode === "plain" ? "on" : ""}" data-act="r-mode" data-m="plain">Простыми словами</button><button class="${rv.mode === "med" ? "on" : ""}" data-act="r-mode" data-m="med">Заключение</button></div>
        <div id="resBox">${resText(p)}</div>
        <div class="row wrap"><button class="btn sm" data-act="r-pdf">${icon("file-down", "s14")}<span>Скачать PDF</span></button><button class="btn sm ghost" data-act="nav" data-view="plan">Что дальше ${icon("arrow-right", "s14")}</button></div>
      </div></div></section>`;
    const trend = `<section class="plate pad" data-reveal><h3>${icon("trending-up", "s16")}Холестерин за полтора года</h3>${Charts.line({ series: [{ values: chol.map(c => c[1]), endLabel: fmt.num(chol[chol.length - 1][1], 1) }], labels: chol.map(c => { const x = D.at(c[0]); return `${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getFullYear()).slice(2)}`; }), min: 4, max: 7, ticks: 3, band: [3, 5.2], fmtY: v => fmt.num(v, 1), w: 520, h: 180, aria: "Холестерин" })}<p class="muted small">Полоса — норма до 5,2 ммоль/л. Растёт третий замер подряд: терапевт назначил повторную липидограмму.</p></section>`;
    const show = { all: study + trend + labs, lab: trend + labs, img: study };
    return {
      title: "Результаты", sub: "Анализы и обследования · проверены врачами",
      html: `<div class="toolbar" data-reveal><div class="seg" id="rSeg">${[["all", "Все"], ["img", "Обследования"], ["lab", "Анализы"]].map(([k, l]) => `<button class="${rv.tab === k ? "on" : ""}" data-act="r-tab" data-t="${k}">${l}</button>`).join("")}</div></div><div class="res-list">${show[rv.tab]}</div>`,
      after(view) { Charts.play(view); },
    };
  }
  function resText(p) { return rv.mode === "plain" ? `<div class="plainx"><p>${esc(plain.what())}</p><p>${esc(plain.next)}</p></div><p class="verified">${UI.lf("confirmed")}<span>Проверено врачом-рентгенологом: ${esc(Store.doc("d9").short)}</span></p>` : UI.sr(p); }
  U.on("r-tab", el => { rv.tab = el.dataset.t; App.rerender(true); });
  U.on("r-mode", el => { rv.mode = el.dataset.m; $$("#resSeg button").forEach(b => b.classList.toggle("on", b === el)); U.glide($("#resSeg")); const box = $("#resBox"); box.innerHTML = resText(me()); box.classList.remove("swap"); box.getBoundingClientRect(); box.classList.add("swap"); });
  U.on("r-pdf", () => U.toast("PDF готовится", "Заключение с подписью врача придёт на почту", { icon: "file-down" }));

  /* ── Показатели здоровья ── */
  const hv = { n: 30 };
  function health() {
    const v = P.vitals, n = hv.n;
    const lab = Array.from({ length: n }, (_, i) => fmt.d(i - n + 1));
    const cut = a => a.slice(-n);
    const card = (ttl, ic, series, o) => `<section class="plate pad hcard" data-reveal><h3>${icon(ic, "s16")}${ttl}<span class="hval push">${o.value}</span></h3>${Charts.line(Object.assign({ series, labels: lab, maxLabels: 6, aria: ttl, h: 190 }, o.chart))}${o.note ? `<p class="muted small">${o.note}</p>` : ""}</section>`;
    const c = P.card;
    return {
      title: "Показатели здоровья", sub: "Тонометр и фитнес-браслет · синхронизировано 2 часа назад",
      html: `<div class="toolbar" data-reveal><div class="seg" id="hSeg">${[[7, "7 дней"], [30, "30 дней"], [90, "90 дней"]].map(([k, l]) => `<button class="${hv.n === k ? "on" : ""}" data-act="h-n" data-n="${k}">${l}</button>`).join("")}</div><span class="demo-mark"><i></i>демо-данные</span></div>
      <div class="h-grid">
        ${card("Давление", "heart-pulse", [{ values: cut(v.sys), endLabel: "верхнее" }, { values: cut(v.dia), cls: "b2", endLabel: "нижнее" }], { value: `${v.sys[v.sys.length - 1]}/${v.dia[v.dia.length - 1]}`, chart: { min: 60, max: 160, ticks: 4, band: [60, 135] }, note: "Полоса — ваша цель до 135/85. Верхнее давление иногда выходит за неё по вечерам." })}
        ${card("Пульс", "activity", [{ values: cut(v.pulse), area: true }], { value: `${v.pulse[v.pulse.length - 1]} уд/мин`, chart: { min: 50, max: 100, ticks: 5, band: [60, 90] } })}
        ${card("Вес", "weight", [{ values: cut(v.weight), area: true }], { value: `${fmt.num(v.weight[v.weight.length - 1], 1)} кг`, chart: { min: 69, max: 74, ticks: 5, fmtY: x => fmt.num(x, 1) } })}
        ${card("Сон", "moon-star", [{ values: cut(v.sleep), area: true }], { value: `${fmt.num(v.sleep[v.sleep.length - 1], 1)} ч`, chart: { min: 4, max: 9, ticks: 5, band: [7, 9], fmtY: x => fmt.num(x, 0) } })}
        ${card("Шаги", "footprints", [{ values: cut(v.steps), area: true }], { value: fmt.int(v.steps[v.steps.length - 1]), chart: { min: 0, max: 12000, ticks: 4, fmtY: x => Math.round(x / 1000) + " тыс" } })}
        <section class="plate pad mcard" data-reveal><h3>${icon("clipboard-list", "s16")}Медкарта</h3>
          <dl class="mc"><div><dt>Группа крови</dt><dd>${esc(c.blood)}</dd></div><div><dt>Аллергия</dt><dd class="warn">${icon("triangle-alert", "s14")}${esc(c.allergy)}</dd></div><div><dt>Хронические</dt><dd>${c.chronic.map(esc).join(", ")}</dd></div><div><dt>Лекарства</dt><dd>${c.meds.map(esc).join("<br>")}</dd></div><div><dt>Прививки</dt><dd>${c.vaccines.map(esc).join("<br>")}</dd></div></dl></section>
      </div>`,
      after(view) { Charts.play(view); },
    };
  }
  U.on("h-n", el => { hv.n = +el.dataset.n; App.rerender(true); });

  /* ── Напоминания ── */
  function reminders() {
    const groups = ["Каждый день", "На неделе", "Позже"];
    const extra = Store.state.myRem || [];
    const all = P.reminders.concat(extra);
    return {
      title: "Напоминания", sub: "О приёмах, анализах и лекарствах",
      html: `<div class="rem-grid">
        <div class="stack">${groups.map(g => { const list = all.filter(r => r.group === g); return list.length ? `<section class="plate pad" data-reveal><h3>${esc(g)}</h3><ul class="rems">${list.map(r => `<li class="${r.fresh ? "fresh" : ""}">${icon(r.icon, "s16")}<div class="grow"><b>${esc(r.title)}</b><span>${esc(r.when || `${fmt.wdLong(r.whenOff)}, ${r.t}`)}</span></div><button class="switch" role="switch" aria-checked="${Store.reminderOn(r.id, r.on)}" data-act="p-rem" data-id="${r.id}" aria-label="${esc(r.title)}"></button></li>`).join("")}</ul></section>` : ""; }).join("")}</div>
        <aside class="stack">
          <section class="plate pad" data-reveal><h3>${icon("plus", "s16")}Новое напоминание</h3>
            <form class="rem-add"><label class="field">${icon("pen-line")}<input name="t" placeholder="Например: измерить сахар" required></label><label class="field">${icon("clock")}<input name="w" placeholder="Когда: ежедневно в 9:00"></label><button class="btn primary" type="submit">${icon("plus", "s16")}<span>Добавить</span></button></form></section>
          <section class="plate pad" data-reveal><h3>${icon("send", "s16")}Куда присылать</h3>
            <ul class="rems">${[["smartphone", "Push в приложении", true], ["message-square", "SMS", true], ["mail", "Почта", false]].map(([ic, l, on], i) => `<li>${icon(ic, "s16")}<div class="grow"><b>${l}</b></div><button class="switch" role="switch" aria-checked="${Store.reminderOn("ch" + i, on)}" data-act="p-rem" data-id="ch${i}" aria-label="${l}"></button></li>`).join("")}</ul></section>
        </aside></div>`,
      after(view) {
        $(".rem-add", view).addEventListener("submit", e => {
          e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return;
          Store.state.myRem = (Store.state.myRem || []).concat({ id: "m" + Date.now(), icon: "bell-ring", title: t, when: e.target.w.value.trim() || "Ежедневно", on: true, group: "Каждый день", fresh: true });
          U.store.set("aegis-demo-v1", Store.state);
          U.toast("Напоминание добавлено", t, { icon: "bell-ring" }); App.rerender(true);
        });
      },
    };
  }

  window.Patient = {
    home: "home",
    nav: () => [
      { view: "home", label: "Главная", icon: "house" },
      { view: "plan", label: "Мой план", icon: "route", count: () => me().booking ? null : 1 },
      { view: "visits", label: "Визиты", icon: "calendar" },
      { view: "results", label: "Результаты", icon: "file-text" },
      { view: "health", label: "Показатели", icon: "heart-pulse" },
      { view: "reminders", label: "Напоминания", icon: "bell-ring" },
    ],
    views: { home, plan, visits, results, health, reminders },
    me: () => ({ name: "Соколова Галина Петровна", short: "Галина Петровна", role: "Пациентка · полис ОМС", photo: me().photo }),
  };
})();
