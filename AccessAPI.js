/**
 * Public API wrapper for Google Apps Script.
 * Enforces authentication tokens, ADMIN vs STAFF role isolation,
 * and per-teacher assigned class/subject restrictions.
 */

/* ========== TEACHER & STAFF ENTRY ENDPOINTS ========== */

function getSetup(token) {
  const account = authRequire_(token, "STAFF");
  return getSetupForAccountInternal_(account);
}

function getStudents() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 2) throw new Error('Grade and subject are required.');
  assertTeacherAssignment_(account, args[0], args[1]);
  return getStudentsInternal_.apply(null, args);
}

function getStudentsForGrade() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 2) throw new Error('Grade and subject are required.');
  assertTeacherAssignment_(account, args[0], args[1]);
  return getStudentsInternal_.apply(null, args);
}

function getSubmissionStatus() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 3) throw new Error('Year, grade, and term are required.');
  assertTeacherAssignment_(account, args[1], null);
  const status = getSubmissionStatusInternal_.apply(null, args);
  return teacherFilterSubmissionStatus_(status, account);
}

function getSubmissionSummary() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 3) throw new Error('Year, grade, and term are required.');
  assertTeacherAssignment_(account, args[1], null);
  const filtered = teacherFilterSubmissionStatus_(
    getSubmissionStatusInternal_.apply(null, args),
    account
  );
  const percent = filtered.expectedMarks > 0
    ? Math.round((filtered.enteredMarks / filtered.expectedMarks) * 10000) / 100
    : 0;
  return {
    year: filtered.year,
    grade: filtered.grade,
    term: filtered.term,
    studentCount: filtered.studentCount,
    expectedMarks: filtered.expectedMarks,
    enteredMarks: filtered.enteredMarks,
    numericMarks: filtered.numericMarks,
    absentMarks: filtered.absentMarks,
    missingMarks: filtered.missingMarks,
    completionPercentage: percent,
    completedSubjects: filtered.completed,
    partialSubjects: filtered.partial,
    pendingSubjects: filtered.pending,
    allComplete: filtered.expectedMarks > 0 && filtered.missingMarks === 0
  };
}

function getSubjectMarksForEntry(year, grade, term, subject, assessmentType, token) {
  const account = authRequire_(token, "STAFF");
  assertTeacherAssignment_(account, grade, subject);
  return getSubjectMarksForEntryInternal_(year, grade, term, subject, assessmentType);
}

function saveMarks() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object') {
    throw new Error('Invalid marks submission arguments.');
  }
  assertTeacherAssignment_(account, args[0].grade, args[0].subject);
  return saveMarksInternal_(args[0], account.username, account.role);
}

function saveSBAMarks() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object') {
    throw new Error('Invalid SBA submission arguments.');
  }
  assertTeacherAssignment_(account, args[0].grade, args[0].subject);
  return saveSBAMarksInternal_(args[0], account.username, account.role);
}

function checkMarkExists() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 5) throw new Error('Invalid checkMarkExists arguments.');
  assertTeacherAssignment_(account, args[1], args[4]);
  return checkMarkExistsInternal_.apply(null, args);
}

function getPendingStudents() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length < 4) throw new Error('Invalid getPendingStudents arguments.');
  assertTeacherAssignment_(account, args[1], args[3]);
  return getPendingStudentsInternal_.apply(null, args);
}

function validateMarksSubmission() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  if (args.length !== 1 || !args[0] || typeof args[0] !== 'object') {
    throw new Error('Invalid validation arguments.');
  }
  assertTeacherAssignment_(account, args[0].grade, args[0].subject);
  return validateMarksSubmissionInternal_.apply(null, args);
}

function getSBAPendingStudents(year, grade, term, subject, token) {
  const account = authRequire_(token, "STAFF");
  assertTeacherAssignment_(account, grade, subject);
  return getSBAPendingStudentsInternal_(year, grade, term, subject);
}

/* ========== ADMIN-ONLY ANALYTICS, REPORTING & BULK EXPORT ENDPOINTS ========== */

function getAnalysis() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getAnalysisInternal_.apply(null, args);
}

function getDashboardData() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getDashboardDataInternal_.apply(null, args);
}

function getTermComparison() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getTermComparisonInternal_.apply(null, args);
}

function getSubjectTermComparison() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getSubjectTermComparisonInternal_.apply(null, args);
}

function getReportStudents() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getReportStudentsInternal_.apply(null, args);
}

function getStudentReport() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getStudentReportInternal_.apply(null, args);
}

function getStudentReportWithAnalyses(year, grade, id, token) {
  authRequire_(token, "ADMIN");
  if (typeof getStudentReportWithAnalysesInternal_ === 'function') {
    return getStudentReportWithAnalysesInternal_(year, grade, id);
  }
  const report = getStudentReportInternal_(year, grade, id);
  const analyses = ['Term 1', 'Term 2', 'Term 3'].map(term =>
    getAnalysisInternal_(year, grade, term)
  );
  return { report, analyses };
}

function getGradeBulkReportData(year, grade, token) {
  authRequire_(token, "ADMIN");
  if (typeof getGradeBulkReportDataInternal_ === 'function') {
    return getGradeBulkReportDataInternal_(year, grade);
  }
  const analyses = ['Term 1', 'Term 2', 'Term 3'].map(term =>
    getAnalysisInternal_(year, grade, term)
  );
  const termComparison = getTermComparisonInternal_(year, grade);
  const studentList = getReportStudentsInternal_(grade);
  const reports = [];
  const studentErrors = [];
  for (const st of studentList) {
    try {
      reports.push(getStudentReportInternal_(year, grade, st.id));
    } catch (err) {
      studentErrors.push({ id: st.id, error: String(err && err.message ? err.message : err) });
    }
  }
  return { analyses, termComparison, reports, studentErrors };
}

function getAnnualTopPerformers(year, grade, token) {
  authRequire_(token, "ADMIN");
  return getAnnualTopPerformersInternal_(year, grade);
}

function getSBAReport(year, grade, term, token) {
  authRequire_(token, "ADMIN");
  return getSBAReportInternal_(year, grade, term);
}

function getMarksAuditLog(year, grade, limit, token) {
  authRequire_(token, "ADMIN");
  return getMarksAuditLogInternal_(year, grade, limit);
}

function exportStart() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return exportStartInternal_.apply(null, args);
}

function exportNext() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return exportNextInternal_.apply(null, args);
}

function exportFinish() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return exportFinishInternal_.apply(null, args);
}