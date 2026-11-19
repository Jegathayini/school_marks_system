/**
 * AccountManagement.gs — Teacher accounts, class/subject assignments,
 * and audit logging.
 * Preserves Staff_Access columns A:H and manages per-teacher
 * grade/subject scope in Teacher_Assignments.
 */

const ACCOUNT_AUDIT_SHEET_ = 'Account_Audit';
const ACCOUNT_AUDIT_HEADERS_ = ['Timestamp', 'Administrator', 'Action', 'TargetUsername', 'Details'];

const TEACHER_ASSIGNMENTS_SHEET_ = 'Teacher_Assignments';
const TEACHER_ASSIGNMENTS_HEADERS_ = ['Username', 'AssignedGrades', 'AssignedSubjects', 'UpdatedAt', 'UpdatedBy'];

function accountSafeText_(value, field, maxLength, required) {
  if (typeof value !== 'string' && value != null) throw new Error(field + ' must be text.');
  const text = String(value || '').trim();
  if (required && text.length < 2) throw new Error(field + ' must be at least 2 characters.');
  if (text.length > maxLength) throw new Error(field + ' is too long.');
  // Google Sheets can interpret leading characters as a formula. Do not
  // accept formula-like content in human-readable profile fields.
  if (/^[=+\-@]/.test(text) || /[\x00-\x1f\x7f]/.test(text))
    throw new Error(field + ' contains unsupported characters.');
  return text;
}

/** Called only while a script lock is held. */
function accountAudit_(administrator, action, target, details) {
  const ss = book_();
  let sh = ss.getSheetByName(ACCOUNT_AUDIT_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(ACCOUNT_AUDIT_SHEET_);
    sh.getRange(1, 1, 1, ACCOUNT_AUDIT_HEADERS_.length).setValues([ACCOUNT_AUDIT_HEADERS_]);
    sh.setFrozenRows(1);
  } else {
    const actual = sh.getRange(1, 1, 1, ACCOUNT_AUDIT_HEADERS_.length).getDisplayValues()[0];
    if (actual.join('|') !== ACCOUNT_AUDIT_HEADERS_.join('|'))
      throw new Error('Account_Audit sheet headings are incorrect.');
  }
  sh.appendRow([new Date(), administrator, action, target, details || '']);
}

function accountAuditAfterChange_(administrator, action, target, details) {
  try {
    accountAudit_(administrator, action, target, details);
  } catch (err) {
    console.error('ACCOUNT AUDIT WRITE FAILED: ' + action + ' for ' + target + ': ' + String(err));
  }
}

/* ========== TEACHER CLASS & SUBJECT ASSIGNMENTS ========== */

function teacherNormalizeGradeAssignments_(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw || raw === '*' || raw.toUpperCase() === 'ALL') return null;
    input = raw.split(',').map(v => v.trim()).filter(Boolean);
  }
  if (!Array.isArray(input)) {
    throw new Error('Assigned grades must be an array, comma-separated list, or ALL.');
  }
  const out = [];
  const seen = new Set();
  for (const item of input) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    if (raw === '*' || raw.toUpperCase() === 'ALL') return null;
    const norm = normalizeGrade_(raw);
    if (!norm) throw new Error('Invalid assigned grade: ' + raw);
    getRegisterConfig_(norm);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out.sort();
}

function teacherNormalizeSubjectAssignments_(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw || raw === '*' || raw.toUpperCase() === 'ALL') return null;
    input = raw.split(',').map(v => v.trim()).filter(Boolean);
  }
  if (!Array.isArray(input)) {
    throw new Error('Assigned subjects must be an array, comma-separated list, or ALL.');
  }
  const out = [];
  const seen = new Set();
  for (const item of input) {
    const raw = accountSafeText_(String(item || ''), 'Assigned subject', 100, false);
    if (!raw) continue;
    if (raw === '*' || raw.toUpperCase() === 'ALL') return null;
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push(raw);
    }
  }
  return out;
}

function teacherAssignmentsSheet_(createIfMissing) {
  const ss = book_();
  let sh = ss.getSheetByName(TEACHER_ASSIGNMENTS_SHEET_);
  if (!sh) {
    if (!createIfMissing) return null;
    sh = ss.insertSheet(TEACHER_ASSIGNMENTS_SHEET_);
    sh.getRange(1, 1, 1, TEACHER_ASSIGNMENTS_HEADERS_.length).setValues([TEACHER_ASSIGNMENTS_HEADERS_]);
    sh.setFrozenRows(1);
    return sh;
  }
  const actual = sh.getRange(1, 1, 1, TEACHER_ASSIGNMENTS_HEADERS_.length).getDisplayValues()[0];
  if (actual.join('|') !== TEACHER_ASSIGNMENTS_HEADERS_.join('|')) {
    throw new Error('Teacher_Assignments sheet headings must be: ' + TEACHER_ASSIGNMENTS_HEADERS_.join(', '));
  }
  return sh;
}

