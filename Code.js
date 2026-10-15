/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 1: Code.gs
 *
 * Google Sheets-bound Apps Script backend.
 *
 * Development version:
 * Use fictional student records until staff authentication
 * and server-side access restrictions are implemented.
 */

const REGISTER_SHEET = 'Grade 06 to 09';
const MARKS_SHEET = 'Marks_Entries';
const AUDIT_SHEET = 'Marks_Audit';

const RELIGION = ['Hinduism', 'RC', 'NonRC'];
const AESTHETIC = ['Music', 'Dance', 'Drama', 'Art'];

const MARKS_HEADERS = [
  'AcademicYear', 'Grade', 'Term', 'StudentID',
  'StudentName', 'SubjectGroup', 'SubjectOption',
  'Marks', 'UpdatedAt'
];

const AUDIT_HEADERS = [
  'Timestamp', 'AcademicYear', 'Grade', 'Term',
  'StudentID', 'SubjectOption', 'PreviousMark', 'NewMark'
];

/* ========== WEB APPLICATION ========== */

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('School Academic Management')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/* ========== SPREADSHEET CONNECTION ========== */

function book_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Spreadsheet connection unavailable. Open Apps Script through Extensions in the Google Sheet.'
    );
  }

  return ss;
}

function testConnection() {
  const setup = getSetup();
  Logger.log(JSON.stringify(setup));

  if (setup.grades.length && setup.subjects.length) {
    Logger.log(JSON.stringify(
      getStudents(setup.grades[0], setup.subjects[0])
    ));
  }
}

/* ========== DATA HELPERS ========== */

function normalizeGrade_(value) {
  const text = String(value == null ? '' : value).trim();
  const match = text.match(/^(?:grade\s*)?0?(\d{1,2})$/i);

  return match
    ? 'Grade ' + String(Number(match[1])).padStart(2, '0')
    : '';
}

function yes_(value) {
  const text = String(value == null ? '' : value)
    .trim()
    .toLowerCase();

  return text === 'yes' || text === 'true';
}

function validateContext_(year, grade, term) {
  const y = Number(year);
  const g = normalizeGrade_(grade);
  const t = String(term || '').trim();

  if (!Number.isInteger(y) || y < 2020 || y > 2100) {
    throw new Error('Invalid academic year.');
  }

  if (!g) {
    throw new Error('Invalid grade.');
  }

  if (!/^Term [123]$/.test(t)) {
    throw new Error('Invalid term.');
  }

  return { year: y, grade: g, term: t };
}

/* ========== STUDENT REGISTER ========== */

function readRegister_() {
  const sheet = book_().getSheetByName(REGISTER_SHEET);

  if (!sheet) {
    throw new Error('Missing register sheet: ' + REGISTER_SHEET);
  }

  const rows = sheet.getDataRange().getDisplayValues();

  if (rows.length < 3) {
    throw new Error(
      'Register must contain two header rows and student records.'
    );
  }

  const mainHeaders = rows[0];
  const optionHeaders = rows[1];
  const columns = Object.create(null);

  const count = Math.max(
    mainHeaders.length,
    optionHeaders.length
  );

  for (let col = 3; col < count; col++) {
    const option = String(optionHeaders[col] || '').trim();
    const heading = String(mainHeaders[col] || '').trim();

    const subject = option || heading;

    if (!subject || /^(religion|aesthetic)$/i.test(subject)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(columns, subject)) {
      throw new Error('Duplicate subject heading: ' + subject);
    }

    columns[subject] = col;
  }

  if (!Object.keys(columns).length) {
    throw new Error('No subjects found in the register.');
  }

  return { rows, columns };
}

function readStudents_(rows) {
  const students = [];
  const seen = new Set();

  let currentGrade = '';

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];

    const detectedGrade = normalizeGrade_(row[2]);

    // Supports merged grade cells.
    if (detectedGrade) {
      currentGrade = detectedGrade;
    }

    const id = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();

    if (!id && !name) {
      continue;
    }

    if (!id || !name || !currentGrade) {
      throw new Error(
        'Incomplete student record at row ' + (i + 1)
      );
    }

    if (seen.has(id)) {
      throw new Error('Duplicate Student ID: ' + id);
    }

    seen.add(id);

    students.push({
      id,
      name,
      grade: currentGrade,
      row
    });
  }

  return students;
}

/* ========== FRONTEND SETUP ========== */

function getSetup() {
  const register = readRegister_();
  const students = readStudents_(register.rows);

  return {
    grades: [...new Set(students.map(s => s.grade))].sort(),
    subjects: Object.keys(register.columns),
    registerSheet: REGISTER_SHEET
  };
}

