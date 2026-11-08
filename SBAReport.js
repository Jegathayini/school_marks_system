
/* ========== SBA ASSESSMENT REPORTS ========== */

function getSBAReportInternal_(year, grade, term) {
  const context = validateContext_(year, grade, term);
  const register = readRegister_(context.grade);

  const subjects = Object.keys(register.columns);
  const students = readStudents_(register.rows)
    .filter(s => s.grade === context.grade);

  const sheet = book_().getSheetByName(SBA_SHEET);
  const marks = new Map();
  const warnings = [];

  if (sheet) {
    ensureSheet_(SBA_SHEET, MARKS_HEADERS);

    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.every(v => v === '' || v === null)) {
        continue;
      }

      if (
        Number(row[0]) !== context.year ||
        normalizeGrade_(row[1]) !== context.grade ||
        String(row[2]).trim() !== context.term
      ) {
        continue;
      }

      const id = String(row[3]).trim();
      const subject = String(row[6]).trim();
      const key = id + '|' + subject;

      if (marks.has(key)) {
        warnings.push('Duplicate SBA record at row ' + (i + 1));
        continue;
      }

      marks.set(key, row[7]);
    }
  }

  const results = [];

  for (const student of students) {
    for (const subject of subjects) {
      if (!yes_(student.row[register.columns[subject]])) {
        continue;
      }

      const key = student.id + '|' + subject;
      const recorded = marks.has(key);
      const mark = recorded ? marks.get(key) : null;

      results.push({
        id: student.id,
        name: student.name,
        subject,
        mark: recorded ? mark : null,
        status: !recorded
          ? 'PENDING'
          : String(mark).toUpperCase() === 'ABSENT'
            ? 'ABSENT'
            : 'RECORDED'
      });
    }
  }

  return {
    year: context.year,
    grade: context.grade,
    term: context.term,
    subjects,
    results,
    total: results.length,
    recorded: results.filter(r => r.status !== 'PENDING').length,
    pending: results.filter(r => r.status === 'PENDING').length,
    warnings
  };
}
