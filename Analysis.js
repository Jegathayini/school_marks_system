
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 3 of 7: Analysis.gs
 *
 * Calculates academic performance from Google Sheets.
 *
 * ABSENT RULE:
 * - ABSENT is a valid recorded result.
 * - ABSENT counts as entered.
 * - ABSENT contributes zero to averages.
 * - ABSENT is displayed as AB in student marks.
 * - Blank marks remain pending.
 *
 * Dependencies from Code.gs:
 * book_(), readRegister_(), readStudents_(),
 * normalizeGrade_(), yes_(), validateContext_(),
 * MARKS_SHEET
 */

/* ========== HELPER FUNCTIONS ========== */

function analysisRound_(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function analysisMarkKey_(year, grade, term, studentId, subject) {
  return [
    String(year),
    String(grade),
    String(term),
    String(studentId),
    String(subject)
  ].join('|');
}

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
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      expectedHeaders.length
    )
    .getValues();
}

function analysisStudentSubjects_(student, columns) {
  return Object.keys(columns).filter(subject => {
    return yes_(student.row[columns[subject]]);
  });
}

/* ========== MAIN ANALYSIS FUNCTION ========== */

function getAnalysis(year, grade, term) {

  const context = validateContext_(year, grade, term);
  const register = readRegister_();

  const registeredStudents = readStudents_(register.rows)
    .filter(student => student.grade === context.grade);

  const savedMarks = analysisReadMarks_();

  const studentMap = new Map();

  for (const student of registeredStudents) {
    studentMap.set(student.id, student);
  }

  const enrollmentMap = new Map();

  for (const student of registeredStudents) {
    enrollmentMap.set(
      student.id,
      analysisStudentSubjects_(student, register.columns)
    );
  }

  const marksMap = new Map();
  const duplicateWarnings = [];
  const invalidWarnings = [];

  /* ========== VALIDATE SAVED MARKS ========== */

  for (let i = 0; i < savedMarks.length; i++) {

    const row = savedMarks[i];
    const sheetRow = i + 2;

    const rowYear = Number(row[0]);
    const rowGrade = normalizeGrade_(row[1]);
    const rowTerm = String(row[2] || '').trim();

    if (
      rowYear !== context.year ||
      rowGrade !== context.grade ||
      rowTerm !== context.term
    ) {
      continue;
    }

    const studentId = String(row[3] || '').trim();
    const subject = String(row[6] || '').trim();
    const rawMark = row[7];

    if (!studentMap.has(studentId)) {
      invalidWarnings.push(
        'Row ' + sheetRow +
        ': Student ' + studentId +
        ' is not registered in ' + context.grade
      );
      continue;
    }

    const enrolledSubjects = enrollmentMap.get(studentId);

    if (!enrolledSubjects.includes(subject)) {
      invalidWarnings.push(
        'Row ' + sheetRow +
        ': Student ' + studentId +
        ' is not enrolled in ' + subject
      );
      continue;
    }

    /* ========== VALIDATE MARK OR ABSENT ========== */

    const markText = String(
      rawMark == null ? '' : rawMark
    ).trim();

    let mark;

    if (
      markText.toUpperCase() === 'ABSENT' ||
      markText.toUpperCase() === 'AB'
    ) {

      // Store absence consistently.
      mark = 'ABSENT';

    } else {

      if (
        typeof rawMark === 'boolean' ||
        !/^\d+(?:\.\d+)?$/.test(markText)
      ) {
        invalidWarnings.push(
          'Row ' + sheetRow +
          ': Invalid mark for student ' + studentId
        );
        continue;
      }

      mark = Number(markText);

      if (
        !Number.isFinite(mark) ||
        mark < 0 ||
        mark > 100
      ) {
        invalidWarnings.push(
          'Row ' + sheetRow +
          ': Mark must be between 0 and 100'
        );
        continue;
      }
    }

    const key = analysisMarkKey_(
      context.year,
      context.grade,
      context.term,
      studentId,
      subject
    );

    /* ========== DUPLICATE DETECTION ========== */

    if (marksMap.has(key)) {

      duplicateWarnings.push(
        'Duplicate mark at row ' + sheetRow +
        ' for student ' + studentId +
        ', subject ' + subject
      );

      // Duplicate results remain invalid.
      marksMap.set(key, null);
      continue;
    }

    if (!marksMap.has(key)) {
      marksMap.set(key, mark);
    }
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

        // Display AB instead of ABSENT.
        marks[subject] = 'AB';

        // Absence is entered and contributes zero.
        entered++;
        absent++;

      } else {

        // Only genuinely missing results are pending.
        missing.push(subject);
      }
    }

    /* ========== STUDENT COMPLETION ========== */

    const complete = expected > 0 && entered === expected;

    /*
     * Divide by all enrolled subjects.
     * Absent subjects count as zero.
     */
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

    const enrolledStudents = registeredStudents.filter(student => {
      return enrollmentMap.get(student.id).includes(subject);
    });

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

    /* ========== SUBJECT COMPLETION ========== */

    const entered = values.length + absent;
    const pending = enrolled - entered;

    /*
     * Include ABSENT as zero in the divisor.
     * Pending marks are excluded.
     */
    const average = entered > 0
      ? analysisRound_(
          values.reduce(
            (sum, mark) => sum + mark,
            0
          ) / entered
        )
      : null;

    /*
     * ABSENT counts as zero for highest/lowest.
     * Highest and lowest are only available
     * when at least one result is entered.
     */
    const highest = entered > 0
      ? Math.max(...values, ...(absent > 0 ? [0] : []))
      : null;

    const lowest = entered > 0
      ? Math.min(...values, ...(absent > 0 ? [0] : []))
      : null;

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

  /*
   * Class average uses completed students only.
   * Their individual averages already include
   * ABSENT as zero.
   */
  const classAverage = studentsWithAverage > 0
    ? analysisRound_(
        classAverageSum / studentsWithAverage
      )
    : null;

  const studentCount = registeredStudents.length;
  const pendingCount = studentCount - completeCount;

  /* ========== RETURN DASHBOARD DATA ========== */

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
      'Subject averages use submitted results and may be provisional.'
  };
}

/* ========== TEST FUNCTION ========== */

function testAnalysis() {

  const result = getAnalysis(
    2026,
    'Grade 06',
    'Term 1'
  );

  Logger.log(JSON.stringify({
    year: result.year,
    grade: result.grade,
    term: result.term,

    studentCount: result.studentCount,
    completeCount: result.completeCount,
    pendingCount: result.pendingCount,

    classAverage: result.classAverage,

    subjects: result.subjects.length,
    warnings: result.warnings
  }));
}
