'use strict';
/* Day Deck pages: record page, deck, insights page and settings. */
(function () {
  const DD = window.DD;
  const h = DD.h;
  const S = () => DD.state;

  DD.selectedDay = null; // null = today
  DD.filter = 'all';
  DD.period = 'week';
  DD.gymEx = null;

  const t = DD.t;
  const FILTERS = [['all', '全部'], ['food', '饮食'], ['do', '做事'], ['work', '工作']];
  const inFilter = (card, f) => f === 'all' || (f === 'food' && card === 'meal') || (f === 'do' && ['do', 'chores', 'gym'].includes(card)) || (f === 'work' && card === 'work');

  /* ---------- Shared header: title, page dots, language / theme / settings ---------- */
  function pageHead(title, pageIndex) {
    const theme = document.documentElement.getAttribute('data-theme');
    const isEn = DD.lang() === 'en';
    return h('header', { class: 'page-head' },
      h('div', null,
        h('h1', { class: 'page-title' }, title),
        h('div', { class: 'dots' }, [0, 1].map((i) => h('button', { type: 'button', class: 'dot' + (i === pageIndex ? ' on' : ''), 'aria-label': t(i === 0 ? '记录' : '洞察'), onClick: () => DD.goPage(i) })))),
      h('div', { class: 'head-btns' },
        h('button', { type: 'button', class: 'round-btn lang-btn', 'aria-label': t(isEn ? '切换到中文' : '切换到英文'), onClick: DD.toggleLang }, isEn ? '中' : 'EN'),
        h('button', { type: 'button', class: 'round-btn', 'aria-label': t(theme === 'night' ? '切换到日间' : '切换到夜间'), onClick: DD.toggleTheme }, DD.iconEl(theme === 'night' ? 'moon' : 'sun')),
        h('button', { type: 'button', class: 'round-btn', 'aria-label': t('设置'), onClick: DD.openSettings }, DD.iconEl('gear'))));
  }

  /* ---------- Record page ---------- */
  function renderRecord() {
    const st = S();
    const today = DD.todayKey();
    const day = DD.selectedDay || today;
    const isToday = day === today;
    const recs = DD.recordsBetween(day, day).sort(DD.byStartDesc);
    const shown = recs.filter((r) => inFilter(r.card, DD.filter));
    const timer = st.timer && isToday && inFilter(st.timer.card, DD.filter) ? st.timer : null;
    const count = recs.length + (st.timer && isToday ? 1 : 0);

    const dateInput = h('input', { type: 'date', value: day, max: today, 'aria-label': t('选择日期') });
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      DD.selectedDay = dateInput.value === today ? null : dateInput.value;
      renderRecord();
    });

    const rows = [];
    if (timer) {
      rows.push(h('li', { class: 'row running', onClick: () => DD.openCardSheet(timer.card) },
        h('span', { class: 'rdot dot-' + timer.card }),
        h('div', null, h('div', { class: 'rtitle' }, DD.timerLabel(timer), h('span', { class: 'live-pill' }, t('进行中'))),
          h('div', { class: 'rdetail' }, h('span', { 'data-since': timer.start }, DD.fmtElapsed(Date.now() - DD.parseLocal(timer.start))), ' · ' + t('{time} 开始', { time: DD.fmtHM(timer.start) }))),
        h('span', { class: 'rtime' }, DD.fmtHM(timer.start))));
    }
    shown.forEach((r) => {
      const d = DD.describe(r);
      rows.push(h('li', { class: 'row', onClick: () => DD.openCardSheet(r.card, r) },
        h('span', { class: 'rdot dot-' + r.card }),
        h('div', { style: 'min-width:0' }, h('div', { class: 'rtitle' }, d.title), d.detail ? h('div', { class: 'rdetail' }, d.detail) : null),
        h('span', { class: 'rtime' }, DD.fmtHM(r.start))));
    });

    const empty = rows.length ? null : h('div', { class: 'empty-day' },
      t(recs.length ? '这个分类是空的，切到「全部」看看' : isToday ? '从下面抽一张卡，记下第一件事' : '这一天是空白的，可以补记'));

    const page = document.getElementById('page-record');
    page.replaceChildren(
      pageHead(t('记录'), 0),
      h('div', { class: 'col' },
        DD.loadWarning ? h('div', { class: 'banner' }, DD.loadWarning) : null,
        h('div', { class: 'ticket' },
          h('h2', { class: 'sec-title' }, t('小结')),
          h('div', { class: 'notes' }, DD.computeNotes().map((n) => h('div', { class: 'note-pill' }, n))),
          h('div', { class: 'tear' }),
          h('div', { class: 'sec-row' },
            h('div', null,
              h('h2', { class: 'sec-title' }, isToday ? t('今天') : DD.fmtDate(day)),
              h('div', { class: 'sec-sub' }, t('{n} 条 · {day}', { n: count, day: DD.fmtDayLong(day) }))),
            h('label', { class: 'round-btn date-btn', 'aria-label': t('选择日期') }, DD.iconEl('cal'), dateInput)),
          !isToday ? h('button', { type: 'button', class: 'link-btn', onClick: () => { DD.selectedDay = null; renderRecord(); } }, t('← 回到今天')) : null,
          DD.seg(FILTERS.map(([v, l]) => [v, t(l)]), DD.filter, (v) => { DD.filter = v; renderRecord(); }),
          rows.length ? h('ul', { class: 'timeline' }, rows) : empty)));
  }

  /* ---------- Deck ---------- */
  const ROT = [-7, -3.5, -1, 2, 4.5, 8];
  const LIFT = [10, 4, 0, 0, 4, 10];

  // On the insights page the deck sinks down, showing only the card tops; a tap brings it back up.
  DD.deckTucked = false;
  DD.setTucked = (v) => {
    DD.deckTucked = !!v;
    const deck = document.getElementById('deck');
    deck.classList.toggle('tucked', DD.deckTucked);
    deck.setAttribute('aria-label', t(DD.deckTucked ? '展开卡牌' : '卡牌'));
  };

  function renderDeck() {
    const st = S();
    const deck = document.getElementById('deck');
    const order = st.settings.cardOrder;
    const wide = window.innerWidth >= 700;
    const cardW = wide ? 154 : 132;
    const colW = Math.min(window.innerWidth, wide ? 640 : 560);
    const avail = colW - 20;
    const step = Math.max(wide ? 84 : 60, Math.min(cardW * 0.62, (avail - cardW) / (order.length - 1)));
    const innerW = cardW + step * (order.length - 1) + 20;

    let scroller = deck.querySelector('.deck-scroll');
    const keepScroll = scroller ? scroller.scrollLeft : 0;
    const inner = h('div', { class: 'deck-inner', style: `width:${innerW}px` });
    order.forEach((id, i) => {
      const f = DD.cardFace(id);
      const head = f.timer
        ? h('div', { class: 'c-head timer', 'data-since': f.timer, 'data-short': '1' }, DD.fmtElapsed(Date.now() - DD.parseLocal(f.timer), true))
        : h('div', { class: 'c-head' }, f.head);
      const body = f.num != null
        ? [h('div', { class: 'c-label' }, f.label), h('div', { class: 'c-big' }, h('span', { class: 'c-num' }, f.num), h('span', { class: 'c-unit' }, f.unit))]
        : [h('div', { class: 'c-line hint-line' }, f.label)];
      const card = h('button', {
        type: 'button', class: 'card ' + id,
        style: `left:${10 + i * step}px; z-index:${i + 1}; transform: translateY(${LIFT[i] || 0}px) rotate(${ROT[i] || 0}deg)`,
        'aria-label': DD.join([DD.cardName(id), f.head, f.label, f.num != null ? `${f.num} ${f.unit}` : '', f.sub], ', '),
      }, head, h('div', { class: 'c-name' }, DD.cardName(id)), body, f.sub ? h('div', { class: 'c-line' }, f.sub) : null);
      attachDraw(card, id, i);
      inner.append(card);
    });
    scroller = h('div', { class: 'deck-scroll' }, inner);
    deck.replaceChildren(scroller);
    deck.classList.toggle('tucked', DD.deckTucked);
    scroller.scrollLeft = keepScroll;
  }

  // Tap a card, or drag it upwards, to draw it. While the deck is tucked, the first tap only raises it.
  function attachDraw(card, id, i) {
    let y0 = null, x0 = 0, drawn = false;
    const base = `translateY(${LIFT[i] || 0}px) rotate(${ROT[i] || 0}deg)`;
    card.addEventListener('pointerdown', (e) => { y0 = e.clientY; x0 = e.clientX; drawn = false; });
    card.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      const dy = e.clientY - y0, dx = Math.abs(e.clientX - x0);
      if (DD.deckTucked) { if (dy < -20 && -dy > dx) { drawn = true; y0 = null; DD.setTucked(false); } return; }
      if (dy < 0 && -dy > dx) card.style.transform = `translateY(${(LIFT[i] || 0) + Math.max(dy, -80)}px) rotate(${(ROT[i] || 0) * 0.5}deg)`;
      if (dy < -55 && -dy > dx * 1.5 && !drawn) { drawn = true; y0 = null; draw(card, id, base); }
    });
    const reset = () => { if (y0 != null) { y0 = null; card.style.transform = base; } };
    card.addEventListener('pointerup', reset);
    card.addEventListener('pointercancel', reset);
    card.addEventListener('click', (e) => {
      if (drawn) { e.preventDefault(); return; }
      if (DD.deckTucked) { DD.setTucked(false); return; }
      draw(card, id, base);
    });
  }
  function draw(card, id, base) {
    card.style.transform = `translateY(-60px) rotate(0deg)`;
    setTimeout(() => { card.style.transform = base; }, 260);
    DD.openCardSheet(id);
  }

  /* ---------- Insights ---------- */
  function periodRange() {
    const tk = DD.todayKey();
    return DD.period === 'week' ? [DD.weekStartKey(tk), tk] : [DD.monthStartKey(tk), tk];
  }

  function barChart(days) {
    const W = 340, H = 150, top = 22, bottom = 26, n = days.length;
    const max = Math.max(1, ...days.map((d) => d.n));
    const slot = W / n, bw = Math.min(34, slot * 0.6);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${DD.esc(t('每天记录数'))}"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bar);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--bar);stop-opacity:.95"/></linearGradient></defs>`;
    s += `<line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" style="stroke:var(--grid)" stroke-width="1.5"/>`;
    days.forEach((d, i) => {
      const x = i * slot + (slot - bw) / 2;
      const bh = d.n ? Math.max(4, ((H - top - bottom) * d.n) / max) : 0;
      const y = H - bottom - bh;
      if (bh) s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="url(#bg1)"/>`;
      if (d.n) s += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="12" style="fill:var(--text2)">${d.n}</text>`;
      if (d.label) s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="${n > 10 ? 10 : 12}" style="fill:var(--text2)">${d.label}</text>`;
    });
    return s + '</svg>';
  }

  function lineChart(points) {
    const W = 340, H = 190, L = 34, R = 14, T = 26, B = 26;
    const vals = points.map((p) => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 5; hi += 5; }
    const padv = (hi - lo) * 0.15; lo = Math.max(0, lo - padv); hi += padv;
    const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${DD.esc(t('最大重量变化'))}">`;
    for (let k = 0; k <= 3; k++) {
      const v = lo + ((hi - lo) * k) / 3, yy = y(v);
      s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" style="stroke:var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="11" style="fill:var(--text2)">${Math.round(v)}</text>`;
    }
    const step = Math.ceil(points.length / 5);
    points.forEach((p, i) => { if (i % step === 0 || i === points.length - 1) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" style="fill:var(--text2)">${p.label}</text>`; });
    if (points.length > 1) s += `<polyline points="${points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    points.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.v)}" r="4.5" style="fill:var(--accent)"/>`; });
    const lp = points[points.length - 1];
    s += `<text x="${Math.min(x(points.length - 1), W - R - 10)}" y="${y(lp.v) - 10}" text-anchor="middle" font-size="12.5" style="fill:var(--accent)">${lp.v} kg</text>`;
    return s + '</svg>';
  }

  const svgEl = (str) => { const d = h('div'); d.innerHTML = str; return d.firstChild; };

  function renderInsights() {
    const st = S();
    const [from, to] = periodRange();
    const recs = DD.recordsBetween(from, to);
    const pname = t(DD.period === 'week' ? '本周' : '本月');
    const tk = DD.todayKey();

    // 1. Records per day
    let days;
    if (DD.period === 'week') days = Array.from({ length: 7 }, (_, i) => { const k = DD.addDays(tk, i - 6); return { k, label: DD.fmtMD(k) }; });
    else { days = []; for (let k = from; k <= to; k = DD.addDays(k, 1)) days.push({ k, label: '' }); days.forEach((d, i) => { const dd = DD.keyToDate(d.k).getDate(); if (dd === 1 || dd % 5 === 0 || i === days.length - 1) d.label = String(dd); }); }
    days.forEach((d) => { d.n = DD.recordsBetween(d.k, d.k).length; });
    const totalShown = days.reduce((a, d) => a + d.n, 0);

    // 2. Food collection
    const foods = DD.distinctFoods(recs);
    const groups = {};
    foods.forEach((g, name) => { (groups[g] = groups[g] || []).push(name); });

    // 3. Where time went
    const time = [];
    DD.DO_TYPES.forEach((tp) => { const m = DD.sumMin(recs.filter((r) => r.card === 'do' && r.type === tp.id)); if (m) time.push([t(tp.label), m, 'var(--d-do)']); });
    [['chores', 'var(--d-chores)'], ['work', 'var(--d-work)'], ['gym', 'var(--d-gym)']].forEach(([c, col]) => { const m = DD.sumMin(recs.filter((r) => r.card === c)); if (m) time.push([DD.cardName(c), m, col]); });
    time.sort((a, b) => b[1] - a[1]);
    const tmax = Math.max(1, ...time.map((x) => x[1]));

    // 4. Gym
    const gymRecs = recs.filter((r) => r.card === 'gym');
    const allGym = st.records.filter((r) => r.card === 'gym').sort((a, b) => (a.start < b.start ? -1 : 1));
    const freq = {};
    allGym.forEach((r) => ((r.data && r.data.exercises) || []).forEach((e) => { if (e.sets.some((s) => s.kg > 0)) freq[e.exerciseId] = (freq[e.exerciseId] || 0) + 1; }));
    const topEx = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 3);
    if (!topEx.includes(DD.gymEx)) DD.gymEx = topEx[0] || null;
    const points = DD.gymEx ? allGym.map((r) => {
      const e = ((r.data && r.data.exercises) || []).find((x) => x.exerciseId === DD.gymEx);
      const kg = e ? Math.max(0, ...e.sets.map((s) => s.kg || 0)) : 0;
      return kg ? { v: kg, label: DD.fmtMD(DD.recDay(r)) } : null;
    }).filter(Boolean).slice(-12) : [];

    // 5. Learned
    const learned = DD.learnedLines(from, to);
    // 6. Watched / read
    const watched = recs.filter((r) => r.card === 'more' && r.type === 'watched').sort(DD.byStartDesc);

    const page = document.getElementById('page-insights');
    const emptyLine = (txt) => h('div', { class: 'muted', style: 'margin-top:12px;font-size:15px' }, txt);

    page.replaceChildren(
      pageHead(t('洞察'), 1),
      h('div', { class: 'col' },
        h('div', { class: 'ticket' },
          DD.seg([['week', t('本周')], ['month', t('本月')]], DD.period, (v) => { DD.period = v; renderInsights(); }),
          h('div', { style: 'margin-top:18px' }, h('h2', { class: 'sec-title' }, t('每天记了几条')), h('div', { class: 'sec-sub' }, t(DD.period === 'week' ? '最近 7 天共 {n} 条' : '本月共 {n} 条', { n: totalShown }))),
          svgEl(barChart(days)),
          h('div', { class: 'tear' }),
          h('h2', { class: 'sec-title' }, t('食物图鉴')),
          h('div', { class: 'sec-sub' }, t('{p} {n} 种', { p: pname, n: foods.size })),
          foods.size ? DD.FOOD_GROUPS.filter((g) => groups[g]).map((g) => h('div', { class: 'group' },
            h('div', { class: 'group-head' }, h('span', null, t(g)), h('span', null, t('{n} 种', { n: groups[g].length }))),
            h('div', { class: 'chips' }, groups[g].map((n) => h('span', { class: 'tag-chip' }, n))))) : emptyLine(t('记一餐，吃到的食物会收集在这里')),
          h('div', { class: 'tear' }),
          h('h2', { class: 'sec-title' }, t('时间去哪了')),
          h('div', { class: 'sec-sub' }, time.length ? t('{p}共 {dur}', { p: pname, dur: DD.fmtDur(time.reduce((a, x) => a + x[1], 0)) }) : pname),
          time.length ? time.map(([label, m, col]) => h('div', { class: 'hbar' }, h('span', null, label), h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.max(3, (m / tmax) * 100)}%;background:${col}` })), h('span', { class: 'v' }, DD.fmtDurShort(m)))) : emptyLine(t('记下时长或用计时，这里会显示时间分布'))),
        h('div', { class: 'ticket' },
          h('div', { class: 'sec-row' }, h('h2', { class: 'sec-title' }, DD.cardName('gym')), h('div', { class: 'muted' }, pname + ' ', h('span', { class: 'big-num', style: 'font-size:28px;color:var(--text)' }, gymRecs.length), ' ' + t('次', { n: gymRecs.length }))),
          topEx.length ? [
            DD.seg(topEx.map((id) => [id, DD.exName(id)]), DD.gymEx, (v) => { DD.gymEx = v; renderInsights(); }, 'sm'),
            h('div', { class: 'small muted', style: 'margin-top:10px' }, t('每次训练的最大重量（kg）')),
            points.length ? svgEl(lineChart(points)) : null,
          ] : emptyLine(t('记录动作和重量后，这里会画出变化')),
          h('div', { class: 'tear' }),
          h('h2', { class: 'sec-title' }, t('学到的 / 复盘')),
          learned.length ? h('ul', { class: 'lines' }, learned.slice(0, 30).map((l) => h('li', null, l.text, h('span', { class: 'src' }, `${l.src} · ${DD.fmtMD(DD.dayKey(l.start))}`)))) : emptyLine(t('工作卡里的「学到」、复盘、探索的发现会汇总在这里')),
          h('div', { class: 'tear' }),
          h('h2', { class: 'sec-title' }, t('看了 / 读了')),
          watched.length ? h('ul', { class: 'lines' }, watched.map((r) => h('li', null, DD.quote(r.data.title), h('span', { class: 'src' }, DD.join([r.data.kind && t(r.data.kind), DD.worthLabel(r.data.worth), DD.fmtMD(DD.recDay(r))]))))) : emptyLine(t('在「更多」里记下看过、读过的')))));
  }

  /* ---------- Settings ---------- */
  DD.openSettings = function () {
    let sheet;
    const rerender = () => sheet.setBody(renderSettings(rerender, sheet));
    sheet = DD.openSheet({ title: t('设置'), full: true, onClose: () => DD.render() });
    rerender();
  };

  function renderSettings(rerender, sheet) {
    const st = S(), set = st.settings;
    const commit = () => { DD.save(); rerender(); };
    const sec = (title, ...kids) => h('section', { class: 'set-sec' }, h('h3', null, title), ...kids);

    // Cards: rename + reorder
    const cardRows = set.cardOrder.map((id, i) => {
      const inp = h('input', { class: 'inp', value: DD.cardName(id), 'aria-label': t('卡片名称'), maxlength: '6' });
      inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v || v === DD.CARD_DEFAULT_NAMES[id] || v === t(DD.CARD_DEFAULT_NAMES[id])) delete set.cardNames[id]; else set.cardNames[id] = v; DD.save(); });
      const move = (dir) => { const o = set.cardOrder; const j = i + dir; [o[i], o[j]] = [o[j], o[i]]; commit(); };
      return h('div', { class: 'set-item' }, h('span', { class: 'rdot dot-' + id, style: 'width:12px;height:12px;border-radius:50%;flex:0 0 auto' }), inp,
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': t('上移'), disabled: i === 0, onClick: () => move(-1) }, '↑'),
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': t('下移'), disabled: i === set.cardOrder.length - 1, onClick: () => move(1) }, '↓'));
    });

    // Foods
    const foodNames = Object.keys(st.foods).sort((a, b) => a.localeCompare(b, 'zh'));
    const foodRows = foodNames.map((n) => {
      const sel = h('select', { class: 'inp', style: 'width:auto;min-width:110px', 'aria-label': t('{n} 的分类', { n }) }, DD.FOOD_GROUPS.map((g) => h('option', { value: g, selected: st.foods[n].group === g ? true : null }, t(g))));
      sel.addEventListener('change', () => {
        st.foods[n].group = sel.value;
        st.records.forEach((r) => { if (r.card === 'meal') ((r.data && r.data.items) || []).forEach((i) => { if (i.food === n) i.group = sel.value; }); });
        DD.save();
      });
      return h('div', { class: 'set-item' }, h('span', null, n), sel);
    });

    // Exercises: rename / merge
    const exIds = Object.keys(st.exercises);
    const exRows = exIds.map((id) => {
      const inp = h('input', { class: 'inp', value: st.exercises[id].name, 'aria-label': t('动作名称') });
      inp.addEventListener('change', () => { const v = inp.value.trim(); if (v) { st.exercises[id].name = v; DD.save(); } });
      const merge = h('select', { class: 'inp', style: 'width:auto;max-width:130px', 'aria-label': t('合并到') }, h('option', { value: '' }, t('合并到…')), exIds.filter((x) => x !== id).map((x) => h('option', { value: x }, st.exercises[x].name)));
      merge.addEventListener('change', () => {
        const to = merge.value;
        if (!to) return;
        if (!DD.ask(t('把「{a}」的记录都合并到「{b}」？', { a: st.exercises[id].name, b: st.exercises[to].name }))) { merge.value = ''; return; }
        st.records.forEach((r) => { if (r.card === 'gym') ((r.data && r.data.exercises) || []).forEach((e) => { if (e.exerciseId === id) e.exerciseId = to; }); });
        delete st.exercises[id];
        commit();
      });
      return h('div', { class: 'set-item' }, inp, merge);
    });

    // Chores chips
    const choreChips = h('div', { class: 'chips', style: 'padding:10px 0' }, set.choreChips.map((c) => h('button', { type: 'button', class: 'chip sm', onClick: () => { if (DD.ask(t('从选项里去掉「{c}」？以前的记录不受影响。', { c: t(c) }))) { set.choreChips = set.choreChips.filter((x) => x !== c); commit(); } } }, t(c), h('span', { class: 'x' }, '×'))));

    const dayStart = h('input', { class: 'inp', type: 'time', value: set.dayStart, style: 'width:auto' });
    dayStart.addEventListener('change', () => { if (/^\d{2}:\d{2}$/.test(dayStart.value)) { set.dayStart = dayStart.value; DD.save(); } });

    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    fileIn.addEventListener('change', () => { const f = fileIn.files[0]; if (f) importFile(f, rerender); fileIn.value = ''; });

    return [
      sec(t('外观'), DD.seg([['system', t('跟随系统')], ['day', t('日间')], ['night', t('夜间')]], set.theme, (v) => { set.theme = v; DD.save(); DD.applyTheme(); rerender(); })),
      sec(t('语言'), DD.seg([['zh', '中文'], ['en', 'English']], DD.lang(), (v) => { DD.setLang(v); DD.render(); sheet.setTitle(t('设置')); rerender(); })),
      sec(t('一天从几点开始'), h('div', { class: 'set-list' }, h('div', { class: 'set-item' }, h('span', null, t('这个时间之前的记录算前一天')), dayStart))),
      sec(t('卡片（改名、排序）'), h('div', { class: 'set-list' }, cardRows)),
      sec(t('做事的类型'), h('div', { class: 'set-list', style: 'padding:10px 14px' }, DD.chips(DD.DO_TYPES.map((x) => [x.id, t(x.label)]), set.doTypes, (v) => { if (!v.length) return DD.toast(t('至少留一个')); set.doTypes = DD.DO_TYPES.map((x) => x.id).filter((x) => v.includes(x)); commit(); }, { multi: true, small: true }), h('div', { class: 'hint' }, t('亮着的会出现在「做事」卡里。')))),
      sec(t('家务选项'), h('div', { class: 'set-list' }, choreChips, h('div', { class: 'hint', style: 'margin:0 0 10px' }, t('在家务卡里可以直接加新的选项。')))),
      sec(t('更多里的类型'), h('div', { class: 'set-list', style: 'padding:10px 14px' }, DD.chips(DD.MORE_TYPES.map(([v, l]) => [v, t(l)]), set.moreTypes, (v) => { if (!v.length) return DD.toast(t('至少留一个')); set.moreTypes = DD.MORE_TYPES.map((x) => x[0]).filter((x) => v.includes(x)); commit(); }, { multi: true, small: true }))),
      sec(t('食物分类'), foodRows.length ? h('div', { class: 'set-list' }, foodRows) : h('div', { class: 'hint' }, t('记过的食物会出现在这里，可以改分类。'))),
      sec(t('动作'), exRows.length ? h('div', { class: 'set-list' }, exRows) : h('div', { class: 'hint' }, t('记过的健身动作会出现在这里，可以改名或合并重复的。'))),
      sec(t('数据'),
        h('div', { class: 'hint', style: 'margin:0 0 6px' }, t('现在有 {n} 条记录，只存在这台设备的这个浏览器里。', { n: st.records.length })),
        h('button', { type: 'button', class: 'wide-btn', onClick: exportData }, t('导出全部数据（JSON）')),
        h('button', { type: 'button', class: 'wide-btn', onClick: () => fileIn.click() }, t('导入 JSON…')), fileIn,
        h('button', { type: 'button', class: 'wide-btn danger', onClick: () => {
          if (!st.records.length && !Object.keys(st.foods).length) return DD.toast(t('现在没有数据'));
          if (!DD.ask(t('删除全部记录、食物和动作？建议先导出一份。'))) return;
          if (!DD.ask(t('再确认一次：删除后不能恢复。'))) return;
          const theme = set.theme;
          DD.state = DD.defaultState(); DD.state.settings.theme = theme; DD.save(); rerender(); DD.toast(t('已清空'));
        } }, t('删除全部数据'))),
      sec(t('关于'), h('div', { class: 'set-list' },
        h('div', { class: 'set-item' }, h('span', null, t('名称')), h('span', { class: 'muted' }, DD.APP_NAME + t('（暂名）'))),
        h('div', { class: 'set-item' }, h('span', null, t('版本')), h('span', { class: 'muted' }, DD.VERSION)),
        h('div', { class: 'set-item' }, h('span', null, t('数据格式')), h('span', { class: 'muted' }, 'schemaVersion ' + DD.SCHEMA)))),
    ];
  }

  function exportData() {
    const text = JSON.stringify(DD.state, null, 2);
    const name = `day-deck-${DD.todayKey()}.json`;
    const file = (() => { try { return new File([text], name, { type: 'application/json' }); } catch (e) { return null; } })();
    // On phones the share sheet is the reliable way to save a file ("存储到文件").
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.maxTouchPoints > 0) {
      navigator.share({ files: [file], title: name }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    DD.toast(t('已导出 {name}', { name }));
  }

  function importFile(file, rerender) {
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(reader.result); } catch (e) { return DD.toast(t('这个文件不是有效的 JSON')); }
      const errs = DD.validate(obj);
      if (errs.length) { window.alert(t('不能导入：') + '\n' + errs.join('\n')); return; }
      const keys = obj.records.map((r) => DD.dayKey(r.start)).sort();
      const summary = obj.records.length ? t('文件里有 {n} 条记录（{a} 到 {b}）', { n: obj.records.length, a: keys[0], b: keys[keys.length - 1] }) : t('文件里没有记录');
      if (!DD.ask(t('{summary}。\n用它替换现在的 {n} 条记录？', { summary, n: DD.state.records.length }))) return;
      DD.state = DD.normalize(obj);
      DD.save(); DD.applyTheme(); rerender(); DD.toast(t('导入好了'));
    };
    reader.readAsText(file);
  }

  /* ---------- Render all ---------- */
  DD.render = function () {
    renderRecord();
    renderInsights();
    renderDeck();
  };
  DD.renderDeck = renderDeck;
})();
