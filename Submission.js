
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 5 of 7: Submission.gs
 *
 * MULTI-REGISTER SUBMISSION VALIDATION
 *
 * Grades 06-09 -> Junior Register
 * Grades 10-11 -> O/L Register
 * Grades 12-13 -> A/L Register
 *
 * Supports:
 * - Dynamically detected subjects
 * - Numeric marks from 0 to 100
 * - ABSENT as a valid recorded result
 * - Duplicate submission prevention
 * - Pending student identification
 * - Submission progress summaries
 *
 * This file does not modify spreadsheet data.
 *
 * Dependencies:
 *
 * Code.gs:
 *   validateContext_()
 *   readRegister_()
 *   readStudents_()
 *   normalizeGrade_()
 *   yes_()
 *
 * Analysis.gs:
 *   getAnalysisInternal_()
 *   analysisReadMarks_()
 *   analysisMarkKey_()
 *
 * Dashboard.gs:
 *   getSubmissionStatusInternal_()
 */

/* ========== SUBJECT VALIDATION ========== */

/**
 * Validate a subject against the correct
 * register for the selected grade.
 *
 * Example:
 * submissionValidateSubject_('ICT', 'Grade 12')
 */
function submissionValidateSubject_(subject, grade) {

  const name = String(subject || '').trim();

  if (!name) {
    throw new Error('Please select a subject.');
  }

  const normalizedGrade = normalizeGrade_(grade);

  if (!normalizedGrade) {
    throw new Error('Invalid grade.');
  }

  // Automatically select the correct register.
  const register = readRegister_(normalizedGrade);

  if (
    !Object.prototype.hasOwnProperty.call(
      register.columns,
      name
    )
  ) {
    throw new Error(
      'Unknown subject "' +
      name +
      '" for ' +
      normalizedGrade
    );
  }

  return name;
}

/* ========== CHECK EXISTING MARKS ========== */

/**
 * Check whether a student's result already exists.
 *
 * Example:
 *
 * checkMarkExistsInternal_(
 *   2026,
 *   'Grade 12',
 *   'Term 1',
 *   'ST001',
 *   'Economics'
 * )
 *
 * Returns:
 * {
 *   exists: true,
 *   mark: 75 OR 'ABSENT',
 *   duplicate: false,
 *   count: 1,
 *   rows: [2]
 * }
 *
 * This function does not change stored marks.
 */
function checkMarkExistsInternal_(
  year,
  grade,
  term,
  studentId,
  subject
) {

  const context = validateContext_(
    year,
    grade,
    term
  );

  const selectedSubject = submissionValidateSubject_(
    subject,
    context.grade
  );

  const id = String(studentId || '').trim();

  if (!id) {
    throw new Error('Student ID is required.');
  }

  // Read the correct register.
  const register = readRegister_(context.grade);

  const student = readStudents_(register.rows).find(
    s =>
      s.id === id &&
      s.grade === context.grade
  );

  if (!student) {
    throw new Error(
      'Student not found in ' +
      context.grade +
      ': ' +
      id
    );
  }

  const subjectColumn =
    register.columns[selectedSubject];

  if (!yes_(student.row[subjectColumn])) {
    throw new Error(
      'Student is not enrolled in ' +
      selectedSubject
    );
  }

  const rows = analysisReadMarks_();
  const matches = [];

  for (let i = 0; i < rows.length; i++) {

    const row = rows[i];

    if (
      Number(row[0]) === context.year &&
      normalizeGrade_(row[1]) === context.grade &&
      String(row[2]).trim() === context.term &&
      String(row[3]).trim() === id &&
      String(row[6]).trim() === selectedSubject
    ) {

      matches.push({
        rowNumber: i + 2,
        mark: row[7]
      });
    }
  }

  return {
    exists: matches.length > 0,

    mark:
      matches.length === 1
        ? matches[0].mark
        : null,

    duplicate: matches.length > 1,
    count: matches.length,

    rows: matches.map(
      match => match.rowNumber
    )
  };
}

/* ========== GET PENDING STUDENTS ========== */

/**
 * Return students who are enrolled in a
 * subject but do not have a valid result.
 *
 * ABSENT counts as entered.
 * Blank marks remain pending.
 *
 * Duplicate or invalid results remain pending
 * until the records are corrected.
 */
