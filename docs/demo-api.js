/* School Academic Management V2 public demo. Fictional data, no server calls. */
(function () {
  'use strict';

  const terms = ['Term 1', 'Term 2', 'Term 3'];
  const subjects = ['Maths', 'Science', 'Tamil', 'English'];
  const allGrades = Array.from({ length: 13 }, (_, i) => 'Grade ' + String(i + 1).padStart(2, '0'));

  const normalizeYear = year => {
    const n = Number(year);
    if (!Number.isInteger(n) || n < 2020 || n > 2100) {
      throw Error('Invalid academic year (expected 2020–2100).');
    }
    return n;
  };

  const normalizeGrade = g => {
    const match = String(g == null ? '' : g).trim().match(/^(?:grade\s*)?0?(\d{1,2})$/i);
    if (!match) return '';
    const num = Number(match[1]);
    return num >= 1 && num <= 13 ? 'Grade ' + String(num).padStart(2, '0') : '';
  };

  const gradeNumber = g => {
    const norm = normalizeGrade(g);
    return norm ? Number(norm.slice(6)) : NaN;
  };

  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;

  const accounts = {
    demo_admin: { password: 'Admin@Demo2026', role: 'ADMIN', name: 'Demo Administrator' },
    demo_teacher: { password: 'Teacher@Demo2026', role: 'TEACHER', name: 'Demo Teacher' }
  };

  const sessionKey = 'school_marks_demo_session';
  const store = () => DemoStorage.load();

  const validateGrade = grade => {
    const norm = normalizeGrade(grade);
    if (!norm) throw Error('Invalid grade.');
    return norm;
  };

  const validateTerm = term => {
    const t = String(term || '').trim();
    if (!terms.includes(t)) throw Error('Invalid term.');
    return t;
  };

  const validateSubject = subject => {
    const s = String(subject || '').trim();
    if (!subjects.includes(s)) throw Error('Invalid subject.');
    return s;
  };

  const validateContext = (year, grade, term) => ({
    year: normalizeYear(year),
    grade: validateGrade(grade),
    term: validateTerm(term)
  });

  const studentsFor = (grade, db = store()) => {
    const gNum = gradeNumber(grade);
    return db.students.filter(s => s.grade === gNum);
  };

  const raw = (s, term, subject, type = 'marks') => s[type]?.[term]?.[subject] ?? null;
  const isAbsent = v => v === 'ABSENT' || v === 'AB';
  const valid = v => typeof v === 'number' && Number.isFinite(v);
  const entered = v => valid(v) || isAbsent(v);
  const score = v => (isAbsent(v) ? 0 : Number(v));
  const mean = vals => (vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);

  const normalizeStoredMark = v => {
    if (v === null || v === undefined || v === '') return '';
    if (isAbsent(v)) return 'ABSENT';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };

  const marksEqual = (a, b) => {
    const na = normalizeStoredMark(a);
    const nb = normalizeStoredMark(b);
    if (na === '' && nb === '') return true;
    if (na === '' || nb === '') return false;
    if (na === 'ABSENT' || nb === 'ABSENT') return na === nb;
    return Math.abs(Number(na) - Number(nb)) < 1e-9;
  };

  const parseSubmittedMark = mark => {
    if (mark === '' || mark === null || mark === undefined) {
      throw Error('Mark cannot be empty.');
    }
    if (typeof mark === 'boolean') {
      throw Error('Invalid mark.');
    }
    const text = String(mark).trim();
    if (!text) {
      throw Error('Mark cannot be empty.');
    }
    if (text.toUpperCase() === 'ABSENT' || text.toUpperCase() === 'AB') {
      return 'ABSENT';
    }
    if (!/^\d+(?:\.\d+)?$/.test(text)) {
      throw Error('Marks must be numeric (0–100) or ABSENT.');
    }
    const num = Number(text);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw Error('Marks must be between 0 and 100.');
    }
    return num;
  };

  const userFor = token => {
    const name = String(token || '').replace(/^demo-/, '');
    if (!accounts[name] || sessionStorage.getItem(sessionKey) !== name) {
      throw Error('Please sign in to the demo.');
    }
    return { ...accounts[name], username: name };
  };

  const requireAdmin = token => {
    const acc = userFor(token);
    if (acc.role !== 'ADMIN') {
      throw Error('Administrator access required.');
    }
    return acc;
  };

  const normalizeGradeAssign = input => {
    if (input === null || input === undefined) return null;
    if (typeof input === 'string') {
      const t = input.trim();
      if (!t || t === '*' || t.toUpperCase() === 'ALL') return null;
      input = t.split(',').map(x => x.trim()).filter(Boolean);
    }
    if (!Array.isArray(input)) throw Error('Assigned grades must be a list or ALL.');
    const out = [];
    const seen = new Set();
    for (const item of input) {
      const t = String(item || '').trim();
      if (!t) continue;
      if (t === '*' || t.toUpperCase() === 'ALL') return null;
      const g = normalizeGrade(t);
      if (!g) throw Error('Invalid assigned grade: ' + t);
      if (!seen.has(g)) {
        seen.add(g);
        out.push(g);
      }
    }
    return out.sort();
  };

  const normalizeSubjectAssign = input => {
    if (input === null || input === undefined) return null;
    if (typeof input === 'string') {
      const t = input.trim();
      if (!t || t === '*' || t.toUpperCase() === 'ALL') return null;
      input = t.split(',').map(x => x.trim()).filter(Boolean);
    }
    if (!Array.isArray(input)) throw Error('Assigned subjects must be a list or ALL.');
    const out = [];
    const seen = new Set();
    for (const item of input) {
      const t = String(item || '').trim();
      if (!t) continue;
      if (t === '*' || t.toUpperCase() === 'ALL') return null;
      if (!subjects.includes(t)) throw Error('Unknown subject in assignment: ' + t);
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  };

  const getAssignmentFor = (username, db = store()) => {
    const a = db.teacherAssignments?.[username];
    if (!a) return { grades: null, subjects: null };
    return {
      grades: Array.isArray(a.grades) ? a.grades.slice() : null,
      subjects: Array.isArray(a.subjects) ? a.subjects.slice() : null
    };
  };

  const assertAssigned = (account, grade, subject, db = store()) => {
    if (!account) throw Error('Please sign in to the demo.');
    if (account.role === 'ADMIN') return;
    const assign = getAssignmentFor(account.username, db);
    if (grade !== undefined && grade !== null && String(grade).trim() !== '') {
      const normGrade = validateGrade(grade);
      if (assign.grades !== null && !assign.grades.includes(normGrade)) {
        throw Error('Access denied: you are not assigned to ' + normGrade + '.');
      }
    }
    if (subject !== undefined && subject !== null && String(subject).trim() !== '') {
      const subj = validateSubject(subject);
      if (assign.subjects !== null && !assign.subjects.includes(subj)) {
        throw Error('Access denied: you are not assigned to subject "' + subj + '".');
      }
    }
  };

  const subjectStats = (grade, term, db = store()) => {
    const list = studentsFor(grade, db);
    return subjects.map(subject => {
      const vals = list.map(s => raw(s, term, subject));
      const present = vals.filter(entered);
      const numeric = present.map(score);
      const count = present.length;
      const expected = list.length;
      return {
        subject,
        enrolled: expected,
        expected,
        entered: count,
        absent: present.filter(isAbsent).length,
        pending: expected - count,
        average: mean(numeric),
        highest: numeric.length ? Math.max(...numeric) : null,
        lowest: numeric.length ? Math.min(...numeric) : null,
        missingIds: list.filter(s => !entered(raw(s, term, subject))).map(s => s.id),
        status: count === expected ? 'completed' : count ? 'partial' : 'pending'
      };
    });
  };

  const analysis = (year, grade, term, db = store()) => {
    const ctx = validateContext(year, grade, term);
    const list = studentsFor(ctx.grade, db);
    const stats = subjectStats(ctx.grade, ctx.term, db);
    const rows = list.map(s => {
      const marks = {};
      const missing = [];
      let total = 0;
      let absent = 0;
      let count = 0;
      for (const subject of subjects) {
        const v = raw(s, ctx.term, subject);
        if (entered(v)) {
          marks[subject] = isAbsent(v) ? 'AB' : v;
          total += score(v);
          count++;
          if (isAbsent(v)) absent++;
        } else {
          missing.push(subject);
        }
      }
      const complete = count === subjects.length && count > 0;
      return {
        id: s.id,
        name: s.name,
        marks,
        missing,
        expected: subjects.length,
        entered: count,
        absent,
        numericCount: count - absent,
        totalRecorded: round(total),
        complete,
        average: complete ? round(total / subjects.length) : null
      };
    });
    const complete = rows.filter(s => s.complete);
    return {
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subjects: stats,
      students: rows,
      studentCount: list.length,
      completeCount: complete.length,
      pendingCount: rows.length - complete.length,
      classAverage: mean(complete.map(s => s.average)),
      warnings: { duplicates: [], invalidOrUnmatched: [] },
      note: 'Fictional demo results. ABSENT is zero; pending marks make student averages incomplete.'
    };
  };

  const buildSubmissionStatus = (year, grade, term, account, db = store()) => {
    const ctx = validateContext(year, grade, term);
    assertAssigned(account, ctx.grade, null, db);
    let stats = subjectStats(ctx.grade, ctx.term, db);
    if (account && account.role === 'TEACHER') {
      const assign = getAssignmentFor(account.username, db);
      if (assign.subjects !== null) {
        const allowed = new Set(assign.subjects);
        stats = stats.filter(s => allowed.has(s.subject));
      }
    }
    const expectedMarks = stats.reduce((n, s) => n + s.expected, 0);
    const enteredMarks = stats.reduce((n, s) => n + s.entered, 0);
    const absentMarks = stats.reduce((n, s) => n + s.absent, 0);
    const missingMarks = Math.max(0, expectedMarks - enteredMarks);
    const numericMarks = Math.max(0, enteredMarks - absentMarks);
    return {
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subjects: stats,
      required: stats.length,
      completed: stats.filter(s => s.status === 'completed').length,
      partial: stats.filter(s => s.status === 'partial').length,
      pending: stats.filter(s => s.status === 'pending').length,
      expectedMarks,
      enteredMarks,
      numericMarks,
      absentMarks,
      missingMarks,
      studentCount: studentsFor(ctx.grade, db).length,
      completionPercentage: expectedMarks > 0 ? round((enteredMarks / expectedMarks) * 100) : 0,
      allComplete: expectedMarks > 0 && missingMarks === 0
    };
  };

  const buildComparisonFromAnalyses = (ctxYear, ctxGrade, analyses, db = store()) => {
    const studentCount = studentsFor(ctxGrade, db).length;
    return {
      year: ctxYear,
      grade: ctxGrade,
      studentCount,
      terms: analyses.map(a => {
        const expected = a.subjects.reduce((n, s) => n + s.expected, 0);
        const count = a.subjects.reduce((n, s) => n + s.entered, 0);
        const absent = a.subjects.reduce((n, s) => n + s.absent, 0);
        return {
          term: a.term,
          entered: count,
          expected,
          absent,
          numeric: Math.max(0, count - absent),
          missing: expected - count,
          completionPercentage: expected > 0 ? round((count / expected) * 100) : 0,
          complete: expected > 0 && count === expected,
          classAverage: a.classAverage
        };
      }),
      subjects: subjects.map(subject => ({
        subject,
        terms: analyses.map(a => {
          const s = a.subjects.find(item => item.subject === subject);
          return {
            term: a.term,
            average: s ? s.average : null,
            entered: s ? s.entered : 0,
            expected: s ? s.expected : 0
          };
        })
      })),
      note: 'Fictional data. AB counts as zero; pending marks are not scored.'
    };
  };

  const comparison = (year, grade) => {
    const y = normalizeYear(year);
    const g = validateGrade(grade);
    const db = store();
    const analyses = terms.map(t => analysis(y, g, t, db));
    return buildComparisonFromAnalyses(y, g, analyses, db);
  };

  const buildStudentReportFromAnalyses = (year, grade, student, analyses) => {
    const termReports = terms.map((term, i) => {
      const result = analyses[i].students.find(s => s.id === student.id);
      const marks = subjects.map(subject => ({
        subject,
        mark: result.marks[subject] ?? null,
        entered: Object.hasOwn(result.marks, subject),
        absent: result.marks[subject] === 'AB'
      }));
      return {
        term,
        marks,
        expected: result.expected,
        entered: result.entered,
        absent: result.absent,
        numericCount: result.numericCount,
        missing: result.expected - result.entered,
        complete: result.complete,
        totalRecorded: result.totalRecorded,
        average: result.average,
        missingSubjects: result.missing
      };
    });
    const complete = termReports.filter(t => t.complete);
    const allComplete = termReports.every(t => t.complete && t.average !== null);
    return {
      year: Number(year),
      grade,
      student: { id: student.id, name: student.name },
      subjects: [...subjects],
      terms: termReports,
      overallAverage: mean(complete.map(t => t.average)),
      annualAverage: allComplete ? mean(termReports.map(t => t.average)) : null,
      allTermsComplete: allComplete,
      warnings: [],
      note: 'Fictional records only; nothing is connected to a school database.'
    };
  };

  const report = (year, grade, id) => {
    const y = normalizeYear(year);
    const g = validateGrade(grade);
    const db = store();
    const student = studentsFor(g, db).find(s => String(s.id) === String(id));
    if (!student) throw Error('Demo student not found.');
    const analyses = terms.map(t => analysis(y, g, t, db));
    return buildStudentReportFromAnalyses(y, g, student, analyses);
  };

  const reportWithAnalyses = (year, grade, id) => {
    const y = normalizeYear(year);
    const g = validateGrade(grade);
    const db = store();
    const student = studentsFor(g, db).find(s => String(s.id) === String(id));
    if (!student) throw Error('Demo student not found.');
    const analyses = terms.map(t => analysis(y, g, t, db));
    return {
      report: buildStudentReportFromAnalyses(y, g, student, analyses),
      analyses
    };
  };

  const gradeBulkReportData = (year, grade) => {
    const y = normalizeYear(year);
    const g = validateGrade(grade);
    const db = store();
    const analyses = terms.map(t => analysis(y, g, t, db));
    const termComparison = buildComparisonFromAnalyses(y, g, analyses, db);
    const list = studentsFor(g, db)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const reports = list.map(st => buildStudentReportFromAnalyses(y, g, st, analyses));
    return {
      analyses,
      termComparison,
      reports,
      studentErrors: []
    };
  };

  const annual = (year, grade) => {
    const y = normalizeYear(year);
    const g = validateGrade(grade);
    const db = store();
    const rows = subjects.map(subject => {
      const candidates = [];
      const enrolled = studentsFor(g, db);
      let pending = 0;
      for (const s of enrolled) {
        const marks = terms.map(t => raw(s, t, subject));
        if (!marks.every(entered)) {
          pending++;
          continue;
        }
        candidates.push({
          id: s.id,
          name: s.name,
          terms: marks.map(v => (isAbsent(v) ? 'AB' : v)),
          annualAverage: mean(marks.map(score))
        });
      }
      candidates.sort((a, b) => b.annualAverage - a.annualAverage || a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));
      let previous = null;
      let rank = 0;
      candidates.forEach((s, i) => {
        if (previous === null || Math.abs(previous - s.annualAverage) > 1e-9) rank = i + 1;
        s.rank = rank;
        previous = s.annualAverage;
      });
      return {
        subject,
        enrolled: enrolled.length,
        complete: candidates.length,
        pending,
        top: pending === 0 ? candidates.filter(s => s.rank <= 3) : []
      };
    });
    return {
      year: y,
      grade: g,
      studentCount: studentsFor(g, db).length,
      ready: rows.length > 0 && rows.every(s => s.pending === 0),
      subjects: rows,
      warnings: [],
      note: 'Fictional annual rankings. All three terms required; ties share ranks.'
    };
  };

  const sbaReport = (year, grade, term) => {
    const ctx = validateContext(year, grade, term);
    const db = store();
    const rows = studentsFor(ctx.grade, db).flatMap(s =>
      subjects.map(subject => {
        const mark = raw(s, ctx.term, subject, 'sba');
        return {
          id: s.id,
          name: s.name,
          subject,
          mark: entered(mark) ? (isAbsent(mark) ? 'ABSENT' : mark) : null,
          status: !entered(mark) ? 'PENDING' : isAbsent(mark) ? 'ABSENT' : 'RECORDED'
        };
      })
    );
    return {
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subjects: [...subjects],
      results: rows,
      total: rows.length,
      recorded: rows.filter(r => r.status !== 'PENDING').length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      warnings: []
    };
  };

  const pendingSBA = (year, grade, term, subject) => {
    const ctx = validateContext(year, grade, term);
    const subj = validateSubject(subject);
    const list = studentsFor(ctx.grade).map(s => ({ id: s.id, name: s.name, mark: raw(s, ctx.term, subj, 'sba') }));
    const count = list.filter(s => entered(s.mark)).length;
    return {
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subject: subj,
      total: list.length,
      completed: count,
      pending: list.length - count,
      students: list.map(s => ({
        id: s.id,
        name: s.name,
        status: entered(s.mark) ? (isAbsent(s.mark) ? 'ABSENT' : 'COMPLETED') : 'PENDING',
        mark: entered(s.mark) ? (isAbsent(s.mark) ? 'ABSENT' : s.mark) : null
      }))
    };
  };

  const subjectMarksForEntry = (year, grade, term, subject, assessmentType) => {
    const ctx = validateContext(year, grade, term);
    const subj = validateSubject(subject);
    const kind = String(assessmentType || 'EXAM').trim().toUpperCase();
    if (kind !== 'EXAM' && kind !== 'SBA') throw Error('Invalid assessment type.');
    const prop = kind === 'SBA' ? 'sba' : 'marks';
    const metaProp = kind === 'SBA' ? 'sbaMeta' : 'marksMeta';
    const list = studentsFor(ctx.grade);
    let recordedCount = 0;
    let pendingCount = 0;
    const students = list.map(s => {
      const m = raw(s, ctx.term, subj, prop);
      const meta = s[metaProp]?.[ctx.term]?.[subj] || {};
      if (!entered(m)) {
        pendingCount++;
        return {
          id: s.id,
          name: s.name,
          mark: null,
          status: 'PENDING',
          updatedAt: '',
          submittedBy: '',
          duplicate: false
        };
      }
      recordedCount++;
      const abs = isAbsent(m);
      return {
        id: s.id,
        name: s.name,
        mark: abs ? 'ABSENT' : Number(m),
        status: abs ? 'ABSENT' : 'RECORDED',
        updatedAt: meta.updatedAt || '',
        submittedBy: meta.submittedBy || '',
        duplicate: false
      };
    });
    return {
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subject: subj,
      assessmentType: kind,
      total: students.length,
      entered: recordedCount,
      pending: pendingCount,
      warnings: [],
      students
    };
  };

  const validateBatch = (payload, account) => {
    if (!payload || typeof payload !== 'object') throw Error('Invalid submission payload.');
    const ctx = validateContext(payload.year, payload.grade, payload.term);
    const subj = validateSubject(payload.subject);
    assertAssigned(account, ctx.grade, subj);
    const db = store();
    const list = studentsFor(ctx.grade, db);
    const idSet = new Set(list.map(s => String(s.id)));
    const studentMap = new Map(list.map(s => [String(s.id), s]));
    const seen = new Set();
    const accepted = [];
    const skipped = [];
    const errors = [];
    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;

    for (const item of payload.marks || []) {
      const id = String(item?.id || '').trim();
      if (!id || !idSet.has(id)) {
        errors.push(`Invalid or unenrolled student: ${id || '(missing)'}`);
        continue;
      }
      if (seen.has(id)) {
        errors.push(`Duplicate student in submission: ${id}`);
        continue;
      }
      seen.add(id);
      if (item.mark === '' || item.mark === null || item.mark === undefined) {
        skipped.push(id);
        continue;
      }
      try {
        const parsed = parseSubmittedMark(item.mark);
        const existingVal = raw(studentMap.get(id), ctx.term, subj);
        let mode = 'CREATE';
        if (entered(existingVal)) {
          if (marksEqual(existingVal, parsed)) {
            mode = 'UNCHANGED';
            unchangedCount++;
          } else {
            mode = 'UPDATE';
            updateCount++;
          }
        } else {
          newCount++;
        }
        accepted.push({ id, mark: parsed, mode });
      } catch (err) {
        errors.push(`${id}: ${err.message}`);
      }
    }

    return {
      valid: errors.length === 0 && accepted.length > 0,
      year: ctx.year,
      grade: ctx.grade,
      term: ctx.term,
      subject: subj,
      acceptedCount: accepted.length,
      newCount,
      updateCount,
      unchangedCount,
      skippedCount: skipped.length,
      errorCount: errors.length,
      accepted,
      skipped,
      errors
    };
  };

  /**
   * Direct teacher & admin mark saves/updates without an admin approval block.
   * Logs background audit records in db.marksAudit (non-blocking).
   */
  const save = (payload, token, type) => {
    const account = userFor(token);
    if (!payload || typeof payload !== 'object') throw Error('Invalid submission.');
    const ctx = validateContext(payload.year, payload.grade, payload.term);
    const subj = validateSubject(payload.subject);
    const db = store();
    assertAssigned(account, ctx.grade, subj, db);
    const list = studentsFor(ctx.grade, db);
    const seen = new Set();
    const changes = [];
    let unchanged = 0;
    const nowIso = new Date().toISOString();

    for (const item of payload.marks || []) {
      const id = String(item?.id || '').trim();
      if (seen.has(id)) throw Error('Duplicate student in submission: ' + id);
      seen.add(id);
      const student = list.find(s => String(s.id) === id);
      if (!student) throw Error('Invalid student: ' + id);
      if (item.mark === '' || item.mark === null || item.mark === undefined) continue;
      const v = parseSubmittedMark(item.mark);
      const existing = raw(student, ctx.term, subj, type);
      if (entered(existing)) {
        if (marksEqual(existing, v)) {
          unchanged++;
          continue;
        }
        changes.push({
          student,
          value: v,
          action: 'UPDATE',
          oldMark: isAbsent(existing) ? 'ABSENT' : Number(existing)
        });
      } else {
        changes.push({
          student,
          value: v,
          action: 'CREATE',
          oldMark: ''
        });
      }
    }

    if (!changes.length && unchanged === 0) {
      throw Error('Enter at least one mark.');
    }

    let added = 0;
    let updated = 0;
    const metaProp = type === 'sba' ? 'sbaMeta' : 'marksMeta';
    const assessmentLabel = type === 'sba' ? 'SBA' : 'EXAM';

    for (const ch of changes) {
      ch.student[type] ||= {};
      ch.student[type][ctx.term] ||= {};
      ch.student[type][ctx.term][subj] = ch.value;
      ch.student[metaProp] ||= {};
      ch.student[metaProp][ctx.term] ||= {};
      ch.student[metaProp][ctx.term][subj] = {
        updatedAt: nowIso,
        submittedBy: account.username
      };
      if (ch.action === 'UPDATE') updated++;
      else added++;
    }

    // Background accountability audit log (never blocks direct edits).
    try {
      db.marksAudit ||= [];
      for (const ch of changes) {
        db.marksAudit.push({
          timestamp: nowIso,
          username: account.username,
          role: account.role,
          assessmentType: assessmentLabel,
          year: ctx.year,
          grade: ctx.grade,
          term: ctx.term,
          studentId: ch.student.id,
          studentName: ch.student.name,
          subject: subj,
          action: ch.action,
          oldMark: ch.oldMark,
          newMark: ch.value
        });
      }
      if (db.marksAudit.length > 2000) {
        db.marksAudit = db.marksAudit.slice(-2000);
      }
    } catch (auditErr) {
      console.warn('Demo audit log failed:', auditErr);
    }

    DemoStorage.save(db);
    return { added, updated, unchanged, total: added + updated };
  };

  const api = {
    login(username, password) {
      const account = accounts[String(username || '').trim()];
      if (!account || account.password !== password) {
        return { success: false, message: 'Invalid demo username or password.' };
      }
      return { success: true, user: { username: String(username).trim(), name: account.name, role: account.role } };
    },
    authLogin(username, password) {
      const result = this.login(username, password);
      if (!result.success) throw Error(result.message);
      sessionStorage.setItem(sessionKey, result.user.username);
      return {
        token: 'demo-' + result.user.username,
        role: result.user.role,
        name: result.user.name,
        mustChangePassword: false
      };
    },
    authSession(token) {
      const account = userFor(token);
      return { role: account.role, name: account.name, mustChangePassword: false };
    },
    authLogout() {
      sessionStorage.removeItem(sessionKey);
      return true;
    },
    resetDemo() {
      return DemoStorage.reset();
    },

    /* ---- Setup & Staff Marks Entry ---- */
    getSetup(token) {
      const account = userFor(token);
      const db = store();
      if (account.role === 'ADMIN') {
        return {
          grades: [...allGrades],
          subjects: [...subjects],
          subjectsByGrade: Object.fromEntries(allGrades.map(g => [g, [...subjects]])),
          registerSheet: 'Fictional demo registers',
          isRestricted: false,
          assignedGrades: null,
          assignedSubjects: null,
          role: 'ADMIN'
        };
      }
      const assign = getAssignmentFor(account.username, db);
      const grades = assign.grades ? allGrades.filter(g => assign.grades.includes(g)) : [...allGrades];
      const allowedSubjs = assign.subjects ? subjects.filter(s => assign.subjects.includes(s)) : [...subjects];
      return {
        grades,
        subjects: allowedSubjs,
        subjectsByGrade: Object.fromEntries(grades.map(g => [g, [...allowedSubjs]])),
        registerSheet: 'Fictional demo registers',
        isRestricted: Boolean(assign.grades || assign.subjects),
        assignedGrades: assign.grades ? assign.grades.slice() : null,
        assignedSubjects: assign.subjects ? assign.subjects.slice() : null,
        role: 'TEACHER'
      };
    },
    getStudents(grade, subject, token) {
      const account = userFor(token);
      assertAssigned(account, grade, subject);
      return studentsFor(grade).map(s => ({ id: s.id, name: s.name }));
    },
    getStudentsForGrade(grade, subject, token) {
      return this.getStudents(grade, subject, token);
    },
    getSubmissionStatus(year, grade, term, token) {
      const account = userFor(token);
      return buildSubmissionStatus(year, grade, term, account);
    },
    getSubmissionSummary(year, grade, term, token) {
      const account = userFor(token);
      const status = buildSubmissionStatus(year, grade, term, account);
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
        completionPercentage: status.completionPercentage,
        completedSubjects: status.completed,
        partialSubjects: status.partial,
        pendingSubjects: status.pending,
        allComplete: status.allComplete
      };
    },
    getSubjectMarksForEntry(year, grade, term, subject, assessmentType, token) {
      const account = userFor(token);
      assertAssigned(account, grade, subject);
      return subjectMarksForEntry(year, grade, term, subject, assessmentType);
    },
    checkMarkExists(year, grade, term, studentId, subject, token) {
      const account = userFor(token);
      const ctx = validateContext(year, grade, term);
      const subj = validateSubject(subject);
      assertAssigned(account, ctx.grade, subj);
      const student = studentsFor(ctx.grade).find(s => String(s.id) === String(studentId).trim());
      if (!student) throw Error('Student not found.');
      const val = raw(student, ctx.term, subj);
      const hasMark = entered(val);
      return { exists: hasMark, mark: hasMark ? val : null, duplicate: false, count: hasMark ? 1 : 0, rows: [] };
    },
    getPendingStudents(year, grade, term, subject, token) {
      const account = userFor(token);
      const ctx = validateContext(year, grade, term);
      const subj = validateSubject(subject);
      assertAssigned(account, ctx.grade, subj);
      const list = studentsFor(ctx.grade);
      const pending = list
        .filter(s => !entered(raw(s, ctx.term, subj)))
        .map(s => ({ id: s.id, name: s.name }));
      return {
        year: ctx.year,
        grade: ctx.grade,
        term: ctx.term,
        subject: subj,
        enrolled: list.length,
        pending: pending.length,
        entered: list.length - pending.length,
        students: pending
      };
    },
    validateMarksSubmission(payload, token) {
      const account = userFor(token);
      return validateBatch(payload, account);
    },
    getSBAPendingStudents(year, grade, term, subject, token) {
      const account = userFor(token);
      assertAssigned(account, grade, subject);
      return pendingSBA(year, grade, term, subject);
    },
    saveMarks(payload, token) {
      return save(payload, token, 'marks');
    },
    saveSBAMarks(payload, token) {
      return save(payload, token, 'sba');
    },

    /* ---- Administrator-Only Analysis & Reporting ---- */
    getDashboardData(year, grade, term, token) {
      const admin = requireAdmin(token);
      return {
        analysis: analysis(year, grade, term),
        submission: buildSubmissionStatus(year, grade, term, admin)
      };
    },
    getAnalysis(year, grade, term, token) {
      requireAdmin(token);
      return analysis(year, grade, term);
    },
    getTermComparison(year, grade, token) {
      requireAdmin(token);
      return comparison(year, grade);
    },
    getSubjectTermComparison(year, grade, subject, token) {
      requireAdmin(token);
      const subj = validateSubject(subject);
      const comp = comparison(year, grade);
      const found = comp.subjects.find(item => item.subject === subj);
      return {
        year: comp.year,
        grade: comp.grade,
        subject: subj,
        terms: found ? found.terms : [],
        note: comp.note
      };
    },
    getAnnualTopPerformers(year, grade, token) {
      requireAdmin(token);
      return annual(year, grade);
    },
    getSBAReport(year, grade, term, token) {
      requireAdmin(token);
      return sbaReport(year, grade, term);
    },
    getReportStudents(grade, token) {
      requireAdmin(token);
      validateGrade(grade);
      return studentsFor(grade)
        .map(s => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    getStudentReport(year, grade, id, token) {
      requireAdmin(token);
      return report(year, grade, id);
    },
    getStudentReportWithAnalyses(year, grade, id, token) {
      requireAdmin(token);
      return reportWithAnalyses(year, grade, id);
    },
    getGradeBulkReportData(year, grade, token) {
      requireAdmin(token);
      return gradeBulkReportData(year, grade);
    },
    getMarksAuditLog(year, grade, limit, token) {
      requireAdmin(token);
      const db = store();
      const entries = Array.isArray(db.marksAudit) ? db.marksAudit.slice() : [];
      const yearFilter = year !== null && year !== undefined && String(year).trim() !== '' && String(year).trim().toUpperCase() !== 'ALL'
        ? Number(year)
        : null;
      const gradeFilter = grade && String(grade).trim().toUpperCase() !== 'ALL'
        ? validateGrade(grade)
        : '';
      const max = Math.max(1, Math.min(500, Number(limit) || 100));
      const filtered = [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (yearFilter !== null && Number(e.year) !== yearFilter) continue;
        if (gradeFilter && normalizeGrade(e.grade) !== gradeFilter) continue;
        filtered.push(e);
        if (filtered.length >= max) break;
      }
      return { entries: filtered, total: filtered.length };
    },
    adminListTeachers(token) {
      requireAdmin(token);
      const db = store();
      const assign = getAssignmentFor('demo_teacher', db);
      return [{
        name: 'Demo Teacher',
        username: 'demo_teacher',
        email: '',
        active: true,
        assignedGrades: assign.grades,
        assignedSubjects: assign.subjects
      }];
    },
    adminSetTeacherAssignments(username, assignedGrades, assignedSubjects, token) {
      requireAdmin(token);
      const u = String(username || '').trim().toLowerCase();
      if (u !== 'demo_teacher') {
        throw Error('Only the demo_teacher account exists in the public demo.');
      }
      const grades = normalizeGradeAssign(assignedGrades);
      const subjs = normalizeSubjectAssign(assignedSubjects);
      const db = store();
      db.teacherAssignments ||= {};
      db.teacherAssignments[u] = { grades, subjects: subjs };
      DemoStorage.save(db);
      return { username: u, assignedGrades: grades, assignedSubjects: subjs };
    },
    adminCreateTeacher() { throw Error('Account creation is disabled in the public demo.'); },
    adminResetTeacherPassword() { throw Error('Password resets are disabled in the public demo.'); },
    adminSetTeacherActive() { throw Error('Account changes are disabled in the public demo.'); },
    authChangePassword() { throw Error('Password changes are disabled in the public demo.'); }
  };

  window.DemoAPI = api;

  function invoke(method, args, success, failure) {
    Promise.resolve()
      .then(() => {
        if (typeof api[method] !== 'function') {
          throw Error('Unsupported demo function: ' + String(method));
        }
        return api[method](...args);
      })
      .then(value => success?.(value))
      .catch(error => {
        if (failure) failure(error);
        else console.error('Demo operation failed:', error);
      });
  }

  function runner(success, failure) {
    return new Proxy({}, {
      get(_target, method) {
        if (method === 'withSuccessHandler') return fn => runner(fn, failure);
        if (method === 'withFailureHandler') return fn => runner(success, fn);
        if (method === 'then') return undefined;
        return (...args) => invoke(method, args, success, failure);
      }
    });
  }

  window.google = { script: { run: runner(undefined, undefined) } };
})();