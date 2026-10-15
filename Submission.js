
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 5 of 7: Submission.gs
 *
 * Submission validation and verification utilities.
 *
 * Supports:
 * - Numeric marks (0 to 100)
 * - ABSENT as a valid recorded result
 * - Duplicate submission prevention
 * - Pending student identification
 * - Submission progress summaries
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
 *   getAnalysis()
 *   analysisReadMarks_()
 *   analysisMarkKey_()
 *
 * Dashboard.gs:
 *   getSubmissionStatus()
 *
 * This file does not modify spreadsheet data.
 */

/* ========== SUBJECT VALIDATION ========== */

/**
 * Validate a subject against the student register.
 */
function submissionValidateSubject_(subject) {

  const name = String(subject || '').trim();

  if (!name) {
    throw new Error('Please select a subject.');
  }

  const register = readRegister_();

  if (!Object.prototype.hasOwnProperty.call(
    register.columns,
    name
  )) {
    throw new Error('Unknown subject: ' + name);
  }

  return name;
}

/* ========== CHECK EXISTING MARKS ========== */

/**
 * Check whether a student's result is already stored.
 *
 * Example:
 *
 * checkMarkExists(
 *   2026,
 *   'Grade 06',
 *   'Term 1',
 *   'ST001',
 *   'Maths'
 * )
 *
 * Returns:
 * {
 *   exists: true,
 *   mark: 75 OR 'ABSENT',
 *   duplicate: false
 * }
 */
function checkMarkExists(year, grade, term, studentId, subject) {

  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject);
  const id = String(studentId || '').trim();

  if (!id) {
    throw new Error('Student ID is required.');
  }

  const register = readRegister_();

  const student = readStudents_(register.rows).find(
    s => s.id === id && s.grade === context.grade
  );

  if (!student) {
    throw new Error(
      'Student not found in ' + context.grade + ': ' + id
    );
  }

  if (!yes_(student.row[register.columns[selectedSubject]])) {
    throw new Error(
      'Student is not enrolled in ' + selectedSubject
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
    mark: matches.length === 1 ? matches[0].mark : null,
    duplicate: matches.length > 1,
    count: matches.length,
    rows: matches.map(m => m.rowNumber)
  };
}

/* ========== GET PENDING STUDENTS ========== */

/**
 * Return students whose results are still missing.
 *
 * ABSENT is considered an entered result.
 * Therefore, absent students are not returned
 * as pending.
 */
function getPendingStudents(year, grade, term, subject) {

  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject);

  const analysis = getAnalysis(
    context.year,
    context.grade,
    context.term
  );

  const register = readRegister_();

  const enrolledStudents = readStudents_(register.rows)
    .filter(student =>
      student.grade === context.grade &&
      yes_(student.row[register.columns[selectedSubject]])
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
      result &&
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

    // Includes numeric marks and ABSENT.
    entered: enrolledStudents.length - pendingStudents.length,

    students: pendingStudents
  };
}

/* ========== VALIDATE SUBMISSION ========== */

/**
 * Check a proposed marks submission before saving.
 *
 * This function DOES NOT save marks.
 *
 * Example payload:
 *
 * {
 *   year: 2026,
 *   grade: 'Grade 06',
 *   term: 'Term 1',
 *   subject: 'Maths',
 *   marks: [
 *     { id: 'ST001', mark: 78 },
 *     { id: 'ST002', mark: 'ABSENT' },
 *     { id: 'ST003', mark: 0 }
 *   ]
 * }
 *
 * Blank marks are ignored.
 * ABSENT counts as entered.
 * Existing results are rejected.
 */
