(function () {
  const maxRotate = 5;

  function initTiltFor(el) {
    if (!el || el.dataset.tiltInited) return;
    el.dataset.tiltInited = '1';

    const computed = getComputedStyle(el);
    const isMiniLeaderboardCard = el.classList.contains('leaderboard-mini-card');
    const baseScale = parseFloat(computed.getPropertyValue('--scale'));
    const baseTy = parseFloat(computed.getPropertyValue('--ty'));
    const initialScale = Number.isFinite(baseScale) ? baseScale : 1;
    const initialTy = Number.isFinite(baseTy) ? baseTy : 0;
    const hoverScale = isMiniLeaderboardCard
      ? initialScale
      : Math.max(0.1, Number((initialScale * 1.02).toFixed(3)));
    const rotateLimit = isMiniLeaderboardCard ? maxRotate * 0.6 : maxRotate;

    el.style.setProperty('--scale', String(initialScale));
    el.style.setProperty('--ty', String(initialTy));

    function onPointerMove(e) {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * (rotateLimit * 2);
      const rx = -(py - 0.5) * (rotateLimit * 2);
      el.style.setProperty('--rx', `${rx}deg`);
      el.style.setProperty('--ry', `${ry}deg`);
    }

    function onPointerEnter() {
      el.classList.add('tilting');
      el.style.setProperty('--scale', String(hoverScale));
      el.style.setProperty('--ty', String(initialTy));
      el.addEventListener('pointermove', onPointerMove);
    }

    function onPointerLeave() {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--scale', String(initialScale));
      el.style.setProperty('--ty', String(initialTy));
      el.removeEventListener('pointermove', onPointerMove);
    }

    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
  }

  function setup() {
    const els = document.querySelectorAll('.fj-card:not(.no-tilt), .cardpack:not(.no-tilt)');
    els.forEach(initTiltFor);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  // watch for dynamic additions
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) setup();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
