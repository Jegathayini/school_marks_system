/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 1 of 7: Code.gs
 *
 * Multi-register Google Sheets-bound Apps Script backend.
 *
 * Register 1: Grades 01 to 05
 * Register 2: Grades 06 to 09
 * Register 3: Grades 10 to 11
 * Register 4: Grades 12 to 13 (GCE A/L)
 *
 * All grades use:
 * - One web application
 * - One Marks_Entries sheet (Term Exams)
 * - One SBA_Entries sheet (School-Based Assessment)
 * - One Marks_Audit sheet (background edit accountability log)
 *
 * Each register must contain:
 * Row 1: Main headings
 * Row 2: Subject/option headings
 * Column A: Student ID
 * Column B: Student Name
 * Column C: Grade
 * Column D onward: Yes/No subject selections
 *
 * ABSENT is stored as "ABSENT".
 */

/* ========== REGISTER CONFIGURATION ========== */

const REGISTER_CONFIG = [
  {
    sheetName: 'Grade 01 to 05',
    grades: [
      'Grade 01',
      'Grade 02',
      'Grade 03',
      'Grade 04',
      'Grade 05'
    ]
  },
  {
    sheetName: 'Grade 06 to 09',
    grades: [
      'Grade 06',
      'Grade 07',
      'Grade 08',
      'Grade 09'
    ]
  },
  {
    sheetName: 'Grade 10 to 11',
    grades: [
      'Grade 10',
      'Grade 11'
    ]
  },
  {
    sheetName: 'Grade 12 to 13',
    grades: [
      'Grade 12',
      'Grade 13'
    ]
  }
];

/*
 * Compatibility constant.
 */
const REGISTER_SHEET = 'Grade 06 to 09';

/* ========== MARKS CONFIGURATION ========== */

const MARKS_SHEET = 'Marks_Entries';
const SBA_SHEET = 'SBA_Entries';
const MARKS_AUDIT_SHEET = 'Marks_Audit';

const RELIGION = [
  'Hinduism',
  'RC',
  'NonRC'
];

const AESTHETIC = [
  'Music',
  'Dance',
  'Drama',
  'Art'
];

const MARKS_HEADERS = [
  'AcademicYear',
  'Grade',
  'Term',
  'StudentID',
  'StudentName',
  'SubjectGroup',
  'SubjectOption',
  'Marks',
  'UpdatedAt',
  'SubmittedBy'
];

const MARKS_AUDIT_HEADERS = [
  'Timestamp',
  'Username',
  'Role',
  'AssessmentType',
  'AcademicYear',
  'Grade',
  'Term',
  'StudentID',
  'StudentName',
  'Subject',
  'Action',
  'OldMark',
  'NewMark'
];

/* ========== WEB APPLICATION ========== */

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('School Academic Management')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}

function include_(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/* ========== SPREADSHEET CONNECTION ========== */

function book_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'Spreadsheet connection unavailable. ' +
      'Open Apps Script through Extensions ' +
      'in the Google Sheet.'
    );
  }
  return ss;
}

/* ========== DATA HELPERS ========== */

/**
 * Convert grade values into a consistent format.
 *
 * Examples:
 * 6        -> Grade 06
 * 06       -> Grade 06
 * Grade 6  -> Grade 06
 * Grade 10 -> Grade 10
 * Grade 13 -> Grade 13
 */
function normalizeGrade_(value) {
  const text = String(
    value == null ? '' : value
  ).trim();

  const match = text.match(
    /^(?:grade\s*)?0?(\d{1,2})$/i
  );

  return match
    ? 'Grade ' +
      String(Number(match[1])).padStart(2, '0')
    : '';
}

/**
 * Check whether a register cell indicates
 * enrollment in a subject.
 */
function yes_(value) {
  const text = String(
    value == null ? '' : value
  )
    .trim()
    .toLowerCase();

  return text === 'yes' || text === 'true';
}

/**
 * Validate academic year, grade and term.
 */
