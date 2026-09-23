// quotebook slides: keyboard navigation, position counter and #hash tracking.
(() => {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counter = document.querySelector('.counter');
  const total = document.querySelectorAll('.slide[data-n]').length;
  let current = 0;

  const go = (i) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    slides[next].scrollIntoView({ block: 'start' });
  };

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    const keys = {
      ArrowDown: 1, ArrowRight: 1, PageDown: 1, j: 1, ' ': e.shiftKey ? -1 : 1,
      ArrowUp: -1, ArrowLeft: -1, PageUp: -1, k: -1,
    };
    if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key in keys) go(current + keys[e.key]);
    else return;
    e.preventDefault();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        current = slides.indexOf(entry.target);
        const n = entry.target.dataset.n;
        if (counter) counter.textContent = n ? `${n} / ${total}` : '';
        const url = current === 0 ? location.pathname + location.search : `#${entry.target.id}`;
        history.replaceState(null, '', url);
      }
    },
    { threshold: 0.6 },
  );

  slides.forEach((s) => observer.observe(s));
  document.addEventListener('keydown', onKey);
})();
