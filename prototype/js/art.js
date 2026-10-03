/* Графика: логотип «Эгиды» и стилизованные снимки (КТ, маммография, рентгенография).
   Снимки рисуются кодом, без реальных изображений пациентов; разметка ИИ — бирюзовый пунктир с размером. */
(function () {
  "use strict";
  const W = 320, H = 240;

  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) ** 2) / rx ** 2 + ((y - cy) ** 2) / ry ** 2 <= 1;

  // фильтры и градиенты живут внутри каждой картинки: снимок растеризуется один раз и дальше не перерисовывается
  const DEFS = `<defs>
      <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>
      <filter id="cloud" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 .78  0 0 0 0 .82  0 0 0 0 .84  0 0 0 1.9 -.75"/></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="soft2"><feGaussianBlur stdDeviation="2.2"/></filter>
      <radialGradient id="ctBody" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#848d92"/><stop offset=".72" stop-color="#626b70"/><stop offset="1" stop-color="#3a4246"/></radialGradient>
      <radialGradient id="ctLung" cx="50%" cy="42%" r="72%"><stop offset="0" stop-color="#20282c"/><stop offset="1" stop-color="#0a0e10"/></radialGradient>
      <radialGradient id="mmgT" cx="22%" cy="55%" r="85%"><stop offset="0" stop-color="#c2c9cc"/><stop offset=".42" stop-color="#959ea2"/><stop offset=".82" stop-color="#4f585c"/><stop offset="1" stop-color="#2a3033"/></radialGradient>
      <linearGradient id="cxrSoft" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2b3236"/><stop offset="1" stop-color="#4b5458"/></linearGradient>
      <linearGradient id="cxrMed" x1="0" x2="1"><stop offset="0" stop-color="#6f797d"/><stop offset=".5" stop-color="#a7b0b4"/><stop offset="1" stop-color="#6f797d"/></linearGradient>
      <linearGradient id="bone" x1="0" x2="1"><stop offset="0" stop-color="#8f989c"/><stop offset=".5" stop-color="#dde3e5"/><stop offset="1" stop-color="#8f989c"/></linearGradient>
    </defs>`;
  const cache = new Map();
  function defs() { /* совместимость: раньше определения вставлялись в документ */ }

  function logo(cls = "") {
    return `<svg class="logo ${cls}" viewBox="0 0 32 32" aria-hidden="true">
      <path class="sh" d="M16 2.6 27.2 6.6v8.6c0 6.9-4.7 12.3-11.2 14.4C9.5 27.5 4.8 22.1 4.8 15.2V6.6Z"/>
      <path class="ar" style="--k:0" d="M16 13.6V9.4"/><path class="ar" style="--k:1" d="M16 18.4v4.2"/>
      <path class="ar" style="--k:2" d="M13.6 16H9.4"/><path class="ar" style="--k:3" d="M18.4 16h4.2"/>
      <circle class="dt" cx="16" cy="16" r="1.5"/>
    </svg>`;
  }

  /* разметка ИИ: пунктирное кольцо, выноска и подпись с размером */
  function mark(m) {
    if (!m) return "";
    const lw = Math.round(m.label.length * 5.5 + 12);
    const right = m.x + m.r + 10 + lw < W - 6;
    const lx = right ? m.x + m.r + 10 : m.x - m.r - 10 - lw;
    const ly = Math.max(16, m.y - m.r - 6);
    const ax = right ? lx : lx + lw;
    const ex = m.x + (right ? 1 : -1) * m.r * .72, ey = m.y - m.r * .72;
    return `<g class="mk">
      <circle class="mk-ring" cx="${m.x}" cy="${m.y}" r="${m.r}"/>
      <path class="mk-ring" d="M${ex.toFixed(1)} ${ey.toFixed(1)}L${ax} ${ly}"/>
      <g class="mk-tag"><rect x="${lx}" y="${ly - 9}" width="${lw}" height="15" rx="3"/><text x="${lx + 6}" y="${ly + 2}">${m.label}</text></g>
      <circle class="mk-anchor" data-anchor="finding" cx="${m.x}" cy="${m.y}" r="${m.r}" fill="none" stroke="none"/>
    </g>`;
  }

  function frame(inner, label, m, key) {
    let url = cache.get(key);
    if (!url) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}<rect width="${W}" height="${H}" fill="#040607"/>${inner}<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".13"/></svg>`;
      url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/\s{2,}/g, " "));
      cache.set(key, url);
    }
    return `<img class="study" src="${url}" alt="${label}" decoding="async" draggable="false">` +
      (m ? `<svg class="marks" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${mark(m)}</svg>` : "");
  }
  const keyOf = (kind, seed, m) => `${kind}|${seed}|${m ? [m.x, m.y, m.r, m.label].join(",") : "-"}`;

  /* КТ ОГК, аксиальный срез: справа пациента = слева на снимке */
  function ct(m, seed = 7) {
    const r = rng(seed); let ribs = "", ves = "";
    for (let i = 0; i < 24; i++) {
      const deg = i * 15 + 7.5;
      if ((deg > 66 && deg < 114) || (deg > 246 && deg < 294)) continue; // грудина и позвоночник
      const ang = deg * Math.PI / 180;
      const x = (160 + Math.cos(ang) * 124).toFixed(1), y = (126 - Math.sin(ang) * 84).toFixed(1);
      ribs += `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="3.4" transform="rotate(${90 - deg} ${x} ${y})" fill="#cdd4d7" opacity=".8"/>`;
    }
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0, cx = left ? 96 : 226, cy = 130;
      const x = cx + (r() - .5) * 96, y = cy + (r() - .5) * 128;
      if (!inEllipse(x, y, cx, cy, 44, 62)) continue;
      if (!left && inEllipse(x, y, 186, 122, 48, 40)) continue;
      const big = r() > .82;
      ves += big ? `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${((r() - .5) * 14).toFixed(1)} ${((r() - .5) * 10).toFixed(1)}" stroke="#56606a" stroke-width="${(1 + r() * 1.4).toFixed(1)}" stroke-linecap="round" opacity=".8"/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.7 + r() * 1.6).toFixed(1)}" fill="#5c666c" opacity="${(.5 + r() * .4).toFixed(2)}"/>`;
    }
    const nod = m ? `<circle cx="${m.x}" cy="${m.y}" r="${Math.max(2.4, m.r * .42).toFixed(1)}" fill="#c7cfd2" filter="url(#soft2)"/><circle cx="${m.x}" cy="${m.y}" r="${Math.max(1.8, m.r * .3).toFixed(1)}" fill="#d9e0e2"/>` : "";
    return frame(`
      <path d="M44 226Q160 238 276 226" stroke="#283034" stroke-width="3" fill="none"/>
      <ellipse cx="160" cy="126" rx="142" ry="99" fill="#30383c"/>
      <ellipse cx="160" cy="126" rx="133" ry="91" fill="url(#ctBody)"/>
      ${ribs}
      <path d="M72 52C42 70 32 120 40 166C46 193 72 206 100 203C126 200 142 189 147 171C151 141 149 101 141 76C131 52 101 42 72 52Z" fill="url(#ctLung)"/>
      <path d="M248 52C278 70 288 120 280 166C274 193 248 206 222 203C204 201 197 191 201 176C207 160 216 150 210 130C202 112 180 98 183 76C190 52 220 42 248 52Z" fill="url(#ctLung)"/>
      ${ves}
      <path d="M146 96C170 84 214 92 228 118C240 142 226 164 200 168C176 172 152 162 146 140C142 124 140 106 146 96Z" fill="#8c959a"/>
      <path d="M160 104C178 100 204 108 212 126C218 142 206 156 190 156C172 156 160 146 158 130C156 120 156 110 160 104Z" fill="#9aa3a7" opacity=".7"/>
      <circle cx="150" cy="86" r="13" fill="#a2abaf"/>
      <circle cx="187" cy="181" r="10.5" fill="#9ba4a8"/>
      <ellipse cx="160" cy="36" rx="11" ry="5" fill="#d3d9dc"/>
      <ellipse cx="160" cy="200" rx="19" ry="16" fill="#d8dee1"/><ellipse cx="160" cy="200" rx="12.5" ry="10" fill="#b8c0c4"/>
      <circle cx="160" cy="222" r="5.5" fill="#2a3134"/><path d="M160 228v8" stroke="#cfd6d9" stroke-width="5" stroke-linecap="round"/>
      ${nod}`, "КТ органов грудной клетки, аксиальный срез", m, keyOf("ct", seed, m));
  }

  /* Маммография, косая проекция: грудная стенка слева, сосок справа */
  function mmg(m, seed = 3) {
    const r = rng(seed); let calc = "";
    const isMass = m && !/кластер/.test(m.label);
    if (m && !isMass) for (let i = 0; i < 11; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * m.r * .62;
      calc += `<circle cx="${(m.x + Math.cos(a) * d).toFixed(1)}" cy="${(m.y + Math.sin(a) * d).toFixed(1)}" r="${(.6 + r() * 1.1).toFixed(1)}" fill="#fbffff"/>`;
    }
    const mass = isMass ? `<ellipse cx="${m.x}" cy="${m.y}" rx="${m.r * .55}" ry="${m.r * .42}" fill="#e3e8ea" filter="url(#soft2)"/>` : "";
    const shape = "M0 6C72 14 150 42 206 94C246 132 262 160 246 190C226 226 120 238 0 236Z";
    return frame(`
      <defs><clipPath id="mmgClip${seed}"><path d="${shape}"/></clipPath></defs>
      <path d="${shape}" fill="url(#mmgT)"/>
      <g clip-path="url(#mmgClip${seed})">
        <rect x="0" y="0" width="320" height="240" filter="url(#cloud)" opacity=".55"/>
        <path d="M0 0H112C78 58 40 108 0 152Z" fill="#c9d0d3" opacity=".88"/>
        <path d="M0 0H112C78 58 40 108 0 152Z" fill="none" stroke="#e1e6e8" stroke-width="1" opacity=".5"/>
      </g>
      <path d="${shape}" fill="none" stroke="#c9d0d3" stroke-width="1.2" opacity=".55"/>
      <circle cx="252" cy="168" r="4" fill="#9aa3a7"/>
      ${calc}${mass}`, "Маммограмма, косая проекция", m, keyOf("mmg", seed, m));
  }

  /* Рентгенография ОГК, прямая проекция */
  function cxr(m, seed = 5, opts = {}) {
    let ribs = "";
    for (let i = 0; i < 9; i++) {
      const y = 62 + i * 16.5;
      ribs += `<path d="M48 ${y + 14}Q96 ${y - 8} 150 ${y + 8}" stroke="#7d878c" stroke-width="3.6" fill="none" opacity=".45"/>`;
      ribs += `<path d="M272 ${y + 14}Q224 ${y - 8} 170 ${y + 8}" stroke="#7d878c" stroke-width="3.6" fill="none" opacity=".45"/>`;
    }
    const effusion = m && /выпот/.test(m.label);
    const infil = m && !effusion ? `<ellipse cx="${m.x}" cy="${m.y}" rx="${m.r * 1.1}" ry="${m.r * .85}" fill="#b4bdc1" opacity=".6" filter="url(#soft)"/>` : "";
    const eff = effusion ? `<path d="M46 168Q96 156 147 176V214H46Z" fill="#919a9e" opacity=".92" filter="url(#soft2)"/>` : "";
    void opts; void seed;
    return frame(`
      <path d="M26 34Q160 2 294 34L310 240H10Z" fill="url(#cxrSoft)"/>
      <path d="M70 50C50 82 42 140 46 204C72 214 122 216 147 207L149 70C132 52 98 44 70 50Z" fill="#0d1215"/>
      <path d="M250 50C270 82 278 140 274 204C252 214 214 216 196 208C200 186 186 174 172 170L171 70C188 52 222 44 250 50Z" fill="#0d1215"/>
      ${ribs}
      <rect x="146" y="40" width="28" height="200" fill="url(#cxrMed)" opacity=".9"/>
      <path d="M150 128C188 116 232 136 240 180C244 202 222 212 160 212Z" fill="#a0a9ad" opacity=".92"/>
      <path d="M40 206Q96 180 150 206V240H40Z" fill="#8f989c"/>
      <path d="M170 212Q226 192 286 214V240H170Z" fill="#8f989c"/>
      <path d="M56 54Q104 40 148 60" stroke="#c9d0d3" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M264 54Q216 40 172 60" stroke="#c9d0d3" stroke-width="6" fill="none" stroke-linecap="round"/>
      ${infil}${eff}`, "Рентгенограмма органов грудной клетки", m, keyOf("cxr", seed, m));
  }

  /* Рентгенография коленного сустава */
  function knee(m) {
    return frame(`
      <rect x="0" y="0" width="320" height="240" fill="#0b1013"/>
      <path d="M102 0H218L224 70C226 96 214 112 196 116H124C106 112 94 96 96 70Z" fill="url(#bone)"/>
      <path d="M108 0H212" stroke="#eef2f3" stroke-width="2" opacity=".3"/>
      <path d="M98 132C112 126 140 126 160 128C182 126 208 126 222 132L216 168C210 186 204 210 204 240H116C116 210 110 186 104 168Z" fill="url(#bone)"/>
      <path d="M228 150C236 156 238 176 236 240H222C222 190 220 168 216 156Z" fill="#9aa3a7"/>
      <ellipse cx="160" cy="60" rx="22" ry="26" fill="#cfd6d9" opacity=".25"/>
      <path d="M124 116Q160 124 196 116" stroke="#3a4448" stroke-width="2" fill="none" opacity=".6"/>`, "Рентгенограмма коленного сустава", m, keyOf("knee", 0, m));
  }

  /* Рентгенография околоносовых пазух */
  function sinus(m) {
    const fluid = m ? `<path d="M96 150H140L138 168C130 180 108 182 98 170Z" fill="#9aa3a7" opacity=".9"/><path d="M96 150H140" stroke="#dfe5e7" stroke-width="1.2"/>` : "";
    return frame(`
      <ellipse cx="160" cy="120" rx="120" ry="118" fill="#2a3135"/>
      <ellipse cx="160" cy="120" rx="112" ry="110" fill="none" stroke="#c3cacd" stroke-width="6" opacity=".7"/>
      <path d="M128 40Q160 26 192 40L188 66Q160 58 132 66Z" fill="#11171a"/>
      <ellipse cx="114" cy="96" rx="30" ry="24" fill="#0f1416" stroke="#9aa3a7" stroke-width="2.4"/>
      <ellipse cx="206" cy="96" rx="30" ry="24" fill="#0f1416" stroke="#9aa3a7" stroke-width="2.4"/>
      <path d="M92 126L142 126L138 172C126 188 104 186 94 172Z" fill="#11171a" stroke="#8d969a" stroke-width="2"/>
      <path d="M228 126L178 126L182 172C194 188 216 186 226 172Z" fill="#11171a" stroke="#8d969a" stroke-width="2"/>
      <path d="M160 108V188" stroke="#a9b2b6" stroke-width="5"/>
      <path d="M96 204Q160 230 224 204" stroke="#c3cacd" stroke-width="7" fill="none" opacity=".7"/>
      ${fluid}`, "Рентгенограмма околоносовых пазух", m, keyOf("sinus", 0, m));
  }

  function study(p, seed) {
    const m = p.ai.mark;
    const kind = m ? m.art : p.study.mod === "ММГ" ? "mmg" : p.study.mod === "КТ" ? "ct" : p.study.area === "коленный сустав" ? "knee" : p.study.area === "околоносовые пазухи" ? "sinus" : "cxr";
    const s = seed || parseInt(p.id.slice(1), 10) * 7 + 3;
    return { ct, mmg, cxr, knee, sinus }[kind](m, s);
  }

  window.Art = { defs, logo, study, ct, mmg, cxr, knee, sinus };
})();
