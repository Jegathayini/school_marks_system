# 🎓 School Marks System

**A smart, web-based school marks management and academic performance analysis system — powered by Google Apps Script and Google Sheets.** 📚📈

[![Platform](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4)](https://developers.google.com/apps-script)

[![Database](https://img.shields.io/badge/Data-Google%20Sheets-34A853)](https://www.google.com/sheets/about/)

[![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JavaScript-orange)](#technology-stack)

[![Testing](https://img.shields.io/badge/Testing-Several%20Cases%20Passed-brightgreen)](#testing)

> **Project status:** I've tested the School Marks System through several functional test cases. If you'd like to evaluate it, I recommend first trying it with the included [fictional sample workbook](fictional_marks_sheet_sample.xlsx), checking the setup and results, and letting me know about any errors through [GitHub Issues](https://github.com/Jegathayini/school_marks_system/issues). 💙

<a id="live-demo"></a>

## 🌐 Live Demo

**Try the interactive School Marks System:** [**Launch Live Demo ↗**](https://jegathayini.github.io/school_marks_system/)

The public demo lets visitors explore the interface using **fictional student records**. It runs on **GitHub Pages**, separately from the Google Apps Script application, and does **not** connect to a school's Google Sheets workbook. Demo changes are stored locally in the visitor's browser and are not shared with other visitors.

### 🔑 Demo login credentials

| Role | Username | Password |
|---|---|---|
| Administrator | `demo_admin` | `Admin@Demo2026` |
| Teacher | `demo_teacher` | `Teacher@Demo2026` |

> **Demo only:** These are public example credentials, not real school accounts. Do not enter real student details, marks, or passwords in the demo. Some production features, including account administration, are intentionally unavailable in the public version.

The demo source files are in [`docs/`](docs/). The full Google Apps Script application and its setup instructions are documented below.

---

### 💙 Welcome to School Marks System!

I built **School Marks System** to make marks entry, academic progress tracking, and report preparation easier for teachers and school administrators. It brings these everyday tasks together in one browser-based application. 🏫

**👩‍🏫 Teachers:** Enter and validate marks.  

**👨‍💼 Administrators:** Manage teacher access, review academic performance, and generate reports.  

**👩‍💻 Developers:** Explore the source, configure a fictional test workbook, and suggest improvements.

> 💡 **New here?** Start with [Installation and configuration](#installation-and-configuration), then check the [Google Sheets data model](#google-sheets-data-model) and [Security and privacy](#security-and-privacy).

---

<a id="table-of-contents"></a>

## 🧭 Table of contents

1. [Live demo](#live-demo)

2. [Overview](#overview)

3. [Main features](#main-features)

4. [User roles](#user-roles)

5. [Technology stack](#technology-stack)

6. [How the system works](#how-the-system-works)

7. [Repository structure](#repository-structure)

8. [Requirements](#requirements)

9. [Installation and configuration](#installation-and-configuration)

10. [Google Sheets data model](#google-sheets-data-model)

11. [Account administration](#account-administration)

12. [Typical workflows](#typical-workflows)

13. [Security and privacy](#security-and-privacy)

14. [Testing](#testing)

15. [Troubleshooting](#troubleshooting)

16. [Customization](#customization)

17. [Limitations and roadmap](#limitations-and-roadmap)

18. [Contributing](#contributing)

19. [Feedback and bug reports](#feedback-and-bug-reports)
20. [Author](#author)

<a id="overview"></a>

## 🌟 Overview

**School Marks System** aims to reduce manual marks-processing work for teachers and provide school administrators with a centralized view of student academic performance.

The application uses a Google Sheets workbook as its data store and Google Apps Script for server-side processing. Its web interface is written in HTML, CSS, and JavaScript.

The project is designed around a **single-school deployment** and can be adapted to a school's grade structure, subjects, academic terms, and reporting practices. It is not a multi-school SaaS platform.

<a id="project-goals"></a>

### 🎯 Project goals

- Let authorized teachers enter marks through a structured interface.

- Validate submissions before they are saved.

- Store submitted marks in a shared, structured data source.

- Help administrators examine academic performance and compare terms.

- Generate student-level reports and support PDF export.

- Let administrators manage teacher access without giving every teacher direct editing access to the underlying spreadsheet.

<a id="main-features"></a>

## ✨ Main features

<a id="1-teacher-marks-entry"></a>

### 📝 1. Teacher marks entry

- Sign in with an assigned teacher account.

- Select the relevant grade, class, subject, academic year, and term as supported by the interface.

- Retrieve eligible student records and submit marks.

- Validate mark values and student/subject selections server-side.

- Support an **ABSENT** value where permitted by the submission logic.

- Detect and reject duplicate marks entries according to the server's validation rules.

- Track the authenticated submitter on saved entries.

<a id="2-academic-analysis"></a>

### 📈 2. Academic analysis

- Summarize student performance.

- Analyze subject-level and class-level performance.

- Compare academic results between terms.

- Explore improvement and performance changes over time.

- Provide dashboard and submission-status views.

<a id="3-student-reports"></a>

### 📄 3. Student reports

- Retrieve individual student report information.

- Display academic results and term-based comparisons.

- Support PDF/report export through the export module.

<a id="4-administrator-functions"></a>

### 🧑‍💼 4. Administrator functions

- Access analysis and reporting features restricted to administrators.

- Create teacher accounts.

- Reset teacher passwords.

- Activate or deactivate teacher accounts.

- Review account-management audit records **if the deployed `AccountManagement` version includes and configures audit logging**.

<a id="5-authentication-and-access-control"></a>

### 🔒 5. Authentication and access control

- Distinct `ADMIN` and `TEACHER` roles.

- Session-based authentication with a configurable expiration policy.

- Temporary-password change requirement for newly created teachers.

- Password changes and resets invalidate earlier sessions by rotating stored password credentials.

- Basic failed-login throttling.

**Security qualification:** These controls are implemented in custom Apps Script code and are **not a substitute for a production-grade identity provider or security review**.

<a id="user-roles"></a>

## 👥 User roles

| Capability | Teacher | Administrator |
|---|:---:|:---:|
| Sign in | Yes | Yes |
| Change own password | Yes | Yes |
| Submit permitted marks | Yes | Yes |
| View teacher submission-related information | As authorized | Yes |
| School-wide analysis | No | Yes |
| Student reports and export | No | Yes |
| Create/reset/deactivate teacher accounts | No | Yes |

Actual access is enforced by server-side checks in the Apps Script functions, not only by hiding interface buttons.

<a id="technology-stack"></a>

## 🛠️ Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Interactive browser interface |
| Backend | Google Apps Script | Validation, authorization, academic processing, exports |
| Data storage | Google Sheets | Registers, marks, and account metadata |
| Hosting | Apps Script Web App | Serves the application |
| Configuration | Apps Script project settings and Script Properties | Runtime settings and private authentication state |
| Source control | Git and GitHub | Version history and code distribution |

No conventional Node.js server or relational database is required by the current architecture.

<a id="how-the-system-works"></a>

## ⚙️ How the system works

```text

                 Teacher / Administrator

                           |

                           v

                 Browser web interface

                      (index.html)

                           |

                    google.script.run

                           |

                           v

                   AccessAPI functions

                           |

                 Authentication + roles

                           |

              +------------+-------------+

              |            |             |

              v            v             v

         Marks entry   Analysis       Reports

         /validation   /dashboard     /export

              |            |             |

              +------------+-------------+

                           |

                           v

                  Google Sheets workbook

                 (registers + marks + staff)

```

1. A user opens the Apps Script web app.

2. The interface calls Apps Script functions to authenticate the user.

3. Protected server endpoints check the session and required role.

4. The requested module reads or writes data in the configured workbook.

5. The interface displays results or confirmation messages.

> The browser must never be treated as the source of truth for permissions, marks validation, or the identity of the person submitting marks.

<a id="repository-structure"></a>

## 📁 Repository structure

```text

school_marks_system/

├── AccessAPI.js           # Authenticated API wrappers

├── AccountManagement.js   # Teacher account administration

├── Analysis.js            # Academic analysis

├── Auth.js                # Custom account authentication

├── Code.js                # Web app entry point and core marks logic

├── Dashboard.js           # Dashboard data

├── ReportExport.js        # Report/PDF export processing

├── StudentReport.js       # Individual student reports

├── Submission.js          # Submission and validation helpers

├── TermComparison.js      # Term comparison logic

├── index.html             # Browser UI (Apps Script HTML template)

├── appscript.json         # Apps Script manifest (rename on import)

├── .gitignore

└── README.md

```

**Important filename mapping:** The repository uses `.js` files for the server-side scripts. In the Google Apps Script editor, create corresponding **`.gs` script files**. Also use the filename **`Index.html`** in Apps Script if the server code calls `HtmlService.createTemplateFromFile('Index')`; Apps Script template names are case-sensitive. Rename `appscript.json` to **`appsscript.json`** when importing the manifest.

<a id="requirements"></a>

## 📋 Requirements

- A Google account with permission to create Google Sheets and Apps Script projects.

- A new Google Sheets workbook for **fictional/test data**.

- An Apps Script project bound to that workbook, or a standalone project explicitly configured to open the correct spreadsheet.

- Permission to authorize the Google services used by the project.

- A modern web browser.

- Basic familiarity with Google Sheets and Apps Script is helpful.

<a id="installation-and-configuration"></a>

## 🚀 Installation and configuration

<a id="step-1-download-the-source"></a>

### 🔹 Step 1 — Download the source

```bash

git clone https://github.com/Jegathayini/school_marks_system.git

cd school_marks_system

```

Alternatively, use **Code → Download ZIP** on GitHub.

<a id="step-2-create-a-test-workbook"></a>

### 🔹 Step 2 — Prepare the sample workbook

1. Open Google Sheets and create a **new, empty workbook**.

2. Name it something like `School_Marks_Test`.

3. Keep the workbook **private**; do not make it publicly editable.

4. Use only fictional student and teacher records during setup.

5. Open **Extensions → Apps Script** to create a spreadsheet-bound project.

The application relies on specific sheet names, columns, and data conventions. **Do not assume that arbitrary spreadsheet headers will work.** Inspect the constants, grade-routing helpers, and validation functions in `Code.js` and related modules before populating data.

<a id="step-3-copy-the-server-files-into-apps-script"></a>

### 🔹 Step 3 — Copy the server files into Apps Script

Create Apps Script script files and paste the corresponding source:

| GitHub file | Apps Script file |
|---|---|
| `Code.js` | `Code.gs` |
| `Auth.js` | `Auth.gs` |
| `AccessAPI.js` | `AccessAPI.gs` |
| `AccountManagement.js` | `AccountManagement.gs` |
| `Analysis.js` | `Analysis.gs` |
| `Dashboard.js` | `Dashboard.gs` |
| `Submission.js` | `Submission.gs` |
| `TermComparison.js` | `TermComparison.gs` |
| `StudentReport.js` | `StudentReport.gs` |
| `ReportExport.js` | `ReportExport.gs` |

**Do not** put these files into separate Apps Script projects: the functions are intended to call one another within a single project.

<a id="step-4-add-the-html-interface"></a>

### 🔹 Step 4 — Add the HTML interface

1. Create an HTML file named `Index` in the Apps Script editor.

2. Copy the contents of GitHub's `index.html` into it.

3. Confirm the name used by the `doGet()` function matches `Index` exactly.

<a id="step-5-review-the-manifest"></a>

### 🔹 Step 5 — Review the manifest

The repository's `appscript.json` is the project manifest source. In Apps Script, the actual manifest filename is `appsscript.json`.

1. Enable the manifest in the Apps Script editor's project settings if it is not visible.

2. Review the repository manifest before copying it.

3. Keep only the OAuth scopes and services genuinely required by the application.

4. Save the project and resolve any manifest validation errors before deployment.

<a id="step-6-configure-the-workbook-schema"></a>

### 🔹 Step 6 — Configure the workbook schema

The application uses grade-register sheets, a central marks sheet, and a staff access sheet. Their **exact names and columns must match the code**.

A known part of the current design is:

- Three grade-register groupings: Grades **06–09**, **10–11**, and **12–13**.

- A central sheet named `Marks_Entries`.

- A sheet named `Staff_Access` for custom-authentication account records.

**Recommended:** Download [`fictional_marks_sheet_sample.xlsx`](fictional_marks_sheet_sample.xlsx) and follow the detailed [Register data-entry guide](#register-data-entry-guide) below. The first three columns and two-row subject-header structure are handled in `Code.js`. Adapt subject names and options to your school while preserving that structure.

<a id="step-7-initialize-test-authentication"></a>

### 🔹 Step 7 — Initialize authentication

The custom authentication module requires a private `AUTH_PEPPER` Script Property. Its initialization helper creates this property and prepares the staff sheet.

1. In the Apps Script editor, find `authInitialize_()` in `Auth.gs`.

2. Run it manually **from the editor** while using a private test workbook.

3. Complete the authorization prompts.

4. Confirm that the `Staff_Access` sheet has been created or validated.

5. **Never publish or copy the generated `AUTH_PEPPER` value.**

The expected `Staff_Access` headers are:

```text

Email | Name | Role | Active | GoogleSubject | Username | PasswordSalt | PasswordHash

```

The `GoogleSubject` column is retained for compatibility; do not assume this username/password flow automatically authenticates a user's Google identity.

<a id="step-8-create-a-test-administrator"></a>

### 🔹 Step 8 — Create an administrator account

The project does **not** ship with a universal administrator username or password.

Account creation is handled by the internal function:

```javascript

authCreateAccount_(username, password, name, role, email)

```

For a local, fictional-data test, an authorized project editor can call this helper from a **temporary editor-only setup function**, using a unique test password. Do not commit the setup function with a literal password, and do not share passwords in screenshots, logs, or Git history. Delete the temporary setup code afterward.

For example, the arguments represent:

| Argument | Meaning |
|---|---|
| `username` | Unique login name |
| `password` | Unique initial password, at least 14 characters |
| `name` | Display name |
| `role` | `ADMIN` or `TEACHER` |
| `email` | Optional account email metadata |

**Caution:** Editor-level access to the Apps Script project or underlying spreadsheet is privileged. Only trusted administrators should have it.

<a id="step-9-verify-the-application-with-fictional-data"></a>

### 🔹 Step 9 — Verify the application with fictional data

Before using the system with school records, use the fictional sample workbook to verify all required sheets and headers, then test:

1. Admin login and logout.

2. Teacher account creation and first-login password change.

3. Teacher login and authorized marks submission.

4. Duplicate-submission and invalid-mark rejection.

5. Grade, subject, and student filtering.

6. Dashboard, analysis, and term comparisons.

7. Student reports and PDF export.

8. Teacher deactivation and attempted access afterward.

9. Password reset and invalidation of an existing session.

10. Authorization failures for restricted admin endpoints.

If a test fails, inspect the Apps Script **Executions** page and verify the spreadsheet schema before changing the code.

<a id="step-10-deploy-a-test-web-app"></a>

### 🔹 Step 10 — Deploy the web app

1. Select **Deploy → New deployment** in Apps Script.

2. Choose **Web app**.

3. Review **Execute as** and **Who has access** carefully.

4. Deploy only to an appropriate **test audience**.

5. Authorize the requested scopes.

6. Open the resulting `/exec` URL and test the login workflow.

**Deployment security:** If a web app executes as its owner, server-side code may access the owner's spreadsheet even when the visitor cannot access the sheet directly. Therefore, a public web-app URL is **not** an authorization boundary. Every callable server endpoint must enforce appropriate authentication and authorization. Do not select public access for real student data merely because a login screen is present.

For any school deployment, first obtain approval for the identity model, data protection, access scope, account ownership, and incident/backup procedures.

<a id="google-sheets-data-model"></a>

## 📊 Google Sheets data model

<a id="a-grade-registers"></a>

### 📚 A. Grade registers

The system separates grade-register data into the following grade ranges:

| Group | Grades |
|---|---|
| Junior grades | 06–09 |
| Secondary grades | 10–11 |
| Senior grades | 12–13 |

These registers are the source of student/subject information used by marks entry and validation. The exact tab names and column positions are defined by the application's code and must be checked before importing data.

<a id="register-data-entry-guide"></a>

### 🏫 Register data-entry guide — which column contains what?

**Download the sample:** [`📥 fictional_marks_sheet_sample.xlsx`](fictional_marks_sheet_sample.xlsx) (included as a separate file in the repository). The workbook uses **fictional students only**. Upload it to Google Drive, open with Google Sheets, and copy its three register tabs into the **same spreadsheet** that contains the Apps Script project. Keep the sheet tab names exactly as shown below, unless you also update `REGISTER_CONFIG` in `Code.js`.

| Register tab (exact name) | Grades included |
|---|---|
| `Grade 06 to 09` | Grade 06, Grade 07, Grade 08, Grade 09 |
| `Grade 10 to 11` | Grade 10, Grade 11 |
| `Grade 12 to 13` | Grade 12, Grade 13 |

**Every register uses the same layout:**

| Column | Row 1 / Row 2 | Enter from row 3 onward | Important rule |
|---|---|---|---|
| **A** | `Student ID` | Unique ID, e.g. `S06001` | Do not repeat a student ID within the same register. Keep IDs stable across terms. |
| **B** | `Student Name` | Full student name | Must not be blank for an enrolled student. |
| **C** | `Grade` | `Grade 06`, `Grade 07`, etc. | Use the grade naming format expected by the application. |
| **D onward** | Subject headings in row 1 and/or subject-option headings in row 2 | `Yes` if enrolled in that subject; `No` if not | The app uses these selections to decide which students appear for a subject. |

#### 📋 Example — the first five columns

| Sheet row | A: Student ID | B: Student Name | C: Grade | D: Mathematics | E: Science |
|---|---|---|---|---|---|
| **1** | Student ID | Student Name | Grade | Mathematics | Science |
| **2** | **(blank)** | **(blank)** | **(blank)** | **(blank)** | **(blank)** |
| **3** | S06001 | Sample Student A | Grade 06 | Yes | Yes |
| **4** | S06002 | Sample Student B | Grade 06 | Yes | No |

**Why two header rows?** The code reads **row 1** as the main heading and **row 2** as the optional subject/option heading. For subject columns, the parser may use the row-2 heading when present and otherwise the row-1 heading. The first three columns remain student identifiers even when row 2 contains subject-option labels. In the provided register examples, row 2 may contain options such as `Hinduism`, `RC`, `NonRC` in columns A–C, and other option names under later subject columns. Keep the sample column positions unchanged. Do **not** duplicate the same effective subject heading across multiple columns in one register. The words `Religion` and `Aesthetic` alone are group labels, not selectable subject names in this parser.

**Subject selection:** Enter `Yes` for each subject the student studies and `No` otherwise. For option groups (such as religion or aesthetics), mark the relevant option `Yes` and the others `No`. Change the sample subjects to match the actual subjects recognized by your complete project and school's curriculum.

**Data-entry rules:**

1. **Keep row 1 and row 2 for headers.** Student records start on **row 3**.

2. Use one student per row. Fill **A, B, and C** for each student; the code can carry forward a grade from a merged/grouped cell, but filling every row is simpler and safer.

3. Use the exact grade labels such as `Grade 06`, not just `6`, until you have confirmed normalization in your deployed version.

4. Keep student IDs as text so leading zeros are preserved; avoid duplicates and empty IDs.

5. Do not type examination marks into the register. **Marks are entered through the web application** and stored in `Marks_Entries`.

6. After editing the sample in Excel, **convert/open it as Google Sheets**; Apps Script's spreadsheet-bound functions expect Google Sheets tabs, not an unopened `.xlsx` file.

7. Use fictional data first, check the subject dropdowns and student filtering, and then review privacy and deployment permissions before importing actual records.

**Note:** The sample demonstrates the verified register parser structure. It is a starting template, not a claim that every school offers the same subjects. Other modules may expect additional subject conventions; review your deployed code when adapting the subject list.

<a id="b-marks_entries"></a>

### 🔹 B. `Marks_Entries`

This sheet stores submitted academic marks centrally. The server-side marks-saving logic validates grade, academic year, term, student eligibility, subject eligibility, and accepted mark values before writing records.

The `Code.js` version used for this guide declares the following initial headings: `AcademicYear`, `Grade`, `Term`, `StudentID`, `StudentName`, `SubjectGroup`, `SubjectOption`, `Marks`, `UpdatedAt`. Let the app create this sheet where possible, and check whether your latest deployed code adds any extra audit/submission columns before changing headers manually.

<a id="c-staff_access"></a>

### 🔹 C. `Staff_Access`

| Column | Header | Description |
|---|---|---|
| A | `Email` | Account email metadata |
| B | `Name` | Display name |
| C | `Role` | `ADMIN` or `TEACHER` |
| D | `Active` | Account activation state |
| E | `GoogleSubject` | Reserved/compatibility field |
| F | `Username` | Login username |
| G | `PasswordSalt` | Random per-account salt |
| H | `PasswordHash` | Derived password hash |

Passwords should **never** be stored as plaintext in this sheet. Password hashes and salts are also sensitive account records and must not be committed to GitHub or made public.

<a id="d-account-audit-records"></a>

### 🔹 D. Account audit records

Some account-management implementations include an `Account_Audit` sheet to record administrative actions. Check the exact deployed `AccountManagement.gs` implementation for the sheet name, columns, and events logged before relying on this feature.

<a id="account-administration"></a>

## 🔐 Account administration

<a id="creating-teachers"></a>

### ➕ Creating teachers

An administrator can create a teacher account through the account-management interface. New teachers are required to replace their initial password before using protected features.

<a id="resetting-passwords"></a>

### 🔑 Resetting passwords

An administrator can issue a password reset. Credential rotation invalidates existing sessions associated with the previous password version. Users must sign in again with their new credentials.

<a id="deactivating-transferred-or-departing-staff"></a>

### 🚪 Deactivating transferred or departing staff

Deactivation prevents the account from passing normal server-side account checks while it is inactive. Administrators should also review shared accounts, spreadsheet permissions, Apps Script editor access, and other external access separately.

**Known edge case:** In the shared test-authentication design, reactivating an account before its previous session expires may allow an earlier session to become valid again if no credential rotation occurred. For stronger revocation, implement an account/session generation value that changes on both deactivation and reactivation.

<a id="typical-workflows"></a>

## 🧑‍🏫 Typical workflows

<a id="teacher-workflow"></a>

### 👩‍🏫 Teacher workflow

```text

Sign in

   ↓

Change initial password if required

   ↓

Select grade / subject / year / term

   ↓

Load students

   ↓

Enter and validate marks

   ↓

Submit

   ↓

Review submission confirmation

```

<a id="administrator-workflow"></a>

### 🏫 Administrator workflow

```text

Sign in

   ↓

Open dashboard

   ├── Review submissions

   ├── Analyze student / subject / class performance

   ├── Compare terms

   ├── Generate reports / exports

   └── Manage teacher accounts

```

<a id="security-and-privacy"></a>

## 🛡️ Security and privacy

<a id="current-authentication-limitations"></a>

### ⚠️ Current authentication limitations

The project uses custom username/password authentication with salted and peppered SHA-256-based password hashing. This is not equivalent to an independently audited authentication system or a dedicated password-hashing algorithm such as Argon2id or scrypt.

The code also maintains sessions and login-attempt state in Apps Script Properties. This approach requires additional review for concurrency, revocation, quotas, auditability, and administrative lifecycle events.

**Before entering real student data**, the school should review authentication, spreadsheet permissions, deployment access, backups, and applicable privacy requirements. Functional testing does not replace a security review.

<a id="protect-the-following"></a>

### 🛡️ Protect the following

- Student names, IDs, marks, and reports.

- Real teacher and administrator details.

- `Staff_Access` contents, password salts, and password hashes.

- Script Properties, including `AUTH_PEPPER` and session state.

- Deployment URLs when access should be restricted.

- Spreadsheet sharing permissions and Apps Script editor permissions.

- Backups and exported PDF reports.

<a id="publishing-safely"></a>

### 🌐 Publishing safely

Before making changes public:

1. Review **all tracked files and Git history** for secrets and personal information.

2. Never commit real spreadsheet exports, credential files, session tokens, or production data.

3. Use fictional examples for screenshots and documentation.

4. If a secret was committed, rotate it; deleting it from the latest commit alone does not remove it from Git history.

5. Review every callable Apps Script endpoint for server-side authorization.

6. Keep the school-owned deployment and workbook under appropriately managed accounts.

<a id="operational-considerations"></a>

### ⚙️ Operational considerations

Google Sheets and Apps Script have execution, quota, concurrency, and storage limits. A successful small test does not establish reliability at every school size or workload. Make a backup and restore plan, test concurrent submissions, and monitor errors before wider adoption.

<a id="testing"></a>

## 🧪 Testing

Suggested minimum test matrix:

| Area | Test |
|---|---|
| Authentication | Valid and invalid login |
| Sessions | Expiration and logout |
| Roles | Teacher denied admin-only operations |
| Passwords | First-login change, reset, and old-session rejection |
| Account lifecycle | Create, deactivate, reactivate |
| Marks validation | Valid mark, invalid mark, `ABSENT` |
| Duplicate protection | Repeat submission for same academic record |
| Registers | Invalid student or subject |
| Reporting | Student report and PDF export |
| Data isolation | User cannot retrieve restricted data by calling backend endpoints directly |
| Concurrency | Two simultaneous submissions |
| Recovery | Restore from a test backup |

Tests should use fictional records and include negative/security cases, not only successful UI interactions.

<a id="troubleshooting"></a>

## 🔧 Troubleshooting

| Problem | Possible cause | What to check |
|---|---|---|
| `Script function not found: doGet` | Missing entry function or wrong deployment version | Confirm `doGet()` exists in `Code.gs`, save, and redeploy |
| `Create Staff_Access sheet first` | Authentication sheet not initialized | Run `authInitialize_()` in the editor |
| `Unexpected Staff_Access headers` | Sheet columns do not match the expected schema | Compare headers A:H exactly |
| `Authentication not initialized` | Missing private `AUTH_PEPPER` property | Run `authInitialize_()` in the correct Apps Script project |
| `Session expired` | Session expired or was invalidated | Sign in again |
| `Access denied: administrator only` | Teacher tried an admin-only action | Use the correct role; do not remove authorization checks |
| HTML template not found | Case-sensitive file naming mismatch | Match `Index.html` to `createTemplateFromFile('Index')` |
| Students or subjects not loading | Register naming/header mismatch | Compare actual workbook with source-code expectations |
| Marks are not saved | Invalid data, duplicate entry, or permissions issue | Check validation feedback and Apps Script Executions |
| PDF export fails | Missing permissions, data, or export configuration | Inspect `ReportExport.gs` and execution logs |
| Latest changes do not appear | Old deployment version | Update the web-app deployment |

<a id="customization"></a>

## 🎨 Customization

To adapt the project to another school:

- Review and adjust the grade ranges and register routing.

- Update supported subjects and the school-specific academic structure.

- Confirm year/term conventions and mark validation rules.

- Customize labels, visual design, and reporting formats in the frontend.

- Review student identifiers and subject names for consistency.

- Review the access-control model and review authentication and access controls before using real records.

- Validate all calculations against manually checked fictional examples.

Avoid changing only the UI while leaving incompatible server-side validation or spreadsheet schemas unchanged.

<a id="limitations-and-roadmap"></a>

## 🗺️ Limitations and roadmap

<a id="current-limitations"></a>

### 🚧 Current limitations

- Designed around one school and Google Sheets, not a multi-tenant database.

- Setup depends on a specific workbook schema and correct Apps Script filenames.

- Custom authentication and permissions should be reviewed before use with private school data.

- Performance depends on Google Apps Script and Sheets limits.

- No claim is made that the project has passed an independent penetration test or privacy audit.

<a id="possible-improvements"></a>

### 💡 Possible improvements

- Keep the **fully fictional sample workbook** and sheet-schema reference synchronized with changes to the application.

- Add automated setup/schema-validation utilities.

- Replace custom passwords with an approved identity solution.

- Strengthen account/session revocation and audit logging.

- Add automated tests and a documented release process.

- Improve accessibility and multilingual support where needed.

- Add a maintained screenshots/demo section using fictional records.

<a id="contributing"></a>

## 🤝 Contributing

I welcome suggestions, bug reports, and improvements through GitHub Issues and Pull Requests.

When reporting a bug, include:

- A clear description of the problem.

- Steps to reproduce it with fictional data.

- Expected versus actual behavior.

- Relevant non-sensitive error messages.

**Never attach real student records, account credentials, private spreadsheets, or session tokens to a public issue.**

<a id="feedback-and-bug-reports"></a>

## 💬 Feedback, bugs and improvements

I'm sharing this project so other schools, students, and developers can explore the demo, learn from the implementation, and suggest improvements. **If you find an error or have an idea for improvement, please let me know!** 💙

- Open a [GitHub Issue](https://github.com/Jegathayini/school_marks_system/issues) with the affected feature, steps to reproduce, and the expected versus actual result.

- Please **do not attach real student marks, teacher passwords, authentication tokens, or private school documents** to public issues. Use fictional examples instead.

- Suggestions and feedback are welcome. Please ask before reusing or redistributing project code, and respect any applicable school permissions.

Thank you for trying my project and helping me improve **School Marks System**! 🎓✨

<a id="exact-register-layout"></a>

## 📚 Exact two-row student register format (important)

Download [`fictional_marks_sheet_sample.xlsx`](fictional_marks_sheet_sample.xlsx) from this repository. It contains three fictional example registers illustrating the **two-row header layout** used in this project.

| Spreadsheet row | What schools should enter |
| --- | --- |
| **Row 1** | `StudentID` / `Student Name`, `StudentName` / `Student Name`, `Grade`, then main subject headings or subject groups (e.g. `Section 01`, `ARTS STREAM`). Preserve the exact column positions shown in the sample. |
| **Row 2** | Additional subject names and options (e.g. `Hinduism`, `RC`, `NonRC`, `Music`, `Dance`, `Geography`, `Accounting`) in their designated columns. **Do not delete this row.** |
| **Row 3 onward** | One student per row: unique student ID, name, grade, followed by `Yes` or `No` for each subject. |

### 🏫 Three register worksheets

- **Grades 06–09:** Core subjects, Religion options, and Aesthetic subjects.

- **Grades 10–11:** Core subjects plus `Section 01`, `Section 02`, and `Section 03` options.

- **Grades 12–13:** `ARTS STREAM`, `COMMERCE STREAM`, and `COMMON SUBJECTS`, with individual subject names on the second header row.

### 📝 Example student row

| StudentID | StudentName | Grade | Maths | Science | Tamil | English | … |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ST1001 | Example Student | Grade 10 | Yes | Yes | Yes | Yes | … |

`Yes` means the student is enrolled in that subject; `No` means they are not. **Do not enter exam marks in the student register.** Teachers submit marks through the web application.

> ⚠️ **Important:** The two-row header is intentional. Do not shift the subject columns or replace the second row with student data. Keep the sheet/tab names and subject spelling consistent with the constants and parsing logic in `Code.js`. Check the code before importing into your own spreadsheet. The sample contains fictional data only.

To set up your school: download the workbook, review each register, replace the fictional students with your school's records **in a private school-owned spreadsheet**, verify subjects and grade labels, and follow the Apps Script setup instructions above. Never commit the completed school register to a public repository.

---

---

🎓 **School Marks System** — Built to make academic marks management, analysis, and reporting simpler! 🚀

<a id="author"></a>

## 👩‍💻 Author

**Jegathayini Thiruchchelvam**

- GitHub Profile: [@Jegathayini](https://github.com/Jegathayini)
- Project Repository: [school_marks_system](https://github.com/Jegathayini/school_marks_system)
