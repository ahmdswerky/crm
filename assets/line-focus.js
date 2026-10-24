// Rows, items or spans under [data-src="path"] that mention L6 or L6-L14: hovering or focusing them
// fades every other line of the matching <pre data-path="path" data-start> block.
(() => {
  const range = text => {
    const match = text.match(/\bL(\d+)(?:-L(\d+))?/);
    return match && [Number(match[1]), Number(match[2] ?? match[1])];
  };

  const blocks = path => [...document.querySelectorAll('pre[data-path]')].filter(pre => pre.dataset.path === path);

  function focus(path, [from, to], on) {
    blocks(path).forEach(pre => {
      const lines = [...pre.querySelectorAll('.line')];
      if (!lines.some(line => line.dataset.line >= from && line.dataset.line <= to)) return;
      pre.classList.toggle('focusing', on);
      lines.forEach(line => line.classList.toggle('on', on && line.dataset.line >= from && line.dataset.line <= to));
    });
  }

  document.querySelectorAll('[data-src] tr, [data-src] li, span[data-src]').forEach(item => {
    const lines = range(item.textContent);
    if (!lines) return;
    const path = item.closest('[data-src]').dataset.src;
    item.classList.add('focus-source');
    item.tabIndex = 0;
    ['mouseenter', 'focus'].forEach(type => item.addEventListener(type, () => focus(path, lines, true)));
    ['mouseleave', 'blur'].forEach(type => item.addEventListener(type, () => focus(path, lines, false)));
  });
})();