function validateContext_(year, grade, term) {
  const y = Number(year);
  const g = normalizeGrade_(grade);
  const t = String(term || '').trim();

  if (
    !Number.isInteger(y) ||
    y < 2020 ||
    y > 2100
  ) {
    throw new Error('Invalid academic year.');
  }

  if (!g) {
    throw new Error('Invalid grade.');
  }

  // Make sure the grade has a configured register.
  getRegisterConfig_(g);

  if (!/^Term [123]$/.test(t)) {
    throw new Error('Invalid term.');
  }

  return {
    year: y,
    grade: g,
    term: t
  };
}

/**
 * Normalize a stored or submitted mark for comparison.
 */
function normalizeStoredMark_(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const text = String(value).trim();
  if (!text) return '';
  if (text.toUpperCase() === 'ABSENT' || text.toUpperCase() === 'AB') {
    return 'ABSENT';
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return n;
  }
  return text;
}

/**
 * Check whether two normalized marks represent the same value.
 */
function marksEqual_(a, b) {
  const na = normalizeStoredMark_(a);
  const nb = normalizeStoredMark_(b);
  if (na === '' && nb === '') return true;
  if (na === '' || nb === '') return false;
  if (na === 'ABSENT' || nb === 'ABSENT') return na === nb;
  if (typeof na === 'number' && typeof nb === 'number') {
    return Math.abs(na - nb) < 1e-9;
  }
  return String(na) === String(nb);
}

/**
 * Protect spreadsheet audit/string fields from accidental formula injection.
 */
function safeAuditCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const text = String(value);
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}

/* ========== REGISTER ROUTING ========== */

function getRegisterConfig_(grade) {
  const normalizedGrade = normalizeGrade_(grade);
  if (!normalizedGrade) {
    throw new Error('Invalid grade: ' + grade);
  }

  const config = REGISTER_CONFIG.find(item =>
    item.grades.includes(normalizedGrade)
  );

  if (!config) {
    throw new Error(
      'No student register configured for ' +
      normalizedGrade
    );
  }

  return config;
}

function getRegisterSheetForGrade_(grade) {
  const config = getRegisterConfig_(grade);
  const sheet = book_().getSheetByName(
    config.sheetName
  );

  if (!sheet) {
    throw new Error(
      'Missing student register tab: ' +
      config.sheetName
    );
  }

  return sheet;
}

/* ========== STUDENT REGISTER ========== */

function readRegister_(grade) {
  const config = grade
    ? getRegisterConfig_(grade)
    : getRegisterConfig_('Grade 06');

  const sheet = book_().getSheetByName(
    config.sheetName
  );

  if (!sheet) {
    throw new Error(
      'Missing register sheet: ' +
      config.sheetName
    );
  }

  const rows = sheet
    .getDataRange()
    .getDisplayValues();

  if (rows.length < 2) {
    throw new Error(
      'Register "' +
      config.sheetName +
      '" must contain two header rows.'
    );
  }

  const mainHeaders = rows[0];
  const optionHeaders = rows[1];
  const columns = Object.create(null);

  const count = Math.max(
    mainHeaders.length,
    optionHeaders.length
  );

  /*
   * Columns:
   * A = Student ID
   * B = Student Name
   * C = Grade
   * Subjects start from column D.
   */
  for (let col = 3; col < count; col++) {
    const option = String(
      optionHeaders[col] || ''
    ).trim();

    const heading = String(
      mainHeaders[col] || ''
    ).trim();

    const subject = option || heading;

    if (
      !subject ||
      /^(religion|aesthetic)$/i.test(subject)
    ) {
      continue;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        columns,
        subject
      )
    ) {
      throw new Error(
        'Duplicate subject heading "' +
        subject +
        '" in register "' +
        config.sheetName +
        '".'
      );
    }

    columns[subject] = col;
  }

  if (!Object.keys(columns).length) {
    throw new Error(
      'No subjects found in register: ' +
      config.sheetName
    );
  }

  return {
    rows,
    columns,
    sheetName: config.sheetName,
    allowedGrades: config.grades.slice()
  };
}

