/**
 * Custom staff authentication — fictional student data only for testing.
 * Preserves existing Staff_Access columns A:H.
 * New teacher accounts must change their initial password.
 * Changing/resetting a password invalidates all prior sessions.
 */
const AUTH_SHEET_ = 'Staff_Access';
const AUTH_HEADERS_ = [
  'Email',
  'Name',
  'Role',
  'Active',
  'GoogleSubject',
  'Username',
  'PasswordSalt',
  'PasswordHash'
];
const AUTH_TTL_MS_ = 30 * 60 * 1000;
const AUTH_MAX_ATTEMPTS_ = 5;
const AUTH_BLOCK_MS_ = 15 * 60 * 1000;

function authSheet_() {
  const sh = book_().getSheetByName(AUTH_SHEET_);
  if (!sh) throw new Error('Create Staff_Access sheet first.');
  const existing = sh.getRange(1, 1, 1, AUTH_HEADERS_.length).getDisplayValues()[0];
  if (existing.join('|') !== AUTH_HEADERS_.join('|')) {
    throw new Error('Staff_Access columns must be: ' + AUTH_HEADERS_.join(', '));
  }
  return sh;
}

function authDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2))
    .join('');
}

function authConstantTimeEqual_(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  let diff = strA.length ^ strB.length;
  const len = Math.max(strA.length, strB.length);
  for (let i = 0; i < len; i++) {
    diff |= (strA.charCodeAt(i) || 0) ^ (strB.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function authPepper_() {
  const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER');
  if (!pepper) {
    throw new Error('Authentication not initialized. Run authInitialize_ in editor.');
  }
  return pepper;
}

function authPasswordHash_(password, salt) {
  let h = authDigest_(salt + ':' + String(password) + ':' + authPepper_());
  for (let i = 0; i < 3000; i++) {
    h = authDigest_(h + ':' + salt);
  }
  return h;
}

function authRandom_() {
  return [0, 1, 2, 3].map(() => Utilities.getUuid()).join('');
}

function authInitialize_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AUTH_PEPPER')) {
    props.setProperty('AUTH_PEPPER', authRandom_());
  }

  const sh = book_().getSheetByName(AUTH_SHEET_) || book_().insertSheet(AUTH_SHEET_);
  if (sh.getLastRow() === 0) {
    sh.appendRow(AUTH_HEADERS_);
  } else {
    const firstFive = sh.getRange(1, 1, 1, 5).getDisplayValues()[0];
    if (firstFive.join('|') !== AUTH_HEADERS_.slice(0, 5).join('|')) {
      throw new Error('Unexpected Staff_Access headers.');
    }

    const tail = sh.getRange(1, 6, 1, 3).getDisplayValues()[0];
    const expectedTail = AUTH_HEADERS_.slice(5);
    const tailEmpty = tail.every(cell => String(cell).trim() === '');
    if (tailEmpty) {
      sh.getRange(1, 6, 1, 3).setValues([expectedTail]);
    } else if (tail.join('|') !== expectedTail.join('|')) {
      throw new Error('Columns F:H in Staff_Access are occupied by unexpected headers.');
    }
  }

  authSheet_();
  Logger.log('Authentication initialized.');
}

function authChangeKey_(username) {
  return 'AUTH_MUST_CHANGE_' + authDigest_(String(username).toLowerCase()).slice(0, 40);
}

function authMustChange_(username) {
  return PropertiesService.getScriptProperties().getProperty(authChangeKey_(username)) === '1';
}

function authSetMustChange_(username, required) {
  const props = PropertiesService.getScriptProperties();
  if (required) props.setProperty(authChangeKey_(username), '1');
  else props.deleteProperty(authChangeKey_(username));
}

/**
 * Remove expired sessions and stale lockout records from ScriptProperties
 * to prevent hitting Apps Script's 500 KB property storage limit.
 */
function authCleanupExpiredProperties_(props, now) {
  const all = props.getProperties();
  for (const key of Object.keys(all)) {
    if (key.startsWith('AUTH_SESSION_')) {
      try {
        const session = JSON.parse(all[key]);
        if (!session || Number(session.expires || 0) < now) {
          props.deleteProperty(key);
        }
      } catch (e) {
        props.deleteProperty(key);
      }
    } else if (key.startsWith('AUTH_FAIL_')) {
      try {
        const attempt = JSON.parse(all[key]);
        const until = Number(attempt && attempt.until ? attempt.until : 0);
        const lastAt = Number(attempt && attempt.lastAt ? attempt.lastAt : 0);
        const expiredBlock = until > 0 && until < now;
        const staleCounter = until === 0 && lastAt > 0 && (now - lastAt) > AUTH_BLOCK_MS_;
        if (!attempt || expiredBlock || staleCounter) {
          props.deleteProperty(key);
        }
      } catch (e) {
        props.deleteProperty(key);
      }
    }
  }
}

/**
 * Delete all stored sessions for a specific username (used on password change/reset).
 */
function authRevokeUserSessions_(props, username) {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return;
  const all = props.getProperties();
  for (const key of Object.keys(all)) {
    if (!key.startsWith('AUTH_SESSION_')) continue;
    try {
      const session = JSON.parse(all[key]);
      if (session && String(session.username || '').trim().toLowerCase() === target) {
        props.deleteProperty(key);
      }
    } catch (e) {
      props.deleteProperty(key);
    }
  }
}

/**
 * Optional standalone/trigger entrypoint for periodic ScriptProperties cleanup.
 */
function authCleanupExpired_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    authCleanupExpiredProperties_(PropertiesService.getScriptProperties(), Date.now());
  } finally {
    lock.releaseLock();
  }
}

