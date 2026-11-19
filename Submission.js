/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 5 of 7: Submission.gs
 *
 * MULTI-REGISTER SUBMISSION & DIRECT EDIT SUPPORT
 *
 * Grades 01-05 -> Primary Register
 * Grades 06-09 -> Junior Register
 * Grades 10-11 -> O/L Register
 * Grades 12-13 -> A/L Register
 *
 * Supports:
 * - Dynamically detected subjects
 * - Numeric marks from 0 to 100
 * - ABSENT as a valid recorded result
 * - Direct teacher edits & updates for saved marks (EXAM and SBA)
 * - Pending student identification
 * - Submission progress summaries
 *
 * This file does not modify spreadsheet data.
 */

/* ========== SUBJECT VALIDATION ========== */

function submissionValidateSubject_(subject, grade) {
  const name = String(subject || '').trim();
  if (!name) {
    throw new Error('Please select a subject.');
  }

  const normalizedGrade = normalizeGrade_(grade);
  if (!normalizedGrade) {
    throw new Error('Invalid grade.');
  }

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

/* ========== SUBJECT MARKS FOR DIRECT ENTRY & EDITING ========== */

/**
 * Return all enrolled students for a (year, grade, term, subject, assessmentType)
 * along with any previously saved marks so teachers can enter pending marks
 * or directly edit existing saved marks without extra approval steps.
 */
function getSubjectMarksForEntryInternal_(year, grade, term, subject, assessmentType) {
  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject, context.grade);
  const kind = String(assessmentType || 'EXAM').trim().toUpperCase();
  if (kind !== 'EXAM' && kind !== 'SBA') {
    throw new Error('Invalid assessment type.');
  }

  const enrolledStudents = getStudentsInternal_(context.grade, selectedSubject);
  const targetSheetName = kind === 'SBA' ? SBA_SHEET : MARKS_SHEET;
  const sheet = book_().getSheetByName(targetSheetName);

  const recordedMap = new Map();
  const duplicateIds = new Set();
  const warnings = [];

  if (sheet && sheet.getLastRow() >= 2) {
    // Check core columns (9 minimum; 10th optional/SubmittedBy)
    const headers = sheet.getRange(1, 1, 1, 9).getDisplayValues()[0];
    if (headers.join('|') !== MARKS_HEADERS.slice(0, 9).join('|')) {
      throw new Error('Unexpected column structure in ' + targetSheetName + '.');
    }

    const colCount = Math.min(sheet.getLastColumn(), MARKS_HEADERS.length);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, colCount).getValues();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => cell === '' || cell === null)) continue;

      if (
        Number(row[0]) !== context.year ||
        normalizeGrade_(row[1]) !== context.grade ||
        String(row[2] || '').trim() !== context.term ||
        String(row[6] || '').trim() !== selectedSubject
      ) {
        continue;
      }

      const id = String(row[3] || '').trim();
      if (!id) continue;

      if (recordedMap.has(id)) {
        duplicateIds.add(id);
        warnings.push('Duplicate ' + kind + ' mark at row ' + (i + 2) + ' for student ' + id);
        continue;
      }

      const normalizedMark = normalizeStoredMark_(row[7]);
      const updatedAt = row[8] instanceof Date ? row[8].toISOString() : String(row[8] || '');
      const submittedBy = colCount >= 10 ? String(row[9] || '').trim() : '';

      recordedMap.set(id, {
        mark: normalizedMark,
        updatedAt,
        submittedBy
      });
    }
  }

  let entered = 0;
  let pending = 0;

  const students = enrolledStudents.map(student => {
    const isDuplicate = duplicateIds.has(student.id);
    const existing = !isDuplicate ? recordedMap.get(student.id) : null;

    if (!existing || existing.mark === '') {
      pending++;
      return {
        id: student.id,
        name: student.name,
        mark: null,
        status: 'PENDING',
        updatedAt: '',
        submittedBy: '',
        duplicate: isDuplicate
      };
    }

    entered++;
    const isAbs = existing.mark === 'ABSENT';
    return {
      id: student.id,
      name: student.name,
      mark: existing.mark,
      status: isAbs ? 'ABSENT' : 'RECORDED',
      updatedAt: existing.updatedAt,
      submittedBy: existing.submittedBy,
      duplicate: false
    };
  });

  return {
    year: context.year,
    grade: context.grade,
    term: context.term,
    subject: selectedSubject,
    assessmentType: kind,
    total: students.length,
    entered,
    pending,
    warnings,
    students
  };
}

