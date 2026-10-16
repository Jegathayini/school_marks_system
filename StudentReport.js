
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 7 of 7: StudentReports.gs
 *
 * MULTI-REGISTER STUDENT PERFORMANCE REPORTS
 *
 * Grade 06-09 -> Junior Register
 * Grade 10-11 -> O/L Register
 * Grade 12-13 -> A/L Register
 *
 * Supports:
 * - Automatic register selection by grade
 * - Automatically detected subjects
 * - Student-specific subject enrollment
 * - Term 1, Term 2 and Term 3 reports
 * - Annual performance summaries
 * - ABSENT and pending results
 * - Data quality warnings
 *
 * ABSENT RULES:
 * - ABSENT is displayed as AB.
 * - ABSENT counts as an entered result.
 * - ABSENT contributes zero to averages.
 * - Missing results remain Pending.
 * - Final term average requires all subjects.
 * - Annual average requires all three terms.
 *
 * This file is READ-ONLY.
 *
 * Dependencies from Code.gs:
 *   readRegister_()
 *   readStudents_()
 *   normalizeGrade_()
 *   validateContext_()
 *   yes_()
 *
 * Dependency from Analysis.gs:
 *   getAnalysis()
 */

/* ========== HELPER FUNCTIONS ========== */

/**
 * Round a number to two decimal places.
 */
