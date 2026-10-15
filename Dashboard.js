
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 4 of 7: Dashboard.gs
 *
 * Provides:
 * 1. Subject-wise Analysis dashboard data
 * 2. Marks submission tracking
 * 3. ABSENT submission tracking
 *
 * Depends on:
 * - getAnalysis() from Analysis.gs
 *
 * ABSENT counts as entered, not pending.
 * This file only reads data.
 */

/* ========== SUBMISSION STATUS HELPER ========== */

/**
 * Build submission status from existing analysis data.
 *
 * Avoids repeating calculations and reading
 * the spreadsheet unnecessarily.
 */
function buildSubmissionStatus_(analysis) {

  const subjects = analysis.subjects.map(subjectData => {

    const subject = subjectData.subject;
    const expected = subjectData.enrolled;

    // Entered includes numeric marks and ABSENT.
    const entered = subjectData.entered;

    // Number of recorded absences.
    const absent = subjectData.absent || 0;

    // Students who have neither marks nor ABSENT.
    const pendingCount = expected - entered;

    let status = 'pending';

    if (entered === expected && expected > 0) {
      status = 'completed';
    } else if (entered > 0) {
      status = 'partial';
    }

    // ABSENT students are not included in missingIds
    // because Analysis.gs already counts them as entered.
    const missingIds = analysis.students
      .filter(student =>
        student.missing.includes(subject)
      )
      .map(student => student.id);

    return {
      subject,
      expected,
      entered,
      absent,
      pending: pendingCount,
      status,
      missingIds
    };
  });

  /* ========== SUBJECT COMPLETION COUNTS ========== */

  const required = subjects.length;

  const completed = subjects.filter(
    subject => subject.status === 'completed'
  ).length;

  const partial = subjects.filter(
    subject => subject.status === 'partial'
  ).length;

  const pending = subjects.filter(
    subject => subject.status === 'pending'
  ).length;

  /* ========== MARKS COUNTS ========== */

  const expectedMarks = subjects.reduce(
    (total, subject) => total + subject.expected,
    0
  );

  const enteredMarks = subjects.reduce(
    (total, subject) => total + subject.entered,
    0
  );

  const absentMarks = subjects.reduce(
    (total, subject) => total + subject.absent,
    0
  );

  const missingMarks = expectedMarks - enteredMarks;

  // Actual numeric marks, excluding absences.
  const numericMarks = enteredMarks - absentMarks;

  /* ========== RETURN SUBMISSION STATUS ========== */

  return {
    year: analysis.year,
    grade: analysis.grade,
    term: analysis.term,

    subjects,

    required,
    completed,
    partial,
    pending,

    expectedMarks,
    enteredMarks,
    numericMarks,
    absentMarks,
    missingMarks,

    studentCount: analysis.studentCount,
    completeStudents: analysis.completeCount,
    incompleteStudents: analysis.pendingCount
  };
}

/* ========== SUBMISSION STATUS ========== */

/**
 * Return submission progress for a grade,
 * academic year and term.
 *
 * Example:
 * getSubmissionStatus(2026, 'Grade 06', 'Term 1')
 *
 * Subject status:
 * - pending: no results entered
 * - partial: some results entered
 * - completed: all results entered
 *
 * ABSENT is a valid recorded result.
 */
function getSubmissionStatus(year, grade, term) {

  const analysis = getAnalysis(year, grade, term);

  return buildSubmissionStatus_(analysis);
}

/* ========== DASHBOARD DATA ========== */

/**
 * Returns both academic analysis and
 * submission tracking information.
 *
 * Called by Index.html:
 *
 * google.script.run
 *   .getDashboardData(year, grade, term);
 */
function getDashboardData(year, grade, term) {

  const analysis = getAnalysis(year, grade, term);

  // Reuse analysis data without reading
  // the spreadsheet a second time.
  const submission = buildSubmissionStatus_(analysis);

  return {
    analysis,
    submission
  };
}

/* ========== BACKEND TEST ========== */

/**
 * Run this function in Apps Script.
 *
 * It only reads spreadsheet records.
 * It does not modify saved marks.
 */
function testDashboard() {

  const result = getDashboardData(
    2026,
    'Grade 06',
    'Term 1'
  );

  Logger.log(JSON.stringify({

    year: result.analysis.year,
    grade: result.analysis.grade,
    term: result.analysis.term,

    students: result.analysis.studentCount,
    completeStudents: result.analysis.completeCount,
    classAverage: result.analysis.classAverage,

    subjectOptions: result.submission.required,
    completedSubjects: result.submission.completed,
    partialSubjects: result.submission.partial,
    pendingSubjects: result.submission.pending,

    expectedMarks: result.submission.expectedMarks,
    enteredMarks: result.submission.enteredMarks,

    numericMarks: result.submission.numericMarks,
    absentMarks: result.submission.absentMarks,
    missingMarks: result.submission.missingMarks

  }));

  Logger.log(
    'Dashboard connection test completed successfully.'
  );
}
