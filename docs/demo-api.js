
/* School Academic Management V2 public demo. Fictional data, no server calls. */
(function () {
  'use strict';
  const terms = ['Term 1', 'Term 2', 'Term 3'];
  const subjects = ['Maths', 'Science', 'Tamil', 'English'];
  const gradeName = n => 'Grade ' + String(n).padStart(2, '0');
  const gradeNumber = g => Number(String(g).replace(/[^0-9]/g, ''));
  const round = n => Math.round(n * 100) / 100;
  const accounts = {
    demo_admin: {password:'Admin@Demo2026', role:'ADMIN', name:'Demo Administrator'},
    demo_teacher: {password:'Teacher@Demo2026', role:'TEACHER', name:'Demo Teacher'}
  };
  const sessionKey = 'school_marks_demo_session';
  const store = () => DemoStorage.load();
  const studentsFor = grade => store().students.filter(s => s.grade === gradeNumber(grade));
  const raw = (s,term,subject,type='marks') => s[type]?.[term]?.[subject] ?? null;
  const isAbsent = v => v === 'ABSENT' || v === 'AB';
  const valid = v => typeof v === 'number' && Number.isFinite(v);
  const entered = v => valid(v) || isAbsent(v);
  const score = v => isAbsent(v) ? 0 : Number(v);
  const mean = vals => vals.length ? round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  const userFor = token => {
    const name=String(token||'').replace(/^demo-/,'');
    if(!accounts[name] || sessionStorage.getItem(sessionKey)!==name) throw Error('Please sign in to the demo.');
    return accounts[name];
  };
  const requireAdmin = token => { if(userFor(token).role!=='ADMIN') throw Error('Administrator access required.'); };
  const subjectStats = (grade,term) => subjects.map(subject => {
    const list=studentsFor(grade), vals=list.map(s=>raw(s,term,subject));
    const present=vals.filter(entered), numeric=present.map(score);
    const count=present.length, expected=list.length;
    return {subject,enrolled:expected,expected,entered:count,absent:present.filter(isAbsent).length,
      pending:expected-count,average:mean(numeric),highest:numeric.length?Math.max(...numeric):null,
      lowest:numeric.length?Math.min(...numeric):null,
      missingIds:list.filter(s=>!entered(raw(s,term,subject))).map(s=>s.id),
      status:count===expected?'completed':count?'partial':'pending'};
  });
  const analysis = (year,grade,term) => {
    const list=studentsFor(grade), stats=subjectStats(grade,term);
    const rows=list.map(s=>{
      const marks={}, missing=[];let total=0,absent=0,count=0;
      for(const subject of subjects){
        const v=raw(s,term,subject);
        if(entered(v)) { marks[subject]=isAbsent(v)?'AB':v;total+=score(v);count++;if(isAbsent(v)) absent++; }
        else missing.push(subject);
      }
      const complete=count===subjects.length && count>0;
      return {id:s.id,name:s.name,marks,missing,expected:subjects.length,entered:count,
        absent,numericCount:count-absent,totalRecorded:round(total),complete,
        average:complete?round(total/subjects.length):null};
    });
    const complete=rows.filter(s=>s.complete);
    return {year:Number(year),grade,term,subjects:stats,students:rows,studentCount:list.length,
      completeCount:complete.length,pendingCount:rows.length-complete.length,
      classAverage:mean(complete.map(s=>s.average)),warnings:{duplicates:[],invalidOrUnmatched:[]},
      note:'Fictional demo results. ABSENT is zero; pending marks make student averages incomplete.'};
  };
  const submission = (year,grade,term) => {
    const stats=subjectStats(grade,term);
    return {year:Number(year),grade,term,subjects:stats,required:stats.length,
      completed:stats.filter(s=>s.entered===s.expected).length};
  };
  const comparison = (year,grade) => ({year:Number(year),grade,studentCount:studentsFor(grade).length,
    terms:terms.map(term=>{const stats=subjectStats(grade,term);const expected=stats.reduce((n,s)=>n+s.expected,0);
      const count=stats.reduce((n,s)=>n+s.entered,0);
      return {term,entered:count,expected,missing:expected-count,classAverage:analysis(year,grade,term).classAverage};}),
    subjects:subjects.map(subject=>({subject,terms:terms.map(term=>{const s=subjectStats(grade,term).find(s=>s.subject===subject);
      return {term,average:s.average,entered:s.entered,expected:s.expected};})})),
    note:'Fictional data. AB counts as zero; pending marks are not scored.'});
  const report = (year,grade,id) => {
    const student=studentsFor(grade).find(s=>String(s.id)===String(id));
    if(!student) throw Error('Demo student not found.');
    const analyses=terms.map(t=>analysis(year,grade,t));
    const termReports=terms.map((term,i)=>{
      const result=analyses[i].students.find(s=>s.id===student.id);
      const marks=subjects.map(subject=>({subject,mark:result.marks[subject]??null,
        entered:Object.hasOwn(result.marks,subject),absent:result.marks[subject]==='AB'}));
      return {term,marks,expected:result.expected,entered:result.entered,absent:result.absent,
        numericCount:result.numericCount,missing:result.expected-result.entered,
        complete:result.complete,totalRecorded:result.totalRecorded,average:result.average,
        missingSubjects:result.missing};
    });
    const complete=termReports.filter(t=>t.complete);
    return {year:Number(year),grade,student:{id:student.id,name:student.name},subjects,
      terms:termReports,overallAverage:mean(complete.map(t=>t.average)),
      annualAverage:complete.length===3?mean(complete.map(t=>t.average)):null,
      warnings:[],note:'Fictional records only; nothing is connected to a school database.'};
  };
  const annual = (year,grade) => {
    const rows=subjects.map(subject=>{
      const candidates=[], enrolled=studentsFor(grade);
      let pending=0;
      for(const s of enrolled){
        const marks=terms.map(t=>raw(s,t,subject));
        if(!marks.every(entered)){pending++;continue;}
        candidates.push({id:s.id,name:s.name,terms:marks.map(v=>isAbsent(v)?'AB':v),annualAverage:mean(marks.map(score))});
      }
      candidates.sort((a,b)=>b.annualAverage-a.annualAverage || a.name.localeCompare(b.name));
      let previous=null,rank=0;
      candidates.forEach((s,i)=>{if(previous===null || Math.abs(previous-s.annualAverage)>1e-9) rank=i+1;
        s.rank=rank;previous=s.annualAverage;});
      return {subject,enrolled:enrolled.length,complete:candidates.length,pending,
        top:pending===0?candidates.filter(s=>s.rank<=3):[]};
    });
    return {year:Number(year),grade,studentCount:studentsFor(grade).length,
      ready:rows.length>0&&rows.every(s=>s.pending===0),subjects:rows,warnings:[],
      note:'Fictional annual rankings. All three terms required; ties share ranks.'};
  };
  const sbaReport = (year,grade,term) => {
    const rows=studentsFor(grade).flatMap(s=>subjects.map(subject=>{
      const mark=raw(s,term,subject,'sba');
      return {id:s.id,name:s.name,subject,mark:entered(mark)?(isAbsent(mark)?'ABSENT':mark):null,
        status:!entered(mark)?'PENDING':isAbsent(mark)?'ABSENT':'RECORDED'};
    }));
    return {year:Number(year),grade,term,subjects,results:rows,total:rows.length,
      recorded:rows.filter(r=>r.status!=='PENDING').length,
      pending:rows.filter(r=>r.status==='PENDING').length,warnings:[]};
  };
  const pendingSBA = (year,grade,term,subject) => {
    const list=studentsFor(grade).map(s=>({id:s.id,name:s.name,mark:raw(s,term,subject,'sba')}));
    const count=list.filter(s=>entered(s.mark)).length;
    return {year:Number(year),grade,term,subject,total:list.length,completed:count,
      students:list.map(s=>({id:s.id,name:s.name,status:entered(s.mark)?(isAbsent(s.mark)?'ABSENT':'RECORDED'):'PENDING'}))};
  };
  const save = (payload,token,type) => {
    userFor(token);
    if(!terms.includes(payload.term)||!subjects.includes(payload.subject)||gradeNumber(payload.grade)<1||gradeNumber(payload.grade)>13)
      throw Error('Invalid grade, term or subject.');
    const db=store(),list=db.students.filter(s=>s.grade===gradeNumber(payload.grade));
    const changes=[];
    for(const item of payload.marks||[]){
      const student=list.find(s=>String(s.id)===String(item.id));
      if(!student) throw Error('Invalid student.');
      const v=isAbsent(item.mark)?'ABSENT':Number(item.mark);
      if(!isAbsent(v)&&(!Number.isFinite(v)||v<0||v>100)) throw Error('Marks must be between 0 and 100.');
      if(entered(raw(student,payload.term,payload.subject,type))) throw Error('Mark already submitted.');
      changes.push({student,value:v});
    }
    for(const {student,value} of changes){student[type] ||= {};student[type][payload.term] ||= {};
      student[type][payload.term][payload.subject]=value;}
    DemoStorage.save(db);return {added:changes.length};
  };
  const api = {
    login(username,password){const account=accounts[String(username).trim()];
      if(!account||account.password!==password) return {success:false,message:'Invalid demo username or password.'};
      return {success:true,user:{username:String(username).trim(),name:account.name,role:account.role}};},
    authLogin(username,password){const result=this.login(username,password);
      if(!result.success) throw Error(result.message);
      sessionStorage.setItem(sessionKey,result.user.username);
      return {token:'demo-'+result.user.username,role:result.user.role,name:result.user.name,mustChangePassword:false};},
    authSession(token){const account=userFor(token);return {role:account.role,name:account.name,mustChangePassword:false};},
    authLogout(){sessionStorage.removeItem(sessionKey);return true;},
    resetDemo(){return DemoStorage.reset();},
    getSetup(token){userFor(token);return {grades:Array.from({length:13},(_,i)=>gradeName(i+1)),
      subjects:[...subjects],subjectsByGrade:Object.fromEntries(Array.from({length:13},(_,i)=>[gradeName(i+1),[...subjects]])),
      registerSheet:'Fictional demo registers'};},
    getStudents(grade,subject,token){userFor(token);return studentsFor(grade).map(s=>({id:s.id,name:s.name}));},
    getStudentsForGrade(grade,subject,token){return this.getStudents(grade,subject,token);},
    getSubmissionStatus(year,grade,term,token){userFor(token);return submission(year,grade,term);},
    getSBAPendingStudents(year,grade,term,subject,token){userFor(token);return pendingSBA(year,grade,term,subject);},
    saveMarks(payload,token){return save(payload,token,'marks');},
    saveSBAMarks(payload,token){return save(payload,token,'sba');},
    getDashboardData(year,grade,term,token){requireAdmin(token);return {analysis:analysis(year,grade,term),submission:submission(year,grade,term)};},
    getAnalysis(year,grade,term,token){requireAdmin(token);return analysis(year,grade,term);},
    getTermComparison(year,grade,token){requireAdmin(token);return comparison(year,grade);},
    getAnnualTopPerformers(year,grade,token){requireAdmin(token);return annual(year,grade);},
    getSBAReport(year,grade,term,token){requireAdmin(token);return sbaReport(year,grade,term);},
    getReportStudents(grade,token){requireAdmin(token);return studentsFor(grade).map(s=>({id:s.id,name:s.name}));},
    getStudentReport(year,grade,id,token){requireAdmin(token);return report(year,grade,id);},
    adminListTeachers(token){requireAdmin(token);return [{name:'Demo Teacher',username:'demo_teacher',email:'',active:true}];},
    adminCreateTeacher(){throw Error('Account creation is disabled in the public demo.');},
    adminResetTeacherPassword(){throw Error('Password resets are disabled in the public demo.');},
    adminSetTeacherActive(){throw Error('Account changes are disabled in the public demo.');},
    authChangePassword(){throw Error('Password changes are disabled in the public demo.');}
  };
  window.DemoAPI=api;
  function invoke(method,args,success,failure){
    Promise.resolve().then(()=>{
      if(typeof api[method]!=='function') throw Error('Unsupported demo function: '+String(method));
      return api[method](...args);
    }).then(value=>success?.(value)).catch(error=>{if(failure) failure(error);else console.error('Demo operation failed:',error);});
  }
  function runner(success,failure){return new Proxy({}, {get(_target,method){
    if(method==='withSuccessHandler') return fn=>runner(fn,failure);
    if(method==='withFailureHandler') return fn=>runner(success,fn);
    if(method==='then') return undefined;
    return (...args)=>invoke(method,args,success,failure);
  }});}
  window.google={script:{run:runner(undefined,undefined)}};
})();
