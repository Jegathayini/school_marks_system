
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 6 of 7: TermComparison.gs
 *
 * Compares academic performance across
 * Term 1, Term 2 and Term 3.
 *
 * Supports ABSENT:
 * - Counts as entered/submitted
 * - Excluded from numeric averages
 * - Not treated as a missing mark
 *
 * Dependencies:
 * - getAnalysis() from Analysis.gs
 * - validateContext_() from Code.gs
 *
 * This file is read-only.
 */

/* ========== TERM CONFIGURATION ========== */

const COMPARISON_TERMS = [
  'Term 1',
  'Term 2',
  'Term 3'
];

/**
 * Round numeric values to two decimal places.
 * Preserve null for unavailable averages.
 */
function comparisonRound_(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

/* ========== MAIN TERM COMPARISON ========== */

function getTermComparison(year, grade) {

  const context = validateContext_(
    year,
    grade,
    'Term 1'
  );

  /* ========== ANALYZE ALL THREE TERMS ========== */

  const analyses = COMPARISON_TERMS.map(term => {
    return getAnalysis(
      context.year,
      context.grade,
      term
    );
  });

  const studentCount = analyses[0].studentCount;

  /* ========== TERM-LEVEL STATISTICS ========== */

  const termResults = analyses.map(analysis => {

    const expected = analysis.students.reduce(
      (total, student) => total + student.expected,
      0
    );

    // Includes numeric marks and ABSENT.
    const entered = analysis.students.reduce(
      (total, student) => total + student.entered,
      0
    );

    const absent = analysis.students.reduce(
      (total, student) => total + (student.absent || 0),
      0
    );

    const numeric = entered - absent;
    const missing = expected - entered;

    return {
      term: analysis.term,

      classAverage: analysis.classAverage,

      expected,
      entered,
      absent,
      numeric,
      missing,

      completeStudents: analysis.completeCount,
      incompleteStudents: analysis.pendingCount,

      completionPercentage: expected > 0
        ? comparisonRound_(entered / expected * 100)
        : 0,

      // A term is complete when every required
      // result is recorded, including ABSENT.
      complete: expected > 0 && missing === 0
    };
  });

  /* ========== COLLECT SUBJECT NAMES ========== */

  const subjectNames = new Set();

  for (const analysis of analyses) {
    for (const subject of analysis.subjects) {
      subjectNames.add(subject.subject);
    }
  }

  /* ========== SUBJECT-LEVEL COMPARISON ========== */

  const subjectResults = [];

  for (const subjectName of subjectNames) {

    const termData = analyses.map(analysis => {

      const subject = analysis.subjects.find(
        item => item.subject === subjectName
      );

      if (!subject) {
        return {
          term: analysis.term,
          average: null,
          expected: 0,
          entered: 0,
          absent: 0,
          numeric: 0,
          missing: 0,
          highest: null,
          lowest: null,
          complete: false
        };
      }

      const expected = subject.enrolled;
      const entered = subject.entered;
      const absent = subject.absent || 0;

      const numeric = entered - absent;
      const missing = expected - entered;

      return {
        term: analysis.term,

        // Already excludes ABSENT in Analysis.gs.
        average: subject.average,

        expected,
        entered,
        absent,
        numeric,
        missing,

        highest: subject.highest,
        lowest: subject.lowest,

        complete: expected > 0 && missing === 0
      };
    });

    subjectResults.push({
      subject: subjectName,
      terms: termData
    });
  }

  /* ========== CLASS AVERAGE COMPARISON ========== */

  const averageComparison = termResults.map(term => ({
    term: term.term,
    average: term.classAverage,
    complete: term.complete,
    completeStudents: term.completeStudents
  }));

  /* ========== PERFORMANCE CHANGES ========== */

  const changes = [];

  for (let i = 1; i < termResults.length; i++) {

    const previous = termResults[i - 1];
    const current = termResults[i];

    // Compare final class averages only when
    // both terms have complete submissions
    // and numeric averages are available.
    if (
      previous.complete &&
      current.complete &&
      previous.classAverage !== null &&
      current.classAverage !== null
    ) {
      const difference = comparisonRound_(
        current.classAverage - previous.classAverage
      );

      changes.push({
        from: previous.term,
        to: current.term,
        difference,

        direction: difference > 0
          ? 'improved'
          : difference < 0
            ? 'declined'
            : 'unchanged'
      });

    } else {

      changes.push({
        from: previous.term,
        to: current.term,
        difference: null,
        direction: 'incomplete'
      });
    }
  }

  /* ========== RETURN COMPARISON DATA ========== */

  return {
    year: context.year,
    grade: context.grade,
    studentCount,

    terms: termResults,
    subjects: subjectResults,

    averageComparison,
    changes,

    note:
      'Missing marks are not treated as zero. ' +
      'ABSENT counts as a submitted result but is excluded from numeric averages. ' +
      'Class averages include only students with complete results and available numeric averages. ' +
      'Subject averages may be provisional while submissions are incomplete. ' +
      'Performance changes are calculated only when both compared terms are fully complete. ' +
      'Historical enrollment snapshots are not yet implemented.'
  };
}

/* ========== INDIVIDUAL SUBJECT COMPARISON ========== */

function getSubjectTermComparison(year, grade, subject) {

  const comparison = getTermComparison(year, grade);

  const subjectName = String(subject || '').trim();

  const result = comparison.subjects.find(
    item => item.subject === subjectName
  );

  if (!result) {
    throw new Error(
      'No enrolled students found for subject: ' +
      subjectName
    );
  }

  return {
    year: comparison.year,
    grade: comparison.grade,
    subject: subjectName,

    terms: result.terms,

    note:
      'Averages use numeric marks only. ' +
      'ABSENT counts as entered but does not affect averages. ' +
      'A term is complete when every enrolled student has a recorded result.'
  };
}

/* ========== TERM COMPARISON TEST ========== */

function testTermComparison() {

  const result = getTermComparison(
    2026,
    'Grade 06'
  );

  Logger.log(
    '===== TERM COMPARISON TEST ====='
  );

  Logger.log(
    'Year: ' + result.year
  );

  Logger.log(
    'Grade: ' + result.grade
  );

  Logger.log(
    'Students: ' + result.studentCount
  );

  for (const term of result.terms) {

    Logger.log(JSON.stringify({
      term: term.term,
      classAverage: term.classAverage,

      entered: term.entered,
      expected: term.expected,

      numeric: term.numeric,
      absent: term.absent,
      missing: term.missing,

      completeStudents: term.completeStudents,
      completionPercentage: term.completionPercentage
    }));
  }

  Logger.log(
    'Subjects: ' + result.subjects.length
  );

  Logger.log(
    'Changes: ' + JSON.stringify(result.changes)
  );

  Logger.log(
    'Term comparison test completed successfully.'
  );
}
