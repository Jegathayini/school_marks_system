
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 7 of 7: StudentReports.gs
 *
 * Individual student performance reports (read-only).
 *
 * ABSENT RULE:
 * - ABSENT is displayed as AB.
 * - ABSENT counts as an entered result.
 * - ABSENT contributes zero to averages.
 * - Blank marks remain Pending.
 * - A complete term with all AB marks has an average of 0.
 *
 * Dependencies from Code.gs:
 * readRegister_(), readStudents_(),
 * normalizeGrade_(), validateContext_(), yes_()
 *
 * Dependency from Analysis.gs:
 * getAnalysis()
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
 * Convert the internal absent value into AB
 * for display in the student report.
 *
 * Preserve numeric marks, including zero.
 * Missing marks are returned as null.
 */
function studentReportDisplayMark_(mark) {

  if (mark === null || mark === undefined || mark === '') {
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
 * Get all registered students in the selected grade.
 *
 * Example:
 * getReportStudents('Grade 06')
 */
function getReportStudents(grade) {

  const selectedGrade = normalizeGrade_(grade);

  if (!selectedGrade) {
    throw new Error('Please select a valid grade.');
  }

  const register = readRegister_();

  return readStudents_(register.rows)
    .filter(student => student.grade === selectedGrade)
    .map(student => ({
      id: student.id,
      name: student.name
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ========== INDIVIDUAL STUDENT REPORT ========== */

/**
 * Generate one student's performance report
 * across Term 1, Term 2 and Term 3.
 *
 * Example:
 * getStudentReport(2026, 'Grade 06', 'ST001')
 *
 * Compatible with renderStudentReport()
 * in Index.html.
 */
function getStudentReport(year, grade, studentId) {

  /* ========== VALIDATE REQUEST ========== */

  const context = validateContext_(
    year,
    grade,
    'Term 1'
  );

  const id = String(
    studentId === null || studentId === undefined
      ? ''
      : studentId
  ).trim();

  if (!id) {
    throw new Error('Please select a student.');
  }

  /* ========== FIND REGISTERED STUDENT ========== */

  const register = readRegister_();

  const student = readStudents_(register.rows)
    .find(item =>
      item.id === id &&
      item.grade === context.grade
    );

  if (!student) {
    throw new Error(
      'Student ' + id +
      ' was not found in ' + context.grade + '.'
    );
  }

  /* ========== DETERMINE ENROLLED SUBJECTS ========== */

  const subjects = Object.keys(register.columns)
    .filter(subject =>
      yes_(student.row[register.columns[subject]])
    );

  if (subjects.length === 0) {
    throw new Error(
      'No enrolled subjects found for student ' + id + '.'
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

    // Use the central Analysis.gs calculation engine.
    // Its averages already count ABSENT as zero.
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
        'Student result not found for ' + termName + '.'
      );
    }

    /* ========== SUBJECT MARKS ========== */

    const marks = subjects.map(subject => {

      const entered =
        Object.prototype.hasOwnProperty.call(
          result.marks,
          subject
        );

      const rawMark = entered
        ? result.marks[subject]
        : null;

      const displayMark =
        studentReportDisplayMark_(rawMark);

      const absent = displayMark === 'AB';

      return {
        subject,

        // Numeric mark, AB, or null.
        mark: displayMark,

        entered,
        absent
      };
    });

    /* ========== TERM COUNTS ========== */

    const expected = result.expected;
    const entered = result.entered;

    const absent = marks.filter(
      item => item.absent
    ).length;

    const numericCount = marks.filter(
      item => typeof item.mark === 'number'
    ).length;

    const complete = result.complete;

    /* ========== TERM AVERAGE ========== */

    /*
     * Analysis.gs already divides the recorded
     * numeric total by the number of enrolled
     * subjects, counting AB as zero.
     *
     * Examples:
     *
     * 80, 70, AB:
     * (80 + 70 + 0) / 3 = 50
     *
     * AB, AB, AB:
     * (0 + 0 + 0) / 3 = 0
     *
     * 80, Pending, AB:
     * Incomplete, so final average is null.
     */

    const average = complete
      ? result.average
      : null;

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

      missingSubjects: result.missing.slice()
    });

    /* ========== DATA QUALITY WARNINGS ========== */

    const duplicateWarnings =
      analysis.warnings.duplicates || [];

    const invalidWarnings =
      analysis.warnings.invalidOrUnmatched || [];

    const studentWarnings = duplicateWarnings
      .concat(invalidWarnings)
      .filter(text =>
        text.includes('student ' + id) ||
        text.includes('Student ' + id)
      );

    for (const warning of studentWarnings) {
      warnings.push(termName + ': ' + warning);
    }
  }

  /* ========== COMPLETED TERM AVERAGES ========== */

  /*
   * Every fully completed term has an average.
   *
   * A term containing only AB marks has
   * an average of 0 and is included.
   */

  const completedTerms = terms.filter(
    term =>
      term.complete &&
      term.average !== null &&
      term.average !== undefined
  );

  /* ========== OVERALL AVAILABLE AVERAGE ========== */

  /*
   * Average of all completed terms.
   *
   * Incomplete terms are excluded.
   * A completed term with average 0 is included.
   */

  const overallAverage = completedTerms.length > 0
    ? studentReportRound_(
        completedTerms.reduce(
          (sum, term) => sum + term.average,
          0
        ) / completedTerms.length
      )
    : null;

  /* ========== ANNUAL AVERAGE ========== */

  /*
   * Annual average is calculated only after
   * all three terms are complete.
   *
   * AB marks count as zero.
   *
   * Example:
   *
   * Term 1 average = 80
   * Term 2 average = 0
   * Term 3 average = 70
   *
   * Annual average = (80 + 0 + 70) / 3
   *                = 50
   */

  const allTermsComplete = terms.every(
    term => term.complete
  );

  const allTermAveragesAvailable = terms.every(
    term =>
      term.average !== null &&
      term.average !== undefined
  );

  const annualAverage =
    allTermsComplete && allTermAveragesAvailable
      ? studentReportRound_(
          terms.reduce(
            (sum, term) => sum + term.average,
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

    completedTerms: completedTerms.length,

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
 * Test the student list and report generation.
 *
 * Uses the first student found in Grade 06.
 * No spreadsheet data is modified.
 */
function testStudentReports() {

  const year = 2026;
  const grade = 'Grade 06';

  Logger.log(
    '===== STUDENT REPORT TEST ====='
  );

  const students = getReportStudents(grade);

  Logger.log(
    'Registered students: ' + students.length
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
    ' (' + selectedStudent.id + ')'
  );

  const report = getStudentReport(
    year,
    grade,
    selectedStudent.id
  );

  Logger.log(JSON.stringify({
    student: report.student,
    grade: report.grade,
    year: report.year,

    subjectCount: report.subjectCount,
    completedTerms: report.completedTerms,

    overallAverage: report.overallAverage,
    annualAverage: report.annualAverage,
    allTermsComplete: report.allTermsComplete,

    terms: report.terms.map(term => ({
      term: term.term,

      entered: term.entered,
      absent: term.absent,
      numericCount: term.numericCount,

      expected: term.expected,
      missing: term.missing,

      totalRecorded: term.totalRecorded,
      average: term.average,
      complete: term.complete,

      marks: term.marks
    })),

    warnings: report.warnings
  }));

  Logger.log(
    'Student report test completed successfully.'
  );
}
