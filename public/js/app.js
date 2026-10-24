const $ = (s) => document.querySelector(s);
const view = $('#view'), addr = $('#addr'), bar = $('#progress');
let KEY = 'exile', CONTENT = location.origin;
const ready = fetch('/api/config').then((r) => r.json()).then((c) => { KEY = c.key; CONTENT = c.contentOrigin; }).catch(() => {});
$('#engine').value = localStorage.getItem('exile.engine') || $('#engine').value;
$('#engine').onchange = (e) => localStorage.setItem('exile.engine', e.target.value);

const enc = (u) => {
  const k = new TextEncoder().encode(KEY);
  const b = new TextEncoder().encode(u).map((x, i) => x ^ k[i % k.length]);
  let s = ''; b.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
// URL if it parses as one (with or without protocol), otherwise a search query.
function resolve(input) {
  const v = input.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(v)) return 'https://' + v;
  return $('#engine').value + encodeURIComponent(v);
}
async function go(input) {
  const url = resolve(input);
  if (!url) return;
  await ready;
  $('#home').classList.add('hidden'); $('#browser').classList.remove('hidden');
  addr.value = url; bar.style.width = '70%';
  view.src = CONTENT + '/service/' + enc(url);
}
$('#homeForm').onsubmit = (e) => { e.preventDefault(); go($('#homeInput').value); };
addr.onkeydown = (e) => { if (e.key === 'Enter') go(addr.value); };
view.onload = () => { bar.style.width = '100%'; setTimeout(() => (bar.style.width = '0'), 300); };
addEventListener('message', (e) => {
  if (e.origin !== CONTENT || e.data?.type !== 'exile:nav') return;
  addr.value = e.data.url; document.title = (e.data.title || 'Exile') + ' · Exile';
});
const cmd = (c) => view.contentWindow.postMessage({ type: 'exile:cmd', cmd: c }, CONTENT);
$('#back').onclick = () => cmd('back');
$('#fwd').onclick = () => cmd('fwd');
$('#reload').onclick = () => cmd('reload');
$('#homeBtn').onclick = () => { view.src = 'about:blank'; $('#browser').classList.add('hidden'); $('#home').classList.remove('hidden'); document.title = 'Exile'; };
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); addr.focus(); addr.select(); }
  if (e.altKey && e.key === 'ArrowLeft') $('#back').click();
  if (e.altKey && e.key === 'ArrowRight') $('#fwd').click();
});