function readStudents_(rows) {
  const students = [];
  const seen = new Set();
  let currentGrade = '';

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const detectedGrade = normalizeGrade_(
      row[2]
    );

    if (detectedGrade) {
      currentGrade = detectedGrade;
    }

    const id = String(
      row[0] || ''
    ).trim();

    const name = String(
      row[1] || ''
    ).trim();

    if (!id && !name) {
      continue;
    }

    if (
      !id ||
      !name ||
      !currentGrade
    ) {
      throw new Error(
        'Incomplete student record at row ' +
        (i + 1)
      );
    }

    if (seen.has(id)) {
      throw new Error(
        'Duplicate Student ID: ' + id
      );
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

/* ========== MULTI-REGISTER VALIDATION ========== */

function readAllRegisters_() {
  const registers = [];
  const schoolIds = new Map();

  for (const config of REGISTER_CONFIG) {
    const register = readRegister_(
      config.grades[0]
    );

    const students = readStudents_(
      register.rows
    );

    for (const student of students) {
      if (
        !config.grades.includes(
          student.grade
        )
      ) {
        throw new Error(
          'Student ' +
          student.id +
          ' has grade ' +
          student.grade +
          ' in the wrong register: ' +
          config.sheetName
        );
      }

      if (schoolIds.has(student.id)) {
        throw new Error(
          'Duplicate Student ID across registers: ' +
          student.id +
          '. Found in ' +
          schoolIds.get(student.id) +
          ' and ' +
          config.sheetName
        );
      }

      schoolIds.set(
        student.id,
        config.sheetName
      );
    }

    registers.push({
      sheetName: config.sheetName,
      grades: config.grades.slice(),
      rows: register.rows,
      columns: register.columns,
      students
    });
  }

  return registers;
}

/* ========== FRONTEND SETUP ========== */

function getSetupInternal_() {
  const registers = readAllRegisters_();

  const allGrades = new Set();
  const allSubjects = new Set();
  const subjectsByGrade = {};
  const registerSheets = {};

  for (const register of registers) {
    const subjects = Object.keys(
      register.columns
    );

    for (const subject of subjects) {
      allSubjects.add(subject);
    }

    for (const grade of register.grades) {
      const gradeStudents =
        register.students.filter(
          student => student.grade === grade
        );

      if (gradeStudents.length > 0) {
        allGrades.add(grade);
      }

      subjectsByGrade[grade] =
        subjects.slice();

      registerSheets[grade] =
        register.sheetName;
    }
  }

  return {
    grades: [...allGrades].sort(),
    subjects: [...allSubjects].sort(),
    subjectsByGrade,
    registerSheets,
    registerSheet: 'Multiple Registers'
  };
}

/**
 * Return setup filtered to the signed-in account's assigned classes/subjects.
 * Administrators receive all configured grades and subjects.
 */
function getSetupForAccountInternal_(account) {
  const setup = getSetupInternal_();
  if (!account || account.role === 'ADMIN') {
    return {
      ...setup,
      isRestricted: false,
      assignedGrades: null,
      assignedSubjects: null,
      role: account ? account.role : 'ADMIN'
    };
  }

  const assignment = teacherGetAssignments_(account.username);
  const allowedGrades = assignment.grades
    ? setup.grades.filter(g => assignment.grades.includes(g))
    : setup.grades.slice();

  const subjectsByGrade = {};
  const registerSheets = {};
  const allowedSubjectsSet = new Set();

  for (const grade of allowedGrades) {
    const rawList = Array.isArray(setup.subjectsByGrade[grade])
      ? setup.subjectsByGrade[grade]
      : [];
    const filteredList = assignment.subjects
      ? rawList.filter(s => assignment.subjects.includes(s))
      : rawList.slice();

    subjectsByGrade[grade] = filteredList;
    registerSheets[grade] = setup.registerSheets[grade];
    for (const subj of filteredList) {
      allowedSubjectsSet.add(subj);
    }
  }

  return {
    grades: allowedGrades,
    subjects: [...allowedSubjectsSet].sort(),
    subjectsByGrade,
    registerSheets,
    registerSheet: setup.registerSheet,
    isRestricted: Boolean(assignment.grades || assignment.subjects),
    assignedGrades: assignment.grades ? assignment.grades.slice() : null,
    assignedSubjects: assignment.subjects ? assignment.subjects.slice() : null,
    role: account.role
  };
}

/* ========== STUDENTS FOR MARKS ENTRY ========== */

function getStudentsInternal_(grade, subject) {
  const normalizedGrade = normalizeGrade_(
    grade
  );

  const selectedSubject = String(
    subject || ''
  ).trim();

  if (!normalizedGrade) {
    throw new Error('Invalid grade.');
  }

  const register = readRegister_(
    normalizedGrade
  );

  if (
    !Object.prototype.hasOwnProperty.call(
      register.columns,
      selectedSubject
    )
  ) {
    throw new Error(
      'Unknown subject "' +
      selectedSubject +
      '" for ' +
      normalizedGrade
    );
  }

  const subjectColumn =
    register.columns[selectedSubject];

  return readStudents_(
    register.rows
  )
    .filter(student =>
      student.grade === normalizedGrade &&
      yes_(
        student.row[subjectColumn]
      )
    )
    .map(student => ({
      id: student.id,
      name: student.name
    }));
}

/* ========== SHEET INITIALIZATION ========== */

function ensureSheet_(name, headers) {
  const spreadsheet = book_();
  let sheet = spreadsheet.getSheetByName(
    name
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      name
    );

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    sheet.setFrozenRows(1);
    return sheet;
  }

  // Safely upgrade existing 9-column marks/SBA sheets without touching marks.
  if ((name === MARKS_SHEET || name === SBA_SHEET) && headers.length === 10) {
    const current = sheet.getRange(1, 1, 1, 9).getDisplayValues()[0];
    if (current.join('|') === headers.slice(0, 9).join('|')) {
      const tenth = String(sheet.getRange(1, 10).getDisplayValue()).trim();
      if (tenth === '') {
        sheet.getRange(1, 10).setValue('SubmittedBy');
      } else if (tenth !== 'SubmittedBy') {
        throw new Error('Column J is occupied; cannot add SubmittedBy safely.');
      }
    }
  }

  const existing = sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .getDisplayValues()[0];

  if (
    existing.join('|') !==
    headers.join('|')
  ) {
    throw new Error(
      'Unexpected column structure in ' +
      name +
      '. Existing data was not changed.'
    );
  }

  return sheet;
}

/* ========== BACKGROUND MARKS AUDIT LOG ========== */

/**
 * Append mark create/update audit records in the background.
 * Failures are logged to Apps Script execution logs and never block
 * teachers from saving or updating marks.
 */
function logMarksAuditNonBlocking_(records, meta) {
  if (!Array.isArray(records) || !records.length) return;
  try {
    const auditSheet = ensureSheet_(MARKS_AUDIT_SHEET, MARKS_AUDIT_HEADERS);
    const rows = records.map(rec => [
      meta.now,
      meta.username,
      meta.role,
      meta.assessmentType,
      meta.year,
      meta.grade,
      meta.term,
      safeAuditCell_(rec.studentId),
      safeAuditCell_(rec.studentName),
      safeAuditCell_(meta.subject),
      rec.action,
      rec.oldMark === '' || rec.oldMark === null || rec.oldMark === undefined ? '' : rec.oldMark,
      rec.newMark
    ]);
    auditSheet
      .getRange(auditSheet.getLastRow() + 1, 1, rows.length, MARKS_AUDIT_HEADERS.length)
      .setValues(rows);
  } catch (err) {
    console.error('MARKS AUDIT LOG FAILED (' + meta.assessmentType + ' ' + meta.grade + ' ' + meta.subject + '): ' + String(err));
  }
}

/**
 * Admin-only reader for background marks edit accountability logs.
 */
function getMarksAuditLogInternal_(year, grade, limit) {
  const sheet = book_().getSheetByName(MARKS_AUDIT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return { entries: [], total: 0 };
  }

  const actual = sheet.getRange(1, 1, 1, MARKS_AUDIT_HEADERS.length).getDisplayValues()[0];
  if (actual.join('|') !== MARKS_AUDIT_HEADERS.join('|')) {
    throw new Error('Unexpected Marks_Audit sheet headings.');
  }

  const yearFilter = year !== null && year !== undefined && String(year).trim() !== '' && String(year).trim().toUpperCase() !== 'ALL'
    ? Number(year)
    : null;
  const gradeFilter = grade && String(grade).trim().toUpperCase() !== 'ALL'
    ? normalizeGrade_(grade)
    : '';
  const maxEntries = Math.max(1, Math.min(500, Number(limit) || 100));

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, MARKS_AUDIT_HEADERS.length).getValues();
  const matched = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    if (r.every(cell => cell === '' || cell === null)) continue;
    const rowYear = Number(r[4]);
    const rowGrade = normalizeGrade_(r[5]);
    if (yearFilter !== null && rowYear !== yearFilter) continue;
    if (gradeFilter && rowGrade !== gradeFilter) continue;

    matched.push({
      timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
      username: String(r[1] || ''),
      role: String(r[2] || ''),
      assessmentType: String(r[3] || ''),
      year: rowYear,
      grade: rowGrade,
      term: String(r[6] || ''),
      studentId: String(r[7] || ''),
      studentName: String(r[8] || ''),
      subject: String(r[9] || ''),
      action: String(r[10] || ''),
      oldMark: r[11] === '' || r[11] === null || r[11] === undefined ? '' : r[11],
      newMark: r[12] === '' || r[12] === null || r[12] === undefined ? '' : r[12]
    });

    if (matched.length >= maxEntries) break;
  }

  return {
    entries: matched,
    total: matched.length
  };
}