/* ========== CHECK EXISTING MARKS ========== */

function checkMarkExistsInternal_(
  year,
  grade,
  term,
  studentId,
  subject
) {
  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject, context.grade);
  const id = String(studentId || '').trim();

  if (!id) {
    throw new Error('Student ID is required.');
  }

  const register = readRegister_(context.grade);
  const student = readStudents_(register.rows).find(
    s => s.id === id && s.grade === context.grade
  );

  if (!student) {
    throw new Error('Student not found in ' + context.grade + ': ' + id);
  }

  const subjectColumn = register.columns[selectedSubject];
  if (!yes_(student.row[subjectColumn])) {
    throw new Error('Student is not enrolled in ' + selectedSubject);
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
    rows: matches.map(match => match.rowNumber)
  };
}

/* ========== GET PENDING STUDENTS ========== */

function getPendingStudentsInternal_(year, grade, term, subject) {
  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject, context.grade);
  const analysis = getAnalysisInternal_(context.year, context.grade, context.term);

  const register = readRegister_(context.grade);
  const subjectColumn = register.columns[selectedSubject];

  const enrolledStudents = readStudents_(register.rows).filter(
    student =>
      student.grade === context.grade &&
      yes_(student.row[subjectColumn])
  );

  const resultMap = new Map(
    analysis.students.map(student => [student.id, student])
  );

  const pendingStudents = [];

  for (const student of enrolledStudents) {
    const result = resultMap.get(student.id);

    if (!result || result.missing.includes(selectedSubject)) {
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
    entered: enrolledStudents.length - pendingStudents.length,
    students: pendingStudents
  };
}

/* ========== VALIDATE SUBMISSION / DIRECT EDITS ========== */

/**
 * Validate proposed marks before saving or updating.
 * Existing results are validated for direct updates rather than rejected.
 */
function validateMarksSubmissionInternal_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid submission.');
  }

  const context = validateContext_(payload.year, payload.grade, payload.term);
  const selectedSubject = submissionValidateSubject_(payload.subject, context.grade);

  if (!Array.isArray(payload.marks)) {
    throw new Error('Marks must be provided as an array.');
  }

  const register = readRegister_(context.grade);
  const subjectColumn = register.columns[selectedSubject];

  const allowedStudents = readStudents_(register.rows).filter(
    student =>
      student.grade === context.grade &&
      yes_(student.row[subjectColumn])
  );

  const allowedIds = new Set(allowedStudents.map(student => student.id));

  const existingRows = analysisReadMarks_();
  const existingMap = new Map();

  for (const row of existingRows) {
    if (row.every(c => c === '' || c === null)) continue;
    existingMap.set(
      analysisMarkKey_(
        row[0],
        normalizeGrade_(row[1]),
        String(row[2]).trim(),
        String(row[3]).trim(),
        String(row[6]).trim()
      ),
      normalizeStoredMark_(row[7])
    );
  }

  const seenIds = new Set();
  const accepted = [];
  const skipped = [];
  const errors = [];
  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;

  for (const item of payload.marks) {
    if (!item || typeof item !== 'object') {
      errors.push('Invalid student record.');
      continue;
    }

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

    if (markText.toUpperCase() === 'ABSENT') {
      mark = 'ABSENT';
    } else {
      if (
        typeof item.mark === 'boolean' ||
        !/^\d+(?:\.\d+)?$/.test(markText)
      ) {
        errors.push('Invalid mark for student ' + id);
        continue;
      }

      mark = Number(markText);

      if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
        errors.push('Mark must be between 0 and 100: ' + id);
        continue;
      }
    }

    const key = analysisMarkKey_(
      context.year,
      context.grade,
      context.term,
      id,
      selectedSubject
    );

    let mode = 'CREATE';
    if (existingMap.has(key)) {
      const prevMark = existingMap.get(key);
      if (marksEqual_(prevMark, mark)) {
        mode = 'UNCHANGED';
        unchangedCount++;
      } else {
        mode = 'UPDATE';
        updateCount++;
      }
    } else {
      newCount++;
    }

    accepted.push({
      id,
      mark,
      mode
    });
  }

  return {
    valid: errors.length === 0 && accepted.length > 0,
    year: context.year,
    grade: context.grade,
    term: context.term,
    subject: selectedSubject,
    acceptedCount: accepted.length,
    newCount,
    updateCount,
    unchangedCount,
    skippedCount: skipped.length,
    errorCount: errors.length,
    absentCount: accepted.filter(item => item.mark === 'ABSENT').length,
    numericCount: accepted.filter(item => typeof item.mark === 'number').length,
    accepted,
    skipped,
    errors
  };
}

