/**
 * AccountManagement.gs — testing with fictional data only.
 * Replace the existing AccountManagement.gs with this entire file.
 * Requires the previously updated Auth.gs and its helper functions.
 * Preserves existing admin RPC signatures and Staff_Access columns.
 */

const ACCOUNT_AUDIT_SHEET_ = 'Account_Audit';
const ACCOUNT_AUDIT_HEADERS_ = ['Timestamp', 'Administrator', 'Action', 'TargetUsername', 'Details'];

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

/** Called only while the account-management script lock is held. */
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

/**
 * Record completed changes. If the audit write fails, do not falsely tell the
 * admin the account operation failed (which could cause duplicate retries).
 * A failed audit must be investigated in Apps Script execution logs.
 */
function accountAuditAfterChange_(administrator, action, target, details) {
  try {
    accountAudit_(administrator, action, target, details);
  } catch (err) {
    console.error('ACCOUNT AUDIT WRITE FAILED: ' + action + ' for ' + target + ': ' + String(err));
  }
}

function adminListTeachers(token) {
  authRequire_(token, 'ADMIN');
  const rows = authSheet_().getDataRange().getDisplayValues();
  return rows.slice(1)
    .filter(r => String(r[2]).trim() === 'TEACHER' && String(r[5]).trim())
    .map(r => ({
      username: String(r[5]).trim(),
      name: String(r[1]).trim(),
      email: String(r[0]).trim(),
      active: String(r[3]).trim().toLowerCase() === 'true'
    }));
}

function adminCreateTeacher(name, username, email, token) {
  authRequire_(token, 'ADMIN');
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
    const admin = authRequire_(token, 'ADMIN');
    const password = authRandom_();
    authCreateAccount_(u, password, n, 'TEACHER', e);
    accountAuditAfterChange_(admin.username, 'CREATE_TEACHER', u, 'Teacher account created');
    return {username: u, name: n, temporaryPassword: password};
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