function getPendingStudentsInternal_(
  year,
  grade,
  term,
  subject
) {

  const context = validateContext_(
    year,
    grade,
    term
  );

  const selectedSubject = submissionValidateSubject_(
    subject,
    context.grade
  );

  const analysis = getAnalysisInternal_(
    context.year,
    context.grade,
    context.term
  );

  // Read the correct register.
  const register = readRegister_(context.grade);

  const subjectColumn =
    register.columns[selectedSubject];

  const enrolledStudents = readStudents_(
    register.rows
  ).filter(
    student =>
      student.grade === context.grade &&
      yes_(student.row[subjectColumn])
  );

  const resultMap = new Map(
    analysis.students.map(student => [
      student.id,
      student
    ])
  );

  const pendingStudents = [];

  for (const student of enrolledStudents) {

    const result = resultMap.get(student.id);

    if (
      !result ||
      result.missing.includes(selectedSubject)
    ) {

      pendingStudents.push({
        id: student.id,
        name: student.name
      });
    }
  }

  return {
    year: context.year,
    grade: context.grade,
    term: context.term,
    subject: selectedSubject,

    enrolled: enrolledStudents.length,
    pending: pendingStudents.length,

    // Numeric marks and ABSENT both count.
    entered:
      enrolledStudents.length -
      pendingStudents.length,

    students: pendingStudents
  };
}

/* ========== VALIDATE SUBMISSION ========== */

/**
 * Validate proposed marks before saving.
 *
 * This function DOES NOT save marks.
 *
 * Example payload:
 *
 * {
 *   year: 2026,
 *   grade: 'Grade 12',
 *   term: 'Term 1',
 *   subject: 'Economics',
 *   marks: [
 *     { id: 'ST001', mark: 78 },
 *     { id: 'ST002', mark: 'ABSENT' },
 *     { id: 'ST003', mark: 0 }
 *   ]
 * }
 *
 * Rules:
 * - Only enrolled students are accepted.
 * - Blank marks are skipped.
 * - ABSENT is valid.
 * - Existing results cannot be overwritten.
 * - Duplicate student IDs are rejected.
 */
function validateMarksSubmissionInternal_(payload) {

  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error('Invalid submission.');
  }

  const context = validateContext_(
    payload.year,
    payload.grade,
    payload.term
  );

  const selectedSubject = submissionValidateSubject_(
    payload.subject,
    context.grade
  );

  if (!Array.isArray(payload.marks)) {
    throw new Error(
      'Marks must be provided as an array.'
    );
  }

  /* ========== ALLOWED STUDENTS ========== */

  const register = readRegister_(context.grade);

  const subjectColumn =
    register.columns[selectedSubject];

  const allowedStudents = readStudents_(
    register.rows
  ).filter(
    student =>
      student.grade === context.grade &&
      yes_(student.row[subjectColumn])
  );

  const allowedIds = new Set(
    allowedStudents.map(
      student => student.id
    )
  );

  /* ========== EXISTING MARKS ========== */

  const existingRows = analysisReadMarks_();

  const existingKeys = new Set();

  for (const row of existingRows) {

    existingKeys.add(
      analysisMarkKey_(
        row[0],
        normalizeGrade_(row[1]),
        String(row[2]).trim(),
        String(row[3]).trim(),
        String(row[6]).trim()
      )
    );
  }

  /* ========== SUBMISSION VALIDATION ========== */

  const seenIds = new Set();

  const accepted = [];
  const skipped = [];
  const errors = [];

  for (const item of payload.marks) {

    if (
      !item ||
      typeof item !== 'object'
    ) {
      errors.push('Invalid student record.');
      continue;
    }

    const id = String(
      item.id || ''
    ).trim();

    if (!id) {
      errors.push(
        'A student record has no ID.'
      );
      continue;
    }

    /* ========== DUPLICATE STUDENT CHECK ========== */

    if (seenIds.has(id)) {

      errors.push(
        'Duplicate student in submission: ' +
        id
      );

      continue;
    }

    seenIds.add(id);

    /* ========== ENROLLMENT CHECK ========== */

    if (!allowedIds.has(id)) {

      errors.push(
        'Student is not enrolled: ' +
        id
      );

      continue;
    }

    /* ========== BLANK MARKS ========== */

    if (
      item.mark === '' ||
      item.mark === null ||
      item.mark === undefined
    ) {

      skipped.push(id);
      continue;
    }

    const markText = String(
      item.mark
    ).trim();

    let mark;

    /* ========== ABSENT VALIDATION ========== */

    if (
      markText.toUpperCase() === 'ABSENT'
    ) {

      mark = 'ABSENT';

    } else {

      /* ========== NUMERIC VALIDATION ========== */

      if (
        typeof item.mark === 'boolean' ||
        !/^\d+(?:\.\d+)?$/.test(markText)
      ) {

        errors.push(
          'Invalid mark for student ' +
          id
        );

        continue;
      }

      mark = Number(markText);

      if (
        !Number.isFinite(mark) ||
        mark < 0 ||
        mark > 100
      ) {

        errors.push(
          'Mark must be between 0 and 100: ' +
          id
        );

        continue;
      }
    }

    /* ========== EXISTING RESULT CHECK ========== */

    const key = analysisMarkKey_(
      context.year,
      context.grade,
      context.term,
      id,
      selectedSubject
    );

    if (existingKeys.has(key)) {

      errors.push(
        'Result already submitted for student ' +
        id
      );

      continue;
    }

    /* ========== ACCEPT VALID MARK ========== */

    accepted.push({
      id,
      mark
    });
  }

  /* ========== RETURN VALIDATION RESULT ========== */

  return {
    valid:
      errors.length === 0 &&
      accepted.length > 0,

    year: context.year,
    grade: context.grade,
    term: context.term,
    subject: selectedSubject,

    acceptedCount: accepted.length,
    skippedCount: skipped.length,
    errorCount: errors.length,

    absentCount: accepted.filter(
      item => item.mark === 'ABSENT'
    ).length,

    numericCount: accepted.filter(
      item => typeof item.mark === 'number'
    ).length,

    accepted,
    skipped,
    errors
  };
}

