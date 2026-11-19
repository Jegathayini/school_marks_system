/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 7 of 7: StudentReport.gs
 *
 * MULTI-REGISTER INDIVIDUAL STUDENT REPORTS
 *
 * Grades 06-09 -> Junior Register
 * Grades 10-11 -> O/L Register
 * Grades 12-13 -> A/L Register
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
 *   readRegister_(), readStudents_(), normalizeGrade_(),
 *   validateContext_(), yes_()
 *
 * Dependency from Analysis.gs:
 *   getAnalysisInternal_(), analysisLoadGradeContext_()
 */

/* ========== HELPER FUNCTIONS ========== */

/**
 * Round a number to two decimal places.
 */
function studentReportRound_(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert stored absence values into AB.
 * Preserve numeric marks, including zero.
 * Missing marks return null.
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

/**
 * Escape a string for safe inclusion inside a RegExp.
 */
function studentReportEscapeRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build one student's report from already-computed term analyses
 * with zero additional spreadsheet reads.
 */
function buildStudentReportFromAnalyses_(year, grade, student, subjects, analyses) {
  const termNames = ['Term 1', 'Term 2', 'Term 3'];
  const terms = [];
  const warnings = [];
  const idPattern = new RegExp(
    '\\bstudent\\s+' + studentReportEscapeRegex_(student.id) + '(?![A-Za-z0-9_-])',
    'i'
  );

  for (let i = 0; i < termNames.length; i++) {
    const termName = termNames[i];
    const analysis = analyses[i];

    const result = analysis.students.find(item => item.id === student.id);
    if (!result) {
      throw new Error('Student result not found for ' + termName + '.');
    }

    const marks = subjects.map(subject => {
      const entered = Object.prototype.hasOwnProperty.call(
        result.marks,
        subject
      );
      const rawMark = entered ? result.marks[subject] : null;
      const displayMark = studentReportDisplayMark_(rawMark);
      const absent = displayMark === 'AB';

      return {
        subject,
        mark: displayMark,
        entered,
        absent
      };
    });

    const expected = result.expected;
    const entered = result.entered;
    const absent = marks.filter(item => item.absent).length;
    const numericCount = marks.filter(item => typeof item.mark === 'number').length;
    const complete = result.complete;
    const average = complete ? result.average : null;

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

    const analysisWarnings = analysis.warnings || {};
    const duplicateWarnings = analysisWarnings.duplicates || [];
    const invalidWarnings = analysisWarnings.invalidOrUnmatched || [];

    const studentWarnings = duplicateWarnings
      .concat(invalidWarnings)
      .filter(text => idPattern.test(String(text)));

    for (const warning of studentWarnings) {
      warnings.push(termName + ': ' + warning);
    }
  }

  const completedTerms = terms.filter(
    term =>
      term.complete &&
      term.average !== null &&
      term.average !== undefined
  );

  const overallAverage = completedTerms.length > 0
    ? studentReportRound_(
        completedTerms.reduce((sum, term) => sum + term.average, 0) /
        completedTerms.length
      )
    : null;

  const allTermsComplete = terms.every(term => term.complete);
  const allTermAveragesAvailable = terms.every(
    term => term.average !== null && term.average !== undefined
  );

  const annualAverage = allTermsComplete && allTermAveragesAvailable
    ? studentReportRound_(
        terms.reduce((sum, term) => sum + term.average, 0) / terms.length
      )
    : null;

  return {
    year,
    grade,
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

/* ========== STUDENT LIST ========== */

function getReportStudentsInternal_(grade) {
  const selectedGrade = normalizeGrade_(grade);
  if (!selectedGrade) {
    throw new Error('Please select a valid grade.');
  }

  const register = readRegister_(selectedGrade);

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
 * Generate one student's report across Term 1, Term 2, and Term 3.
 * Uses a single register + marks read across all three terms.
 */
function getStudentReportInternal_(year, grade, studentId, preloadedContext, preloadedAnalyses) {
  const context = validateContext_(year, grade, 'Term 1');

  const id = String(
    studentId === null || studentId === undefined ? '' : studentId
  ).trim();

  if (!id) {
    throw new Error('Please select a student.');
  }

  const contextData = (
    preloadedContext &&
    preloadedContext.grade === context.grade
  )
    ? preloadedContext
    : analysisLoadGradeContext_(context.grade);

  const student = contextData.registeredStudents.find(item => item.id === id);
  if (!student) {
    throw new Error(
      'Student ' + id + ' was not found in ' + context.grade + '.'
    );
  }

  const subjects = Object.keys(contextData.register.columns).filter(subject =>
    yes_(student.row[contextData.register.columns[subject]])
  );

  if (subjects.length === 0) {
    throw new Error('No enrolled subjects found for student ' + id + '.');
  }

  const termNames = ['Term 1', 'Term 2', 'Term 3'];
  const analyses = (
    Array.isArray(preloadedAnalyses) &&
    preloadedAnalyses.length === 3
  )
    ? preloadedAnalyses
    : termNames.map(termName =>
        getAnalysisInternal_(context.year, context.grade, termName, contextData)
      );

  return buildStudentReportFromAnalyses_(
    context.year,
    context.grade,
    student,
    subjects,
    analyses
  );
}

/**
 * Return one student's report together with all 3 term analyses
 * from a single spreadsheet read (for ranking display in the UI).
 */
function getStudentReportWithAnalysesInternal_(year, grade, studentId) {
  const context = validateContext_(year, grade, 'Term 1');
  const contextData = analysisLoadGradeContext_(context.grade);
  const analyses = ['Term 1', 'Term 2', 'Term 3'].map(termName =>
    getAnalysisInternal_(context.year, context.grade, termName, contextData)
  );
  const report = getStudentReportInternal_(
    context.year,
    context.grade,
    studentId,
    contextData,
    analyses
  );

  return {
    report,
    analyses
  };
}

/**
 * Generate all reports, analyses, and term comparisons for an entire grade
 * in a single spreadsheet read (eliminates N*3 reads during bulk PDF export).
 */
function getGradeBulkReportDataInternal_(year, grade) {
  const context = validateContext_(year, grade, 'Term 1');
  const contextData = analysisLoadGradeContext_(context.grade);
  const analyses = ['Term 1', 'Term 2', 'Term 3'].map(termName =>
    getAnalysisInternal_(context.year, context.grade, termName, contextData)
  );
  const termComparison = getTermComparisonInternal_(
    context.year,
    context.grade,
    contextData
  );

  const subjectKeys = Object.keys(contextData.register.columns);
  const students = contextData.registeredStudents
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const reports = [];
  const studentErrors = [];

  for (const student of students) {
    const subjects = subjectKeys.filter(subject =>
      yes_(student.row[contextData.register.columns[subject]])
    );
    if (!subjects.length) {
      studentErrors.push(
        student.id + ': No enrolled subjects found for student ' + student.id + '.'
      );
      continue;
    }

    reports.push(
      buildStudentReportFromAnalyses_(
        context.year,
        context.grade,
        student,
        subjects,
        analyses
      )
    );
  }

  return {
    year: context.year,
    grade: context.grade,
    students: students.map(s => ({ id: s.id, name: s.name })),
    analyses,
    termComparison,
    reports,
    studentErrors
  };
}

/* ========== TEST STUDENT REPORTS ========== */

function testStudentReportsForGrade_(year, grade) {
  const context = validateContext_(year, grade, 'Term 1');

  Logger.log('===== STUDENT REPORT TEST =====');
  Logger.log('Grade: ' + context.grade);

  const students = getReportStudentsInternal_(context.grade);
  Logger.log('Registered students: ' + students.length);

  if (students.length === 0) {
    Logger.log('No students available for testing.');
    return;
  }

  const selectedStudent = students[0];
  Logger.log(
    'Testing student: ' + selectedStudent.name + ' (' + selectedStudent.id + ')'
  );

  const report = getStudentReportInternal_(
    context.year,
    context.grade,
    selectedStudent.id
  );

  Logger.log(
    JSON.stringify({
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
    }, null, 2)
  );

  Logger.log('Student report test completed successfully.');
}

function testStudentReports_() {
  testStudentReportsForGrade_(2026, 'Grade 06');
}

function testStudentReportsGrade11_() {
  testStudentReportsForGrade_(2026, 'Grade 11');
}

function testStudentReportsGrade12_() {
  testStudentReportsForGrade_(2026, 'Grade 12');
}

function testStudentReportsGrade13_() {
  testStudentReportsForGrade_(2026, 'Grade 13');
}