
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 1 of 7: Code.gs
 *
 * Multi-register Google Sheets-bound Apps Script backend.
 *
 * Register 1: Grades 06 to 09
 * Register 2: Grades 10 to 11
 * Register 3: Grades 12 to 13 (GCE A/L)
 *
 * All grades use:
 * - One web application
 * - One Marks_Entries sheet
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
 *
 * IMPORTANT:
 * Use fictional student data until staff authentication
 * and server-side access restrictions are implemented.
 */

/* ========== REGISTER CONFIGURATION ========== */

/*
 * IMPORTANT:
 * Change these sheetName values to match the
 * exact names of your Google Sheets tabs.
 */

const REGISTER_CONFIG = [
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
 *
 * Older backend files may still reference this.
 * We will update those files next.
 */
const REGISTER_SHEET = 'Grade 06 to 09';

/* ========== MARKS CONFIGURATION ========== */

const MARKS_SHEET = 'Marks_Entries';

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
  'UpdatedAt'
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

/* ========== REGISTER ROUTING ========== */

/**
 * Find the register configuration for a grade.
 */
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

/**
 * Get the correct register tab for a grade.
 */
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

/**
 * Read a student register.
 *
 * Pass a grade to select the correct register.
 *
 * Examples:
 * readRegister_('Grade 07')
 * readRegister_('Grade 10')
 * readRegister_('Grade 12')
 *
 * Temporary compatibility:
 * Calling readRegister_() without a grade
 * reads the Grades 06-09 register.
 *
 * Other backend files must be updated to
 * pass the selected grade explicitly.
 */
function readRegister_(grade) {

  const config = grade
    ? getRegisterConfig_(grade)
    : REGISTER_CONFIG[0];

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
   *
   * A = Student ID
   * B = Student Name
   * C = Grade
   *
   * Subjects start from column D.
   */
  for (let col = 3; col < count; col++) {

    const option = String(
      optionHeaders[col] || ''
    ).trim();

    const heading = String(
      mainHeaders[col] || ''
    ).trim();

    // Prefer the subject option heading.
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

/**
 * Convert register rows into student objects.
 *
 * Supports merged grade cells where the grade
 * is written once for a group of students.
 */
function readStudents_(rows) {

  const students = [];
  const seen = new Set();

  let currentGrade = '';

  for (let i = 2; i < rows.length; i++) {

    const row = rows[i];

    const detectedGrade = normalizeGrade_(
      row[2]
    );

    // Supports merged grade cells.
    if (detectedGrade) {
      currentGrade = detectedGrade;
    }

    const id = String(
      row[0] || ''
    ).trim();

    const name = String(
      row[1] || ''
    ).trim();

    // Ignore completely empty student rows.
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

/**
 * Load and validate all three registers.
 *
 * Ensures:
 * - Students are in the correct register
 * - Student IDs are unique across the school
 * - Subject headings are valid
 */
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

/**
 * Return all available grades and subjects.
 *
 * subjectsByGrade allows the frontend to show
 * only subjects belonging to the selected grade.
 */
function getSetup() {

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

      // Display grades containing students.
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

    /*
     * Compatibility field for existing frontend.
     * This is the combined subject list.
     */
    subjects: [...allSubjects].sort(),

    /*
     * New field for grade-specific dropdowns.
     */
    subjectsByGrade,

    registerSheets,

    registerSheet: 'Multiple Registers'
  };
}

/* ========== STUDENTS FOR MARKS ENTRY ========== */

/**
 * Return only students who:
 *
 * 1. Belong to the selected grade
 * 2. Have Yes for the selected subject
 */
function getStudents(grade, subject) {

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

/**
 * Create the marks sheet if missing.
 *
 * Existing sheet headings are validated
 * before new marks are saved.
 */
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

/* ========== MARKS SUBMISSION ========== */

/**
 * Save marks for any configured grade.
 *
 * The selected grade determines which
 * student register is used.
 *
 * All marks are stored centrally in
 * Marks_Entries.
 *
 * ABSENT is stored as "ABSENT".
 *
 * Existing marks cannot be overwritten
 * through this function.
 */
function saveMarks(payload) {

  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(
      'Missing marks submission.'
    );
  }

  const context = validateContext_(
    payload.year,
    payload.grade,
    payload.term
  );

  const subject = String(
    payload.subject || ''
  ).trim();

  if (
    !Array.isArray(payload.marks) ||
    !payload.marks.length
  ) {
    throw new Error(
      'No marks submitted.'
    );
  }

  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    /* ========== VALIDATE STUDENTS ========== */

    const enrolledStudents = getStudents(
      context.grade,
      subject
    );

    const allowedNames = new Map(
      enrolledStudents.map(student => [
        student.id,
        student.name
      ])
    );

    const submittedIds = new Set();
    const entries = [];

    for (const item of payload.marks) {

      const id = String(
        item.id || ''
      ).trim();

      if (!allowedNames.has(id)) {
        throw new Error(
          'Student is not enrolled: ' + id
        );
      }

      if (submittedIds.has(id)) {
        throw new Error(
          'Duplicate student in submission: ' +
          id
        );
      }

      submittedIds.add(id);

      // Blank marks are not submitted.
      if (
        item.mark === '' ||
        item.mark === null ||
        item.mark === undefined
      ) {
        continue;
      }

      const markText = String(
        item.mark
      ).trim();

      let mark;

      /* ========== ABSENT HANDLING ========== */

      if (
        markText.toUpperCase() ===
        'ABSENT'
      ) {

        mark = 'ABSENT';

      } else {

        /* ========== NUMERIC VALIDATION ========== */

        if (
          !/^\d+(?:\.\d+)?$/.test(
            markText
          )
        ) {
          throw new Error(
            'Invalid mark for student ' +
            id
          );
        }

        mark = Number(markText);

        if (
          !Number.isFinite(mark) ||
          mark < 0 ||
          mark > 100
        ) {
          throw new Error(
            'Marks must be between 0 and 100 ' +
            'for student ' +
            id
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
      throw new Error(
        'Enter at least one mark.'
      );
    }

    /* ========== INITIALIZE STORAGE ========== */

    const marksSheet = ensureSheet_(
      MARKS_SHEET,
      MARKS_HEADERS
    );



    /* ========== CHECK EXISTING RECORDS ========== */

    const storedRows = marksSheet
      .getDataRange()
      .getValues();

    const existingKeys = new Set();

    for (
      let i = 1;
      i < storedRows.length;
      i++
    ) {

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
          'Duplicate stored marks detected in ' +
          MARKS_SHEET
        );
      }

      existingKeys.add(key);
    }

    /* ========== SUBJECT GROUP ========== */

    const group = RELIGION.includes(
      subject
    )
      ? 'Religion'
      : AESTHETIC.includes(subject)
        ? 'Aesthetic'
        : subject;

    const now = new Date();

    const newRows = [];

    /* ========== PREPARE NEW RECORDS ========== */

    // Validate every mark before writing.
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
          'Marks already exist for student ' +
          entry.id +
          ' in ' +
          subject +
          '. Contact the administrator ' +
          'for corrections.'
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


    }

    /* ========== SAVE MARKS ========== */

    marksSheet
      .getRange(
        marksSheet.getLastRow() + 1,
        1,
        newRows.length,
        MARKS_HEADERS.length
      )
      .setValues(newRows);

    return {
      added: newRows.length,
      updated: 0,
      total: newRows.length
    };

  } finally {

    lock.releaseLock();
  }
}

/* ========== CONNECTION TEST ========== */

/**
 * Run this function from the Apps Script editor
 * to verify the three register tabs.
 *
 * No marks are modified.
 */
function testConnection() {

  Logger.log(
    '===== MULTI-REGISTER CONNECTION TEST ====='
  );

  const setup = getSetup();

  Logger.log(
    JSON.stringify(
      setup,
      null,
      2
    )
  );

  for (const grade of setup.grades) {

    const register = readRegister_(
      grade
    );

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
