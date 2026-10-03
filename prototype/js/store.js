/* Общее состояние двух кабинетов. Одна запись видна обоим контурам:
   координатор записал — у пациента загорелся шаг плана; пациент записался сам — плёнка на столе гаснет. */
(function () {
  "use strict";
  const KEY = "aegis-demo-v1";
  const blank = () => ({ bookings: {}, status: {}, decisions: {}, comments: {}, events: {}, taken: {}, notif: { patient: [], admin: [] }, seen: {}, reminders: {}, role: "coordinator", lampOn: false });
  let S = Object.assign(blank(), U.store.get(KEY, {}));
  const subs = new Set();
  const save = () => { U.store.set(KEY, S); subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); };

  const D = window.DATA;
  const byId = Object.fromEntries(D.patients.map(p => [p.id, p]));
  const docById = Object.fromEntries(D.doctors.map(d => [d.id, d]));
  const slotById = Object.fromEntries(D.slots.map(s => [s.id, s]));
  const NEEDS = new Set(["opened", "no-contact", "call-planned", "sms-read"]);

  const STATUS = {
    "opened": "Открыла рекомендацию, не записалась",
    "no-contact": "Не удаётся связаться",
    "call-planned": "Звонок запланирован",
    "sms-read": "SMS прочитано, записи нет",
    "booked": "Записан",
    "visited": "Приём состоялся",
    "normal": "Норма, маршрут не нужен",
    "planned": "Врач изменил маршрут",
  };

  function patient(id) {
    const p = byId[id]; if (!p) return null;
    const status = S.status[id] || p.status;
    const bk = S.bookings[id] || (p.booked ? { doc: p.booked.doc, off: p.booked.off, t: p.booked.t, by: p.booked.by } : null);
    const decision = S.decisions[id] || p.decision;
    const extraC = (S.comments[id] || []).map(c => [c.who, c.ago, c.text, true]);
    const extraE = (S.events[id] || []).map(e => [e.off, e.title, e.text, e.state, true]);
    const lit = NEEDS.has(status) && !bk;
    const since = p.study.ago;
    let statusText = STATUS[status] || status;
    if (status === "call-planned" && p.callAt) statusText = `Звонок сегодня в ${p.callAt}`;
    if (status === "opened") statusText = p.sex === "Ж" ? "Открыла рекомендацию, не записалась" : "Открыл рекомендацию, не записался";
    if (bk) statusText = `${bk.by === "patient" ? (p.sex === "Ж" ? "Записалась сама" : "Записался сам") : "Записан координатором"} · ${U.fmt.wdd(bk.off)}, ${bk.t}`;
    return Object.assign({}, p, { status, booking: bk, decision, lit, since, statusText, comments: p.comments.concat(extraC), timeline: p.timeline.concat(extraE) });
  }
  const all = () => D.patients.map(p => patient(p.id));

  function slotFree(s) { return !s.busy && !S.taken[s.id]; }
  function freeSlots(sk, opts = {}) {
    const docs = D.doctors.filter(d => d.sk === sk && d.shift);
    return D.slots.filter(s => docs.some(d => d.id === s.doc) && slotFree(s) && (opts.dayIndex == null || s.dayIndex === opts.dayIndex)).sort((a, b) => a.at - b.at);
  }
  function bestSlot(p) {
    const step = p.route.find(r => r.sk); if (!step) return null;
    return freeSlots(step.sk)[0] || null;
  }

  function book(pid, slotId, by) {
    const p = byId[pid], s = slotById[slotId]; if (!p || !s || !slotFree(s)) return null;
    const doc = docById[s.doc];
    S.taken[slotId] = pid;
    S.bookings[pid] = { doc: s.doc, off: s.off, t: s.t, by, slot: slotId };
    S.status[pid] = "booked";
    const when = `${U.fmt.wdd(s.off)}, ${s.t}`;
    (S.events[pid] = S.events[pid] || []).push({ off: 0, title: by === "patient" ? (p.sex === "Ж" ? "Записалась сама в приложении" : "Записался сам в приложении") : "Координатор записал на приём", text: `${doc.spec}: ${doc.short}, ${when}, каб. ${doc.room}`, state: "booked" });
    if (by === "coordinator") S.notif.patient.unshift({ id: "n" + Date.now(), icon: "calendar-check", title: `Вы записаны: ${doc.spec.toLowerCase()}`, text: `${doc.short}, ${when}, кабинет ${doc.room}. Записала координатор Ольга Белова.`, pid, fresh: true });
    else S.notif.admin.unshift({ id: "n" + Date.now(), icon: "calendar-check", title: `${p.short} записалась сама`, text: `${doc.spec}: ${doc.short}, ${when}`, pid, fresh: true });
    save();
    return { doc, slot: s, when };
  }

  // запись пациентки на другие приёмы из её кабинета (не меняет маршрут на столе)
  function addVisit(pid, slotId) {
    const s = slotById[slotId]; if (!s || !slotFree(s)) return null;
    S.taken[slotId] = pid;
    (S.visits = S.visits || []).push({ pid, slot: slotId });
    save();
    return { doc: docById[s.doc], slot: s };
  }
  const visits = pid => (S.visits || []).filter(v => v.pid === pid).map(v => slotById[v.slot]).filter(Boolean);

  function decide(pid, state, note) {
    S.decisions[pid] = { by: "d2", state, ago: 0, note };
    const labels = { confirmed: "Врач подтвердил маршрут", changed: "Врач изменил маршрут", declined: "Врач отклонил маршрут" };
    (S.events[pid] = S.events[pid] || []).push({ off: 0, title: labels[state], text: "Ковалёва И. П." + (note ? `: ${note}` : ""), state });
    if (state === "declined") S.status[pid] = "planned";
    save();
  }

  function comment(pid, text, who = "me") {
    (S.comments[pid] = S.comments[pid] || []).push({ who, ago: 0, text });
    save();
  }

  function setStatus(pid, st, ev) {
    S.status[pid] = st;
    if (ev) (S.events[pid] = S.events[pid] || []).push(Object.assign({ off: 0 }, ev));
    save();
  }

  const notifs = cab => S.notif[cab] || [];
  const unread = cab => notifs(cab).filter(n => n.fresh).length;
  function readAll(cab) { notifs(cab).forEach(n => { n.fresh = false; }); save(); }

  function reminder(id, on) { S.reminders[id] = on; save(); }
  const reminderOn = (id, d) => S.reminders[id] == null ? d : S.reminders[id];

  function seen(key) { if (S.seen[key]) return true; S.seen[key] = 1; U.store.set(KEY, S); return false; }
  function setRole(r) { S.role = r; save(); }
  function reset() { S = blank(); U.store.set(KEY, S); subs.forEach(f => f()); }

  window.Store = {
    get state() { return S; }, patient, all, doc: id => docById[id], slot: id => slotById[id], slotFree, freeSlots, bestSlot,
    book, addVisit, visits, decide, comment, setStatus, notifs, unread, readAll, reminder, reminderOn, seen, setRole, reset,
    subscribe: f => { subs.add(f); return () => subs.delete(f); }, STATUS,
  };
})();