function teacherReadAssignmentsMap_() {
  const sh = teacherAssignmentsSheet_(false);
  const map = new Map();
  if (!sh || sh.getLastRow() < 2) return map;
  const rows = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(cell => String(cell || '').trim() === '')) continue;
    const u = String(r[0] || '').trim().toLowerCase();
    if (!u) continue;
    map.set(u, {
      rowNumber: i + 1,
      grades: teacherNormalizeGradeAssignments_(r[1]),
      subjects: teacherNormalizeSubjectAssignments_(r[2]),
      updatedAt: String(r[3] || '').trim(),
      updatedBy: String(r[4] || '').trim()
    });
  }
  return map;
}

function teacherGetAssignments_(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return { grades: null, subjects: null };
  const entry = teacherReadAssignmentsMap_().get(u);
  if (!entry) return { grades: null, subjects: null };
  return {
    grades: entry.grades ? entry.grades.slice() : null,
    subjects: entry.subjects ? entry.subjects.slice() : null
  };
}

/**
 * Called while lock is held. Writes or updates Teacher_Assignments row.
 */
function teacherWriteAssignments_(username, grades, subjects, adminUsername) {
  const u = String(username || '').trim().toLowerCase();
  const sh = teacherAssignmentsSheet_(true);
  const rows = sh.getDataRange().getDisplayValues();
  const existingIndex = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim().toLowerCase() === u);
  const gradeCell = grades === null ? 'ALL' : grades.join(', ');
  const subjectCell = subjects === null ? 'ALL' : subjects.join(', ');
  const rowValues = [u, gradeCell, subjectCell, new Date(), adminUsername || ''];
  if (existingIndex >= 0) {
    sh.getRange(existingIndex + 1, 1, 1, TEACHER_ASSIGNMENTS_HEADERS_.length).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
}

/**
 * Server-side authorization guard for teacher-accessible endpoints.
 * Administrators bypass per-class restrictions.
 */
function assertTeacherAssignment_(account, grade, subject) {
  if (!account) throw new Error('Unauthorized: please sign in.');
  if (account.role === 'ADMIN') return;
  if (account.role !== 'TEACHER') throw new Error('Access denied.');

  const assignment = teacherGetAssignments_(account.username);
  if (grade !== undefined && grade !== null && String(grade).trim() !== '') {
    const normalizedGrade = normalizeGrade_(grade);
    if (!normalizedGrade) throw new Error('Invalid grade.');
    if (assignment.grades !== null && !assignment.grades.includes(normalizedGrade)) {
      throw new Error('Access denied: you are not assigned to ' + normalizedGrade + '.');
    }
  }
  if (subject !== undefined && subject !== null && String(subject).trim() !== '') {
    const selectedSubject = String(subject).trim();
    if (assignment.subjects !== null && !assignment.subjects.includes(selectedSubject)) {
      throw new Error('Access denied: you are not assigned to subject "' + selectedSubject + '".');
    }
  }
}

/**
 * Filter submission status subjects for assigned teachers and recompute summary counts.
 */
function teacherFilterSubmissionStatus_(status, account) {
  if (!status || !account || account.role === 'ADMIN') return status;
  const assignment = teacherGetAssignments_(account.username);
  if (assignment.subjects === null) return status;

  const allowedSubjects = new Set(assignment.subjects);
  const subjects = (status.subjects || []).filter(s => allowedSubjects.has(s.subject));
  const required = subjects.length;
  const completed = subjects.filter(s => s.status === 'completed').length;
  const partial = subjects.filter(s => s.status === 'partial').length;
  const pending = subjects.filter(s => s.status === 'pending').length;
  const expectedMarks = subjects.reduce((n, s) => n + Number(s.expected || 0), 0);
  const enteredMarks = subjects.reduce((n, s) => n + Number(s.entered || 0), 0);
  const absentMarks = subjects.reduce((n, s) => n + Number(s.absent || 0), 0);
  const missingMarks = Math.max(0, expectedMarks - enteredMarks);
  const numericMarks = Math.max(0, enteredMarks - absentMarks);
  const completionPercentage = expectedMarks > 0
    ? Math.round((enteredMarks / expectedMarks) * 10000) / 100
    : 0;

  return {
    ...status,
    subjects,
    required,
    completed,
    partial,
    pending,
    expectedMarks,
    enteredMarks,
    numericMarks,
    absentMarks,
    missingMarks,
    completionPercentage,
    allComplete: expectedMarks > 0 && missingMarks === 0
  };
}

/* ========== ADMIN ACCOUNT ENDPOINTS ========== */

function adminListTeachers(token) {
  authRequire_(token, 'ADMIN');
  const rows = authSheet_().getDataRange().getDisplayValues();
  const assignments = teacherReadAssignmentsMap_();
  return rows.slice(1)
    .filter(r => String(r[2]).trim() === 'TEACHER' && String(r[5]).trim())
    .map(r => {
      const username = String(r[5]).trim();
      const assign = assignments.get(username.toLowerCase());
      return {
        username,
        name: String(r[1]).trim(),
        email: String(r[0]).trim(),
        active: String(r[3]).trim().toLowerCase() === 'true',
        assignedGrades: assign ? assign.grades : null,
        assignedSubjects: assign ? assign.subjects : null
      };
    });
}

