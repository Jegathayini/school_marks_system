
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 4 of 7: Dashboard.gs
 *
 * MULTI-REGISTER DASHBOARD
 *
 * Grade 06-09 -> Junior Register
 * Grade 10-11 -> O/L Register
 * Grade 12-13 -> A/L Register
 *
 * Provides:
 * 1. Subject-wise academic analysis
 * 2. Marks submission tracking
 * 3. ABSENT submission tracking
 * 4. Student completion tracking
 * 5. Subject completion tracking
 * 6. Grade-specific dashboard data
 *
 * Dependencies:
 * - getAnalysisInternal_() from Analysis.gs
 * - validateContext_() from Code.gs
 *
 * IMPORTANT:
 * - ABSENT counts as entered.
 * - ABSENT contributes zero to averages.
 * - Missing marks remain pending.
 * - Subjects are detected from the selected
 *   grade's student register.
 *
 * This file is READ-ONLY.
 */

/* ========== SUBMISSION STATUS HELPER ========== */

/**
 * Build submission status from analysis data.
 *
 * Reuses the results returned by Analysis.gs.
 * Does not read the spreadsheet again.
 *
 * Works for every configured grade.
 */
function buildSubmissionStatus_(analysis) {

  if (
    !analysis ||
    !Array.isArray(analysis.subjects) ||
    !Array.isArray(analysis.students)
  ) {
    throw new Error(
      'Invalid analysis data supplied to dashboard.'
    );
  }

  /* ========== SUBJECT-WISE STATUS ========== */

  const subjects = analysis.subjects.map(
    subjectData => {

      const subject = subjectData.subject;

      // Students enrolled in this subject.
      const expected = Number(
        subjectData.enrolled || 0
      );

      // Includes numeric marks and ABSENT.
      const entered = Number(
        subjectData.entered || 0
      );

      // Number of ABSENT results.
      const absent = Number(
        subjectData.absent || 0
      );

      // Results not yet entered.
      const pendingCount = Math.max(
        0,
        expected - entered
      );

      /* ========== COMPLETION STATUS ========== */

      let status = 'pending';

      if (
        expected > 0 &&
        entered === expected
      ) {

        status = 'completed';

      } else if (entered > 0) {

        status = 'partial';
      }

      /* ========== MISSING STUDENTS ========== */

      const missingIds = analysis.students
        .filter(
          student =>
            Array.isArray(student.missing) &&
            student.missing.includes(subject)
        )
        .map(
          student => student.id
        );

      /* ========== RETURN SUBJECT STATUS ========== */

      return {
        subject,

        expected,
        entered,
        absent,

        pending: pendingCount,

        status,
        missingIds
      };
    }
  );

  /* ========== SUBJECT COMPLETION COUNTS ========== */

  const required = subjects.length;

  const completed = subjects.filter(
    subject =>
      subject.status === 'completed'
  ).length;

  const partial = subjects.filter(
    subject =>
      subject.status === 'partial'
  ).length;

  const pending = subjects.filter(
    subject =>
      subject.status === 'pending'
  ).length;

  /* ========== TOTAL MARKS COUNTS ========== */

  const expectedMarks = subjects.reduce(
    (total, subject) =>
      total + subject.expected,
    0
  );

  const enteredMarks = subjects.reduce(
    (total, subject) =>
      total + subject.entered,
    0
  );

  const absentMarks = subjects.reduce(
    (total, subject) =>
      total + subject.absent,
    0
  );

  const missingMarks = Math.max(
    0,
    expectedMarks - enteredMarks
  );

  // Actual numeric results, excluding ABSENT.
  const numericMarks = Math.max(
    0,
    enteredMarks - absentMarks
  );

  /* ========== COMPLETION PERCENTAGE ========== */

  const completionPercentage =
    expectedMarks > 0
      ? Math.round(
          (
            enteredMarks /
            expectedMarks
          ) * 10000
        ) / 100
      : 0;

  /* ========== STUDENT COMPLETION ========== */

  const studentCount = Number(
    analysis.studentCount || 0
  );

  const completeStudents = Number(
    analysis.completeCount || 0
  );

  const incompleteStudents = Number(
    analysis.pendingCount || 0
  );

  /* ========== RETURN SUBMISSION STATUS ========== */

  return {
    year: analysis.year,
    grade: analysis.grade,
    term: analysis.term,

    subjects,

    // Subject counts.
    required,
    completed,
    partial,
    pending,

    // Marks counts.
    expectedMarks,
    enteredMarks,
    numericMarks,
    absentMarks,
    missingMarks,

    // Student counts.
    studentCount,
    completeStudents,
    incompleteStudents,

    // Additional summary fields.
    completionPercentage,

    allComplete:
      expectedMarks > 0 &&
      missingMarks === 0
  };
}

