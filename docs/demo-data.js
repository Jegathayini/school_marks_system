
/*
 * School Academic Management System V2
 * GitHub Pages — Fictional Demo Data
 *
 * All student names, IDs and marks are fictional.
 * No connection to Google Sheets or real school records.
 */

(function () {
  "use strict";

  const GRADES = Array.from(
    { length: 13 },
    (_, index) => index + 1
  );

  const TERMS = [
    "Term 1",
    "Term 2",
    "Term 3"
  ];

  const SUBJECTS = [
    "Maths",
    "Science",
    "Tamil",
    "English"
  ];

  const FIRST_NAMES = [
    "Aarav",
    "Anika",
    "Kavin",
    "Nila",
    "Tharun",
    "Meera",
    "Arjun",
    "Ishani",
    "Yuvan",
    "Kavya",
    "Rithik",
    "Diya"
  ];

  const LAST_NAMES = [
    "Kumar",
    "Rajan",
    "Selvan",
    "Nathan",
    "Devan",
    "Mohan",
    "Ravi",
    "Arul",
    "Mani",
    "Siva",
    "Vimal",
    "Kannan"
  ];

  const STUDENTS_PER_GRADE = 12;

  // Deterministic marks: identical initial data on every device.
  function generateMark(
    grade,
    studentIndex,
    termIndex,
    subjectIndex
  ) {
    const seed =
      grade * 17 +
      studentIndex * 11 +
      termIndex * 7 +
      subjectIndex * 13;

    return 35 + (seed % 66);
  }

  function generateSBAMark(
    grade,
    studentIndex,
    termIndex,
    subjectIndex
  ) {
    const seed =
      grade * 13 +
      studentIndex * 9 +
      termIndex * 11 +
      subjectIndex * 7;

    return 45 + (seed % 56);
  }

  function generateStudent(grade, studentIndex) {
    const firstName =
      FIRST_NAMES[(studentIndex + grade - 1) % FIRST_NAMES.length];

    const lastName =
      LAST_NAMES[(studentIndex * 3 + grade - 1) % LAST_NAMES.length];

    const id =
      "DEMO-" +
      String(grade).padStart(2, "0") +
      "-" +
      String(studentIndex + 1).padStart(3, "0");

    const marks = {};
    const sba = {};

    TERMS.forEach((term, termIndex) => {
      marks[term] = {};
      sba[term] = {};

      SUBJECTS.forEach((subject, subjectIndex) => {
        // A few absent students to demonstrate ABSENT = 0.
        const absent =
          (grade + studentIndex + termIndex + subjectIndex) % 37 === 0;

        // A few pending marks to demonstrate incomplete reports.
        const pending =
          (grade * 3 + studentIndex + termIndex + subjectIndex) % 41 === 0;

        if (!pending) {
          marks[term][subject] = absent
            ? "ABSENT"
            : generateMark(
                grade,
                studentIndex,
                termIndex,
                subjectIndex
              );
        }

        // SBA records are maintained independently of exam marks.
        const sbaPending =
          (grade + studentIndex * 2 + termIndex + subjectIndex) % 43 === 0;

        if (!sbaPending) {
          sba[term][subject] = generateSBAMark(
            grade,
            studentIndex,
            termIndex,
            subjectIndex
          );
        }
      });
    });

    return {
      id,
      name: firstName + " " + lastName,
      grade,
      marks,
      sba
    };
  }

  const students = [];

  GRADES.forEach(grade => {
    for (let index = 0; index < STUDENTS_PER_GRADE; index++) {
      students.push(generateStudent(grade, index));
    }
  });

  window.DEMO_INITIAL_DATA = {
    version: 2,
    academicYear: 2026,
    schoolName: "Demo School (Fictional)",
    grades: GRADES.map(
      grade => "Grade " + String(grade).padStart(2, "0")
    ),
    terms: TERMS,
    subjects: SUBJECTS,
    students
  };

  console.info(
    "School Academic V2 fictional demo initialized:",
    students.length,
    "students across",
    GRADES.length,
    "grades."
  );
})();
