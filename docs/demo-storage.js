
/* Public demo: fictional records are stored in this browser only. */
window.DemoStorage = {
  key: 'school_marks_demo_v2_final',
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const value = JSON.parse(raw);
        if (value && Array.isArray(value.students)) return value;
      }
    } catch (error) {
      console.warn('Demo storage unavailable:', error);
    }
    return JSON.parse(JSON.stringify(window.DEMO_INITIAL_DATA));
  },
  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.warn('Demo storage unavailable:', error);
    }
  },
  reset() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {}
    return this.load();
  }
};