/* ========== SUBMISSION STATUS ========== */

/**
 * Get marks submission progress for:
 *
 * - Academic year
 * - Grade
 * - Term
 *
 * Examples:
 *
 * getSubmissionStatusInternal_(
 *   2026,
 *   'Grade 06',
 *   'Term 1'
 * )
 *
 * getSubmissionStatusInternal_(
 *   2026,
 *   'Grade 12',
 *   'Term 1'
 * )
 *
 * Subject status:
 *
 * pending:
 *   No results have been entered.
 *
 * partial:
 *   Some results have been entered.
 *
 * completed:
 *   Every enrolled student has a result.
 *
 * ABSENT counts as entered.
 */
function getSubmissionStatusInternal_(
  year,
  grade,
  term
) {

  const context = validateContext_(
    year,
    grade,
    term
  );

  const analysis = getAnalysisInternal_(
    context.year,
    context.grade,
    context.term
  );

  return buildSubmissionStatus_(
    analysis
  );
}

/* ========== DASHBOARD DATA ========== */

/**
 * Return both:
 *
 * 1. Academic analysis
 * 2. Submission progress
 *
 * Called by Index.html:
 *
 * google.script.run
 *   .withSuccessHandler(...)
 *   .getDashboardDataInternal_(
 *     year,
 *     grade,
 *     term
 *   );
 *
 * Maintains the existing response format:
 *
 * {
 *   analysis: {...},
 *   submission: {...}
 * }
 */
function getDashboardDataInternal_(
  year,
  grade,
  term
) {

  const context = validateContext_(
    year,
    grade,
    term
  );

  /* ========== ACADEMIC ANALYSIS ========== */

  const analysis = getAnalysisInternal_(
    context.year,
    context.grade,
    context.term
  );

  /* ========== SUBMISSION TRACKING ========== */

  // Reuse analysis without reading the
  // spreadsheet a second time.
  const submission = buildSubmissionStatus_(
    analysis
  );

  /* ========== RETURN DASHBOARD DATA ========== */

  return {
    analysis,
    submission
  };
}

/* ========== BACKEND TEST FUNCTIONS ========== */

/**
 * Generic read-only dashboard test.
 *
 * Can be used with any configured grade.
 *
 * No marks are modified.
 */
function testDashboardForGrade__(
  year,
  grade,
  term
) {

  const result = getDashboardDataInternal_(
    year,
    grade,
    term
  );

  Logger.log(
    '===== DASHBOARD TEST ====='
  );

  Logger.log(
    JSON.stringify(
      {
        year: result.analysis.year,
        grade: result.analysis.grade,
        term: result.analysis.term,

        students:
          result.analysis.studentCount,

        completeStudents:
          result.analysis.completeCount,

        incompleteStudents:
          result.analysis.pendingCount,

        classAverage:
          result.analysis.classAverage,

        subjectOptions:
          result.submission.required,

        completedSubjects:
          result.submission.completed,

        partialSubjects:
          result.submission.partial,

        pendingSubjects:
          result.submission.pending,

        expectedMarks:
          result.submission.expectedMarks,

        enteredMarks:
          result.submission.enteredMarks,

        numericMarks:
          result.submission.numericMarks,

        absentMarks:
          result.submission.absentMarks,

        missingMarks:
          result.submission.missingMarks,

        completionPercentage:
          result.submission.completionPercentage,

        allComplete:
          result.submission.allComplete
      },
      null,
      2
    )
  );

  Logger.log(
    'Dashboard connection test completed for ' +
    result.analysis.grade
  );
}

/**
 * Original Grade 06 test.
 */
function testDashboard_() {

  testDashboardForGrade_(
    2026,
    'Grade 06',
    'Term 1'
  );
}

/**
 * Grade 11 test.
 */
function testDashboardGrade11_() {

  testDashboardForGrade_(
    2026,
    'Grade 11',
    'Term 1'
  );
}

/**
 * Grade 12 test.
 */
function testDashboardGrade12_() {

  testDashboardForGrade_(
    2026,
    'Grade 12',
    'Term 1'
  );
}

/**
 * Grade 13 test.
 */
function testDashboardGrade13_() {

  testDashboardForGrade_(
    2026,
    'Grade 13',
    'Term 1'
  );
}
