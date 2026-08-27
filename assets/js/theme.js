(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var THEMES = ['light', 'dark', 'auto'];
  var KEY = 'site-theme';
  var ACCENT_VARS = ['--accent', '--accent-hover', '--accent-soft'];

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var raf = null;
  var hue = 0;

  function current() {
    return root.getAttribute('data-theme') || 'light';
  }

  function paint(h) {
    root.style.setProperty('--accent', 'hsl(' + h + ', 70%, 52%)');
    root.style.setProperty('--accent-hover', 'hsl(' + h + ', 70%, 44%)');
    root.style.setProperty('--accent-soft', 'hsla(' + h + ', 70%, 52%, 0.10)');
  }

  function tick() {
    hue = (hue + 0.12) % 360;
    paint(hue);
    raf = requestAnimationFrame(tick);
  }

  function startAuto() {
    if (reduceMotion) { paint(hue); return; }
    if (raf === null) tick();
  }

  /* clearVars is false when merely pausing, so the current hue stays on screen. */
  function stopAuto(clearVars) {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    if (clearVars) {
      ACCENT_VARS.forEach(function (v) { root.style.removeProperty(v); });
    }
  }

  function apply(theme) {
    stopAuto(true);
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    if (theme === 'auto') {
      hue = (Date.now() / 50) % 360;
      startAuto();
    }
  }

  /* No point burning frames on a hidden tab. */
  document.addEventListener('visibilitychange', function () {
    if (current() !== 'auto') return;
    if (document.hidden) { stopAuto(false); } else { startAuto(); }
  });

  btn.addEventListener('click', function () {
    apply(THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length]);
  });

  if (current() === 'auto') {
    hue = (Date.now() / 50) % 360;
    startAuto();
  }
})();
