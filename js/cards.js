'use strict';
/* Day Deck card sheets: what opens when a card is drawn, or a timeline row is tapped. */
(function () {
  const DD = window.DD;
  const h = DD.h;
  const S = () => DD.state;

  const toInt = (v) => { const n = parseInt(v, 10); return n > 0 ? n : null; };
  const toNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const elapsedMin = (start) => Math.max(1, Math.round((Date.now() - DD.parseLocal(start).getTime()) / 60000));

  // Default time for a new record: now, or the same clock time on the day being viewed.
  function defaultStart() {
    const now = DD.nowLocal();
    const day = DD.selectedDay;
    if (!day || day === DD.todayKey()) return now;
    return day + now.slice(10);
  }

  /* ---------- Shared pieces ---------- */

  // Start time, plus an optional duration. Picking a duration moves the start back from "now"
  // until the user edits the time themselves.
  function whenFields(draft, rerender, withDuration, label) {
    const timeEl = h('input', { class: 'inp', type: 'datetime-local', value: DD.dtValue(draft.start) });
    timeEl.addEventListener('change', () => { const v = DD.fromDtValue(timeEl.value); if (v) { draft.start = v; draft.startTouched = true; } });
    const out = [DD.field(label || (withDuration ? '开始时间' : '时间'), timeEl)];
    if (!withDuration) return out;
    const setMinutes = (m) => {
      draft.minutes = m;
      if (!draft.startTouched && m) {
        const base = DD.parseLocal(draft.base);
        draft.start = DD.toLocal(new Date(base.getTime() - m * 60000));
        timeEl.value = DD.dtValue(draft.start);
      }
    };
    const minEl = h('input', { class: 'inp num', type: 'number', inputmode: 'numeric', min: '0', placeholder: '分钟', value: draft.minutes || '' });
    minEl.addEventListener('input', () => setMinutes(toInt(minEl.value)));
    const chipRow = DD.chips([15, 30, 60, 90].map((m) => [m, m < 60 ? `${m} 分钟` : `${m / 60} 小时`]), toInt(draft.minutes), (m) => { setMinutes(m); rerender(); }, { small: true, allowNone: true });
    chipRow.append(minEl);
    out.push(DD.field('多久', chipRow));
    return out;
  }

  // Timer controls inside a sheet.
  function timerBox(draft, ctx) {
    if (ctx.editing || !DD.TIMER_CARDS.includes(ctx.card)) return null;
    if (draft.running) {
      return h('div', { class: 'timer-box' },
        h('div', null, h('div', { class: 'small muted' }, `${DD.fmtHM(draft.start)} 开始 · 计时中`), h('div', { class: 'big', 'data-since': draft.start }, DD.fmtElapsed(Date.now() - DD.parseLocal(draft.start)))),
        h('div', { class: 'inp-row' },
          h('button', { type: 'button', class: 'pill-btn soft', onClick: () => {
            if (!DD.ask('放弃这次计时？不会保存记录。')) return;
            S().timer = null; DD.save(); DD.closeSheet(); DD.render();
          } }, '放弃'),
          h('button', { type: 'button', class: 'pill-btn', onClick: () => {
            draft.minutes = elapsedMin(draft.start); draft.running = false; draft.stopped = true; ctx.rerender();
          } }, '停止')));
    }
    if (draft.stopped) {
      return h('div', { class: 'timer-box' }, h('div', null, h('div', { class: 'small muted' }, '计时结束'), h('div', { class: 'big' }, DD.fmtDur(draft.minutes))), h('div', { class: 'small muted' }, '确认后点保存'));
    }
    return h('div', { class: 'timer-box' },
      h('div', { class: 'small muted', style: 'flex:1 1 160px' }, '现在开始做？先开始计时，做完再回来补充。'),
      h('button', { type: 'button', class: 'pill-btn', onClick: () => ctx.startTimer() }, '开始计时'));
  }

  const noteField = (draft, label, placeholder) => DD.field(label || '备注', DD.textInput(draft, 'note', { multiline: true, placeholder: placeholder || '可选' }));

  /* ---------- Card definitions ---------- */

  const MEAL_BY_HOUR = (hr) => (hr >= 4 && hr < 10.5 ? 'breakfast' : hr >= 10.5 && hr < 15 ? 'lunch' : hr >= 17 && hr < 21.5 ? 'dinner' : 'snack');

  const CARDS = {
    meal: {
      init(d, r) {
        if (r) { d.type = r.type; d.items = clone((r.data && r.data.items) || []); }
        else { const t = new Date(); d.type = MEAL_BY_HOUR(t.getHours() + t.getMinutes() / 60); d.items = []; }
        d.foodName = '';
      },
      render(d, ctx) {
        const st = S();
        const addFood = (name) => {
          name = (name || '').trim();
          if (!name) return;
          if (!d.items.some((i) => i.food === name)) d.items.push({ food: name, group: (st.foods[name] || {}).group || null, portion: null });
          d.foodName = '';
          ctx.rerender();
          setTimeout(() => { const el = ctx.body.querySelector('[data-food-input]'); if (el) el.focus(); }, 0);
        };
        const input = DD.textInput(d, 'foodName', { placeholder: '例如：鸡蛋', enterkeyhint: 'done', 'data-food-input': '1' });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFood(d.foodName); } });
        const recent = Object.keys(st.foods).filter((n) => !d.items.some((i) => i.food === n))
          .sort((a, b) => ((st.foods[b].lastUsed || '') > (st.foods[a].lastUsed || '') ? 1 : -1)).slice(0, 14);
        return [
          DD.seg(DD.MEAL_TYPES, d.type, (v) => { d.type = v; ctx.rerender(); }),
          DD.field('吃了什么',
            h('div', { class: 'inp-row' }, input, h('button', { type: 'button', class: 'add-btn', onClick: () => addFood(d.foodName) }, '添加')),
            recent.length ? h('div', { style: 'margin-top:10px' }, DD.chips(recent.map((n) => [n, '+ ' + n]), null, addFood, { small: true })) : null),
          d.items.map((it, idx) => h('div', { class: 'item' },
            h('div', { class: 'item-head' }, h('span', { class: 'item-name' }, it.food),
              h('button', { type: 'button', class: 'icon-x', 'aria-label': '移除', onClick: () => { d.items.splice(idx, 1); ctx.rerender(); } }, '×')),
            h('div', { class: 'small muted', style: 'margin-top:4px' }, it.group ? '' : '选一个分类（以后会记住）'),
            DD.chips(DD.FOOD_GROUPS, it.group, (g) => { it.group = g; ctx.rerender(); }, { small: true }),
            DD.chips(DD.PORTIONS.map((p) => [p, p + '份']), it.portion, (p) => { it.portion = p; ctx.rerender(); }, { small: true, allowNone: true }))),
          whenFields(d, ctx.rerender, false),
          noteField(d),
        ];
      },
      collect(d) {
        if (!d.items.length && !(d.note || '').trim()) return { error: '加一样吃的' };
        const items = d.items.map((i) => ({ food: i.food, group: i.group || '其他', portion: i.portion || null }));
        return { type: d.type, data: { items } };
      },
      afterSave(d, rec) {
        const now = DD.nowLocal();
        rec.data.items.forEach((i) => { S().foods[i.food] = { group: i.group, lastUsed: now }; });
      },
    },

    gym: {
      init(d, r) {
        d.exercises = r ? ((r.data && r.data.exercises) || []).map((e) => ({ name: DD.exName(e.exerciseId), sets: e.sets.map((s) => ({ kg: s.kg ?? '', reps: s.reps ?? '' })) })) : [];
        d.focus = r ? (r.data && r.data.focus) || null : null;
        d.exName = '';
        d.type = 'gym';
      },
      render(d, ctx) {
        const st = S();
        const last = ctx.editing ? null : DD.lastOfCard('gym', (r) => r.data && r.data.exercises && r.data.exercises.length);
        const findEx = (name) => Object.keys(st.exercises).find((id) => st.exercises[id].name.toLowerCase() === name.toLowerCase());
        const lastSets = (id) => {
          const r = DD.lastOfCard('gym', (x) => ((x.data && x.data.exercises) || []).some((e) => e.exerciseId === id));
          const e = r && r.data.exercises.find((x) => x.exerciseId === id);
          return e ? e.sets.map((s) => ({ kg: s.kg ?? '', reps: s.reps ?? '' })) : null;
        };
        const addEx = (name) => {
          name = (name || '').trim();
          if (!name || d.exercises.some((e) => e.name === name)) return;
          const id = findEx(name);
          d.exercises.push({ name: id ? st.exercises[id].name : name, sets: (id && lastSets(id)) || [{ kg: '', reps: '' }] });
          d.exName = '';
          ctx.rerender();
        };
        const input = DD.textInput(d, 'exName', { placeholder: '例如：深蹲', enterkeyhint: 'done' });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addEx(d.exName); } });
        const recent = Object.keys(st.exercises).filter((id) => !d.exercises.some((e) => e.name === st.exercises[id].name))
          .sort((a, b) => ((st.exercises[b].lastUsed || '') > (st.exercises[a].lastUsed || '') ? 1 : -1)).slice(0, 12);

        return [
          last && !d.exercises.length ? h('button', { type: 'button', class: 'sub-btn', style: 'width:100%;min-height:48px', onClick: () => {
            d.exercises = last.data.exercises.map((e) => ({ name: DD.exName(e.exerciseId), sets: e.sets.map((s) => ({ kg: s.kg ?? '', reps: s.reps ?? '' })) }));
            d.focus = last.data.focus || d.focus;
            ctx.rerender();
          } }, `照上次练（${DD.fmtWhen(last.start)}${last.data.focus ? ' · ' + last.data.focus : ''}）`) : null,
          timerBox(d, ctx),
          DD.field('练哪里', DD.chips(DD.GYM_FOCUS, d.focus, (v) => { d.focus = v; ctx.rerender(); }, { allowNone: true })),
          DD.field('动作',
            h('div', { class: 'inp-row' }, input, h('button', { type: 'button', class: 'add-btn', onClick: () => addEx(d.exName) }, '添加')),
            recent.length ? h('div', { style: 'margin-top:10px' }, DD.chips(recent.map((id) => [st.exercises[id].name, '+ ' + st.exercises[id].name]), null, addEx, { small: true })) : null),
          d.exercises.map((ex, ei) => h('div', { class: 'item' },
            h('div', { class: 'item-head' }, h('span', { class: 'item-name' }, ex.name),
              h('button', { type: 'button', class: 'icon-x', 'aria-label': '移除动作', onClick: () => { d.exercises.splice(ei, 1); ctx.rerender(); } }, '×')),
            ex.sets.map((s, si) => h('div', { class: 'set-row' },
              h('span', { class: 'n' }, `第${si + 1}组`),
              DD.textInput(s, 'kg', { type: 'text', inputmode: 'decimal', placeholder: 'kg', 'aria-label': 'kg' }),
              h('span', { class: 'times' }, '×'),
              DD.textInput(s, 'reps', { type: 'text', inputmode: 'numeric', placeholder: '次', 'aria-label': '次数' }),
              h('button', { type: 'button', class: 'icon-x', 'aria-label': '删除这组', onClick: () => { ex.sets.splice(si, 1); ctx.rerender(); } }, '×'))),
            h('button', { type: 'button', class: 'sub-btn', onClick: () => { const l = ex.sets[ex.sets.length - 1]; ex.sets.push(l ? { kg: l.kg, reps: l.reps } : { kg: '', reps: '' }); ctx.rerender(); } }, '+ 一组'))),
          whenFields(d, ctx.rerender, true),
          noteField(d),
        ];
      },
      collect(d) {
        const exs = d.exercises.filter((e) => e.name.trim());
        if (!exs.length && !toInt(d.minutes)) return { error: '加一个动作，或者填一下多久' };
        const st = S(), now = DD.nowLocal();
        const exercises = exs.map((e) => {
          let id = Object.keys(st.exercises).find((k) => st.exercises[k].name.toLowerCase() === e.name.trim().toLowerCase());
          if (!id) { id = DD.uid('ex'); st.exercises[id] = { name: e.name.trim() }; }
          st.exercises[id].lastUsed = now;
          const sets = e.sets.map((s) => ({ kg: toNum(s.kg), reps: toInt(s.reps) })).filter((s) => s.kg != null || s.reps != null);
          return { exerciseId: id, sets };
        });
        return { type: 'gym', data: { focus: d.focus || null, exercises } };
      },
    },

    do: {
      init(d, r) {
        const lastType = (DD.lastOfCard('do') || {}).type;
        d.type = r ? r.type : (lastType || 'explore');
        const dt = (r && r.data) || {};
        d.projectId = dt.projectId || null; d.with = dt.with || null; d.worth = dt.worth ?? null;
        d.newProject = '';
      },
      render(d, ctx) {
        const st = S();
        const types = DD.DO_TYPES.filter((t) => st.settings.doTypes.includes(t.id) || t.id === d.type);
        const out = [DD.field('做了什么', DD.chips(types.map((t) => [t.id, t.label]), d.type, (v) => { d.type = v; ctx.rerender(); }))];
        if (d.type === 'writing') {
          const addProject = () => {
            const name = d.newProject.trim();
            if (!name) return;
            let id = Object.keys(st.projects).find((k) => st.projects[k].name === name);
            if (!id) { id = DD.uid('pj'); st.projects[id] = { name }; DD.save(); }
            d.projectId = id; d.newProject = ''; ctx.rerender();
          };
          const inp = DD.textInput(d, 'newProject', { placeholder: '新项目名', enterkeyhint: 'done' });
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addProject(); } });
          out.push(DD.field('哪个项目',
            Object.keys(st.projects).length ? DD.chips(Object.keys(st.projects).map((id) => [id, st.projects[id].name]), d.projectId, (v) => { d.projectId = v; ctx.rerender(); }, { allowNone: true }) : null,
            h('div', { class: 'inp-row', style: 'margin-top:10px' }, inp, h('button', { type: 'button', class: 'add-btn', onClick: addProject }, '添加'))));
        }
        if (d.type === 'social') out.push(DD.field('和谁', DD.seg([['friends', '朋友'], ['career', '工作与职业']], d.with, (v) => { d.with = v; ctx.rerender(); }, 'sm', true)));
        out.push(timerBox(d, ctx));
        out.push(whenFields(d, ctx.rerender, true));
        if (d.type === 'self') out.push(DD.field('值得吗？', DD.seg([[true, '值得'], [false, '不太值']], d.worth, (v) => { d.worth = v; ctx.rerender(); }, 'sm', true)));
        out.push(noteField(d, DD.doType(d.type).prompt, '一句话就好'));
        return out;
      },
      collect(d) {
        const data = {};
        if (d.type === 'writing' && d.projectId) data.projectId = d.projectId;
        if (d.type === 'social' && d.with) data.with = d.with;
        if (d.type === 'self' && d.worth != null) data.worth = d.worth;
        return { type: d.type, data };
      },
    },

    chores: {
      init(d, r) { d.chores = r ? clone((r.data && r.data.chores) || []) : []; d.newChip = ''; d.type = 'chores'; },
      render(d, ctx) {
        const st = S();
        const all = [...new Set(st.settings.choreChips.concat(d.chores))];
        const addChip = () => {
          const name = d.newChip.trim();
          if (!name) return;
          if (!st.settings.choreChips.includes(name)) { st.settings.choreChips.push(name); DD.save(); }
          if (!d.chores.includes(name)) d.chores.push(name);
          d.newChip = ''; ctx.rerender();
        };
        const inp = DD.textInput(d, 'newChip', { placeholder: '自己加一项', enterkeyhint: 'done' });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(); } });
        return [
          DD.field('做了哪些（可多选）', DD.chips(all, d.chores, (v) => { d.chores = v; ctx.rerender(); }, { multi: true }),
            h('div', { class: 'inp-row', style: 'margin-top:10px' }, inp, h('button', { type: 'button', class: 'add-btn', onClick: addChip }, '添加'))),
          timerBox(d, ctx),
          whenFields(d, ctx.rerender, true),
          noteField(d),
        ];
      },
      collect(d) {
        if (!d.chores.length) return { error: '选一项家务' };
        return { type: 'chores', data: { chores: d.chores.slice() } };
      },
      afterSave(d, rec, ctx) {
        if (!ctx.editing && rec.data.chores.includes('做饭')) {
          setTimeout(() => DD.toast('做了饭，顺便记一下吃了什么？', { label: '记一餐', run: () => DD.openCardSheet('meal') }), 300);
        }
      },
    },

    work: {
      init(d, r) {
        d.tab = r && r.type === 'review' ? 'review' : 'log';
        d.kind = r && r.type !== 'review' ? r.type : 'learned';
        const dt = (r && r.data) || {};
        d.text = dt.text || '';
        // 复盘: one per day. Load the existing one for the day being viewed.
        d.reviewDay = r && r.type === 'review' ? DD.recDay(r) : (DD.selectedDay || DD.todayKey());
        const rev = r && r.type === 'review' ? r : S().records.find((x) => x.card === 'work' && x.type === 'review' && DD.recDay(x) === d.reviewDay);
        d.review = rev ? rev.id : null;
        d.done = rev ? rev.data.done || '' : ''; d.learned = rev ? rev.data.learned || '' : ''; d.next = rev ? rev.data.next || '' : '';
      },
      render(d, ctx) {
        const out = [];
        if (!ctx.editing && !d.running) out.push(DD.seg([['log', '学习 / 做了什么'], ['review', '复盘']], d.tab, (v) => { d.tab = v; ctx.setTitle(v === 'review' ? '复盘' : DD.cardName('work')); ctx.rerender(); }));
        if (d.tab === 'log') {
          d.type = d.kind;
          out.push(DD.field('类型', DD.chips([['learned', '学到'], ['did', '做了']], d.kind, (v) => { d.kind = v; d.type = v; ctx.rerender(); })));
          out.push(DD.field(d.kind === 'did' ? '做了什么？' : '学到了什么？', DD.textInput(d, 'text', { multiline: true, placeholder: '一句话就好' })));
          out.push(timerBox(d, ctx));
          out.push(whenFields(d, ctx.rerender, true));
          return out;
        }
        // 复盘 tab: the day's notes as reminders, then three short fields.
        const dayRecs = DD.recordsBetween(d.reviewDay, d.reviewDay).filter((r) => (r.card === 'do' && r.note) || (r.card === 'work' && r.type !== 'review' && r.data && r.data.text)).sort(DD.byStartDesc);
        if (dayRecs.length) {
          out.push(h('div', { class: 'reminders' }, h('div', { class: 'muted small' }, `${d.reviewDay === DD.todayKey() ? '今天' : DD.fmtDayLong(d.reviewDay)}记下的`),
            h('ul', null, dayRecs.slice(0, 8).map((r) => h('li', null, `${r.card === 'do' ? DD.doType(r.type).label : (r.type === 'did' ? '做了' : '学到')}：${r.card === 'do' ? r.note : r.data.text}`)))));
        }
        out.push(h('div', { class: 'hint' }, '工作和工作以外的都可以写，每项都可以空着。'));
        out.push(DD.field('今天做了什么', DD.textInput(d, 'done', { multiline: true })));
        out.push(DD.field('学到了什么', DD.textInput(d, 'learned', { multiline: true, placeholder: '一行一条' })));
        out.push(DD.field('明天要做什么', DD.textInput(d, 'next', { multiline: true })));
        return out;
      },
      collect(d) {
        if (d.tab === 'log') {
          if (!d.text.trim()) return { error: d.kind === 'did' ? '写一句做了什么' : '写一句学到了什么' };
          return { type: d.kind, data: { text: d.text.trim() } };
        }
        if (![d.done, d.learned, d.next].some((x) => (x || '').trim())) return { error: '至少写一项' };
        const existing = d.review && S().records.find((r) => r.id === d.review);
        const start = existing ? existing.start : (d.reviewDay === DD.todayKey() ? DD.nowLocal() : d.reviewDay + 'T21:00:00');
        return { id: d.review || undefined, type: 'review', start, minutes: null, data: { done: d.done.trim(), learned: d.learned.trim(), next: d.next.trim() } };
      },
    },

    more: {
      init(d, r) {
        const dt = (r && r.data) || {};
        d.type = r ? r.type : (S().settings.moreTypes[0] || 'spend');
        d.amount = dt.amount ?? ''; d.title = dt.title || ''; d.kind = dt.kind || '书';
        d.finished = dt.finished ?? null; d.worth = dt.worth ?? null;
      },
      render(d, ctx) {
        const st = S();
        const types = DD.MORE_TYPES.filter((t) => st.settings.moreTypes.includes(t[0]) || t[0] === d.type);
        const out = [];
        if (!ctx.editing) out.push(DD.seg(types, d.type, (v) => { d.type = v; ctx.rerender(); }));
        if (d.type === 'spend') {
          out.push(DD.field('多少钱', DD.textInput(d, 'amount', { inputmode: 'decimal', placeholder: '0.00' })));
          out.push(DD.field('花在哪', DD.textInput(d, 'note', { placeholder: '一句话（只是随手记，不做预算）' })));
        } else if (d.type === 'watched') {
          out.push(DD.field('什么', DD.chips(DD.WATCH_KINDS, d.kind, (v) => { d.kind = v; ctx.rerender(); }, { small: true })));
          out.push(DD.field('名字', DD.textInput(d, 'title', { placeholder: '书名、剧名、展名…' })));
          out.push(DD.field(d.kind === '书' ? '读完了吗？' : '看完了吗？', DD.seg([[true, d.kind === '书' ? '读完了' : '看完了'], [false, d.kind === '书' ? '在读' : '在看']], d.finished, (v) => { d.finished = v; ctx.rerender(); }, 'sm', true)));
          out.push(DD.field('值得吗？', DD.seg([[true, '值得'], [false, '不太值']], d.worth, (v) => { d.worth = v; ctx.rerender(); }, 'sm', true)));
          out.push(noteField(d, '想法'));
        } else {
          out.push(DD.field('写点什么', DD.textInput(d, 'note', { multiline: true, placeholder: '随便写', style: 'min-height:140px' })));
        }
        out.push(whenFields(d, ctx.rerender, false));
        return out;
      },
      collect(d) {
        if (d.type === 'spend') {
          const a = toNum(d.amount);
          if (a == null || a <= 0) return { error: '填一下金额' };
          return { type: 'spend', data: { amount: Math.round(a * 100) / 100 } };
        }
        if (d.type === 'watched') {
          if (!d.title.trim()) return { error: '填一下名字' };
          return { type: 'watched', data: { title: d.title.trim(), kind: d.kind, finished: d.finished, worth: d.worth } };
        }
        if (!(d.note || '').trim()) return { error: '写一点内容' };
        return { type: 'note', data: {} };
      },
    },
  };

  /* ---------- Saving a running timer from elsewhere ---------- */
  DD.finishTimer = function () {
    const t = S().timer;
    if (!t) return;
    const def = CARDS[t.card];
    const d = Object.assign({}, clone(t.draft || {}), { start: t.start, minutes: elapsedMin(t.start), startTouched: true });
    const res = def.collect(d, { editing: false, card: t.card });
    const rec = res.error
      ? { card: t.card, type: t.type, start: t.start, minutes: d.minutes, data: {}, note: (d.note || '').trim() }
      : Object.assign({ card: t.card, start: t.start, minutes: d.minutes, note: (d.note || '').trim() }, res);
    S().timer = null;
    DD.upsertRecord(rec);
    if (!res.error && def.afterSave) def.afterSave(d, rec, { editing: true });
    DD.save();
  };

  /* ---------- Open a card ---------- */
  DD.openCardSheet = function (card, record) {
    const st = S();
    const def = CARDS[card];
    const editing = !!record;
    const running = !editing && st.timer && st.timer.card === card ? st.timer : null;
    const base = defaultStart();
    let draft = { card, start: record ? record.start : base, base, startTouched: !!record, minutes: record ? record.minutes : null, note: record ? record.note || '' : '' };
    def.init(draft, record);
    if (running) {
      Object.assign(draft, clone(running.draft || {}), { start: running.start, startTouched: true, running: true, stopped: false });
      if (card === 'work') draft.tab = 'log';
    }

    let sheet;
    const ctx = {
      card, editing, record,
      rerender: () => sheet.setBody(render()),
      setTitle: (t) => sheet.setTitle(t),
      get body() { return sheet.body; },
      startTimer() {
        if (st.timer) {
          if (!DD.ask(`「${DD.timerLabel(st.timer)}」正在计时。先把它结束并保存，再开始新的？`)) return;
          DD.finishTimer();
        }
        const snap = clone(draft);
        delete snap.running; delete snap.stopped;
        st.timer = { card, type: draft.type, start: DD.nowLocal(), draft: snap };
        DD.save();
        DD.closeSheet();
        DD.render();
        DD.toast('开始计时了，做完点卡片结束');
      },
    };

    const render = () => {
      const nodes = [].concat(def.render(draft, ctx)).flat(Infinity).filter(Boolean);
      if (editing) nodes.push(h('button', { type: 'button', class: 'danger-btn', onClick: () => {
        if (!DD.ask('删除这条记录？')) return;
        DD.deleteRecord(record.id); DD.closeSheet(); DD.render(); DD.toast('删掉了');
      } }, '删除这条记录'));
      return nodes;
    };

    const save = () => {
      // Read any field the user typed into but didn't "add" yet.
      if (card === 'meal' && (draft.foodName || '').trim()) { const n = draft.foodName.trim(); if (!draft.items.some((i) => i.food === n)) draft.items.push({ food: n, group: (st.foods[n] || {}).group || null, portion: null }); draft.foodName = ''; }
      if (card === 'gym' && (draft.exName || '').trim()) { draft.exercises.push({ name: draft.exName.trim(), sets: [] }); draft.exName = ''; }
      if (draft.running) { draft.minutes = elapsedMin(draft.start); draft.running = false; }
      const res = def.collect(draft, ctx);
      if (res.error) { DD.toast(res.error); return; }
      const rec = Object.assign({ card, start: draft.start, minutes: toInt(draft.minutes), note: (draft.note || '').trim() }, res);
      if (record) rec.id = record.id;
      if (!rec.id) delete rec.id;
      if (running) st.timer = null;
      DD.upsertRecord(rec);
      const saved = st.records.find((r) => r.id === rec.id) || st.records[st.records.length - 1];
      if (def.afterSave) def.afterSave(draft, saved, ctx);
      DD.save();
      DD.closeSheet();
      DD.render();
      DD.toast(editing || res.id ? '改好了' : '记下了');
    };

    const title = card === 'work' && draft.tab === 'review' ? '复盘' : DD.cardName(card);
    sheet = DD.openSheet({ title, onSave: save });
    ctx.rerender();
  };
})();
