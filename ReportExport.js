/**
 * ReportExport.gs — School Academic Management
 * Keep the seven existing files. Add this as a NEW Apps Script file.
 * Run exportStart(year), then repeatedly exportNext(jobId) from Index.html.
 * Reports are read-only; only temporary Google Drive documents/files are created.
 * IMPORTANT: Restrict web-app access to authorized school staff before using real data.
 */
const EXPORT_ROOT_NAME = 'School Academic Reports';
const EXPORT_JOB_PREFIX = 'academic_export_';
const EXPORT_BATCH_SIZE = 2; // Conservative: student reports call getAnalysis() three times.

function exportRoot_() {
  const folders = DriveApp.getFoldersByName(EXPORT_ROOT_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(EXPORT_ROOT_NAME);
}
function exportProperty_(id) { return EXPORT_JOB_PREFIX + id; }
function exportJob_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty(exportProperty_(id));
  if (!raw) throw new Error('Export job not found or expired. Start a new export.');
  return JSON.parse(raw);
}
function exportSave_(job) {
  PropertiesService.getScriptProperties().setProperty(exportProperty_(job.id), JSON.stringify(job));
}
function exportYear_(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Invalid academic year.');
  return year;
}
function exportStart(year) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const y = exportYear_(year);
    const grades = REGISTER_CONFIG.flatMap(r => r.grades);
    const tasks = [];
    for (const grade of grades) {
      for (const term of ['Term 1', 'Term 2', 'Term 3']) tasks.push({type:'subject', grade, term});
      tasks.push({type:'term', grade});
      for (const student of getReportStudents(grade)) tasks.push({type:'student', grade, studentId:student.id});
    }
    if (!tasks.length) throw new Error('No report tasks found.');
    const id = Utilities.getUuid();
    const workFolder = exportRoot_().createFolder('_WORK_' + y + '_' + id);
    const job = {id, year:y, folderId:workFolder.getId(), index:0, tasks, errors:[], status:'running'};
    exportSave_(job);
    return {jobId:id, done:0, total:tasks.length, status:'running'};
  } finally { lock.releaseLock(); }
}
function exportSafeName_(text) {
  return String(text).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 90);
}
function exportCell_(value) {
  return value === null || value === undefined || value === '' ? 'Pending' : String(value);
}
function exportParagraph_(body, value) { body.appendParagraph(String(value)); }
function exportTable_(body, rows) {
  if (rows.length) body.appendTable(rows.map(row => row.map(exportCell_)));
}
function exportBuildDocument_(task, year) {
  const title = task.type === 'subject' ? task.grade + ' - ' + task.term + ' - Subjectwise Analysis'
    : task.type === 'term' ? task.grade + ' - Termwise Analysis'
    : task.grade + ' - ' + task.studentId + ' - Student Performance';
  const doc = DocumentApp.create(title);
  try {
    const body = doc.getBody();
    body.appendParagraph('SCHOOL ACADEMIC MANAGEMENT').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    exportParagraph_(body, 'Academic year: ' + year);
    if (task.type === 'subject') {
      const a = getAnalysis(year, task.grade, task.term);
      exportParagraph_(body, 'Students: ' + a.studentCount + ' | Complete: ' + a.completeCount + ' | Pending: ' + a.pendingCount);
      exportParagraph_(body, 'Class average: ' + exportCell_(a.classAverage));
      body.appendParagraph('Subject performance').setHeading(DocumentApp.ParagraphHeading.HEADING3);
      exportTable_(body, [['Subject','Enrolled','Entered','Absent','Pending','Average','Highest','Lowest']].concat(
        a.subjects.map(s => [s.subject,s.enrolled,s.entered,s.absent,s.pending,s.average,s.highest,s.lowest])));
      body.appendParagraph('Student results').setHeading(DocumentApp.ParagraphHeading.HEADING3);
      exportTable_(body, [['Student ID','Name','Entered','Total','Average','Status']].concat(
        a.students.map(s => [s.id,s.name,s.entered+'/'+s.expected,s.totalRecorded,s.average,s.complete?'Complete':'Pending'])));
      exportParagraph_(body, 'Duplicate warnings: ' + a.warnings.duplicates.length + '; invalid/unmatched: ' + a.warnings.invalidOrUnmatched.length);
    } else if (task.type === 'term') {
      const c = getTermComparison(year, task.grade);
      exportParagraph_(body, 'Registered students: ' + c.studentCount);
      exportTable_(body, [['Term','Class average','Entered','Expected','Absent','Missing','Completion %']].concat(
        c.terms.map(t => [t.term,t.classAverage,t.entered,t.expected,t.absent,t.missing,t.completionPercentage])));
      body.appendParagraph('Subject averages across terms').setHeading(DocumentApp.ParagraphHeading.HEADING3);
      exportTable_(body, [['Subject','Term 1','Term 2','Term 3']].concat(
        c.subjects.map(s => [s.subject].concat(s.terms.map(t => t.average)))));
      exportParagraph_(body, 'Comparisons marked incomplete are not final performance changes.');
    } else {
      const r = getStudentReport(year, task.grade, task.studentId);
      exportParagraph_(body, 'Student: ' + r.student.name + ' | ID: ' + r.student.id);
      exportTable_(body, [['Term','Recorded','Absent','Average','Status']].concat(
        r.terms.map(t => [t.term,t.entered+'/'+t.expected,t.absent,t.average,t.complete?'Complete':'Pending'])));
      body.appendParagraph('Subject marks').setHeading(DocumentApp.ParagraphHeading.HEADING3);
      exportTable_(body, [['Subject','Term 1','Term 2','Term 3']].concat(r.subjects.map(subject =>
        [subject].concat(r.terms.map(term => {
          const mark = term.marks.find(m => m.subject === subject);
          return mark ? mark.mark : null;
        })))));
      exportParagraph_(body, 'Available average: ' + exportCell_(r.overallAverage));
      exportParagraph_(body, 'Final annual average: ' + exportCell_(r.annualAverage));
      if (r.warnings.length) exportParagraph_(body, 'Data warnings: ' + r.warnings.join('; '));
    }
    exportParagraph_(body, 'AB = absent (counts as zero). Pending = no valid recorded mark.');
    doc.saveAndClose();
    const file = DriveApp.getFileById(doc.getId());
    return {pdf:file.getAs(MimeType.PDF), documentId:doc.getId()};
  } catch (error) {
    try { doc.saveAndClose(); } catch (_) {}
    DriveApp.getFileById(doc.getId()).setTrashed(true);
    throw error;
  }
}
function exportTaskName_(task) {
  if (task.type === 'subject') return '1. Subjectwise Analysis/' + exportSafeName_(task.grade + ' - ' + task.term) + '.pdf';
  if (task.type === 'term') return '2. Termwise Analysis/' + exportSafeName_(task.grade) + '.pdf';
  return '3. Student Performance Reports/' + exportSafeName_(task.grade) + '/' + exportSafeName_(task.studentId) + '.pdf';
}
function exportNext(jobId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const job = exportJob_(jobId);
    if (job.status === 'complete') return {status:'complete',done:job.index,total:job.tasks.length,url:job.url,errors:job.errors};
    if (job.status !== 'running') throw new Error('Export job is not running.');
    const folder = DriveApp.getFolderById(job.folderId);
    const stop = Math.min(job.index + EXPORT_BATCH_SIZE, job.tasks.length);
    for (; job.index < stop; job.index++) {
      const task = job.tasks[job.index];
      let tempId = null;
      try {
        const generated = exportBuildDocument_(task, job.year);
        tempId = generated.documentId;
        const name = exportTaskName_(task);
        folder.createFile(generated.pdf.setName(name));
      } catch (e) {
        job.errors.push({task:exportTaskName_(task),message:String(e.message || e)});
      } finally {
        if (tempId) DriveApp.getFileById(tempId).setTrashed(true);
      }
    }
    exportSave_(job);
    return {status:'running',done:job.index,total:job.tasks.length,errors:job.errors};
  } finally { lock.releaseLock(); }
}
function exportFinish(jobId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const job = exportJob_(jobId);
    if (job.status === 'complete') return {status:'complete',done:job.index,total:job.tasks.length,url:job.url,errors:job.errors};
    if (job.index !== job.tasks.length) throw new Error('Export is still processing.');
    if (job.errors.length) throw new Error(job.errors.length + ' report(s) failed. Review errors; ZIP was not finalized.');
    const folder = DriveApp.getFolderById(job.folderId);
    const files = folder.getFiles();
    const blobs = [];
    while (files.hasNext()) {
      const f = files.next();
      blobs.push(f.getBlob().setName(f.getName()));
    }
    if (!blobs.length) throw new Error('No PDFs generated.');
    const zipName = 'School_Academic_Reports_' + job.year + '.zip';
    const zip = Utilities.zip(blobs, zipName);
    const saved = exportRoot_().createFile(zip);
    job.status = 'complete';
    job.url = saved.getUrl();
    job.fileId = saved.getId();
    exportSave_(job);
    folder.setTrashed(true);
    return {status:'complete',done:job.index,total:job.tasks.length,url:job.url,errors:job.errors};
  } finally { lock.releaseLock(); }
}
