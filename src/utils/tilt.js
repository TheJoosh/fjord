(function () {
  const maxRotate = 5;

  function initTiltFor(el) {
    if (!el || el.dataset.tiltInited) return;
    el.dataset.tiltInited = '1';

    el.style.transformOrigin = 'center';

    function onPointerMove(e) {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * (maxRotate * 2);
      const rx = -(py - 0.5) * (maxRotate * 2);
      el.style.setProperty('--rx', `${rx}deg`);
      el.style.setProperty('--ry', `${ry}deg`);
    }

    function onPointerEnter() {
      el.classList.add('tilting');
      el.style.setProperty('--scale', '1.02');
      el.style.setProperty('--ty', getComputedStyle(el).getPropertyValue('--ty') || '0');
      el.addEventListener('pointermove', onPointerMove);
    }

    function onPointerLeave() {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--scale', '1');
      el.style.setProperty('--ty', '0');
      el.removeEventListener('pointermove', onPointerMove);
    }

    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
  }

  function setup() {
    const els = document.querySelectorAll('.fj-card, .cardpack');
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
