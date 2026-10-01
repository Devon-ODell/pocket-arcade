'use strict';
(async () => {
  const status = document.getElementById('catalog-status');
  const host = document.getElementById('sources');
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  try {
    const response = await fetch('source-catalog.json');
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const { entries } = await response.json();
    status.textContent = `${entries.filter(e => e.kind !== 'library').length} game / template entries · ${entries.filter(e => e.kind === 'library').length} libraries`;
    for (const entry of entries) {
      const card = document.createElement('article');
      card.append(node('h2', entry.title), node('p', `${entry.engine} · ${entry.kind}`), node('code', entry.source), node('p', entry.status), node('p', entry.launch));
      if (entry.web_root && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
        const link = node('a', 'Open local browser build');
        link.href = `/catalog/${encodeURIComponent(entry.id)}/`;
        link.className = 'btn';
        card.append(link);
      }
      host.append(card);
    }
  } catch (error) { status.textContent = error.message; }
})();
