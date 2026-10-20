/* Static demo backend: no network, no real credentials or real student data. */
(function () {
  'use strict';
  const terms = ['Term 1', 'Term 2', 'Term 3'];
  const gradeName = n => 'Grade ' + String(n).padStart(2, '0');
  const numberGrade = g => Number(String(g).replace(/[^0-9]/g, ''));
  const round = n => Math.round(n * 100) / 100;
  const allSubjects = ['Maths', 'Science', 'Tamil', 'English'];
  const accounts = {
    demo_admin: {password:'Admin@Demo2026', role:'ADMIN', name:'Demo Administrator'},
    demo_teacher: {password:'Teacher@Demo2026', role:'TEACHER', name:'Demo Teacher'}
  };
  const sessionKey = 'school_marks_demo_session';
  const getAccount = token => {
    const username = String(token || '').replace(/^demo-/, '');
    const account = accounts[username];
    if (!account) throw Error('Please sign in to the demo.');
    return {username, ...account};
  };
  const requireAdmin = token => {
    if (getAccount(token).role !== 'ADMIN') throw Error('Demo administrator access required.');
  };
  const data = () => DemoStorage.load();
  const studentsFor = grade => data().students.filter(s => s.grade === numberGrade(grade));
  const subjectsFor = grade => studentsFor(grade).length ? allSubjects : [];
  const recorded = (student, term, subject) => {
    const value = student.marks?.[term]?.[subject];
    return value === undefined || value === null || value === '' ? null : value;
  };
  const numeric = value => value !== null && value !== 'ABSENT' && Number.isFinite(Number(value));
  const avg = values => {
    const nums = values.filter(numeric).map(Number);
    return nums.length ? round(nums.reduce((a,b)=>a+b,0)/nums.length) : null;
  };
  const subjectStats = (grade,term) => subjectsFor(grade).map(subject => {
    const list = studentsFor(grade), vals = list.map(s=>recorded(s,term,subject));
    const scores = vals.filter(numeric).map(Number);
    const entered = vals.filter(v=>v!==null).length;
    const expected = list.length;
    return {subject, enrolled:expected, expected, entered, absent:vals.filter(v=>v==='ABSENT').length,
      pending:expected-entered, average:avg(vals), highest:scores.length?Math.max(...scores):null,
      lowest:scores.length?Math.min(...scores):null,
      missingIds:list.filter(s=>recorded(s,term,subject)===null).map(s=>s.id),
      status:entered===expected?'completed':entered?'partial':'pending'};
  });
  const submission = (year,grade,term) => {
    const subjects=subjectStats(grade,term);
    return {year,grade,term,subjects,required:subjects.length,completed:subjects.filter(s=>s.entered===s.expected).length};
  };
  const analysis = (year,grade,term) => {
    const subjects=subjectStats(grade,term);
    const list=studentsFor(grade);
    const studentRows=list.map(s=>{
      const vals=subjects.map(x=>recorded(s,term,x.subject));
      const entered=vals.filter(v=>v!==null).length;
      return {id:s.id,name:s.name,entered,expected:subjects.length,
        absent:vals.filter(v=>v==='ABSENT').length,
        totalRecorded:vals.filter(numeric).reduce((sum,v)=>sum+Number(v),0),
        average:avg(vals),complete:entered===subjects.length};
    });
    const completeCount=studentRows.filter(s=>s.complete).length;
    return {year,grade,term,subjects,students:studentRows,studentCount:list.length,
      completeCount,pendingCount:list.length-completeCount,
      classAverage:avg(studentRows.filter(s=>s.complete).map(s=>s.average)),
      warnings:{duplicates:[],invalidOrUnmatched:[]},
      note:'Fictional demonstration data. Missing marks are not counted as zero.'};
  };
  const comparison=(year,grade)=>{
    const subjects=subjectsFor(grade);
    const termStats=terms.map(term=>{
      const stats=subjectStats(grade,term),entered=stats.reduce((a,s)=>a+s.entered,0),
        expected=stats.reduce((a,s)=>a+s.expected,0);
      return {term,entered,expected,missing:expected-entered,
        classAverage:analysis(year,grade,term).classAverage};
    });
    return {year,grade,studentCount:studentsFor(grade).length,terms:termStats,
      subjects:subjects.map(subject=>({subject,terms:terms.map(term=>{
        const s=subjectStats(grade,term).find(s=>s.subject===subject);
        return {term,average:s.average,entered:s.entered,expected:s.expected};
      })})),note:'Only recorded numeric marks contribute to subject averages.'};
  };
  const report=(year,grade,id)=>{
    const student=studentsFor(grade).find(s=>String(s.id)===String(id));
    if(!student) throw Error('Demo student not found.');
    const subjects=subjectsFor(grade);
    const termReports=terms.map(term=>{
      const marks=subjects.map(subject=>({subject,mark:recorded(student,term,subject)}));
      const vals=marks.map(m=>m.mark),entered=vals.filter(v=>v!==null).length;
      return {term,marks,entered,expected:subjects.length,complete:entered===subjects.length,
        average:avg(vals),totalRecorded:vals.filter(numeric).reduce((a,v)=>a+Number(v),0)};
    });
    return {year,grade,student:{id:student.id,name:student.name},subjects,terms:termReports,
      note:'Fictional student. Results are saved only in your browser.',warnings:[]};
  };
  const api={
    login(username,password){
      const account=accounts[String(username).trim()];
      if(!account || account.password!==password) return {success:false,message:'Invalid demo username or password.'};
      return {success:true,user:{username:String(username).trim(),name:account.name,role:account.role}};
    },
    getStudents(){return data().students;},
    getStudent(id){return data().students.find(s=>String(s.id)===String(id))||null;},
    getDashboardData(year,grade,term){
      if(arguments.length>=3) return {analysis:analysis(year,grade,term),submission:submission(year,grade,term)};
      const students=data().students;
      const marks=students.flatMap(s=>Object.values(s.marks).flatMap(t=>Object.values(t)));
      return {totalStudents:students.length,totalGrades:new Set(students.map(s=>s.grade)).size,averageMarks:avg(marks)};
    },
    submitMarks(studentId,term,subject,mark){
      const value=Number(mark);
      if(!Number.isFinite(value)||value<0||value>100) throw Error('Marks must be between 0 and 100.');
      const store=data(),student=store.students.find(s=>String(s.id)===String(studentId));
      if(!student) throw Error('Student not found.');
      student.marks[term] ||= {};
      student.marks[term][subject]=value;
      DemoStorage.save(store);return {success:true};
    },
    resetDemo(){return DemoStorage.reset();},
    authLogin(username,password){
      const result=this.login(username,password);
      if(!result.success) throw Error(result.message);
      sessionStorage.setItem(sessionKey,result.user.username);
      return {token:'demo-'+result.user.username,role:result.user.role,name:result.user.name,mustChangePassword:false};
    },
    authSession(token){
      const user=getAccount(token);
      if(sessionStorage.getItem(sessionKey)!==user.username) throw Error('Session expired.');
      return {role:user.role,name:user.name,mustChangePassword:false};
    },
    authLogout(){sessionStorage.removeItem(sessionKey);return true;},
    getSetup(token){getAccount(token);return {grades:Array.from({length:8},(_,i)=>gradeName(i+6)),
      subjectsByGrade:Object.fromEntries(Array.from({length:8},(_,i)=>[gradeName(i+6),subjectsFor(gradeName(i+6))]))};},
    getSubmissionStatus(year,grade,term,token){getAccount(token);return submission(year,grade,term);},
    getStudentsForGrade(grade,subject,token){getAccount(token);return studentsFor(grade).map(s=>({id:s.id,name:s.name}));},
    saveMarks(payload,token){
      getAccount(token);
      if(!terms.includes(payload.term)||!subjectsFor(payload.grade).includes(payload.subject)) throw Error('Invalid grade, term or subject.');
      const store=data(),list=store.students.filter(s=>s.grade===numberGrade(payload.grade));
      let added=0;
      for(const item of payload.marks){
        const student=list.find(s=>String(s.id)===String(item.id));
        if(!student) throw Error('Invalid student.');
        const value=item.mark==='ABSENT'?'ABSENT':Number(item.mark);
        if(value!=='ABSENT'&&(!Number.isFinite(value)||value<0||value>100)) throw Error('Invalid mark.');
        if(recorded(student,payload.term,payload.subject)!==null) throw Error('This mark has already been submitted.');
        student.marks[payload.term] ||= {};
        student.marks[payload.term][payload.subject]=value;added++;
      }
      DemoStorage.save(store);return {added};
    },
    getAnalysis(year,grade,term,token){requireAdmin(token);return analysis(year,grade,term);},
    getTermComparison(year,grade,token){requireAdmin(token);return comparison(year,grade);},
    getReportStudents(grade,token){requireAdmin(token);return studentsFor(grade).map(s=>({id:s.id,name:s.name}));},
    getStudentReport(year,grade,id,token){requireAdmin(token);return report(year,grade,id);},
    adminListTeachers(token){requireAdmin(token);return [{name:'Demo Teacher',username:'demo_teacher',active:true}];},
    adminCreateTeacher(){throw Error('Creating accounts is disabled in the public demo.');},
    adminResetTeacherPassword(){throw Error('Password resets are disabled in the public demo.');},
    adminSetTeacherActive(){throw Error('Account changes are disabled in the public demo.');},
    authChangePassword(){throw Error('Password changes are disabled in the public demo.');}
  };
  window.DemoAPI=api;
  // Adapter preserves the original Google Apps Script frontend call style.
  // No network requests are made; every method resolves locally.
  window.google={script:{run:new Proxy({}, {
    get(_target,property){
      if(property==='withSuccessHandler') return success=>makeRunner(success,undefined);
      if(property==='withFailureHandler') return failure=>makeRunner(undefined,failure);
      if(property==='then') return undefined;
      return (...args)=>invoke(property,args,undefined,undefined);
    }
  })}};
  function makeRunner(success,failure){
    return new Proxy({}, {get(_target,property){
      if(property==='withSuccessHandler') return fn=>makeRunner(fn,failure);
      if(property==='withFailureHandler') return fn=>makeRunner(success,fn);
      if(property==='then') return undefined;
      return (...args)=>invoke(property,args,success,failure);
    }});
  }
  function invoke(method,args,success,failure){
    Promise.resolve().then(()=>{
      if(method==='getStudents') return api.getStudentsForGrade(...args);
      if(typeof api[method]!=='function') throw Error('Unsupported demo function: '+String(method));
      return api[method](...args);
    }).then(value=>success?.(value)).catch(error=>{
      if(failure) failure(error);
      else console.error('Demo operation failed:',error);
    });
  }
})();
