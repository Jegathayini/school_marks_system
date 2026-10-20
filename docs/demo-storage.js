/* Local browser storage; never connects to Google Sheets. */
window.DemoStorage = {
  key: 'school_marks_demo_v2',
  load() {
    try { const raw = localStorage.getItem(this.key); if (raw) return JSON.parse(raw); }
    catch (error) { console.warn('Demo storage unavailable:', error); }
    return JSON.parse(JSON.stringify(window.DEMO_INITIAL_DATA));
  },
  save(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  reset() { localStorage.removeItem(this.key); return this.load(); }
};