function getStudents(grade, subject) {
  const register = readRegister_();
  const normalizedGrade = normalizeGrade_(grade);
  const selectedSubject = String(subject || '').trim();

  if (!normalizedGrade) {
    throw new Error('Invalid grade.');
  }

  if (!Object.prototype.hasOwnProperty.call(
    register.columns, selectedSubject
  )) {
    throw new Error('Unknown subject: ' + selectedSubject);
  }

  const subjectColumn = register.columns[selectedSubject];

  return readStudents_(register.rows)
    .filter(student =>
      student.grade === normalizedGrade &&
      yes_(student.row[subjectColumn])
    )
    .map(student => ({
      id: student.id,
      name: student.name
    }));
}

/* ========== SHEET INITIALIZATION ========== */

function ensureSheet_(name, headers) {
  const spreadsheet = book_();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);

    return sheet;
  }

  const existing = sheet
    .getRange(1, 1, 1, headers.length)
    .getDisplayValues()[0];

  if (existing.join('|') !== headers.join('|')) {
    throw new Error(
      'Unexpected column structure in ' + name +
      '. Existing data was not changed.'
    );
  }

  return sheet;
}

/* ========== MARKS SUBMISSION ========== */

function saveMarks(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Missing marks submission.');
  }

  const context = validateContext_(
    payload.year,
    payload.grade,
    payload.term
  );

  const subject = String(payload.subject || '').trim();

  if (!Array.isArray(payload.marks) || !payload.marks.length) {
    throw new Error('No marks submitted.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const enrolledStudents = getStudents(context.grade, subject);

    const allowedNames = new Map(
      enrolledStudents.map(student => [
        student.id,
        student.name
      ])
    );

    const submittedIds = new Set();
    const entries = [];

    for (const item of payload.marks) {
      const id = String(item.id || '').trim();

      if (!allowedNames.has(id)) {
        throw new Error('Student is not enrolled: ' + id);
      }

      if (submittedIds.has(id)) {
        throw new Error('Duplicate student in submission: ' + id);
      }

      submittedIds.add(id);

      if (
        item.mark === '' ||
        item.mark === null ||
        item.mark === undefined
      ) {
        continue;
      }

      const markText = String(item.mark).trim();

      // Accept ABSENT as a valid recorded result
      let mark;

      if (markText.toUpperCase() === 'ABSENT') {
        mark = 'ABSENT';
      } else {
        // Validate normal numeric marks
        if (!/^\d+(?:\.\d+)?$/.test(markText)) {
          throw new Error('Invalid mark for student ' + id);
        }

        mark = Number(markText);

        if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
          throw new Error(
            'Marks must be between 0 and 100 for student ' + id
          );
        }
      }

      entries.push({
        id,
        name: allowedNames.get(id),
        mark
      });
    }

    if (!entries.length) {
      throw new Error('Enter at least one mark.');
    }

    const marksSheet = ensureSheet_(
      MARKS_SHEET,
      MARKS_HEADERS
    );

    const auditSheet = ensureSheet_(
      AUDIT_SHEET,
      AUDIT_HEADERS
    );

    const storedRows = marksSheet.getDataRange().getValues();
    const existingKeys = new Set();

    for (let i = 1; i < storedRows.length; i++) {
      const row = storedRows[i];

      const key = [
        row[0],
        row[1],
        row[2],
        String(row[3]),
        row[6]
      ].join('|');

      if (existingKeys.has(key)) {
        throw new Error(
          'Duplicate stored marks detected in ' + MARKS_SHEET
        );
      }

      existingKeys.add(key);
    }

    const group = RELIGION.includes(subject)
      ? 'Religion'
      : AESTHETIC.includes(subject)
        ? 'Aesthetic'
        : subject;

    const now = new Date();
    const newRows = [];
    const auditRows = [];

    // Validate all records before writing anything.
    for (const entry of entries) {
      const key = [
        context.year,
        context.grade,
        context.term,
        entry.id,
        subject
      ].join('|');

      if (existingKeys.has(key)) {
        throw new Error(
          'Marks already exist for student ' + entry.id +
          ' in ' + subject +
          '. Contact the administrator for corrections.'
        );
      }

      existingKeys.add(key);

      newRows.push([
        context.year,
        context.grade,
        context.term,
        entry.id,
        entry.name,
        group,
        subject,
        entry.mark,
        now
      ]);

      auditRows.push([
        now,
        context.year,
        context.grade,
        context.term,
        entry.id,
        subject,
        '',
        entry.mark
      ]);
    }

    marksSheet
      .getRange(
        marksSheet.getLastRow() + 1,
        1,
        newRows.length,
        MARKS_HEADERS.length
      )
      .setValues(newRows);

    auditSheet
      .getRange(
        auditSheet.getLastRow() + 1,
        1,
        auditRows.length,
        AUDIT_HEADERS.length
      )
      .setValues(auditRows);

    return {
      added: newRows.length,
      updated: 0,
      total: newRows.length
    };

  } finally {
    lock.releaseLock();
  }
}
