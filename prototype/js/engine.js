/* Движок выносок. Линия в один физический пиксель ведёт от находки ИИ к слоту записи.
   Читает живые размеры блоков и пересчитывает путь при прокрутке, ресайзе и смене раскладки.
   Пока маршрут только предложен, пунктир «бежит» к слоту; после записи линия становится сплошной. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("leaders");
  const lines = new Map();
  let raf = 0;

  function connect(id, from, to, opts = {}) {
    remove(id);
    if (!svg || !from || !to) return null;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = `<path class="drawing"/><circle r="2.6"/><circle r="2.6"/>${opts.label ? `<g class="lbl"><rect rx="4" height="19"/><text y="13"></text></g>` : ""}`;
    svg.appendChild(g);
    const L = { id, from, to, g, path: g.querySelector("path"), dots: g.querySelectorAll("circle"), lbl: g.querySelector(".lbl"), state: opts.state || "proposed", bend: opts.bend == null ? .5 : opts.bend, drawn: false, quiet: !!opts.quiet };
    g.setAttribute("class", L.state);
    if (L.lbl) setLabel(L, opts.label);
    lines.set(id, L);
    schedule();
    return L;
  }

  function setLabel(L, text) {
    const t = L.lbl.querySelector("text");
    t.textContent = text;
    L.lblW = Math.ceil(text.length * 6.4 + 16);
    L.lbl.querySelector("rect").setAttribute("width", L.lblW);
    t.setAttribute("x", 8);
  }

  function setState(id, state, label) {
    const L = lines.get(id); if (!L) return;
    L.state = state;
    L.g.setAttribute("class", state + (L.g.classList.contains("hide") ? " hide" : ""));
    if (L.drawn) L.path.setAttribute("class", state);
    if (label && L.lbl) setLabel(L, label);
    schedule();
  }

  function remove(id) { const L = lines.get(id); if (L) { L.g.remove(); lines.delete(id); } }
  function clear() { lines.forEach(L => L.g.remove()); lines.clear(); }
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  function visible(el, r) {
    if (!r.width && !r.height) return false;
    const cy = r.top + r.height / 2;
    if (cy < 4 || cy > window.innerHeight - 4) return false;
    const clip = el.closest("[data-clip]");
    if (clip) { const c = clip.getBoundingClientRect(); if (cy < c.top || cy > c.bottom) return false; }
    return true;
  }

  function draw() {
    raf = 0;
    if (!svg) return;
    const dpr = window.devicePixelRatio || 1;
    const px = v => (Math.round(v * dpr) + .5) / dpr; // центр физического пикселя
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    lines.forEach(L => {
      if (!L.from.isConnected || !L.to.isConnected) { remove(L.id); return; }
      const a = L.from.getBoundingClientRect(), b = L.to.getBoundingClientRect();
      const show = visible(L.from, a) && visible(L.to, b) && window.innerWidth > 760;
      L.g.classList.toggle("hide", !show);
      const toRight = b.left + b.width / 2 >= a.left + a.width / 2;
      const sx = px(toRight ? a.right : a.left), sy = px(a.top + a.height / 2);
      const ex = px(toRight ? b.left - 5 : b.right + 5), ey = px(b.top + b.height / 2);
      const hd = toRight ? 1 : -1, dir = ey >= sy ? 1 : -1;
      const mx = px(sx + (ex - sx) * L.bend);
      const r = Math.max(0, Math.min(12, Math.abs(ey - sy) / 2, Math.abs(mx - sx), Math.abs(ex - mx)));
      const d = Math.abs(ey - sy) < 1.5
        ? `M${sx} ${sy}H${ex}`
        : `M${sx} ${sy}H${mx - hd * r}Q${mx} ${sy} ${mx} ${sy + dir * r}V${ey - dir * r}Q${mx} ${ey} ${mx + hd * r} ${ey}H${ex}`;
      L.path.setAttribute("d", d);
      L.path.style.strokeWidth = (1 / dpr) + "px";
      L.dots[0].setAttribute("cx", sx); L.dots[0].setAttribute("cy", sy);
      L.dots[1].setAttribute("cx", ex); L.dots[1].setAttribute("cy", ey);
      if (L.lbl) {
        const lx = toRight ? Math.max(mx + 10, ex - L.lblW - 10) : Math.min(mx - L.lblW - 10, ex + 10);
        L.lbl.setAttribute("transform", `translate(${Math.round(lx)} ${Math.round(ey - 26)})`);
      }
      if (!L.drawn && show) {
        L.drawn = true;
        const len = L.path.getTotalLength();
        L.path.style.strokeDasharray = len;
        L.path.style.strokeDashoffset = len;
        L.path.getBoundingClientRect();
        L.path.style.transition = "stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)";
        L.path.style.strokeDashoffset = "0";
        setTimeout(() => { L.path.style.strokeDasharray = ""; L.path.style.strokeDashoffset = ""; L.path.style.transition = ""; L.path.setAttribute("class", L.state); }, 950);
      }
    });
  }

  // во время анимации раскладки (выезд панели, разворот) линия следует за блоками каждый кадр
  function follow(ms = 700) {
    const end = performance.now() + ms;
    (function tick() { draw(); if (performance.now() < end) requestAnimationFrame(tick); })();
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(document.documentElement);

  window.Leaders = { connect, setState, remove, clear, redraw: schedule, follow, has: id => lines.has(id) };
})();
