/* 应统择校 · MAS Choice
   数据来自 data.js（window.MAS_DATA），逐条标注来源；对比选择存于 localStorage。 */

const CMP_KEY = 'masChoice.compare.v1';

const TIER_COLORS = { '985': '#4F6EF2', '211': '#8B5CF6', '双一流': '#10B981', '双非': '#8A92A6' };

let compare = [];          // 参与对比的校名，最多 3 所
const charts = {};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const NA = '<span class="s-na">—</span>';

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

function getData() { return window.MAS_DATA || null; }
function hasData() {
  const d = getData();
  return !!(d && Array.isArray(d.schools) && d.schools.length);
}

function loadCompare() {
  try { const v = JSON.parse(localStorage.getItem(CMP_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function saveCompare() {
  try { localStorage.setItem(CMP_KEY, JSON.stringify(compare)); } catch (e) { /* ignore */ }
}

// 复试线颜色带：直观显示竞争烈度
function lineColor(v) {
  if (typeof v !== 'number') return 'var(--muted)';
  if (v >= 380) return '#E5484D';
  if (v >= 360) return '#D97706';
  return '#0E7A5F';
}

// ---------- 筛选与列表 ----------
function currentFilters() {
  return {
    q: $('fSearch').value.trim().toLowerCase(),
    province: $('fProvince').value,
    tier: $('fTier').value,
    band: $('fLine').value,
    verified: $('fVerified').checked,
    sort: $('fSort').value,
  };
}

function applyFilters() {
  const f = currentFilters();
  const list = getData().schools.filter((s) => {
    if (f.q && !String(s.school).toLowerCase().includes(f.q)) return false;
    if (f.province && s.province !== f.province) return false;
    if (f.tier && s.tier !== f.tier) return false;
    if (f.verified && !s.verified) return false;
    if (f.band) {
      const v = s.line2025;
      if (typeof v !== 'number') return false;
      if (f.band === '380' && !(v >= 380)) return false;
      if (f.band === '360' && !(v >= 360 && v < 380)) return false;
      if (f.band === '340' && !(v >= 340 && v < 360)) return false;
      if (f.band === 'lt340' && !(v < 340)) return false;
    }
    return true;
  });
  if (f.sort === 'lineDesc') list.sort((a, b) => (b.line2025 ?? -1) - (a.line2025 ?? -1));
  else if (f.sort === 'lineAsc') list.sort((a, b) => (a.line2025 ?? 1e9) - (b.line2025 ?? 1e9));
  else list.sort((a, b) => String(a.school).localeCompare(String(b.school), 'zh'));
  return list;
}

function renderList() {
  const d = getData();
  const shown = applyFilters();
  const verifiedCount = d.schools.filter((s) => s.verified).length;
  $('listStats').textContent = `共 ${d.schools.length} 所 · 已核实 ${verifiedCount} 所 · 当前显示 ${shown.length} 所`;

  if (!shown.length) {
    $('schoolList').innerHTML = '<div class="empty">没有符合条件的院校，试试放宽筛选条件。</div>';
    return;
  }
  $('schoolList').innerHTML = shown.map((s) => {
    const tc = TIER_COLORS[s.tier] || '#8A92A6';
    const l25 = typeof s.line2025 === 'number'
      ? `<span class="num" style="color:${lineColor(s.line2025)}">${s.line2025}</span>` : NA;
    const l24 = typeof s.line2024 === 'number' ? `<span class="num">${s.line2024}</span>` : NA;
    const chips = [
      s.city ? esc(s.city) : '',
      s.type ? esc(s.type) : '',
      s.lang ? `初试 ${esc(s.lang)}` : '',
      typeof s.quota === 'number' ? `拟招 ${s.quota} 人` : '',
    ].filter(Boolean).map((x) => `<span class="s-chip">${x}</span>`).join('');
    return `<div class="school-card">
      <div class="s-top">
        <span class="s-name">${esc(s.school)}</span>
        <span class="s-tier" style="background:${tc}">${esc(s.tier || '')}</span>
        ${s.verified ? '<span class="s-verified">✓ 已核实</span>' : '<span class="s-unverified">单一来源</span>'}
      </div>
      <div class="s-lines">
        <div class="s-line"><span class="lbl">2025复试线</span>${l25}</div>
        <div class="s-line prev"><span class="lbl">2024</span>${l24}</div>
      </div>
      ${chips ? `<div class="s-meta">${chips}</div>` : ''}
      ${s.refBooks ? `<div class="s-notes">专业课参考：${esc(s.refBooks)}</div>` : ''}
      ${s.notes ? `<div class="s-notes">${esc(s.notes)}</div>` : ''}
      <div class="s-foot">
        ${s.sourceUrl ? `<a class="s-src" href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">数据来源 ↗</a>` : '<span></span>'}
        <label class="cmp-label"><input type="checkbox" class="cmp-chk" data-school="${esc(s.school)}" ${compare.includes(s.school) ? 'checked' : ''}> 对比</label>
      </div>
    </div>`;
  }).join('');
}

// ---------- 对比 ----------
function toggleCompare(name, on) {
  if (on) {
    if (compare.includes(name)) return;
    if (compare.length >= 3) { toast('最多同时对比 3 所院校'); renderList(); return; }
    compare.push(name);
  } else {
    compare = compare.filter((x) => x !== name);
  }
  saveCompare();
  updateCompareBar();
  renderList();
}

function updateCompareBar() {
  $('cmpCount').textContent = compare.length;
  $('compareBar').hidden = compare.length === 0;
}

function renderCompare() {
  const d = getData();
  const schools = compare.map((n) => d.schools.find((s) => s.school === n)).filter(Boolean);
  if (schools.length < 2) {
    $('compareHint').style.display = '';
    $('compareWrap').innerHTML = '';
    return;
  }
  $('compareHint').style.display = 'none';
  const diffCell = (s) => {
    if (typeof s.line2025 !== 'number' || typeof s.line2024 !== 'number') return '<td>—</td>';
    const df = s.line2025 - s.line2024;
    const color = df > 0 ? '#E5484D' : df < 0 ? '#0E7A5F' : 'inherit';
    return `<td class="cmp-val" style="color:${color}">${df > 0 ? '+' : ''}${df}</td>`;
  };
  const rows = [
    ['2025 复试线', (s) => typeof s.line2025 === 'number'
      ? `<td class="cmp-val" style="color:${lineColor(s.line2025)}">${s.line2025}</td>` : '<td>—</td>'],
    ['2024 复试线', (s) => typeof s.line2024 === 'number' ? `<td class="cmp-val">${s.line2024}</td>` : '<td>—</td>'],
    ['两年变化', diffCell],
    ['层次', (s) => `<td>${esc(s.tier || '—')}</td>`],
    ['城市', (s) => `<td>${esc([s.city, s.province].filter(Boolean).join(' · ') || '—')}</td>`],
    ['初试外语', (s) => `<td>${esc(s.lang || '—')}</td>`],
    ['专业课', (s) => `<td>${esc(s.proCourse || '432统计学')}</td>`],
    ['参考书/风格', (s) => `<td>${esc(s.refBooks || '—')}</td>`],
    ['拟招生', (s) => `<td>${typeof s.quota === 'number' ? s.quota + ' 人' : '—'}</td>`],
    ['备注', (s) => `<td>${esc(s.notes || '—')}</td>`],
  ];
  $('compareWrap').innerHTML = `<table class="cmp-table">
    <thead><tr><th>项目</th>${schools.map((s) => `<th>${esc(s.school)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, fn]) => `<tr><th>${label}</th>${schools.map(fn).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// ---------- 趋势 ----------
function ensureChart(key, el) {
  if (!charts[key]) charts[key] = echarts.init(el);
  return charts[key];
}

function renderNational() {
  const nl = (getData().meta || {}).nationalLine || [];
  if (!nl.length) {
    $('chartNational').innerHTML = '<div class="empty">暂无国家线数据</div>';
    return;
  }
  const years = nl.map((x) => x.year);
  const scores = nl.map((x) => x.score);
  ensureChart('national', $('chartNational')).setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 20, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: years, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'line', data: scores, smooth: true,
      symbol: 'circle', symbolSize: 8,
      lineStyle: { width: 3, color: '#0E7A5F' },
      itemStyle: { color: '#0E7A5F' },
      label: { show: true, fontSize: 11 },
    }],
  });
}

function renderSchoolsChart() {
  const list = getData().schools
    .filter((s) => typeof s.line2025 === 'number' || typeof s.line2024 === 'number')
    .sort((a, b) => (b.line2025 ?? b.line2024 ?? 0) - (a.line2025 ?? a.line2024 ?? 0));
  if (!list.length) {
    $('chartSchools').innerHTML = '<div class="empty">暂无院校复试线数据</div>';
    return;
  }
  ensureChart('schools', $('chartSchools')).setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 44, right: 14, top: 30, bottom: 90 },
    xAxis: { type: 'category', data: list.map((s) => s.school), axisLabel: { fontSize: 10, rotate: 40, interval: 0 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: [
      { name: '2024', type: 'bar', barMaxWidth: 12, itemStyle: { color: '#9FB3C8' }, data: list.map((s) => (typeof s.line2024 === 'number' ? s.line2024 : null)) },
      { name: '2025', type: 'bar', barMaxWidth: 12, itemStyle: { color: '#0E7A5F' }, data: list.map((s) => (typeof s.line2025 === 'number' ? s.line2025 : null)) },
    ],
  }, { notMerge: true });
}

// ---------- 数据说明 ----------
function renderAbout() {
  const d = getData();
  const meta = d.meta || {};
  const verified = d.schools.filter((s) => s.verified).length;
  $('aboutBody').innerHTML = `
    <p>· 收录院校 ${d.schools.length} 所，其中数据已核实（院校官网或多来源交叉）${verified} 所。</p>
    <p>· 数据更新：${esc(meta.updated || '—')}。国家线来源：${meta.nationalLineSource
      ? `<a href="${esc(meta.nationalLineSource)}" target="_blank" rel="noopener" style="color:var(--primary)">查看</a>` : '—'}。</p>
    <p>· 「✓ 已核实」= 复试线来自院校研究生院/学院官网，或有多个独立来源交叉；「单一来源」= 仅一个第三方来源，使用前请自行核对。</p>
    ${meta.caveats ? `<p>· ${esc(meta.caveats)}</p>` : ''}
    <p>· 空值处理：查不到的数据显示为 —，不猜测、不插补。</p>`;
}

// ---------- 路由与初始化 ----------
function switchTab(name) {
  document.querySelectorAll('#tabnav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  requestAnimationFrame(() => {
    if (name === 'list') renderList();
    if (name === 'compare') renderCompare();
    if (name === 'trend') { renderNational(); renderSchoolsChart(); }
    if (name === 'about') renderAbout();
  });
}

function init() {
  if (!hasData()) {
    $('main').innerHTML =
      '<div class="card"><div class="card-title">数据尚未生成</div><p class="hint">data.js 缺失或为空。请先生成数据文件，并通过 HTTP 方式访问本页面。</p></div>';
    return;
  }
  const d = getData();
  compare = loadCompare().filter((n) => d.schools.some((s) => s.school === n));

  const provs = [...new Set(d.schools.map((s) => s.province).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'zh'));
  $('fProvince').innerHTML = '<option value="">全部地区</option>' + provs.map((p) => `<option>${esc(p)}</option>`).join('');

  ['fSearch', 'fProvince', 'fTier', 'fLine', 'fSort'].forEach((id) => $(id).addEventListener('input', renderList));
  $('fVerified').addEventListener('change', renderList);

  $('schoolList').addEventListener('change', (e) => {
    const chk = e.target.closest('.cmp-chk');
    if (!chk) return;
    toggleCompare(chk.dataset.school, chk.checked);
  });

  $('btnGoCompare').addEventListener('click', () => switchTab('compare'));
  $('btnClearCompare').addEventListener('click', () => {
    compare = [];
    saveCompare();
    updateCompareBar();
    renderList();
    toast('已清空对比选择');
  });

  document.querySelectorAll('#tabnav button').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab))
  );

  updateCompareBar();
  renderList();
  window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
}

init();
