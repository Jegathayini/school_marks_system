/* Public demo: fictional records are stored in this browser only. */
window.DemoStorage = {
  key: 'school_marks_demo_v2_final',
  load() {
    const fallback = JSON.parse(JSON.stringify(window.DEMO_INITIAL_DATA));
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const value = JSON.parse(raw);
        if (value && Array.isArray(value.students)) {
          if (!value.teacherAssignments || typeof value.teacherAssignments !== 'object') {
            value.teacherAssignments = fallback.teacherAssignments;
          }
          if (!Array.isArray(value.marksAudit)) {
            value.marksAudit = [];
          }
          return value;
        }
      }
    } catch (error) {
      console.warn('Demo storage unavailable:', error);
    }
    return fallback;
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