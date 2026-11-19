/* ========== SBA ASSESSMENT REPORTS ========== */

/**
 * Read-only header verification for SBA_Entries.
 */
function sbaReportValidateHeaders_(sheet) {
  const expectedBase = MARKS_HEADERS.slice(0, 9);
  const actual = sheet
    .getRange(1, 1, 1, MARKS_HEADERS.length)
    .getDisplayValues()[0];

  const fullMatch = actual.join('|') === MARKS_HEADERS.join('|');
  const legacyNineMatch =
    actual.slice(0, 9).join('|') === expectedBase.join('|') &&
    String(actual[9] || '').trim() === '';

  if (!fullMatch && !legacyNineMatch) {
    throw new Error(
      'Unexpected column structure in ' + SBA_SHEET +
      '. Existing data was not changed.'
    );
  }
}

/**
 * Generate validated SBA assessment report for a grade and term.
 * Matches Analysis.js and Submission.js rules:
 * - Only enrolled students/subjects are scored
 * - Invalid/non-numeric/out-of-range marks produce warnings
 * - Duplicate StudentID|Subject entries invalidate the mark and remain PENDING
 */
function getSBAReportInternal_(year, grade, term) {
  const context = validateContext_(year, grade, term);
  const register = readRegister_(context.grade);

  const subjects = Object.keys(register.columns);
  const students = readStudents_(register.rows)
    .filter(s => s.grade === context.grade);

  const studentMap = new Map();
  const enrollmentMap = new Map();

  for (const student of students) {
    studentMap.set(student.id, student);
    enrollmentMap.set(
      student.id,
      subjects.filter(subject => yes_(student.row[register.columns[subject]]))
    );
  }

  const sheet = book_().getSheetByName(SBA_SHEET);
  const marks = new Map();
  const warnings = [];

  if (sheet && sheet.getLastRow() >= 2) {
    sbaReportValidateHeaders_(sheet);

    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 9)
      .getValues();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sheetRow = i + 2;

      if (row.every(v => v === '' || v === null)) {
        continue;
      }

      if (
        Number(row[0]) !== context.year ||
        normalizeGrade_(row[1]) !== context.grade ||
        String(row[2] == null ? '' : row[2]).trim() !== context.term
      ) {
        continue;
      }

      const id = String(row[3] == null ? '' : row[3]).trim();
      const subject = String(row[6] == null ? '' : row[6]).trim();
      const rawMark = row[7];

      if (!studentMap.has(id)) {
        warnings.push(
          'Row ' + sheetRow + ': Student ' + id +
          ' is not registered in ' + context.grade
        );
        continue;
      }

      if (!enrollmentMap.get(id).includes(subject)) {
        warnings.push(
          'Row ' + sheetRow + ': Student ' + id +
          ' is not enrolled in ' + subject
        );
        continue;
      }

      const markText = String(rawMark == null ? '' : rawMark).trim();
      let validatedMark;

      const upper = markText.toUpperCase();
      if (upper === 'ABSENT' || upper === 'AB') {
        validatedMark = 'ABSENT';
      } else {
        if (
          typeof rawMark === 'boolean' ||
          !/^\d+(?:\.\d+)?$/.test(markText)
        ) {
          warnings.push(
            'Row ' + sheetRow + ': Invalid SBA mark for student ' + id
          );
          continue;
        }

        validatedMark = Number(markText);
        if (!Number.isFinite(validatedMark) || validatedMark < 0 || validatedMark > 100) {
          warnings.push(
            'Row ' + sheetRow + ': SBA mark must be between 0 and 100 for student ' + id
          );
          continue;
        }
      }

      const key = id + '|' + subject;

      if (marks.has(key)) {
        warnings.push(
          'Duplicate SBA record at row ' + sheetRow +
          ' for student ' + id + ', subject ' + subject
        );
        // Invalidate duplicated records so they remain PENDING until fixed.
        marks.set(key, null);
        continue;
      }

      marks.set(key, validatedMark);
    }
  }

  const results = [];

  for (const student of students) {
    const enrolledSubjects = enrollmentMap.get(student.id) || [];
    for (const subject of enrolledSubjects) {
      const key = student.id + '|' + subject;
      const value = marks.has(key) ? marks.get(key) : null;
      const recorded = value !== null && value !== undefined;

      results.push({
        id: student.id,
        name: student.name,
        subject,
        mark: recorded ? value : null,
        status: !recorded
          ? 'PENDING'
          : value === 'ABSENT'
            ? 'ABSENT'
            : 'RECORDED'
      });
    }
  }

  const recordedCount = results.filter(r => r.status !== 'PENDING').length;

  return {
    year: context.year,
    grade: context.grade,
    term: context.term,
    subjects,
    results,
    total: results.length,
    recorded: recordedCount,
    pending: results.length - recordedCount,
    warnings
  };
}