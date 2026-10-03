const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
global.self = global; const m = {}; new Function('exports','module','define', src)(m, {exports: m}, undefined);
const names = fs.readFileSync(process.argv[3], 'utf8').split(/\s+/).filter(Boolean);
const pascal = n => n.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const out = {}; const missing = [];
for (const n of names) {
  const node = m.icons[pascal(n)];
  if (!node) { missing.push(n); continue; }
  out[n] = node[2].map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
}
const header = `/* Иконки: подмножество Lucide v0.469.0 (ISC License, © Lucide Contributors, https://lucide.dev).\n   Сгенерировано из пакета lucide; добавить иконку: дописать имя в scripts/icons.txt и перегенерировать. */\n`;
fs.writeFileSync(process.argv[4], header + 'window.ICONS = ' + JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + ';\n');
console.log('icons:', Object.keys(out).length, 'missing:', missing.join(' ') || '-');
