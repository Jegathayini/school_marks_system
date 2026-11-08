
/**
 * Annual Prize Giving rankings.
 * All classes in the selected grade are combined.
 * All three terms are required.
 * AB counts as zero; Pending is incomplete.
 * Ties use competition ranking: 1, 1, 3.
 */
function getAnnualTopPerformersInternal_(year, grade) {
  const termNames = ['Term 1', 'Term 2', 'Term 3'];

  const analyses = termNames.map(term =>
    getAnalysisInternal_(year, grade, term)
  );

  const base = analyses[0];

  const subjectNames = [
    ...new Set(
      analyses.flatMap(a =>
        a.subjects.map(s => s.subject)
      )
    )
  ];

  const byTerm = analyses.map(a =>
    new Map(
      a.students.map(s => [String(s.id), s])
    )
  );

  const warnings = analyses.flatMap(a => [
    ...(a.warnings.duplicates || []),
    ...(a.warnings.invalidOrUnmatched || [])
  ]);

  const subjects = subjectNames.map(subject => {
    const enrolled = base.students.filter(student =>
      analyses.some(a =>
        a.students.some(s =>
          String(s.id) === String(student.id) &&
          Object.prototype.hasOwnProperty.call(
            s.marks,
            subject
          )
        )
      )
    );

    const candidates = [];
    let incomplete = 0;

    for (const student of enrolled) {
      const marks = byTerm.map(map => {
        const s = map.get(String(student.id));

        return s &&
          Object.prototype.hasOwnProperty.call(
            s.marks,
            subject
          )
          ? s.marks[subject]
          : null;
      });

      const complete = marks.every(m =>
        (typeof m === 'number' && Number.isFinite(m)) ||
        m === 'AB'
      );

      if (!complete) {
        incomplete++;
        continue;
      }

      const scores = marks.map(m =>
        m === 'AB' ? 0 : m
      );

      candidates.push({
        id: student.id,
        name: student.name,
        terms: marks,
        annualAverage:
          scores.reduce((sum, n) => sum + n, 0) / 3
      });
    }

    candidates.sort((a, b) =>
      b.annualAverage - a.annualAverage ||
      String(a.name).localeCompare(String(b.name)) ||
      String(a.id).localeCompare(String(b.id))
    );

    let previous = null;

    const ranked = candidates.map((student, index) => {
      const rank =
        previous !== null &&
        Math.abs(student.annualAverage - previous) < 1e-9
          ? candidates[index - 1].rank
          : index + 1;

      previous = student.annualAverage;
      student.rank = rank;

      return student;
    });

    return {
      subject,
      enrolled: enrolled.length,
      complete: candidates.length,
      pending: incomplete,

      // Include students tied within ranks 1–3.
      top: incomplete === 0
        ? ranked.filter(s => s.rank <= 3)
        : []
    };
  });

  return {
    year: base.year,
    grade: base.grade,
    studentCount: base.studentCount,

    ready:
      subjects.length > 0 &&
      subjects.every(s => s.pending === 0) &&
      warnings.length === 0,

    subjects,
    warnings,

    note:
      'Annual average = (Term 1 + Term 2 + Term 3) / 3. ' +
      'AB counts as zero. All subject marks must be complete. ' +
      'Equal averages receive the same competition rank. ' +
      'Students are ranked across the whole grade. ' +
      'Verify historical transfers before publishing.'
  };
}
