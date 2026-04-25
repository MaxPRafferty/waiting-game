const views = new Map();
let currentView = null;

export function registerView(name, el) {
  views.set(name, el);
}

export function navigateTo(name) {
  if (currentView === name) return;
  for (const [viewName, el] of views) {
    el.classList.toggle('active', viewName === name);
  }
  currentView = name;
  window.location.hash = name === 'queue' ? '' : name;
}

export function getCurrentView() {
  return currentView;
}

export function initRouter() {
  const hash = window.location.hash.slice(1);
  const target = hash && views.has(hash) ? hash : 'queue';
  navigateTo(target);

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.slice(1);
    const t = h && views.has(h) ? h : 'queue';
    navigateTo(t);
  });
}
