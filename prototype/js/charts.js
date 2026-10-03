/* Графики рисуются как развёртка монитора: кривая проявляется слева направо за бегущей линией.
   Данные синтетические и подписаны как демо там, где их показывают. */
(function () {
  "use strict";
  let seq = 0;

  // сглаженная кривая через точки (кардинальный сплайн)
  function smooth(pts, k = .18) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
      const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  /* линия: series = [{values, cls, label, area}], band = [lo, hi] — норма */
  function line(o) {
    const w = o.w || 640, h = o.h || 220, id = "ch" + (++seq);
    const pad = { l: 40, r: 16, t: 14, b: o.labels ? 26 : 10 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const n = o.series[0].values.length;
    const min = o.min, max = o.max;
    const X = i => pad.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const Y = v => pad.t + ih - (v - min) / (max - min) * ih;
    const fy = o.fmtY || (v => v);
    let g = "";
    const ticks = o.ticks || 4;
    for (let i = 0; i <= ticks; i++) {
      const v = min + (max - min) * i / ticks, y = Y(v).toFixed(1);
      g += `<line class="gl" x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}"/><text class="ty" x="${pad.l - 8}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${fy(v)}</text>`;
    }
    if (o.band) g += `<rect class="band" x="${pad.l}" y="${Y(o.band[1]).toFixed(1)}" width="${iw}" height="${(Y(o.band[0]) - Y(o.band[1])).toFixed(1)}"/>`;
    if (o.labels) {
      const every = Math.ceil(o.labels.length / (o.maxLabels || 6));
      o.labels.forEach((l, i) => { if (i % every === 0 || i === o.labels.length - 1) g += `<text class="tx" x="${X(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${l}</text>`; });
    }
    if (o.marker != null) {
      const x = X(o.marker).toFixed(1);
      g += `<line class="mkline" x1="${x}" x2="${x}" y1="${pad.t}" y2="${pad.t + ih}"/><text class="mktext" x="${(+x + 6).toFixed(1)}" y="${pad.t + 10}">${o.markerLabel || ""}</text>`;
    }
    let s = "";
    o.series.forEach((se, si) => {
      const pts = se.values.map((v, i) => [X(i), Y(v)]);
      const d = smooth(pts);
      if (se.area) s += `<path class="area ${se.cls || ""}" d="${d}L${X(n - 1).toFixed(1)} ${pad.t + ih}L${X(0).toFixed(1)} ${pad.t + ih}Z" fill="url(#${id}g)"/>`;
      s += `<path class="trace ${se.cls || ""}" d="${d}"/>`;
      const last = pts[pts.length - 1];
      if (se.end !== false) s += `<circle class="end ${se.cls || ""}" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.4"/>`;
      if (se.endLabel) s += `<text class="endl" x="${(last[0] - 6).toFixed(1)}" y="${(last[1] - 9 - si * 0).toFixed(1)}" text-anchor="end">${se.endLabel}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${o.aria || "график"}">
      <defs><linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--teal);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--teal);stop-opacity:0"/></linearGradient>
      <clipPath id="${id}c"><rect class="sweep" x="0" y="0" width="${w}" height="${h}"/></clipPath></defs>
      ${g}<g clip-path="url(#${id}c)">${s}</g><line class="head" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}" style="--w:${w}"/></svg>`;
  }

  // маленькая линия тренда для реальных рядов показателей
  function spark(values, o = {}) {
    const w = o.w || 120, h = o.h || 34, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const pts = values.map((v, i) => [2 + i * (w - 4) / (values.length - 1), h - 3 - (v - min) / span * (h - 6)]);
    const last = pts[pts.length - 1];
    return `<svg class="spark ${o.cls || ""}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${smooth(pts, .15)}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6"/></svg>`;
  }

  // шкала референсного интервала: где значение относительно нормы
  function range(v, lo, hi) {
    const span = hi - lo || hi || 1;
    const min = Math.max(0, lo - span * .6), max = hi + span * .6;
    const pos = Math.min(100, Math.max(0, (v - min) / (max - min) * 100));
    const a = (lo - min) / (max - min) * 100, b = (hi - min) / (max - min) * 100;
    const st = v > hi ? "hi" : v < lo ? "lo" : "ok";
    return `<div class="rng ${st}" role="img" aria-label="Значение ${v}, норма ${lo}–${hi}"><i class="norm" style="left:${a}%;width:${b - a}%"></i><b style="--x:${pos}%"></b></div>`;
  }

  // перезапуск развёртки при появлении графика в кадре
  function play(root) {
    root.querySelectorAll(".chart").forEach(c => { c.classList.remove("go"); c.getBoundingClientRect(); c.classList.add("go"); });
  }

  window.Charts = { line, spark, range, play, smooth };
})();
