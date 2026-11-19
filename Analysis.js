/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 3 of 7: Analysis.gs
 *
 * MULTI-REGISTER ACADEMIC ANALYSIS
 *
 * Grades 06-09 -> Junior Register
 * Grades 10-11 -> O/L Register
 * Grades 12-13 -> A/L Register
 *
 * ABSENT RULES:
 * - ABSENT is a valid recorded result.
 * - ABSENT counts as entered.
 * - ABSENT contributes zero to averages.
 * - ABSENT is displayed as AB.
 * - Blank marks remain pending.
 *
 * Dependencies from Code.gs:
 * book_(), readRegister_(), readStudents_(),
 * normalizeGrade_(), yes_(), validateContext_(),
 * MARKS_SHEET
 */

/* ========== HELPER FUNCTIONS ========== */

/**
 * Round a number to two decimal places.
 */
function analysisRound_(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Create a unique key for a mark.
 */
function analysisMarkKey_(year, grade, term, studentId, subject) {
  return [
    String(year),
    String(grade),
    String(term),
    String(studentId),
    String(subject)
  ].join('|');
}

/**
 * Read stored marks from Marks_Entries.
 *
 * No marks are changed.
 */
function analysisReadMarks_() {
  const sheet = book_().getSheetByName(MARKS_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const expectedHeaders = [
    'AcademicYear',
    'Grade',
    'Term',
    'StudentID',
    'StudentName',
    'SubjectGroup',
    'SubjectOption',
    'Marks',
    'UpdatedAt'
  ];

  const headers = sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .getDisplayValues()[0];

  if (headers.join('|') !== expectedHeaders.join('|')) {
    throw new Error(
      'Unexpected Marks_Entries column structure. ' +
      'Please check the spreadsheet headers.'
    );
  }

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, expectedHeaders.length)
    .getValues();
}

/**
 * Load register, grade students, and saved marks once so callers
 * analyzing multiple terms or students avoid redundant sheet reads.
 */
function analysisLoadGradeContext_(grade) {
  const normalizedGrade = normalizeGrade_(grade);
  if (!normalizedGrade) {
    throw new Error('Invalid grade.');
  }

  const register = readRegister_(normalizedGrade);
  const registeredStudents = readStudents_(register.rows)
    .filter(student => student.grade === normalizedGrade);
  const savedMarks = analysisReadMarks_();

  return {
    grade: normalizedGrade,
    register,
    registeredStudents,
    savedMarks
  };
}

/**
 * Get subjects enrolled by one student.
 */
function analysisStudentSubjects_(student, columns) {
  return Object.keys(columns).filter(subject =>
    yes_(student.row[columns[subject]])
  );
}

/* ========== MAIN ANALYSIS FUNCTION ========== */

/**
 * Calculate results for one academic context.
 *
 * Optionally accepts preloadedContext from analysisLoadGradeContext_()
 * to eliminate redundant spreadsheet reads across multi-term workflows.
 */
function getAnalysisInternal_(year, grade, term, preloadedContext) {
  /* ========== VALIDATE CONTEXT ========== */

  const context = validateContext_(year, grade, term);

  /* ========== LOAD REGISTER, STUDENTS & MARKS ========== */

  const usePreloaded = Boolean(
    preloadedContext &&
    preloadedContext.grade === context.grade &&
    preloadedContext.register &&
    Array.isArray(preloadedContext.registeredStudents) &&
    Array.isArray(preloadedContext.savedMarks)
  );

  const register = usePreloaded
    ? preloadedContext.register
    : readRegister_(context.grade);

  const registeredStudents = usePreloaded
    ? preloadedContext.registeredStudents
    : readStudents_(register.rows).filter(
        student => student.grade === context.grade
      );

  const savedMarks = usePreloaded
    ? preloadedContext.savedMarks
    : analysisReadMarks_();

  /* ========== STUDENT LOOKUP ========== */

  const studentMap = new Map();
  for (const student of registeredStudents) {
    studentMap.set(student.id, student);
  }

  /* ========== SUBJECT ENROLLMENT ========== */

  const enrollmentMap = new Map();
  for (const student of registeredStudents) {
    enrollmentMap.set(
      student.id,
      analysisStudentSubjects_(student, register.columns)
    );
  }

  /* ========== MARK VALIDATION ========== */

  const marksMap = new Map();
  const duplicateWarnings = [];
  const invalidWarnings = [];

  for (let i = 0; i < savedMarks.length; i++) {
    const row = savedMarks[i];
    const sheetRow = i + 2;

    const rowYear = Number(row[0]);
    const rowGrade = normalizeGrade_(row[1]);
    const rowTerm = String(row[2] == null ? '' : row[2]).trim();

    if (
      rowYear !== context.year ||
      rowGrade !== context.grade ||
      rowTerm !== context.term
    ) {
      continue;
    }

    const studentId = String(row[3] == null ? '' : row[3]).trim();
    const subject = String(row[6] == null ? '' : row[6]).trim();
    const rawMark = row[7];

    /* ========== STUDENT VALIDATION ========== */

    if (!studentMap.has(studentId)) {
      invalidWarnings.push(
        'Row ' + sheetRow + ': Student ' + studentId +
        ' is not registered in ' + context.grade
      );
      continue;
    }

    /* ========== ENROLLMENT VALIDATION ========== */

    const enrolledSubjects = enrollmentMap.get(studentId);
    if (!enrolledSubjects.includes(subject)) {
      invalidWarnings.push(
        'Row ' + sheetRow + ': Student ' + studentId +
        ' is not enrolled in ' + subject
      );
      continue;
    }

    /* ========== VALIDATE MARK OR ABSENT ========== */

    const markText = String(rawMark == null ? '' : rawMark).trim();
    let mark;

    if (
      markText.toUpperCase() === 'ABSENT' ||
      markText.toUpperCase() === 'AB'
    ) {
      mark = 'ABSENT';
    } else {
      if (
        typeof rawMark === 'boolean' ||
        !/^\d+(?:\.\d+)?$/.test(markText)
      ) {
        invalidWarnings.push(
          'Row ' + sheetRow + ': Invalid mark for student ' + studentId
        );
        continue;
      }

      mark = Number(markText);

      if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
        invalidWarnings.push(
          'Row ' + sheetRow + ': Mark must be between 0 and 100'
        );
        continue;
      }
    }

    /* ========== UNIQUE MARK KEY & DUPLICATE DETECTION ========== */

    const key = analysisMarkKey_(
      context.year,
      context.grade,
      context.term,
      studentId,
      subject
    );

    if (marksMap.has(key)) {
      duplicateWarnings.push(
        'Duplicate mark at row ' + sheetRow +
        ' for student ' + studentId + ', subject ' + subject
      );
      // Keep the key in marksMap with null so 2nd, 3rd, ... duplicates remain invalidated.
      marksMap.set(key, null);
      continue;
    }

    marksMap.set(key, mark);
  }

  /* ========== STUDENT PERFORMANCE ========== */

  const studentResults = [];
  let completeCount = 0;
  let classAverageSum = 0;
  let studentsWithAverage = 0;

  for (const student of registeredStudents) {
    const expectedSubjects = enrollmentMap.get(student.id);
    const expected = expectedSubjects.length;

    const marks = {};
    const missing = [];

    let totalRecorded = 0;
    let entered = 0;
    let absent = 0;
    let numericCount = 0;

    for (const subject of expectedSubjects) {
      const key = analysisMarkKey_(
        context.year,
        context.grade,
        context.term,
        student.id,
        subject
      );

      const mark = marksMap.get(key);

      if (typeof mark === 'number') {
        marks[subject] = mark;
        totalRecorded += mark;
        entered++;
        numericCount++;
      } else if (mark === 'ABSENT') {
        marks[subject] = 'AB';
        entered++;
        absent++;
      } else {
        missing.push(subject);
      }
    }

    const complete = expected > 0 && entered === expected;

    const average = complete && expected > 0
      ? analysisRound_(totalRecorded / expected)
      : null;

    if (complete) {
      completeCount++;
      if (average !== null) {
        classAverageSum += average;
        studentsWithAverage++;
      }
    }

    studentResults.push({
      id: student.id,
      name: student.name,
      expected,
      entered,
      absent,
      numericCount,
      complete,
      totalRecorded: analysisRound_(totalRecorded),
      average,
      marks,
      missing
    });
  }

  /* ========== SUBJECT PERFORMANCE ========== */

  const subjectResults = [];

  for (const subject of Object.keys(register.columns)) {
    const enrolledStudents = registeredStudents.filter(student =>
      enrollmentMap.get(student.id).includes(subject)
    );

    const enrolled = enrolledStudents.length;
    if (enrolled === 0) {
      continue;
    }

    const values = [];
    let absent = 0;

    for (const student of enrolledStudents) {
      const key = analysisMarkKey_(
        context.year,
        context.grade,
        context.term,
        student.id,
        subject
      );

      const mark = marksMap.get(key);

      if (typeof mark === 'number') {
        values.push(mark);
      } else if (mark === 'ABSENT') {
        absent++;
      }
    }

    const entered = values.length + absent;
    const pending = enrolled - entered;

    const average = entered > 0
      ? analysisRound_(
          values.reduce((sum, mark) => sum + mark, 0) / entered
        )
      : null;

    let highest = null;
    let lowest = null;

    if (entered > 0) {
      let maxVal = absent > 0 ? 0 : -Infinity;
      let minVal = absent > 0 ? 0 : Infinity;
      for (const v of values) {
        if (v > maxVal) maxVal = v;
        if (v < minVal) minVal = v;
      }
      highest = maxVal;
      lowest = minVal;
    }

    subjectResults.push({
      subject,
      enrolled,
      entered,
      absent,
      pending,
      average,
      highest,
      lowest
    });
  }

  /* ========== CLASS AVERAGE ========== */

  const classAverage = studentsWithAverage > 0
    ? analysisRound_(classAverageSum / studentsWithAverage)
    : null;

  const studentCount = registeredStudents.length;
  const pendingCount = studentCount - completeCount;

  /* ========== RETURN RESULTS ========== */

  return {
    year: context.year,
    grade: context.grade,
    term: context.term,

    studentCount,
    completeCount,
    pendingCount,
    classAverage,

    students: studentResults,
    subjects: subjectResults,

    warnings: {
      duplicates: duplicateWarnings,
      invalidOrUnmatched: invalidWarnings
    },

    note:
      'Enrollment is based on the current student register. ' +
      'Historical enrollment snapshots are not yet implemented. ' +
      'ABSENT is displayed as AB and counts as zero in averages. ' +
      'ABSENT counts as entered for submission completion. ' +
      'Blank marks remain pending. ' +
      'Final student and class averages include complete results only. ' +
      'Subject averages use submitted results and may be provisional. ' +
      'A/L averages here are general school averages, not official Z-scores.'
  };
}