function authCreateAccount_(username, password, name, role, email) {
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u)) {
    throw new Error('Username must be 4–32 characters.');
  }
  if (String(password || '').length < 14) {
    throw new Error('Use a unique password of at least 14 characters.');
  }
  if (!['ADMIN', 'TEACHER'].includes(role)) {
    throw new Error('Invalid role.');
  }

  const sh = authSheet_();
  const rows = sh.getDataRange().getDisplayValues();
  if (rows.slice(1).some(r => String(r[5]).trim().toLowerCase() === u)) {
    throw new Error('Username already exists.');
  }

  const salt = authRandom_();
  sh.appendRow([email || '', name || u, role, true, '', u, salt, authPasswordHash_(password, salt)]);

  if (role === 'TEACHER') {
    authSetMustChange_(u, true);
  }
  Logger.log('Account created: ' + u + ' (' + role + ')');
}

function authCreateDemoAccounts_() {
  throw new Error(
    'For safety, create accounts in Apps Script editor by temporarily calling ' +
    'authCreateAccount_(username, uniquePassword, name, role, email) in this function. ' +
    'Do not commit passwords to GitHub.'
  );
}

function authAccount_(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(u)) return null;
  const rows = authSheet_().getDataRange().getDisplayValues();
  const r = rows.slice(1).find(x => String(x[5]).trim().toLowerCase() === u);
  if (!r || !['ADMIN', 'TEACHER'].includes(r[2]) || String(r[3]).toLowerCase() !== 'true') {
    return null;
  }
  return {
    username: u,
    name: r[1],
    role: r[2],
    salt: r[6],
    hash: r[7]
  };
}

function authSessionVersion_(account) {
  // Rotating either password salt or hash invalidates all earlier sessions.
  return authDigest_(account.username + ':' + account.salt + ':' + account.hash);
}

function authLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'AUTH_FAIL_' + authDigest_(u).slice(0, 24);
    const now = Date.now();

    authCleanupExpiredProperties_(props, now);

    const attempt = JSON.parse(props.getProperty(key) || '{"count":0,"until":0,"lastAt":0}');
    if (attempt.until > now) {
      throw new Error('Too many attempts. Try again later.');
    }

    const account = authAccount_(u);
    const salt = account ? account.salt : 'dummy-salt-' + authDigest_(u);
    const actual = authPasswordHash_(String(password || ''), salt);
    const expected = account ? account.hash : '0'.repeat(64);

    if (!account || !authConstantTimeEqual_(actual, expected)) {
      attempt.count = (attempt.count || 0) + 1;
      attempt.lastAt = now;
      if (attempt.count >= AUTH_MAX_ATTEMPTS_) {
        attempt.until = now + AUTH_BLOCK_MS_;
        attempt.count = 0;
      }
      props.setProperty(key, JSON.stringify(attempt));
      throw new Error('Invalid credentials or account temporarily locked.');
    }

    props.deleteProperty(key);
    const token = authRandom_();
    const session = {
      username: u,
      role: account.role,
      name: account.name,
      version: authSessionVersion_(account),
      expires: now + AUTH_TTL_MS_
    };
    props.setProperty('AUTH_SESSION_' + authDigest_(token), JSON.stringify(session));

    return {
      token,
      role: account.role,
      name: account.name,
      expires: session.expires,
      mustChangePassword: authMustChange_(u)
    };
  } finally {
    lock.releaseLock();
  }
}

function authRequire_(token, requiredRole) {
  if (typeof token !== 'string' || token.length < 80) {
    throw new Error('Unauthorized: please sign in.');
  }

  const props = PropertiesService.getScriptProperties();
  const key = 'AUTH_SESSION_' + authDigest_(token);
  const raw = props.getProperty(key);
  if (!raw) {
    throw new Error('Session expired. Sign in again.');
  }

  const session = JSON.parse(raw);
  if (session.expires < Date.now()) {
    props.deleteProperty(key);
    throw new Error('Session expired. Sign in again.');
  }

  const account = authAccount_(session.username);
  if (
    !account ||
    account.role !== session.role ||
    session.version !== authSessionVersion_(account)
  ) {
    props.deleteProperty(key);
    throw new Error('Account changed or session invalidated. Sign in again.');
  }

  if (requiredRole === 'ADMIN' && account.role !== 'ADMIN') {
    throw new Error('Access denied: administrator only.');
  }

  const mustChangePassword = authMustChange_(account.username);
  if (mustChangePassword && requiredRole !== 'PASSWORD_CHANGE' && requiredRole !== 'SESSION') {
    throw new Error('You must change your temporary password before continuing.');
  }

  return {
    username: account.username,
    name: account.name,
    role: account.role,
    expires: session.expires,
    mustChangePassword
  };
}

function authSession(token) {
  return authRequire_(token, 'SESSION');
}

function authLogout(token) {
  if (typeof token === 'string' && token.length >= 80) {
    PropertiesService.getScriptProperties().deleteProperty('AUTH_SESSION_' + authDigest_(token));
  }
  return true;
}

/**
 * Public endpoint for authenticated users.
 * Requires their current password; revokes all their prior sessions.
 * They must log in again with the new password.
 */
function authChangePassword(token, currentPassword, newPassword) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const user = authRequire_(token, 'PASSWORD_CHANGE');
    const password = String(newPassword || '');
    if (password.length < 14 || password.length > 256) {
      throw new Error('New password must be 14–256 characters.');
    }
    if (password === String(currentPassword || '')) {
      throw new Error('Choose a different password.');
    }

    const account = authAccount_(user.username);
    const currentHash = authPasswordHash_(String(currentPassword || ''), account ? account.salt : 'dummy');
    if (!account || !authConstantTimeEqual_(currentHash, account.hash)) {
      throw new Error('Current password is incorrect.');
    }

    const sh = authSheet_();
    const rows = sh.getDataRange().getDisplayValues();
    const index = rows.findIndex(
      (r, i) => i > 0 && String(r[5]).trim().toLowerCase() === user.username
    );
    if (index < 0) {
      throw new Error('Account not found.');
    }

    const salt = authRandom_();
    sh.getRange(index + 1, 7, 1, 2).setValues([[salt, authPasswordHash_(password, salt)]]);
    authSetMustChange_(user.username, false);
    authRevokeUserSessions_(PropertiesService.getScriptProperties(), user.username);

    return {
      success: true,
      message: 'Password changed. Please sign in again.'
    };
  } finally {
    lock.releaseLock();
  }
}