/* ========== SUBMISSION SUMMARY ========== */

function getSubmissionSummaryInternal_(year, grade, term) {
  const status = getSubmissionStatusInternal_(year, grade, term);

  const percent = status.expectedMarks > 0
    ? Math.round((status.enteredMarks / status.expectedMarks) * 10000) / 100
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
    allComplete: status.expectedMarks > 0 && status.missingMarks === 0
  };
}

/* ========== TEST FUNCTIONS ========== */

function testSubmissionForGrade__(year, grade, term) {
  const context = validateContext_(year, grade, term);
  const summary = getSubmissionSummaryInternal_(context.year, context.grade, context.term);

  Logger.log(JSON.stringify(summary, null, 2));

  const register = readRegister_(context.grade);
  const students = readStudents_(register.rows).filter(
    student => student.grade === context.grade
  );

  if (students.length > 0) {
    const student = students[0];
    const subjects = Object.keys(register.columns).filter(
      subject => yes_(student.row[register.columns[subject]])
    );

    if (subjects.length > 0) {
      const check = checkMarkExistsInternal_(
        context.year,
        context.grade,
        context.term,
        student.id,
        subjects[0]
      );
      Logger.log('Existing result check: ' + JSON.stringify(check));
    }
  }

  Logger.log('Submission verification completed for ' + context.grade);
}

function testSubmission_() {
  testSubmissionForGrade__(2026, 'Grade 06', 'Term 1');
}

function testSubmissionGrade11_() {
  testSubmissionForGrade__(2026, 'Grade 11', 'Term 1');
}

function testSubmissionGrade12_() {
  testSubmissionForGrade__(2026, 'Grade 12', 'Term 1');
}

function testSubmissionGrade13_() {
  testSubmissionForGrade__(2026, 'Grade 13', 'Term 1');
}

/* ========== SBA STUDENT ENTRY STATUS ========== */

function getSBAPendingStudentsInternal_(year, grade, term, subject) {
  const context = validateContext_(year, grade, term);
  const selectedSubject = submissionValidateSubject_(subject, context.grade);
  const students = getStudentsInternal_(context.grade, selectedSubject);
  const sheet = book_().getSheetByName(SBA_SHEET);

  if (!sheet) {
    return {
      total: students.length,
      completed: 0,
      pending: students.length,
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        status: 'PENDING',
        mark: null
      }))
    };
  }

  ensureSheet_(SBA_SHEET, MARKS_HEADERS);
  const rows = sheet.getDataRange().getValues().slice(1);
  const recorded = new Map();

  for (const row of rows) {
    if (
      Number(row[0]) !== context.year ||
      normalizeGrade_(row[1]) !== context.grade ||
      String(row[2]).trim() !== context.term ||
      String(row[6]).trim() !== selectedSubject
    ) {
      continue;
    }

    const id = String(row[3]).trim();
    const mark = row[7];

    if (!recorded.has(id)) {
      recorded.set(id, []);
    }
    recorded.get(id).push(mark);
  }

  const result = students.map(student => {
    const marks = recorded.get(student.id) || [];
    const valid = marks.length === 1 && (
      marks[0] === 'ABSENT' ||
      (
        marks[0] !== '' &&
        marks[0] !== null &&
        Number.isFinite(Number(marks[0])) &&
        Number(marks[0]) >= 0 &&
        Number(marks[0]) <= 100
      )
    );

    return {
      id: student.id,
      name: student.name,
      status: valid ? 'COMPLETED' : 'PENDING',
      mark: valid ? marks[0] : null
    };
  });

  const completed = result.filter(s => s.status === 'COMPLETED').length;

  return {
    total: result.length,
    completed,
    pending: result.length - completed,
    students: result
  };
}