/* Общие куски интерфейса обоих кабинетов: форма линии, срочность, плёнка снимка, заключение SR, слоты, мысли Навигатора. */
(function () {
  "use strict";
  const { esc, icon, fmt, plural } = U;
  const D = DATA;

  const lf = (state = "proposed") => `<svg class="lf ${state}" viewBox="0 0 26 8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4"/>${state === "declined" ? `<line class="x" x1="9" y1="0.5" x2="17" y2="7.5"/>` : ""}</svg>`;
  const LF_TEXT = { proposed: "предложил Навигатор", confirmed: "подтвердил врач", booked: "записан", declined: "отклонено", overdue: "просрочено", changed: "изменил врач", urgent: "срочно" };

  const PRI = { urgent: "Срочно", high: "Высокий", medium: "Плановый", routine: "Без срочности" };
  const pri = p => `<span class="pri ${p.priority}"><i></i>${PRI[p.priority]}</span>`;
  const age = n => `${n} ${plural(n, ["год", "года", "лет"])}`;

  // состояние линии для шага маршрута
  function stepState(p, i) {
    if (i === 0 && p.booking) return "booked";
    if (p.status === "visited" && i === 0) return "booked";
    const d = p.decision;
    if (d && d.state === "declined") return "declined";
    if (d && d.state === "changed") return "changed";
    if (d && d.state === "confirmed") return "confirmed";
    return "proposed";
  }
  const stepLine = (p, i) => { const s = stepState(p, i); return lf(s === "changed" ? "declined" : s); };

  function stepText(st) {
    if (st.sk) return `${D.specs[st.sk]} · в течение ${U.days(st.within)}`;
    return `${st.title} · ${st.when || ("в течение " + U.days(st.within))}`;
  }

  // плёнка снимка с угловыми надписями как в DICOM-просмотрщике
  function film(p, size = "lg", extra = "") {
    const s = p.study, ai = p.ai;
    const win = s.mod === "КТ" ? "W 1500 · L −600" : s.mod === "ММГ" ? "MLO · ACR " + (ai.kafka.mmg_acr_left || "B") : s.slices;
    const corners = size === "sm"
      ? `<span class="corner tl">${s.mod} · ${fmt.d(-s.ago)}</span><span class="corner tr">p ${fmt.num(ai.prob)}</span>`
      : `<span class="corner tl">${esc(p.short)} · ${p.sex} · ${p.age}<br>ID ${s.uid.slice(-11)}</span>
         <span class="corner tr">${s.mod} ${esc(s.area)} · ${fmt.d(-s.ago)}<br>${esc(s.slices)}</span>
         <span class="corner bl">${win}</span>
         <span class="corner br">${esc(ai.service)} ${ai.version}<br>p = ${fmt.num(ai.prob)} ${ai.prob >= .5 ? "≥" : "<"} 0,50</span>
         <span class="scalebar"><i style="width:${s.mod === "КТ" ? 34 : 26}px"></i>10 мм</span>`;
    return `<div class="film ${size} ${extra}">${Art.study(p)}${corners}</div>`;
  }

  // шкала вероятности 0–1 с порогом: измерение, а не украшение
  function probMeter(prob, thr = .5) {
    let ticks = "";
    for (let i = 0; i <= 20; i++) ticks += `<i style="left:${i * 5}%" class="${i % 10 === 0 ? "maj" : i % 2 === 0 ? "mid" : ""}"></i>`;
    return `<div class="pm" role="img" aria-label="Вероятность ${fmt.num(prob)} при пороге ${fmt.num(thr)}">
      <div class="pm-scale">${ticks}<b class="thr" style="left:${thr * 100}%"><span>порог ${fmt.num(thr)}</span></b><b class="val ${prob >= thr ? "over" : ""}" style="--x:${prob * 100}%"><span>${fmt.num(prob)}</span></b></div>
      <div class="pm-ax"><span>0,00</span><span>0,50</span><span>1,00</span></div></div>`;
  }

  // заключение ИИ в структуре DICOM SR по БФТ
  function sr(p, opts = {}) {
    const s = p.study, ai = p.ai;
    const rows = ai.fields.map(([k, v]) => `<div class="sr-row"><dt>${esc(k)}</dt><dd class="${/не выявлено/.test(v) ? "muted" : ""}">${esc(v)}</dd></div>`).join("");
    const conf = p.comments.find(c => c[0] === "d9");
    return `<div class="sr">
      <div class="sr-meta">
        <div><span>Модальность</span><b>${s.mod === "КТ" ? "CT" : s.mod === "ММГ" ? "MG" : "DX"} · ${esc(s.title)}</b></div>
        <div><span>Область</span><b>${esc(s.area)}</b></div>
        <div><span>Сервис</span><b>${esc(ai.service)} ${ai.version}</b></div>
        <div><span>Сформировано</span><b>${fmt.d(-s.ago)}, 10:42</b></div>
        <div><span>Технические данные</span><b>${esc(s.slices)}</b></div>
        <div><span>Назначение</span><b>${esc(ai.purpose)}</b></div>
      </div>
      ${probMeter(ai.prob)}
      <h4>Описание</h4><dl class="sr-desc">${rows}</dl>
      <h4>Заключение</h4><p class="sr-concl">${esc(ai.conclusion)}</p>
      <ul class="sr-warn">${D.WARN.map(w => `<li>${icon("info", "s14")}${esc(w)}</li>`).join("")}</ul>
      ${conf && !opts.noConfirm ? `<p class="sr-human">${lf("confirmed")}<span>Находку подтвердил рентгенолог: ${esc(Store.doc("d9").short)}, ${fmt.rel(-conf[1])}</span></p>` : ""}
    </div>`;
  }

  function kafka(p) {
    const s = p.study, ai = p.ai;
    const msg = Object.assign({
      studyIUID: s.uid, aiResult: { seriesIUID: s.uid + ".9001" }, pathologyFlag: ai.prob >= .5, confidenceLevel: Math.round(ai.prob * 100),
      modelId: ai.modelId, modelVersion: ai.version, norma: ai.prob >= .5 ? 0 : 1,
    }, ai.kafka, { report: "…", conclusion: ai.conclusion.slice(0, 64) + "…", dateTimeParams: { processStartDT: `${isoDay(-s.ago)}T10:41:12+03:00`, processEndDT: `${isoDay(-s.ago)}T10:42:03+03:00` } });
    const json = JSON.stringify(msg, null, 2)
      .replace(/(&|<|>)/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
      .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
      .replace(/: (true|false|\d+(\.\d+)?)/g, ': <span class="n">$1</span>');
    return `<pre class="json">${json}</pre>`;
  }
  function isoDay(off) { const x = D.at(off); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; }

  // хронология маршрута: форма линии на каждой станции
  function timeline(p) {
    const items = p.timeline.slice().sort((a, b) => a[0] - b[0]);
    const STATE = { done: "confirmed", ai: "proposed", confirmed: "confirmed", proposed: "proposed", overdue: "overdue", booked: "booked", changed: "declined", declined: "declined" };
    const ICO = { done: "check", ai: "sparkles", confirmed: "badge-check", proposed: "route", overdue: "hourglass", booked: "calendar-check", changed: "pen-line", declined: "ban" };
    const next = p.route[0];
    const tail = !p.booking && p.lit ? `<li class="tl-item next"><span class="tl-dot">${icon("circle-dot", "s14")}</span><div><b>${esc(next.title)}</b><p>Следующий шаг · ещё не записан</p></div><span class="tl-when">дальше</span></li>` : "";
    return `<ol class="tl">${items.map((e, i) => `<li class="tl-item ${e[3]} ${e[4] ? "fresh" : ""}" style="--k:${i}">
        <span class="tl-dot">${icon(ICO[e[3]] || "circle", "s14")}</span>
        <div><b>${esc(e[1])}</b><p>${esc(e[2])}</p></div>
        <span class="tl-when">${e[0] === 0 ? "сегодня" : fmt.d(e[0])}</span>
        <svg class="tl-seg lf ${STATE[e[3]] || "proposed"}" viewBox="0 0 8 26" preserveAspectRatio="none" aria-hidden="true"><line x1="4" y1="0" x2="4" y2="26"/></svg>
      </li>`).join("")}${tail}</ol>`;
  }

  // «Навигатор анализирует»: этапы с галочками, затем результат
  async function think(el, steps, done) {
    el.innerHTML = `<div class="think"><div class="think-head">${icon("sparkles", "s16")}<span class="shine">Навигатор анализирует случай</span></div><ol>${steps.map(s => `<li><b></b>${esc(s)}</li>`).join("")}</ol></div>`;
    const lis = el.querySelectorAll("li");
    for (let i = 0; i < lis.length; i++) {
      lis[i].classList.add("now");
      await U.sleep(U.reduced() ? 0 : 420);
      lis[i].classList.remove("now"); lis[i].classList.add("done");
    }
    await U.sleep(U.reduced() ? 0 : 220);
    done();
  }

  // ёмкость смены врача: плёнка фиксированной длины, запись не может её переполнить
  function capacity(doc, dayIndex, opts = {}) {
    const day = D.slots.filter(s => s.doc === doc.id && s.dayIndex === dayIndex);
    if (!day.length) return `<div class="cap-empty muted">Нет приёма</div>`;
    const free = day.filter(Store.slotFree);
    const best = opts.best || new Map();
    const act = opts.act || "slot";
    const cells = day.map(s => {
      const taken = Store.state.taken[s.id];
      const isFree = Store.slotFree(s);
      const b = best.get(s.id);
      const cls = taken ? "slot taken" : isFree ? (b ? "slot free best" : "slot free") : "slot busy";
      const tip = taken ? `записан: ${(Store.patient(taken) || { short: "пациент" }).short}` : isFree ? (b ? `Навигатор: подходит ${b.short}` : "свободно") : "занято";
      return `<button class="${cls}" ${isFree ? `data-act="${act}"` : "disabled"} data-slot="${s.id}" aria-label="${s.t}, ${esc(tip)}" title="${s.t} · ${esc(tip)}"><span>${s.t}</span></button>`;
    }).join("");
    const hours = day.map((s, i) => s.t.endsWith(":00") ? `<span style="left:${(i / day.length * 100).toFixed(2)}%">${s.t.split(":")[0]}</span>` : "").join("") + `<span style="left:100%">${endTime(day[day.length - 1].t).split(":")[0]}</span>`;
    const chips = opts.chips ? `<div class="free-times">${free.length ? free.map(s => `<button class="tchip ${best.has(s.id) ? "best" : ""}" data-act="${act}" data-slot="${s.id}">${s.t}</button>`).join("") : `<span class="muted small">Свободного времени нет</span>`}</div>` : "";
    const mins = free.length * 30, h = Math.floor(mins / 60), m = mins % 60;
    return `<div class="capwrap"><div class="cap" style="--n:${day.length}">${cells}</div><div class="cap-hours">${hours}</div>${chips}<div class="cap-foot"><span class="cap-left">свободно ${mins ? (h ? h + " ч " : "") + (m ? m + " мин" : "") : "0 мин"} из ${day.length / 2} ч</span></div></div>`;
  }
  const endTime = t => { const [hh, mm] = t.split(":").map(Number); const x = hh * 60 + mm + 30; return `${Math.floor(x / 60)}:${x % 60 ? "30" : "00"}`; };

  function stamp(text, sub, cls = "") { return `<span class="stamp ${cls}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}</span>`; }

  const greet = () => { const h = new Date().getHours(); return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер"; };

  window.UI = { lf, LF_TEXT, pri, PRI, age, stepState, stepLine, stepText, film, probMeter, sr, kafka, timeline, think, capacity, stamp, greet };
})();