/* ========== TEST FUNCTIONS ========== */

function testAnalysis_() {
  const result = getAnalysisInternal_(2026, 'Grade 06', 'Term 1');
  Logger.log(
    JSON.stringify({
      year: result.year,
      grade: result.grade,
      term: result.term,
      studentCount: result.studentCount,
      completeCount: result.completeCount,
      pendingCount: result.pendingCount,
      classAverage: result.classAverage,
      subjects: result.subjects.length,
      warnings: result.warnings
    })
  );
}

function testAnalysisGrade11_() {
  const result = getAnalysisInternal_(2026, 'Grade 11', 'Term 1');
  Logger.log(
    JSON.stringify({
      grade: result.grade,
      studentCount: result.studentCount,
      completeCount: result.completeCount,
      classAverage: result.classAverage,
      subjects: result.subjects.length,
      warnings: result.warnings
    }, null, 2)
  );
}

function testAnalysisGrade12_() {
  const result = getAnalysisInternal_(2026, 'Grade 12', 'Term 1');
  Logger.log(
    JSON.stringify({
      grade: result.grade,
      studentCount: result.studentCount,
      completeCount: result.completeCount,
      classAverage: result.classAverage,
      subjects: result.subjects.length,
      warnings: result.warnings
    }, null, 2)
  );
}

function testAnalysisGrade13_() {
  const result = getAnalysisInternal_(2026, 'Grade 13', 'Term 1');
  Logger.log(
    JSON.stringify({
      grade: result.grade,
      studentCount: result.studentCount,
      completeCount: result.completeCount,
      classAverage: result.classAverage,
      subjects: result.subjects.length,
      warnings: result.warnings
    }, null, 2)
  );
}