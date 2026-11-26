'use strict';
/* Day Deck core: constants, storage, dates, record descriptions, card faces, notes and insight numbers.
   No DOM here. Everything hangs off window.DD so the app also runs from file:// without modules. */
(function () {
  const DD = (window.DD = window.DD || {});

  DD.APP_NAME = 'Day Deck'; // placeholder name: change it here (and in index.html / manifest)
  DD.VERSION = '0.1.0-demo';
  DD.SCHEMA = 1;
  const KEY = 'daydeck.v1';
  DD.STORAGE_KEY = KEY;

  DD.CARD_IDS = ['meal', 'gym', 'do', 'chores', 'work', 'more'];
  DD.CARD_DEFAULT_NAMES = { meal: '吃饭', gym: '健身', do: '做事', chores: '家务', work: '工作', more: '更多' };
  DD.TIMER_CARDS = ['gym', 'do', 'chores', 'work'];
  DD.MEAL_TYPES = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐']];
  DD.FOOD_GROUPS = ['蛋白质', '蔬菜', '水果', '主食', '奶豆', '坚果种子', '其他'];
  DD.PORTIONS = ['小', '中', '大'];
  DD.GYM_FOCUS = ['推', '拉', '腿', '全身', '有氧'];
  DD.DO_TYPES = [
    { id: 'explore', label: '探索', prompt: '发现了什么？' },
    { id: 'writing', label: '写作', prompt: '推进了什么？' },
    { id: 'social', label: '社交', prompt: '和谁？下一步？' },
    { id: 'self', label: '取悦自己', prompt: '做了什么？' },
    { id: 'admin', label: '生活 admin', prompt: '处理了什么？' },
  ];
  DD.DEFAULT_CHORES = ['收拾', '洗衣服', '做饭', '清洁', '采购'];
  DD.WATCH_KINDS = ['书', '剧', '电影', '播客', '展', '游戏'];
  DD.MORE_TYPES = [['spend', '花销'], ['watched', '看了 / 读了'], ['note', '自由记录']];
  // Words that must never appear in an encouraging note.
  DD.BANNED = ['没有', '还没', '天没', '断了', '落后', '应该', '必须'];

  /* ---------------- State and storage ---------------- */

  DD.defaultSettings = () => ({
    dayStart: '04:00',
    theme: 'system',
    cardOrder: DD.CARD_IDS.slice(),
    cardNames: {},
    doTypes: DD.DO_TYPES.map((t) => t.id),
    choreChips: DD.DEFAULT_CHORES.slice(),
    moreTypes: DD.MORE_TYPES.map((t) => t[0]),
  });

  DD.defaultState = () => ({
    schemaVersion: DD.SCHEMA,
    settings: DD.defaultSettings(),
    foods: {},
    exercises: {},
    projects: {},
    records: [],
    timer: null,
  });

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // Fill in anything missing so older or imported data always has the full shape.
  DD.normalize = function (obj) {
    const s = DD.defaultState();
    const out = Object.assign(s, obj);
    out.settings = Object.assign(DD.defaultSettings(), isObj(obj.settings) ? obj.settings : {});
    const st = out.settings;
    const order = Array.isArray(st.cardOrder) ? st.cardOrder.filter((c) => DD.CARD_IDS.includes(c)) : [];
    DD.CARD_IDS.forEach((c) => { if (!order.includes(c)) order.push(c); });
    st.cardOrder = order;
    if (!isObj(st.cardNames)) st.cardNames = {};
    if (!Array.isArray(st.doTypes)) st.doTypes = DD.DO_TYPES.map((t) => t.id);
    if (!Array.isArray(st.choreChips)) st.choreChips = DD.DEFAULT_CHORES.slice();
    if (!Array.isArray(st.moreTypes)) st.moreTypes = DD.MORE_TYPES.map((t) => t[0]);
    if (!/^\d{2}:\d{2}$/.test(st.dayStart)) st.dayStart = '04:00';
    ['foods', 'exercises', 'projects'].forEach((k) => { if (!isObj(out[k])) out[k] = {}; });
    if (!Array.isArray(out.records)) out.records = [];
    if (!isObj(out.timer)) out.timer = null;
    return out;
  };

  // Returns problems found in a candidate data object (used by import). Empty array = valid.
  DD.validate = function (obj) {
    const errs = [];
    const t = DD.t;
    if (!isObj(obj)) return [t('不是一个数据对象')];
    if (obj.schemaVersion !== DD.SCHEMA) errs.push(t('schemaVersion 应为 {a}，文件里是 {b}', { a: DD.SCHEMA, b: obj.schemaVersion }));
    if (!Array.isArray(obj.records)) errs.push(t('缺少 records 列表'));
    else {
      const ids = new Set();
      obj.records.forEach((r, i) => {
        if (!isObj(r)) { errs.push(t('第 {n} 条记录格式不对', { n: i + 1 })); return; }
        if (!r.id || ids.has(r.id)) errs.push(t('第 {n} 条记录的 id 缺失或重复', { n: i + 1 }));
        ids.add(r.id);
        if (!DD.CARD_IDS.includes(r.card)) errs.push(t('第 {n} 条记录的卡片类型未知：{c}', { n: i + 1, c: r.card }));
        if (!DD.parseLocal(r.start)) errs.push(t('第 {n} 条记录的时间读不出来', { n: i + 1 }));
      });
    }
    return errs.slice(0, 8);
  };

  DD.load = function () {
    DD.loadWarning = '';
    DD.saveBlocked = false;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {
      DD.loadWarning = DD.t('这个浏览器现在不能保存数据（可能是无痕模式）。记录在关闭页面后会丢失。');
    }
    if (!raw) { DD.state = DD.defaultState(); return; }
    try {
      const obj = JSON.parse(raw);
      if (!isObj(obj) || obj.schemaVersion !== DD.SCHEMA) throw new Error('unexpected shape');
      DD.state = DD.normalize(obj);
    } catch (e) {
      // Never overwrite a copy we cannot read: keep it under a backup key first.
      const bk = KEY + '.unreadable.' + Date.now();
      try {
        localStorage.setItem(bk, raw);
        DD.loadWarning = DD.t('保存的数据读不出来，原样备份在 {k}。现在从空白开始。', { k: bk });
      } catch (e2) {
        DD.saveBlocked = true;
        DD.loadWarning = DD.t('保存的数据读不出来，也没法备份。为了不覆盖它，这次的改动不会保存。');
      }
      DD.state = DD.defaultState();
    }
  };

  DD.save = function () {
    if (DD.saveBlocked) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(DD.state));
      return true;
    } catch (e) {
      if (DD.toast) DD.toast(DD.t('保存失败：浏览器存储可能满了或被禁用'));
      return false;
    }
  };

  DD.uid = (p = 'r') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  /* ---------------- Dates (local time, no zones) ---------------- */

  const pad = (n) => String(n).padStart(2, '0');
  DD.pad = pad;
  DD.toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  DD.parseLocal = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d) ? null : d;
  };
  DD.nowLocal = () => DD.toLocal(new Date());
  DD.calKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayStartMin = () => {
    const [h, m] = ((DD.state && DD.state.settings.dayStart) || '04:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  // The "day" a moment belongs to: before dayStart (default 04:00) counts as the previous day.
  DD.dayKey = (v) => {
    const d = typeof v === 'string' ? DD.parseLocal(v) : v;
    if (!d) return '';
    if (d.getHours() * 60 + d.getMinutes() < dayStartMin()) return DD.calKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12));
    return DD.calKey(d);
  };
  DD.keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  DD.addDays = (k, n) => { const d = DD.keyToDate(k); d.setDate(d.getDate() + n); return DD.calKey(d); };
  DD.todayKey = () => DD.dayKey(new Date());
  DD.weekStartKey = (k) => DD.addDays(k, -((DD.keyToDate(k).getDay() + 6) % 7)); // Monday
  DD.monthStartKey = (k) => k.slice(0, 8) + '01';
  DD.monthEndKey = (k) => { const d = DD.keyToDate(k); return DD.calKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
  DD.WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const en = () => DD.lang() === 'en';
  DD.weekday = (d) => (en() ? WEEKDAYS_EN : DD.WEEKDAYS)[d.getDay()];
  DD.fmtHM = (v) => { const d = typeof v === 'string' ? DD.parseLocal(v) : v; return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
  DD.fmtDate = (k) => { const d = DD.keyToDate(k); return en() ? `${d.getDate()} ${MONTHS_EN[d.getMonth()]}` : `${d.getMonth() + 1}月${d.getDate()}日`; };
  DD.fmtDayLong = (k) => `${DD.weekday(DD.keyToDate(k))} · ${DD.fmtDate(k)}`;
  DD.fmtMD = (k) => { const d = DD.keyToDate(k); return en() ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getMonth() + 1}/${d.getDate()}`; };
  DD.fmtDur = (m) => {
    m = Math.round(m || 0);
    const [H, M] = en() ? [' h', ' min'] : [' 小时', ' 分钟'];
    if (m < 60) return `${m}${M}`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}${H} ${r}${M}` : `${h}${H}`;
  };
  DD.fmtDurShort = (m) => { m = Math.round(m || 0); return m < 60 ? `${m}m` : `${Math.round((m / 60) * 10) / 10}h`; };
  // short: drop the hours while under an hour ("12:31"), for the narrow card faces.
  DD.fmtElapsed = (ms, short) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (short && s < 3600) return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };
  // "12:40" if today, "周二" within the last week, else "11/12".
  DD.fmtWhen = (start) => {
    const k = DD.dayKey(start), t = DD.todayKey();
    if (k === t) return DD.fmtHM(start);
    if (k >= DD.addDays(t, -6)) return DD.weekday(DD.keyToDate(k));
    return DD.fmtMD(k);
  };

  /* ---------------- Records ---------------- */

  DD.recDay = (r) => DD.dayKey(r.start);
  DD.recordsBetween = (from, to) => DD.state.records.filter((r) => { const k = DD.recDay(r); return k >= from && k <= to; });
  DD.byStartDesc = (a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0);
  DD.cardName = (id) => (DD.state.settings.cardNames || {})[id] || DD.t(DD.CARD_DEFAULT_NAMES[id]);
  DD.doType = (id) => DD.DO_TYPES.find((t) => t.id === id) || { id, label: id, prompt: '备注' };
  DD.exName = (id) => (DD.state.exercises[id] || {}).name || DD.t('动作');
  DD.projName = (id) => (DD.state.projects[id] || {}).name || DD.t('项目');
  DD.lastOfCard = (card, pred) => DD.state.records.filter((r) => r.card === card && (!pred || pred(r))).sort(DD.byStartDesc)[0] || null;

  DD.upsertRecord = function (rec) {
    const now = DD.nowLocal();
    const i = DD.state.records.findIndex((r) => r.id === rec.id);
    if (i >= 0) DD.state.records[i] = Object.assign({}, DD.state.records[i], rec, { updated: now });
    else DD.state.records.push(Object.assign({ id: DD.uid(), end: null, minutes: null, data: {}, note: '', source: 'manual', sample: false, created: now }, rec, { updated: now }));
    DD.save();
  };
  DD.deleteRecord = function (id) {
    DD.state.records = DD.state.records.filter((r) => r.id !== id);
    DD.save();
  };

  const join = (parts, sep = ' · ') => parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== '').join(sep);
  DD.join = join;
  const watchVerb = (kind) => DD.t({ 书: '读了', 播客: '听了', 游戏: '玩了' }[kind] || '看了');
  DD.watchVerb = watchVerb;
  const fmtAmount = (a) => (a == null || a === '' ? '' : Number(a).toFixed(2).replace(/\.00$/, ''));
  DD.listSep = () => (en() ? ', ' : '、');
  DD.quote = (title) => (en() ? `“${title}”` : `《${title}》`);
  const worthLabel = (w) => (w == null ? '' : DD.t(w ? '值得' : '不太值'));
  DD.worthLabel = worthLabel;

  // Title and grey detail line for a timeline row. Built-in labels are translated; what the user typed is not.
  DD.describe = function (r) {
    const t = DD.t, cn = DD.cardName(r.card), d = r.data || {}, sep = DD.listSep();
    const dur = r.minutes ? DD.fmtDur(r.minutes) : '';
    switch (r.card) {
      case 'meal': {
        const mt = (DD.MEAL_TYPES.find((x) => x[0] === r.type) || [])[1];
        return { title: join([cn, mt && t(mt)]), detail: join([(d.items || []).map((i) => i.food).join(sep), r.note]) };
      }
      case 'gym': {
        const ex = (d.exercises || []).map((e) => `${DD.exName(e.exerciseId)} ${t('{n} 组', { n: e.sets.length })}`).join(' · ');
        return { title: join([cn, d.focus && t(d.focus), dur]), detail: join([ex, r.note]) };
      }
      case 'do': {
        let k = t(DD.doType(r.type).label);
        if (r.type === 'writing' && d.projectId) k += ' · ' + DD.projName(d.projectId);
        if (r.type === 'social' && d.with) k += ' · ' + t(d.with === 'career' ? '工作与职业' : '朋友');
        return { title: join([cn, k, dur]), detail: join([r.type === 'self' ? worthLabel(d.worth) : '', r.note]) };
      }
      case 'chores':
        return { title: join([cn, (d.chores || []).map((c) => t(c)).join(sep)]), detail: join([dur, r.note]) };
      case 'work':
        if (r.type === 'review') return { title: t('复盘'), detail: join([d.done, d.learned, d.next], ' / ') };
        return { title: join([cn, t(r.type === 'did' ? '做了' : '学到'), dur]), detail: d.text || '' };
      case 'more':
        if (r.type === 'spend') return { title: join([t('花销'), fmtAmount(d.amount)]), detail: r.note };
        if (r.type === 'watched') {
          const book = d.kind === '书';
          const done = d.finished == null ? '' : t(d.finished ? (book ? '读完了' : '看完了') : (book ? '在读' : '在看'));
          return { title: join([watchVerb(d.kind), d.title ? DD.quote(d.title) : '']), detail: join([d.kind && t(d.kind), done, worthLabel(d.worth)]) };
        }
        return { title: t('自由记录'), detail: r.note };
    }
    return { title: cn, detail: r.note || '' };
  };

  DD.timerLabel = function (tm) {
    if (!tm) return '';
    if (tm.card === 'do') return join([DD.cardName('do'), DD.t(DD.doType(tm.type).label)]);
    if (tm.card === 'work') return join([DD.cardName('work'), DD.t(tm.type === 'did' ? '做了' : '学到')]);
    return DD.cardName(tm.card);
  };

  /* ---------------- Helpers for counting ---------------- */

  const sumMin = (rs) => rs.reduce((a, r) => a + (r.minutes || 0), 0);
  DD.sumMin = sumMin;
  DD.distinctFoods = (rs) => {
    const m = new Map();
    rs.filter((r) => r.card === 'meal').forEach((r) => ((r.data && r.data.items) || []).forEach((i) => {
      const name = (i.food || '').trim();
      if (name && !m.has(name)) m.set(name, i.group || (DD.state.foods[name] || {}).group || '其他');
    }));
    return m; // name -> group
  };
  DD.groupCounts = (foodMap) => { const g = {}; foodMap.forEach((grp) => { g[grp] = (g[grp] || 0) + 1; }); return g; };
  // Highest weight per exercise across the given gym records.
  DD.topWeights = (rs) => {
    const m = {};
    rs.filter((r) => r.card === 'gym').forEach((r) => ((r.data && r.data.exercises) || []).forEach((e) => e.sets.forEach((s) => {
      if (s.kg > 0) m[e.exerciseId] = Math.max(m[e.exerciseId] || 0, s.kg);
    })));
    return m;
  };
  // Learned lines: 复盘 "学到了什么", 工作 "学到", 探索 "发现了什么". Newest first.
  DD.learnedLines = (from, to) => {
    const out = [];
    DD.recordsBetween(from, to).forEach((r) => {
      if (r.card === 'work' && r.type === 'review' && r.data && r.data.learned) {
        r.data.learned.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((t) => out.push({ text: t, src: DD.t('复盘'), start: r.start }));
      } else if (r.card === 'work' && r.type === 'learned' && r.data && r.data.text) {
        out.push({ text: r.data.text, src: DD.cardName('work'), start: r.start });
      } else if (r.card === 'do' && r.type === 'explore' && r.note) {
        out.push({ text: r.note, src: DD.t('探索'), start: r.start });
      }
    });
    return out.sort((a, b) => (a.start < b.start ? 1 : -1));
  };

  /* ---------------- Card faces ---------------- */

  // A face: small header (last record, or a running timer), then a label, a big number with its unit, and one small line.
  DD.cardFace = function (id) {
    const t = DD.t, S = DD.state, tk = DD.todayKey(), ws = DD.weekStartKey(tk), ms = DD.monthStartKey(tk);
    const mine = (from) => DD.recordsBetween(from, tk).filter((r) => r.card === id);
    const today = mine(tk), week = mine(ws), month = mine(ms);
    const last = DD.lastOfCard(id);
    const face = { head: last ? t('{when} 记录', { when: DD.fmtWhen(last.start) }) : '', label: '', num: null, unit: '', sub: '' };
    if (S.timer && S.timer.card === id) face.timer = S.timer.start;
    const big = (label, n, unit) => { face.label = label; face.num = n; face.unit = t(unit, { n }); };
    switch (id) {
      case 'meal': {
        const foods = DD.distinctFoods(DD.recordsBetween(ws, tk)).size;
        if (today.length) big(t('今天'), today.length, '餐'); else face.label = t('记下吃了什么');
        if (foods) face.sub = t('本周 {n} 种食物', { n: foods });
        break;
      }
      case 'gym': {
        if (month.length) big(t('本月'), month.length, '次'); else face.label = t('练了什么、几组');
        if (last) {
          const focus = last.data && last.data.focus;
          const what = focus ? t(focus) : ((last.data && last.data.exercises) || []).slice(0, 1).map((e) => DD.exName(e.exerciseId))[0];
          if (what) face.sub = t('上次 {what}', { what });
        }
        break;
      }
      case 'do': {
        const mins = sumMin(today);
        const by = {};
        today.forEach((r) => { by[r.type] = (by[r.type] || 0) + (r.minutes || 0) + 0.001; });
        const top = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 2);
        if (today.length) {
          if (mins >= 60) big(t('今天'), Math.round((mins / 60) * 10) / 10, '小时');
          else if (mins) big(t('今天'), mins, '分钟');
          else big(t('今天'), today.length, '件');
          face.sub = top.map((k) => t(DD.doType(k).label)).join(' · ');
        } else if (week.length) {
          big(t('本周'), week.length, '件');
        } else face.label = t('探索、写作、社交');
        break;
      }
      case 'chores': {
        const names = [...new Set(today.flatMap((r) => (r.data && r.data.chores) || []))];
        if (week.length) big(t('本周'), week.length, '次'); else face.label = t('收拾、洗衣服、做饭');
        if (names.length) face.sub = t('今天 {what}', { what: names.slice(0, 2).map((c) => t(c)).join(' · ') });
        break;
      }
      case 'work': {
        const learned = today.filter((r) => r.type === 'learned').length;
        const did = today.filter((r) => r.type === 'did').length;
        if (learned) big(t('今天学到'), learned, '条');
        else if (did) big(t('今天做了'), did, '件');
        else face.label = t('学到了什么、复盘');
        if (today.some((r) => r.type === 'review')) face.sub = t('复盘写好了');
        break;
      }
      case 'more':
        face.head = '';
        face.label = t('花销、看了什么、读了什么');
        break;
    }
    return face;
  };

  /* ---------------- Encouraging notes (positive only) ---------------- */

  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const round1 = (x) => Math.round(x * 10) / 10;

  // Words that must never appear in an English note either.
  DD.BANNED_EN = ["haven't", "didn't", 'missed', 'should', 'must', 'behind', 'streak', 'only '];
  DD.isPositive = (text) => !DD.BANNED.some((w) => text.includes(w)) && !DD.BANNED_EN.some((w) => text.toLowerCase().includes(w));

  DD.computeNotes = function () {
    const t = DD.t;
    const tk = DD.todayKey(), ws = DD.weekStartKey(tk), ms = DD.monthStartKey(tk);
    const week = DD.recordsBetween(ws, tk), month = DD.recordsBetween(ms, tk);
    const pEnd = DD.addDays(ms, -1), prevMonth = DD.recordsBetween(DD.monthStartKey(pEnd), pEnd);
    const c = [];
    const add = (id, p, text) => c.push({ id, p, text });

    const gymM = month.filter((r) => r.card === 'gym').length;
    if (gymM) add('gym', 3, t('这个月去了 {n} 次健身房', { n: gymM }));

    const tM = DD.topWeights(month), tP = DD.topWeights(prevMonth);
    Object.keys(tM).forEach((id) => { if (tP[id] && tM[id] > tP[id]) add('ex_' + id, 4, t('{ex} 比上个月多了 {kg} kg', { ex: DD.exName(id), kg: round1(tM[id] - tP[id]) })); });

    const fw = DD.distinctFoods(week);
    if (fw.size) {
      let text = t('本周吃到了 {n} 种食物', { n: fw.size });
      if (fw.size >= 4) {
        const g = DD.groupCounts(fw);
        const thin = ['蔬菜', '水果', '蛋白质'].filter((x) => (g[x] || 0) < 2).sort((a, b) => (g[a] || 0) - (g[b] || 0))[0];
        if (thin) text += t('，可以多加几种{group}', { group: t(thin) });
      }
      add('foodW', 3, text);
    }
    const gm = DD.groupCounts(DD.distinctFoods(month));
    if ((gm['蛋白质'] || 0) >= 2) add('protein', 2, t('这个月已经吃了 {n} 种蛋白质', { n: gm['蛋白质'] }) + ((gm['蔬菜'] || 0) < gm['蛋白质'] ? t('，可以增加一些蔬菜的种类') : ''));

    const wr = week.filter((r) => r.card === 'do' && r.type === 'writing');
    if (wr.length) {
      const byP = {};
      wr.forEach((r) => { const p = r.data && r.data.projectId; if (p) byP[p] = (byP[p] || 0) + 1; });
      const topP = Object.keys(byP).sort((a, b) => byP[b] - byP[a])[0];
      let text = sumMin(wr) ? t('本周写作 {dur}', { dur: DD.fmtDur(sumMin(wr)) }) : t('本周写作了 {n} 次', { n: wr.length });
      if (topP) text += t('，{p}推进了 {n} 次', { p: DD.projName(topP), n: byP[topP] });
      add('writing', 3, text);
    }
    const ex = week.filter((r) => r.card === 'do' && r.type === 'explore');
    if (ex.length) add('explore', 2, sumMin(ex) ? t('本周探索了 {dur}', { dur: DD.fmtDur(sumMin(ex)) }) : t('本周探索了 {n} 次', { n: ex.length }));
    const ch = week.filter((r) => r.card === 'chores').length;
    if (ch) add('chores', 2, t('这周已经做了 {n} 次家务', { n: ch }));
    const ln = DD.learnedLines(ws, tk).length;
    if (ln) add('learned', 3, t('本周记下了 {n} 条学到的东西', { n: ln }));
    const shows = month.filter((r) => r.card === 'more' && r.type === 'watched' && r.data && r.data.kind === '展').length;
    if (shows) add('shows', 2, t('这个月去看了 {n} 次展', { n: shows }));
    const self = month.filter((r) => r.card === 'do' && r.type === 'self').length;
    if (self) add('self', 2, t('这个月为自己安排了 {n} 件开心的事', { n: self }));
    const books = month.filter((r) => r.card === 'more' && r.type === 'watched' && r.data && r.data.kind === '书' && r.data.finished).length;
    if (books) add('books', 2, t('这个月读完了 {n} 本书', { n: books }));
    const tod = DD.recordsBetween(tk, tk).length;
    if (tod) add('today', 1, t('今天记下了 {n} 件事', { n: tod }));

    // Rotate: a per-day random nudge so the same note doesn't sit there for days.
    const picked = c.filter((n) => DD.isPositive(n.text))
      .map((n) => Object.assign(n, { score: n.p + hash(tk + n.id) * 2.5 }))
      .sort((a, b) => b.score - a.score).slice(0, 3).map((n) => n.text);
    return picked.length ? picked : [t('抽一张卡，记下今天的第一件事')];
  };
})();
