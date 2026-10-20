
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
 * Uses the updated Code.gs functions.
 *
 * ABSENT RULES:
 * - ABSENT is a valid recorded result.
 * - ABSENT counts as entered.
 * - ABSENT contributes zero to averages.
 * - ABSENT is displayed as AB.
 * - Blank marks remain pending.
 *
 * A/L NOTE:
 * Three main subjects, General English and GIT
 * are tracked as separate enrolled subjects.
 *
 * This version preserves the existing general
 * average calculation across all enrolled subjects.
 * It does not calculate official A/L Z-scores,
 * university admission eligibility, or stream-
 * specific examination results.
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
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

/**
 * Create a unique key for a mark.
 */
function analysisMarkKey_(
  year,
  grade,
  term,
  studentId,
  subject
) {
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

  const sheet = book_().getSheetByName(
    MARKS_SHEET
  );

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
    .getRange(
      1,
      1,
      1,
      expectedHeaders.length
    )
    .getDisplayValues()[0];

  if (
    headers.join('|') !==
    expectedHeaders.join('|')
  ) {
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

/**
 * Get subjects enrolled by one student.
 *
 * The subject list comes from the correct
 * register for the selected grade.
 */
function analysisStudentSubjects_(
  student,
  columns
) {
  return Object.keys(columns).filter(
    subject => {
      return yes_(
        student.row[columns[subject]]
      );
    }
  );
}

/* ========== MAIN ANALYSIS FUNCTION ========== */

/**
 * Calculate results for one academic context.
 *
 * Examples:
 *
 * getAnalysisInternal_(2026, 'Grade 06', 'Term 1')
 * getAnalysisInternal_(2026, 'Grade 10', 'Term 2')
 * getAnalysisInternal_(2026, 'Grade 12', 'Term 3')
 */
function getAnalysisInternal_(year, grade, term) {

  /* ========== VALIDATE CONTEXT ========== */

  const context = validateContext_(
    year,
    grade,
    term
  );

  /*
   * IMPORTANT MULTI-REGISTER CHANGE:
   *
   * Previously:
   * const register = readRegister_();
   *
   * Now:
   * Pass the selected grade so the correct
   * register is opened automatically.
   */
  const register = readRegister_(
    context.grade
  );

  /* ========== LOAD REGISTERED STUDENTS ========== */

  const registeredStudents = readStudents_(
    register.rows
  ).filter(
    student =>
      student.grade === context.grade
  );

  /* ========== LOAD SAVED MARKS ========== */

  const savedMarks = analysisReadMarks_();

  /* ========== STUDENT LOOKUP ========== */

  const studentMap = new Map();

  for (const student of registeredStudents) {
    studentMap.set(
      student.id,
      student
    );
  }

  /* ========== SUBJECT ENROLLMENT ========== */

  const enrollmentMap = new Map();

  for (const student of registeredStudents) {

    enrollmentMap.set(
      student.id,
      analysisStudentSubjects_(
        student,
        register.columns
      )
    );
  }

  /* ========== MARK VALIDATION ========== */

  const marksMap = new Map();

  const duplicateWarnings = [];
  const invalidWarnings = [];

  /*
   * Once a duplicate key is detected,
   * that mark remains invalid.
   */
  const duplicateKeys = new Set();

  for (
    let i = 0;
    i < savedMarks.length;
    i++
  ) {

    const row = savedMarks[i];
    const sheetRow = i + 2;

    const rowYear = Number(row[0]);

    const rowGrade = normalizeGrade_(
      row[1]
    );

    const rowTerm = String(
      row[2] || ''
    ).trim();

    /*
     * Only analyze marks matching the
     * selected year, grade and term.
     */
    if (
      rowYear !== context.year ||
      rowGrade !== context.grade ||
      rowTerm !== context.term
    ) {
      continue;
    }

    const studentId = String(
      row[3] || ''
    ).trim();

    const subject = String(
      row[6] || ''
    ).trim();

    const rawMark = row[7];

    /* ========== STUDENT VALIDATION ========== */

    if (!studentMap.has(studentId)) {

      invalidWarnings.push(
        'Row ' +
        sheetRow +
        ': Student ' +
        studentId +
        ' is not registered in ' +
        context.grade
      );

      continue;
    }

    /* ========== ENROLLMENT VALIDATION ========== */

    const enrolledSubjects =
      enrollmentMap.get(studentId);

    if (
      !enrolledSubjects.includes(subject)
    ) {

      invalidWarnings.push(
        'Row ' +
        sheetRow +
        ': Student ' +
        studentId +
        ' is not enrolled in ' +
        subject
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

      // Normalize absence.
      mark = 'ABSENT';

    } else {

      if (
        typeof rawMark === 'boolean' ||
        !/^\d+(?:\.\d+)?$/.test(markText)
      ) {

        invalidWarnings.push(
          'Row ' +
          sheetRow +
          ': Invalid mark for student ' +
          studentId
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
          'Row ' +
          sheetRow +
          ': Mark must be between 0 and 100'
        );

        continue;
      }
    }

    /* ========== UNIQUE MARK KEY ========== */

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
        'Duplicate mark at row ' +
        sheetRow +
        ' for student ' +
        studentId +
        ', subject ' +
        subject
      );

      duplicateKeys.add(key);

      // Duplicate results are not used.
      marksMap.set(key, null);

      continue;
    }

    /*
     * Never restore a duplicated mark,
     * even if there are three or more rows.
     */
    if (duplicateKeys.has(key)) {
      continue;
    }

    marksMap.set(
      key,
      mark
    );
  }

  /* ========== STUDENT PERFORMANCE ========== */

  const studentResults = [];

  let completeCount = 0;

  let classAverageSum = 0;
  let studentsWithAverage = 0;

  for (const student of registeredStudents) {

    const expectedSubjects =
      enrollmentMap.get(student.id);

    const expected =
      expectedSubjects.length;

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

      /* ========== NUMERIC MARK ========== */

      if (typeof mark === 'number') {

        marks[subject] = mark;

        totalRecorded += mark;

        entered++;
        numericCount++;

      /* ========== ABSENT ========== */

      } else if (mark === 'ABSENT') {

        // Display AB.
        marks[subject] = 'AB';

        // Counts as entered, worth zero.
        entered++;
        absent++;

      /* ========== PENDING ========== */

      } else {

        missing.push(subject);
      }
    }

    /* ========== COMPLETION ========== */

    const complete =
      expected > 0 &&
      entered === expected;

    /*
     * Student average:
     *
     * Total numeric marks divided by
     * ALL enrolled subjects.
     *
     * ABSENT contributes zero.
     *
     * A final average is calculated
     * only after every subject is entered.
     */
    const average =
      complete && expected > 0
        ? analysisRound_(
            totalRecorded / expected
          )
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

      totalRecorded: analysisRound_(
        totalRecorded
      ),

      average,

      marks,
      missing
    });
  }

  /* ========== SUBJECT PERFORMANCE ========== */

  const subjectResults = [];

  for (
    const subject of Object.keys(
      register.columns
    )
  ) {

    const enrolledStudents =
      registeredStudents.filter(
        student => {
          return enrollmentMap
            .get(student.id)
            .includes(subject);
        }
      );

    const enrolled =
      enrolledStudents.length;

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

    const entered =
      values.length + absent;

    const pending =
      enrolled - entered;

    /*
     * Subject average:
     *
     * Numeric total divided by
     * submitted results.
     *
     * ABSENT counts as zero.
     * Pending results are excluded.
     */
    const average =
      entered > 0
        ? analysisRound_(
            values.reduce(
              (sum, mark) => sum + mark,
              0
            ) / entered
          )
        : null;

    /*
     * ABSENT contributes zero when
     * determining highest and lowest.
     */
    const highest =
      entered > 0
        ? Math.max(
            ...values,
            ...(absent > 0 ? [0] : [])
          )
        : null;

    const lowest =
      entered > 0
        ? Math.min(
            ...values,
            ...(absent > 0 ? [0] : [])
          )
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
   * Only completed students contribute
   * to the final class average.
   *
   * Their individual averages already
   * include ABSENT as zero.
   */
  const classAverage =
    studentsWithAverage > 0
      ? analysisRound_(
          classAverageSum /
          studentsWithAverage
        )
      : null;

  const studentCount =
    registeredStudents.length;

  const pendingCount =
    studentCount - completeCount;

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

/**
 * Original Grade 06 test.
 */
function testAnalysis_() {

  const result = getAnalysisInternal_(
    2026,
    'Grade 06',
    'Term 1'
  );

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

/**
 * Test Grade 11 analysis.
 *
 * Requires a Grade 11 register.
 */
function testAnalysisGrade11_() {

  const result = getAnalysisInternal_(
    2026,
    'Grade 11',
    'Term 1'
  );

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

/**
 * Test Grade 12 analysis.
 *
 * Requires a Grade 12 register.
 */
function testAnalysisGrade12_() {

  const result = getAnalysisInternal_(
    2026,
    'Grade 12',
    'Term 1'
  );

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

/**
 * Test Grade 13 analysis.
 *
 * Requires a Grade 13 register.
 */
function testAnalysisGrade13_() {

  const result = getAnalysisInternal_(
    2026,
    'Grade 13',
    'Term 1'
  );

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