/* ========== SUBMISSION SUMMARY ========== */

/**
 * Return a grade-specific summary of
 * marks submission progress.
 *
 * This uses Dashboard.gs.
 *
 * Numeric marks and ABSENT both count
 * as entered.
 */
function getSubmissionSummaryInternal_(
  year,
  grade,
  term
) {

  const status = getSubmissionStatusInternal_(
    year,
    grade,
    term
  );

  const percent =
    status.expectedMarks > 0
      ? Math.round(
          (
            status.enteredMarks /
            status.expectedMarks
          ) * 10000
        ) / 100
      : 0;

  return {
    year: status.year,
    grade: status.grade,
    term: status.term,

    studentCount: status.studentCount,

    expectedMarks: status.expectedMarks,
    enteredMarks: status.enteredMarks,

    numericMarks: status.numericMarks,
    absentMarks: status.absentMarks,

    missingMarks: status.missingMarks,

    completionPercentage: percent,

    completedSubjects: status.completed,
    partialSubjects: status.partial,
    pendingSubjects: status.pending,

    allComplete:
      status.expectedMarks > 0 &&
      status.missingMarks === 0
  };
}

/* ========== TEST FUNCTIONS ========== */

/**
 * Generic read-only submission test.
 *
 * Run with fictional student data.
 */
function testSubmissionForGrade__(
  year,
  grade,
  term
) {

  const context = validateContext_(
    year,
    grade,
    term
  );

  const summary = getSubmissionSummaryInternal_(
    context.year,
    context.grade,
    context.term
  );

  Logger.log(
    JSON.stringify(
      summary,
      null,
      2
    )
  );

  const register = readRegister_(
    context.grade
  );

  const students = readStudents_(
    register.rows
  ).filter(
    student =>
      student.grade === context.grade
  );

  if (students.length > 0) {

    const student = students[0];

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

    if (subjects.length > 0) {

      const check = checkMarkExistsInternal_(
        context.year,
        context.grade,
        context.term,
        student.id,
        subjects[0]
      );

      Logger.log(
        'Existing result check: ' +
        JSON.stringify(check)
      );
    }
  }

  Logger.log(
    'Submission verification completed for ' +
    context.grade
  );
}

/**
 * Original Grade 06 test.
 */
function testSubmission_() {

  testSubmissionForGrade_(
    2026,
    'Grade 06',
    'Term 1'
  );
}

/**
 * Grade 11 test.
 */
function testSubmissionGrade11_() {

  testSubmissionForGrade_(
    2026,
    'Grade 11',
    'Term 1'
  );
}

/**
 * Grade 12 test.
 */
function testSubmissionGrade12_() {

  testSubmissionForGrade_(
    2026,
    'Grade 12',
    'Term 1'
  );
}

/**
 * Grade 13 test.
 */
function testSubmissionGrade13_() {

  testSubmissionForGrade_(
    2026,
    'Grade 13',
    'Term 1'
  );
}