/**
 * Create a teacher account, optionally specifying assigned grades and subjects.
 * Supports both (name, username, email, token) and
 * (name, username, email, assignedGrades, assignedSubjects, token).
 */
function adminCreateTeacher(name, username, email, assignedGrades, assignedSubjects, token) {
  let effectiveGrades = null;
  let effectiveSubjects = null;
  let authTok = token;

  if (arguments.length === 4) {
    authTok = assignedGrades;
  } else {
    effectiveGrades = teacherNormalizeGradeAssignments_(assignedGrades);
    effectiveSubjects = teacherNormalizeSubjectAssignments_(assignedSubjects);
  }

  authRequire_(authTok, 'ADMIN');
  const n = accountSafeText_(name, 'Teacher name', 100, true);
  const u = String(username || '').trim().toLowerCase();
  const e = accountSafeText_(email, 'Email', 254, false);
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u))
    throw new Error('Username must be 4–32 characters.');
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new Error('Invalid email address.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const admin = authRequire_(authTok, 'ADMIN');
    const password = authRandom_();
    authCreateAccount_(u, password, n, 'TEACHER', e);
    if (effectiveGrades !== null || effectiveSubjects !== null) {
      teacherWriteAssignments_(u, effectiveGrades, effectiveSubjects, admin.username);
    }
    const scopeSummary =
      'Grades: ' + (effectiveGrades ? effectiveGrades.join(', ') : 'ALL') +
      ' | Subjects: ' + (effectiveSubjects ? effectiveSubjects.join(', ') : 'ALL');
    accountAuditAfterChange_(admin.username, 'CREATE_TEACHER', u, 'Teacher account created (' + scopeSummary + ')');
    return {
      username: u,
      name: n,
      temporaryPassword: password,
      assignedGrades: effectiveGrades,
      assignedSubjects: effectiveSubjects
    };
  } finally {
    lock.releaseLock();
  }
}

function adminSetTeacherAssignments(username, assignedGrades, assignedSubjects, token) {
  authRequire_(token, 'ADMIN');
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u)) throw new Error('Invalid username.');
  const grades = teacherNormalizeGradeAssignments_(assignedGrades);
  const subjects = teacherNormalizeSubjectAssignments_(assignedSubjects);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const admin = authRequire_(token, 'ADMIN');
    const sh = authSheet_();
    const rows = sh.getDataRange().getDisplayValues();
    const index = rows.findIndex((r, i) => i > 0 &&
      String(r[5]).trim().toLowerCase() === u && String(r[2]).trim() === 'TEACHER');
    if (index < 0) throw new Error('Teacher account not found.');
    teacherWriteAssignments_(u, grades, subjects, admin.username);
    const details =
      'Grades: ' + (grades ? grades.join(', ') : 'ALL') +
      ' | Subjects: ' + (subjects ? subjects.join(', ') : 'ALL');
    accountAuditAfterChange_(admin.username, 'UPDATE_ASSIGNMENTS', u, details);
    return {
      username: u,
      assignedGrades: grades,
      assignedSubjects: subjects
    };
  } finally {
    lock.releaseLock();
  }
}

function adminResetTeacherPassword(username, token) {
  authRequire_(token, 'ADMIN');
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u)) throw new Error('Invalid username.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const admin = authRequire_(token, 'ADMIN');
    const sh = authSheet_();
    const rows = sh.getDataRange().getDisplayValues();
    const index = rows.findIndex((r, i) => i > 0 &&
      String(r[5]).trim().toLowerCase() === u && String(r[2]).trim() === 'TEACHER');
    if (index < 0) throw new Error('Teacher account not found.');
    const password = authRandom_();
    const salt = authRandom_();
    sh.getRange(index + 1, 7, 1, 2).setValues([[salt, authPasswordHash_(password, salt)]]);
    authSetMustChange_(u, true);
    accountAuditAfterChange_(admin.username, 'RESET_PASSWORD', u, 'Password reset; previous sessions invalidated');
    return {username: u, temporaryPassword: password};
  } finally {
    lock.releaseLock();
  }
}

function adminSetTeacherActive(username, active, token) {
  authRequire_(token, 'ADMIN');
  if (typeof active !== 'boolean') throw new Error('Active must be true or false.');
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u)) throw new Error('Invalid username.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const admin = authRequire_(token, 'ADMIN');
    const sh = authSheet_();
    const rows = sh.getDataRange().getDisplayValues();
    const index = rows.findIndex((r, i) => i > 0 &&
      String(r[5]).trim().toLowerCase() === u && String(r[2]).trim() === 'TEACHER');
    if (index < 0) throw new Error('Teacher account not found.');
    const previous = String(rows[index][3]).trim().toLowerCase() === 'true';
    if (previous !== active) {
      sh.getRange(index + 1, 4).setValue(active);
      accountAuditAfterChange_(admin.username, active ? 'ACTIVATE_TEACHER' : 'DEACTIVATE_TEACHER', u, 'Account status changed');
    }
    return {username: u, active: active};
  } finally {
    lock.releaseLock();
  }
}