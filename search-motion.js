/* Decorative text mirror; the native search input remains the editing surface. */
(() => {
  const input = document.getElementById('search');
  const label = input.closest('.search');
  const mirror = label.querySelector('.search-mirror');
  const particles = label.querySelector('.search-particles');
  const field = label.querySelector('.search-field');
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const split = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
  const reduce = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous = [];
  let composing = false;
  let scrollFrame;
  function selection() {
    label.classList.toggle('native-text', composing || input.selectionStart !== input.selectionEnd);
  }
  function syncScroll() {
    for (const span of mirror.children) span.style.transform = `translateX(${-input.scrollLeft}px)`;
  }
  function paint(withMotion = true) {
    const next = split(input.value);
    let start = 0;
    while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
    let end = 0;
    while (end < previous.length - start && end < next.length - start && previous[previous.length - 1 - end] === next[next.length - 1 - end]) end++;
    const motion = withMotion && !composing && !reduce() && document.activeElement === input;
    if (motion) {
      const origin = field.getBoundingClientRect();
      Array.from(mirror.children).slice(start, Math.min(previous.length - end, start + 24)).forEach((span, index) => {
        const rect = span.getBoundingClientRect();
        if (rect.left < origin.left || rect.right > origin.right) return;
        const ghost = document.createElement('span'); ghost.textContent = span.textContent;
        ghost.style.left = `${rect.left - origin.left}px`; ghost.style.top = `${rect.top - origin.top}px`;
        particles.append(ghost);
        const anim = ghost.animate([{ opacity: .85, transform: 'translateY(0) rotate(0deg)' }, { opacity: 0, transform: `translateY(13px) rotate(${index % 2 ? 9 : -9}deg)` }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
        anim.finished.then(() => ghost.remove(), () => ghost.remove());
      });
    }
    mirror.replaceChildren(...next.map((letter, index) => {
      const span = document.createElement('span'); span.textContent = letter;
      // Inner span allows text scroll and the entrance transform to coexist.
      const glyph = document.createElement('span'); glyph.textContent = letter; span.replaceChildren(glyph);
      if (motion && index >= start && index < next.length - end) glyph.animate([{ opacity: 0, transform: 'translateY(-4px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 100, easing: 'cubic-bezier(.2,.8,.2,1)' });
      return span;
    }));
    previous = next; syncScroll(); selection();
    cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(syncScroll);
  }
  input.addEventListener('input', () => paint());
  input.addEventListener('scroll', syncScroll);
  input.addEventListener('select', selection);
  input.addEventListener('keyup', () => { syncScroll(); selection(); });
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) selection(); });
  input.addEventListener('compositionstart', () => { composing = true; selection(); });
  input.addEventListener('compositionend', () => { composing = false; paint(false); });
  input.addEventListener('focus', () => { document.body.classList.add('search-focused'); paint(false); });
  input.addEventListener('blur', () => { document.body.classList.remove('search-focused'); particles.replaceChildren(); });
  input.addEventListener('keydown', event => { if (event.key === 'Escape' && !composing) { event.preventDefault(); input.blur(); } });
  document.querySelector('.search-shade').addEventListener('click', () => input.blur());
  new ResizeObserver(syncScroll).observe(field);
  document.fonts?.ready.then(syncScroll);
  paint(false);
})();
