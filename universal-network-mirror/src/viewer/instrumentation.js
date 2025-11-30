// Test Instrumentation Hook
(function () {
  window.__UNM_TEST_BUFFER__ = [];
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'DEV_PROJECTION_TICK') return;
    window.__UNM_TEST_BUFFER__.push(ev.data.tick);
  });
  // Optional Profiling Hook
  window.__UNM_PROF = {
    events: [],
    mark(label) { this.events.push({ label, t: performance.now() }); }
  };
})();
