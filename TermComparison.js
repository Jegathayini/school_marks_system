
/**
 * SCHOOL ACADEMIC MANAGEMENT SYSTEM
 * File 6 of 7: TermComparison.gs
 *
 * MULTI-REGISTER TERM COMPARISON
 *
 * Grades 06-09 -> Junior Register
 * Grades 10-11 -> O/L Register
 * Grades 12-13 -> A/L Register
 *
 * Compares academic performance across:
 * - Term 1
 * - Term 2
 * - Term 3
 *
 * Supports:
 * - Automatically detected subjects
 * - Grade-specific registers
 * - Subject-wise term comparisons
 * - Class average comparisons
 * - Submission completion tracking
 * - Performance improvement or decline
 * - ABSENT and pending marks
 *
 * ABSENT RULES:
 * - ABSENT counts as entered.
 * - ABSENT contributes zero to averages.
 * - ABSENT is not considered pending.
 * - Missing marks remain pending.
 *
 * Dependencies:
 * - getAnalysis() from Analysis.gs
 * - validateContext_() from Code.gs
 *
 * This file is READ-ONLY.
 */

/* ========== TERM CONFIGURATION ========== */

const COMPARISON_TERMS = [
  'Term 1',
  'Term 2',
  'Term 3'
];

/* ========== HELPER FUNCTIONS ========== */

/**
 * Round numeric values to two decimal places.
 *
 * Preserve null for unavailable averages.
 */
