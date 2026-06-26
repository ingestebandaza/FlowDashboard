(function () {
  'use strict';

  const STORAGE_KEY = 'flowdashboard.proView';
  const VIEW_CLASSES = ['pro-view-control', 'pro-view-streaming', 'pro-view-accounts'];

  function bySelector(selector) {
    return document.querySelector(selector);
  }

  function all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function setView(view) {
    const nextView = ['control', 'streaming', 'accounts'].includes(view) ? view : 'control';
    document.body.classList.remove(...VIEW_CLASSES);
    document.body.classList.add(`pro-view-${nextView}`);
    localStorage.setItem(STORAGE_KEY, nextView);

    all('.js-pro-view-btn').forEach((button) => {
      const active = button.dataset.proView === nextView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (nextView === 'streaming') {
      const grid = bySelector('.grid');
      const leftColumn = bySelector('.left-column');
      const menuToggle = bySelector('.js-menu-toggle-btn');
      if (grid) grid.classList.add('streaming-menu-hidden');
      if (leftColumn) leftColumn.classList.add('streaming-menu-hidden');
      if (menuToggle) menuToggle.classList.add('active');
    }
  }

  function updateMetrics() {
    const cards = all('.device-card[data-device-serial]');
    const selected = cards.filter((card) => card.classList.contains('is-selected'));
    const deviceCount = bySelector('.js-device-count');
    const agentStatus = bySelector('.js-flow-agent-status');

    const totalEl = bySelector('.js-pro-device-total');
    const selectedEl = bySelector('.js-pro-device-selected');
    const agentEl = bySelector('.js-pro-agent-total');

    if (totalEl) {
      const parsed = Number((deviceCount?.textContent || '').match(/\d+/)?.[0] || cards.length || 0);
      setMetricText(totalEl, String(parsed));
    }
    if (selectedEl) setMetricText(selectedEl, String(selected.length));
    if (agentEl) {
      const parsed = Number((agentStatus?.textContent || '').match(/\d+/)?.[0] || 0);
      setMetricText(agentEl, String(parsed));
    }
  }

  function setMetricText(element, value) {
    if (element.textContent !== value) {
      element.textContent = value;
    }
  }

  function openLicensePanel() {
    const modal = bySelector('#licenseLoginModal');
    if (modal) {
      modal.style.display = 'flex';
      return;
    }
    window.open('license_admin.html', '_blank', 'noopener,noreferrer');
  }

  function initProPanel() {
    all('.js-pro-view-btn').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.proView));
    });

    const licenseButton = bySelector('.js-pro-license-btn');
    if (licenseButton) licenseButton.addEventListener('click', openLicensePanel);

    setView(localStorage.getItem(STORAGE_KEY) || 'control');
    updateMetrics();

    const observer = new MutationObserver(updateMetrics);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProPanel);
  } else {
    initProPanel();
  }
})();