function studentReportRound_(value) {

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

/**
 * Convert stored absence values into AB.
 *
 * Preserve numeric marks, including zero.
 * Missing marks return null.
 */
function studentReportDisplayMark_(mark) {

  if (
    mark === null ||
    mark === undefined ||
    mark === ''
  ) {
    return null;
  }

  if (
    typeof mark === 'string' &&
    (
      mark.trim().toUpperCase() === 'ABSENT' ||
      mark.trim().toUpperCase() === 'AB'
    )
  ) {
    return 'AB';
  }

  return mark;
}

/* ========== STUDENT LIST ========== */

/**
 * Get registered students for a selected grade.
 *
 * Examples:
 *
 * getReportStudents('Grade 06')
 * getReportStudents('Grade 11')
 * getReportStudents('Grade 12')
 * getReportStudents('Grade 13')
 *
 * Automatically reads the correct register.
 */
function getReportStudents(grade) {

  const selectedGrade = normalizeGrade_(grade);

  if (!selectedGrade) {
    throw new Error(
      'Please select a valid grade.'
    );
  }

  /* ========== SELECT REGISTER ========== */

  const register = readRegister_(selectedGrade);

  /* ========== FILTER STUDENTS ========== */

  return readStudents_(register.rows)
    .filter(
      student =>
        student.grade === selectedGrade
    )
    .map(
      student => ({
        id: student.id,
        name: student.name
      })
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );
}

/* ========== INDIVIDUAL STUDENT REPORT ========== */

/**
 * Generate one student's report across:
 *
 * Term 1
 * Term 2
 * Term 3
 *
 * Examples:
 *
 * getStudentReport(
 *   2026,
 *   'Grade 06',
 *   'ST001'
 * )
 *
 * getStudentReport(
 *   2026,
 *   'Grade 12',
 *   'AL001'
 * )
 *
 * Maintains compatibility with the existing
 * renderStudentReport() frontend function.
 */
function getStudentReport(
  year,
  grade,
  studentId
) {

  /* ========== VALIDATE REQUEST ========== */

  const context = validateContext_(
    year,
    grade,
    'Term 1'
  );

  const id = String(
    studentId === null ||
    studentId === undefined
      ? ''
      : studentId
  ).trim();

  if (!id) {
    throw new Error(
      'Please select a student.'
    );
  }

  /* ========== SELECT CORRECT REGISTER ========== */

  const register = readRegister_(context.grade);

  /* ========== FIND STUDENT ========== */

  const student = readStudents_(register.rows)
    .find(
      item =>
        item.id === id &&
        item.grade === context.grade
    );

  if (!student) {

    throw new Error(
      'Student ' +
      id +
      ' was not found in ' +
      context.grade +
      '.'
    );
  }

  /* ========== DETERMINE ENROLLED SUBJECTS ========== */

  const subjects = Object.keys(
    register.columns
  ).filter(
    subject =>
      yes_(
        student.row[
          register.columns[subject]
        ]
      )
  );

  if (subjects.length === 0) {

    throw new Error(
      'No enrolled subjects found for student ' +
      id +
      '.'
    );
  }

  /* ========== GENERATE THREE TERM RESULTS ========== */

  const termNames = [
    'Term 1',
    'Term 2',
    'Term 3'
  ];

  const terms = [];
  const warnings = [];

  for (const termName of termNames) {

    /*
     * Analysis.gs handles:
     *
     * - Correct register selection
     * - Enrollment checking
     * - Missing results
     * - ABSENT as zero
     * - Final term averages
     */

    const analysis = getAnalysis(
      context.year,
      context.grade,
      termName
    );

    const result = analysis.students.find(
      item => item.id === id
    );

    if (!result) {

      throw new Error(
        'Student result not found for ' +
        termName +
        '.'
      );
    }

    /* ========== SUBJECT MARKS ========== */

    const marks = subjects.map(
      subject => {

        const entered =
          Object.prototype.hasOwnProperty.call(
            result.marks,
            subject
          );

        const rawMark = entered
          ? result.marks[subject]
          : null;

        const displayMark =
          studentReportDisplayMark_(
            rawMark
          );

        const absent =
          displayMark === 'AB';

        return {
          subject,

          // Numeric mark, AB, or null.
          mark: displayMark,

          entered,
          absent
        };
      }
    );

    /* ========== TERM COUNTS ========== */

    const expected = result.expected;
    const entered = result.entered;

    const absent = marks.filter(
      item => item.absent
    ).length;

    const numericCount = marks.filter(
      item =>
        typeof item.mark === 'number'
    ).length;

    const complete = result.complete;

    /* ========== TERM AVERAGE ========== */

    /*
     * Example:
     *
     * Maths: 80
     * Science: 70
     * English: AB
     *
     * Average = (80 + 70 + 0) / 3
     *         = 50
     *
     * If any result is missing:
     * Average = null
     */

    const average = complete
      ? result.average
      : null;

    /* ========== SAVE TERM RESULT ========== */

    terms.push({
      term: termName,

      expected,
      entered,
      absent,
      numericCount,

      missing: expected - entered,
      complete,

      totalRecorded: result.totalRecorded,
      average,

      marks,

      missingSubjects:
        result.missing.slice()
    });

    /* ========== DATA QUALITY WARNINGS ========== */

    const analysisWarnings =
      analysis.warnings || {};

    const duplicateWarnings =
      analysisWarnings.duplicates || [];

    const invalidWarnings =
      analysisWarnings.invalidOrUnmatched || [];

    const studentWarnings =
      duplicateWarnings
        .concat(invalidWarnings)
        .filter(
          text => {
            const message = String(text);

            return (
              message.includes('student ' + id) ||
              message.includes('Student ' + id)
            );
          }
        );

    for (const warning of studentWarnings) {

      warnings.push(
        termName + ': ' + warning
      );
    }
  }

  /* ========== COMPLETED TERM AVERAGES ========== */

  /*
   * Completed terms include those where
   * every subject is marked ABSENT.
   *
   * Such a term has an average of 0.
   */

  const completedTerms = terms.filter(
    term =>
      term.complete &&
      term.average !== null &&
      term.average !== undefined
  );

  /* ========== OVERALL AVAILABLE AVERAGE ========== */

  /*
   * This is the average of currently
   * completed terms.
   *
   * Incomplete terms are excluded.
   *
   * This is NOT necessarily the final
   * annual average.
   */

  const overallAverage =
    completedTerms.length > 0
      ? studentReportRound_(
          completedTerms.reduce(
            (sum, term) =>
              sum + term.average,
            0
          ) / completedTerms.length
        )
      : null;

  /* ========== ANNUAL AVERAGE ========== */

  /*
   * Annual average is available only
   * when all three terms are complete.
   *
   * Example:
   *
   * Term 1: 80
   * Term 2: 0
   * Term 3: 70
   *
   * Annual Average = 50
   */

  const allTermsComplete = terms.every(
    term => term.complete
  );

  const allTermAveragesAvailable =
    terms.every(
      term =>
        term.average !== null &&
        term.average !== undefined
    );

  const annualAverage =
    allTermsComplete &&
    allTermAveragesAvailable
      ? studentReportRound_(
          terms.reduce(
            (sum, term) =>
              sum + term.average,
            0
          ) / terms.length
        )
      : null;

  /* ========== RETURN STUDENT REPORT ========== */

  return {
    year: context.year,
    grade: context.grade,

    student: {
      id: student.id,
      name: student.name
    },

    subjects,
    subjectCount: subjects.length,

    terms,

    completedTerms:
      completedTerms.length,

    overallAverage,
    annualAverage,
    allTermsComplete,

    warnings,

    note:
      'Missing marks are displayed as Pending, not zero. ' +
      'Absent marks are displayed as AB and count as zero ' +
      'when calculating averages. ' +
      'AB counts as an entered result for submission completion. ' +
      'A term with all subjects marked AB is complete and has ' +
      'an average of zero. ' +
      'Final term averages are calculated only when all enrolled ' +
      'subject results have been recorded. ' +
      'The annual average is calculated only when all three ' +
      'terms are complete. ' +
      'Enrollment reflects the current register; historical ' +
      'enrollment snapshots are not yet implemented.'
  };
}

/* ========== TEST STUDENT REPORTS ========== */

/**
 * Generic read-only test for any grade.
 *
 * Uses the first student in that grade.
 *
 * No spreadsheet data is modified.
 */
function testStudentReportsForGrade_(
  year,
  grade
) {

  const context = validateContext_(
    year,
    grade,
    'Term 1'
  );

  Logger.log(
    '===== STUDENT REPORT TEST ====='
  );

  Logger.log(
    'Grade: ' + context.grade
  );

  const students = getReportStudents(
    context.grade
  );

  Logger.log(
    'Registered students: ' +
    students.length
  );

  if (students.length === 0) {

    Logger.log(
      'No students available for testing.'
    );

    return;
  }

  const selectedStudent = students[0];

  Logger.log(
    'Testing student: ' +
    selectedStudent.name +
    ' (' +
    selectedStudent.id +
    ')'
  );

  const report = getStudentReport(
    context.year,
    context.grade,
    selectedStudent.id
  );

  Logger.log(
    JSON.stringify(
      {
        student: report.student,
        grade: report.grade,
        year: report.year,

        subjectCount:
          report.subjectCount,

        completedTerms:
          report.completedTerms,

        overallAverage:
          report.overallAverage,

        annualAverage:
          report.annualAverage,

        allTermsComplete:
          report.allTermsComplete,

        terms: report.terms.map(
          term => ({
            term: term.term,

            entered: term.entered,
            absent: term.absent,

            numericCount:
              term.numericCount,

            expected: term.expected,
            missing: term.missing,

            totalRecorded:
              term.totalRecorded,

            average: term.average,
            complete: term.complete,

            marks: term.marks
          })
        ),

        warnings: report.warnings
      },
      null,
      2
    )
  );

  Logger.log(
    'Student report test completed successfully.'
  );
}

/**
 * Original Grade 06 test.
 */
function testStudentReports() {

  testStudentReportsForGrade_(
    2026,
    'Grade 06'
  );
}

/**
 * Grade 11 test.
 */
function testStudentReportsGrade11() {

  testStudentReportsForGrade_(
    2026,
    'Grade 11'
  );
}

/**
 * Grade 12 test.
 */
function testStudentReportsGrade12() {

  testStudentReportsForGrade_(
    2026,
    'Grade 12'
  );
}

/**
 * Grade 13 test.
 */
function testStudentReportsGrade13() {

  testStudentReportsForGrade_(
    2026,
    'Grade 13'
  );
}