/* ========== MARKS SUBMISSION & DIRECT UPDATES ========== */

/**
 * Shared internal writer for both Marks_Entries (EXAM) and SBA_Entries (SBA).
 * Supports both creating new marks and directly updating existing marks,
 * with non-blocking background audit logging.
 */
function saveAssessmentMarksInternal_(sheetName, assessmentType, payload, submittedBy, actorRole) {
  const submitter = String(submittedBy || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(submitter)) {
    throw new Error('Unauthorized: valid submitter identity required.');
  }

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
    const enrolledStudents = getStudentsInternal_(
      context.grade,
      subject
    );

    const allowedNames = new Map(
      enrolledStudents.map(student => [student.id, student.name])
    );

    const submittedIds = new Set();
    const entries = [];

    for (const item of payload.marks) {
      if (!item || typeof item !== 'object') {
        throw new Error('Invalid mark record in submission.');
      }

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
      let mark;

      if (markText.toUpperCase() === 'ABSENT') {
        mark = 'ABSENT';
      } else {
        if (
          typeof item.mark === 'boolean' ||
          !/^\d+(?:\.\d+)?$/.test(markText)
        ) {
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

    const marksSheet = ensureSheet_(sheetName, MARKS_HEADERS);
    const storedRows = marksSheet.getDataRange().getValues();
    const existingMap = new Map();

    for (let i = 1; i < storedRows.length; i++) {
      const row = storedRows[i];

      if (row.every(cell => cell === '' || cell === null)) {
        continue;
      }

      if ([row[0], row[1], row[2], row[3], row[6]].some(
        cell => cell === '' || cell === null
      )) {
        throw new Error(
          'Incomplete stored marks record at row ' + (i + 1) +
          ' in ' + sheetName
        );
      }

      const key = [
        Number(row[0]),
        normalizeGrade_(row[1]),
        String(row[2]).trim(),
        String(row[3]).trim(),
        String(row[6]).trim()
      ].join('|');

      if (existingMap.has(key)) {
        throw new Error(
          'Duplicate stored marks detected in ' + sheetName + ': ' + key
        );
      }

      existingMap.set(key, {
        rowNumber: i + 1,
        mark: normalizeStoredMark_(row[7])
      });
    }

    const group = RELIGION.includes(subject)
      ? 'Religion'
      : AESTHETIC.includes(subject)
        ? 'Aesthetic'
        : subject;

    const now = new Date();
    const newRows = [];
    const updates = [];
    const auditRecords = [];
    let unchanged = 0;

    for (const entry of entries) {
      const key = [
        context.year,
        context.grade,
        context.term,
        entry.id,
        subject
      ].join('|');

      if (existingMap.has(key)) {
        const existing = existingMap.get(key);
        if (marksEqual_(existing.mark, entry.mark)) {
          unchanged++;
          continue;
        }

        updates.push({
          rowNumber: existing.rowNumber,
          values: [
            entry.name,
            group,
            subject,
            entry.mark,
            now,
            submitter
          ]
        });

        auditRecords.push({
          studentId: entry.id,
          studentName: entry.name,
          action: 'UPDATE',
          oldMark: existing.mark,
          newMark: entry.mark
        });
      } else {
        existingMap.set(key, {
          rowNumber: -1,
          mark: entry.mark
        });

        newRows.push([
          context.year,
          context.grade,
          context.term,
          entry.id,
          entry.name,
          group,
          subject,
          entry.mark,
          now,
          submitter
        ]);

        auditRecords.push({
          studentId: entry.id,
          studentName: entry.name,
          action: 'CREATE',
          oldMark: '',
          newMark: entry.mark
        });
      }
    }

    for (const upd of updates) {
      marksSheet
        .getRange(upd.rowNumber, 5, 1, 6)
        .setValues([upd.values]);
    }

    if (newRows.length) {
      marksSheet
        .getRange(
          marksSheet.getLastRow() + 1,
          1,
          newRows.length,
          MARKS_HEADERS.length
        )
        .setValues(newRows);
    }

    logMarksAuditNonBlocking_(auditRecords, {
      now,
      username: submitter,
      role: String(actorRole || 'STAFF').toUpperCase(),
      assessmentType,
      year: context.year,
      grade: context.grade,
      term: context.term,
      subject
    });

    return {
      added: newRows.length,
      updated: updates.length,
      unchanged,
      total: newRows.length + updates.length
    };
  } finally {
    lock.releaseLock();
  }
}

function saveMarksInternal_(payload, submittedBy, actorRole) {
  return saveAssessmentMarksInternal_(
    MARKS_SHEET,
    'EXAM',
    payload,
    submittedBy,
    actorRole
  );
}

/* ========== SBA MARKS STORAGE ========== */

function saveSBAMarksInternal_(payload, submittedBy, actorRole) {
  return saveAssessmentMarksInternal_(
    SBA_SHEET,
    'SBA',
    payload,
    submittedBy,
    actorRole
  );
}

/* ========== CONNECTION TEST ========== */

function testConnection_() {
  Logger.log(
    '===== MULTI-REGISTER CONNECTION TEST ====='
  );

  const setup = getSetupInternal_();
  Logger.log(
    JSON.stringify(
      setup,
      null,
      2
    )
  );

  for (const grade of setup.grades) {
    const register = readRegister_(grade);
    const students = readStudents_(
      register.rows
    ).filter(
      student => student.grade === grade
    );

    Logger.log(
      grade +
      ' | Register: ' +
      register.sheetName +
      ' | Students: ' +
      students.length +
      ' | Subjects: ' +
      Object.keys(
        register.columns
      ).length
    );
  }

  Logger.log(
    'Connection test completed successfully.'
  );
}

function debugMarksSheet() {
  const ss = book_();
  const sheet = ss.getSheetByName('Marks_Entries');

  if (!sheet) {
    Logger.log('ERROR: Marks_Entries sheet not found');
    return;
  }

  const values = sheet.getDataRange().getValues();
  const populatedRows = values.slice(1).filter(row =>
    row.some(cell => String(cell).trim() !== '')
  );

  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('Last row: ' + sheet.getLastRow());
  Logger.log('Populated data rows: ' + populatedRows.length);
  Logger.log('First populated row: ' + JSON.stringify(populatedRows[0] || null));
}

function testConnection() {
  testConnection_();
}