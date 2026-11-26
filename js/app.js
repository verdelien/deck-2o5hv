'use strict';
/* Day Deck start-up: theme, page swiping, live timers, offline support. */
(function () {
  const DD = window.DD;
  const root = document.documentElement;
  const dark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

  DD.resolveTheme = () => {
    const t = DD.state.settings.theme;
    return t === 'day' || t === 'night' ? t : (dark && dark.matches ? 'night' : 'day');
  };
  DD.applyTheme = () => {
    const t = DD.resolveTheme();
    root.setAttribute('data-theme', t);
    const meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', t === 'night' ? '#1C1514' : '#FBF6F3');
  };
  // The round button switches to the other scheme and remembers the choice.
  DD.toggleTheme = () => {
    DD.state.settings.theme = DD.resolveTheme() === 'night' ? 'day' : 'night';
    DD.save();
    DD.applyTheme();
    DD.render();
  };
  if (dark && dark.addEventListener) dark.addEventListener('change', () => { if (DD.state.settings.theme === 'system') { DD.applyTheme(); DD.render(); } });

  /* ---------- Pages ---------- */
  const pager = document.getElementById('pager');
  DD.page = 0;
  DD.goPage = (i) => pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
  pager.addEventListener('scroll', () => {
    const i = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    if (i !== DD.page) {
      DD.page = i;
      document.querySelectorAll('.page').forEach((p, pi) => p.querySelectorAll('.dot').forEach((d, di) => d.classList.toggle('on', di === pi)));
    }
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DD.sheetOpen()) { DD.closeSheet(); return; }
    if (DD.sheetOpen() || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName)) return;
    if (e.key === 'ArrowRight') DD.goPage(1);
    if (e.key === 'ArrowLeft') DD.goPage(0);
  });

  /* ---------- Live clocks: anything with data-since ticks every second ---------- */
  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('[data-since]').forEach((el) => {
      const d = DD.parseLocal(el.getAttribute('data-since'));
      if (d) el.textContent = DD.fmtElapsed(now - d.getTime(), el.hasAttribute('data-short'));
    });
  }, 1000);

  // When the app comes back (e.g. next morning), refresh dates, notes and card faces.
  let lastDay = null;
  const refreshIfStale = () => {
    const t = DD.todayKey();
    if (t !== lastDay) { lastDay = t; if (!DD.sheetOpen()) DD.render(); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfStale(); });
  setInterval(refreshIfStale, 60000);

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { DD.renderDeck(); pager.scrollLeft = DD.page * pager.clientWidth; }, 120);
  });

  /* ---------- Start ---------- */
  DD.load();
  DD.applyTheme();
  lastDay = DD.todayKey();
  DD.render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