function validateMarksSubmission(payload) {

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid submission.');
  }

  const context = validateContext_(
    payload.year,
    payload.grade,
    payload.term
  );

  const selectedSubject = submissionValidateSubject_(
    payload.subject
  );

  if (!Array.isArray(payload.marks)) {
    throw new Error('Marks must be provided as an array.');
  }

  const register = readRegister_();

  const allowedStudents = readStudents_(register.rows)
    .filter(student =>
      student.grade === context.grade &&
      yes_(student.row[register.columns[selectedSubject]])
    );

  const allowedIds = new Set(
    allowedStudents.map(student => student.id)
  );

  const existingRows = analysisReadMarks_();
  const existingKeys = new Set();

  for (const row of existingRows) {

    existingKeys.add(
      analysisMarkKey_(
        row[0],
        normalizeGrade_(row[1]),
        row[2],
        row[3],
        row[6]
      )
    );
  }

  const seenIds = new Set();
  const accepted = [];
  const skipped = [];
  const errors = [];

  for (const item of payload.marks) {

    const id = String(item.id || '').trim();

    if (!id) {
      errors.push('A student record has no ID.');
      continue;
    }

    if (seenIds.has(id)) {
      errors.push('Duplicate student in submission: ' + id);
      continue;
    }

    seenIds.add(id);

    if (!allowedIds.has(id)) {
      errors.push('Student is not enrolled: ' + id);
      continue;
    }

    // Blank marks remain pending.
    if (
      item.mark === '' ||
      item.mark === null ||
      item.mark === undefined
    ) {
      skipped.push(id);
      continue;
    }

    const markText = String(item.mark).trim();

    let mark;

    /* ========== ABSENT VALIDATION ========== */

    if (markText.toUpperCase() === 'ABSENT') {

      // Store a consistent uppercase value.
      mark = 'ABSENT';

    } else {

      /* ========== NUMERIC MARK VALIDATION ========== */

      if (!/^\d+(?:\.\d+)?$/.test(markText)) {
        errors.push('Invalid mark for student ' + id);
        continue;
      }

      mark = Number(markText);

      if (
        !Number.isFinite(mark) ||
        mark < 0 ||
        mark > 100
      ) {
        errors.push(
          'Mark must be between 0 and 100: ' + id
        );
        continue;
      }
    }

    /* ========== DUPLICATE PREVENTION ========== */

    const key = analysisMarkKey_(
      context.year,
      context.grade,
      context.term,
      id,
      selectedSubject
    );

    if (existingKeys.has(key)) {
      errors.push(
        'Result already submitted for student ' + id
      );
      continue;
    }

    accepted.push({
      id,
      mark
    });
  }

  return {
    valid: errors.length === 0 && accepted.length > 0,

    year: context.year,
    grade: context.grade,
    term: context.term,
    subject: selectedSubject,

    acceptedCount: accepted.length,
    skippedCount: skipped.length,
    errorCount: errors.length,

    // Separate absence count for easier reporting.
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
 * Return a summary of submission progress.
 *
 * Numeric marks and ABSENT both count as entered.
 */
function getSubmissionSummary(year, grade, term) {

  const status = getSubmissionStatus(year, grade, term);

  const percent = status.expectedMarks > 0
    ? Math.round(
        (status.enteredMarks / status.expectedMarks) * 10000
      ) / 100
    : 0;

  return {
    year: status.year,
    grade: status.grade,
    term: status.term,

    studentCount: status.studentCount,

    expectedMarks: status.expectedMarks,
    enteredMarks: status.enteredMarks,

    // New absence-aware fields.
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

/* ========== TEST FUNCTION ========== */

/**
 * Read-only test for submission tracking.
 *
 * Uses Grade 06, Term 1, 2026.
 */
function testSubmission() {

  const summary = getSubmissionSummary(
    2026,
    'Grade 06',
    'Term 1'
  );

  Logger.log(JSON.stringify(summary));

  const register = readRegister_();

  const students = readStudents_(register.rows)
    .filter(student => student.grade === 'Grade 06');

  if (students.length > 0) {

    const student = students[0];

    const subjects = Object.keys(register.columns)
      .filter(subject =>
        yes_(student.row[register.columns[subject]])
      );

    if (subjects.length > 0) {

      const check = checkMarkExists(
        2026,
        'Grade 06',
        'Term 1',
        student.id,
        subjects[0]
      );

      Logger.log(
        'Existing result check: ' + JSON.stringify(check)
      );
    }
  }

  Logger.log(
    'Submission verification completed successfully.'
  );
}