function comparisonRound_(value) {

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

/* ========== MAIN TERM COMPARISON ========== */

/**
 * Compare all three terms for a grade.
 *
 * Examples:
 *
 * getTermComparison(2026, 'Grade 06')
 * getTermComparison(2026, 'Grade 11')
 * getTermComparison(2026, 'Grade 12')
 * getTermComparison(2026, 'Grade 13')
 *
 * getAnalysis() automatically selects the
 * correct student register.
 */
function getTermComparison(year, grade) {

  /* ========== VALIDATE REQUEST ========== */

  const context = validateContext_(
    year,
    grade,
    'Term 1'
  );

  /* ========== ANALYZE ALL THREE TERMS ========== */

  const analyses = COMPARISON_TERMS.map(
    term => getAnalysis(
      context.year,
      context.grade,
      term
    )
  );

  const studentCount =
    analyses[0].studentCount;

  /* ========== TERM-LEVEL STATISTICS ========== */

  const termResults = analyses.map(
    analysis => {

      const expected = analysis.students.reduce(
        (total, student) =>
          total + student.expected,
        0
      );

      // Includes numeric marks and ABSENT.
      const entered = analysis.students.reduce(
        (total, student) =>
          total + student.entered,
        0
      );

      const absent = analysis.students.reduce(
        (total, student) =>
          total + (student.absent || 0),
        0
      );

      const numeric = Math.max(
        0,
        entered - absent
      );

      const missing = Math.max(
        0,
        expected - entered
      );

      const complete =
        expected > 0 &&
        missing === 0;

      const completionPercentage =
        expected > 0
          ? comparisonRound_(
              entered / expected * 100
            )
          : 0;

      return {
        term: analysis.term,

        classAverage:
          analysis.classAverage,

        expected,
        entered,
        absent,
        numeric,
        missing,

        completeStudents:
          analysis.completeCount,

        incompleteStudents:
          analysis.pendingCount,

        completionPercentage,

        complete
      };
    }
  );

  /* ========== COLLECT SUBJECT NAMES ========== */

  const subjectNames = new Set();

  for (const analysis of analyses) {

    for (const subject of analysis.subjects) {

      subjectNames.add(
        subject.subject
      );
    }
  }

  /* ========== SUBJECT-LEVEL COMPARISON ========== */

  const subjectResults = [];

  for (const subjectName of subjectNames) {

    const termData = analyses.map(
      analysis => {

        const subject = analysis.subjects.find(
          item =>
            item.subject === subjectName
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

        const expected = Number(
          subject.enrolled || 0
        );

        const entered = Number(
          subject.entered || 0
        );

        const absent = Number(
          subject.absent || 0
        );

        const numeric = Math.max(
          0,
          entered - absent
        );

        const missing = Math.max(
          0,
          expected - entered
        );

        const complete =
          expected > 0 &&
          missing === 0;

        return {
          term: analysis.term,

          /*
           * Analysis.gs already calculates
           * the subject average.
           *
           * ABSENT contributes zero.
           *
           * This average can be provisional
           * until all marks are submitted.
           */
          average:
            subject.average,

          expected,
          entered,
          absent,
          numeric,
          missing,

          highest:
            subject.highest,

          lowest:
            subject.lowest,

          complete
        };
      }
    );

    subjectResults.push({
      subject: subjectName,
      terms: termData
    });
  }

  /* ========== CLASS AVERAGE COMPARISON ========== */

  const averageComparison = termResults.map(
    term => ({
      term: term.term,

      average:
        term.classAverage,

      complete:
        term.complete,

      completeStudents:
        term.completeStudents
    })
  );

  /* ========== PERFORMANCE CHANGES ========== */

  const changes = [];

  for (
    let i = 1;
    i < termResults.length;
    i++
  ) {

    const previous =
      termResults[i - 1];

    const current =
      termResults[i];

    /*
     * Compare final class averages only
     * when both terms are fully complete.
     *
     * ABSENT results are valid and
     * contribute zero to the averages.
     */

    if (
      previous.complete &&
      current.complete &&
      previous.classAverage !== null &&
      previous.classAverage !== undefined &&
      current.classAverage !== null &&
      current.classAverage !== undefined
    ) {

      const difference = comparisonRound_(
        current.classAverage -
        previous.classAverage
      );

      changes.push({
        from: previous.term,
        to: current.term,

        difference,

        direction:
          difference > 0
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
      'ABSENT counts as a submitted result and contributes ' +
      'zero to averages. ' +
      'Class averages include students with complete results. ' +
      'Subject averages include recorded numeric and ABSENT results ' +
      'and may be provisional while submissions are incomplete. ' +
      'Performance changes are calculated only when both compared ' +
      'terms have fully completed submissions. ' +
      'Historical enrollment snapshots are not yet implemented.'
  };
}

/* ========== INDIVIDUAL SUBJECT COMPARISON ========== */

/**
 * Compare a single subject across all terms.
 *
 * Examples:
 *
 * getSubjectTermComparison(
 *   2026,
 *   'Grade 06',
 *   'Maths'
 * )
 *
 * getSubjectTermComparison(
 *   2026,
 *   'Grade 12',
 *   'Economics'
 * )
 *
 * Subject names are automatically obtained
 * from the selected grade's register.
 */
function getSubjectTermComparison(
  year,
  grade,
  subject
) {

  const comparison = getTermComparison(
    year,
    grade
  );

  const subjectName = String(
    subject || ''
  ).trim();

  if (!subjectName) {

    throw new Error(
      'Please select a subject.'
    );
  }

  const result = comparison.subjects.find(
    item =>
      item.subject === subjectName
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
      'ABSENT counts as entered and contributes zero ' +
      'to the subject average. ' +
      'Missing marks remain pending. ' +
      'A term is complete when every enrolled student ' +
      'has a recorded result.'
  };
}

/* ========== TEST FUNCTIONS ========== */

/**
 * Generic read-only term comparison test.
 *
 * Can be used with any configured grade.
 *
 * No spreadsheet data is modified.
 */
function testTermComparisonForGrade_(
  year,
  grade
) {

  const result = getTermComparison(
    year,
    grade
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

    Logger.log(
      JSON.stringify({
        term: term.term,

        classAverage:
          term.classAverage,

        entered:
          term.entered,

        expected:
          term.expected,

        numeric:
          term.numeric,

        absent:
          term.absent,

        missing:
          term.missing,

        completeStudents:
          term.completeStudents,

        completionPercentage:
          term.completionPercentage
      })
    );
  }

  Logger.log(
    'Subjects: ' +
    result.subjects.length
  );

  Logger.log(
    'Changes: ' +
    JSON.stringify(
      result.changes
    )
  );

  Logger.log(
    'Term comparison test completed for ' +
    result.grade
  );
}

/**
 * Original Grade 06 test.
 */
function testTermComparison() {

  testTermComparisonForGrade_(
    2026,
    'Grade 06'
  );
}

/**
 * Grade 11 test.
 */
function testTermComparisonGrade11() {

  testTermComparisonForGrade_(
    2026,
    'Grade 11'
  );
}

/**
 * Grade 12 test.
 */
function testTermComparisonGrade12() {

  testTermComparisonForGrade_(
    2026,
    'Grade 12'
  );
}

/**
 * Grade 13 test.
 */
function testTermComparisonGrade13() {

  testTermComparisonForGrade_(
    2026,
    'Grade 13'
  );
}
