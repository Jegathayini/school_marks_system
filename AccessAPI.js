/** Public RPC entry points: all calls require a valid server-checked session. */

function getSetup() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return getSetupInternal_.apply(null, args);
}

function getStudents() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return getStudentsInternal_.apply(null, args);
}

function saveMarks() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  const account = authRequire_(token, "STAFF");
  // Username is derived from the verified session, never from user input.
  if (args.length !== 1) throw new Error('Invalid marks submission arguments.');
  return saveMarksInternal_(args[0], account.username);
}

function getAnalysis() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getAnalysisInternal_.apply(null, args);
}

function getSubmissionStatus() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return getSubmissionStatusInternal_.apply(null, args);
}

function getDashboardData() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "ADMIN");
  return getDashboardDataInternal_.apply(null, args);
}

function checkMarkExists() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return checkMarkExistsInternal_.apply(null, args);
}

function getPendingStudents() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return getPendingStudentsInternal_.apply(null, args);
}

function validateMarksSubmission() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return validateMarksSubmissionInternal_.apply(null, args);
}

function getSubmissionSummary() {
  const args = Array.prototype.slice.call(arguments);
  const token = args.pop();
  authRequire_(token, "STAFF");
  return getSubmissionSummaryInternal_.apply(null, args);
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
