(() => {
  'use strict';
  const K_CUSTOM='helpTrainingV3CustomLessons', K_EDITS='helpTrainingV3Edits', K_MOVES='helpTrainingV3Moves';
  const get=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

  function applyMoves(){
    if(typeof moduleData==='undefined')return;
    const moves=get(K_MOVES,{});
    Object.entries(moves).forEach(([id,moduleId])=>{
      let lesson=null;
      moduleData.forEach(m=>{const found=m.lessons.find(x=>x.id===id);if(found){lesson=found;m.lessons=m.lessons.filter(x=>x.id!==id)}});
      if(lesson)moduleData.find(m=>m.id===moduleId)?.lessons.push(lesson);
    });
  }

  function enrichCustom(id){
    const c=get(K_CUSTOM,[]).find(x=>x.id===id);if(!c)return;
    const edits=get(K_EDITS,{});
    edits[id]={...(edits[id]||{}),title:c.title,desc:c.desc,steps:c.steps,level:c.level||'Básico',status:c.status||'Rascunho',mandatory:!!c.mandatory,roles:c.roles||['geral'],warning:c.warning||'',errors:c.errors||[],images:c.images||[],quiz:c.quiz||null};
    set(K_EDITS,edits);
  }

  const save=window.saveLessonEditor;
  if(typeof save==='function')window.saveLessonEditor=function(id,isNew){
    const selected=document.getElementById('edModule')?.value||'';
    const before=get(K_CUSTOM,[]).map(x=>x.id);
    const r=save.apply(this,arguments);
    const after=get(K_CUSTOM,[]);
    if(isNew){const created=after.find(x=>!before.includes(x.id));if(created)enrichCustom(created.id)}
    else if(id){
      const moves=get(K_MOVES,{});moves[id]=selected;set(K_MOVES,moves);
      const idx=after.findIndex(x=>x.id===id);if(idx>=0){after[idx].moduleId=selected;set(K_CUSTOM,after);enrichCustom(id)}
    }
    applyMoves();
    return r;
  };

  const dup=window.duplicateLesson;
  if(typeof dup==='function')window.duplicateLesson=function(id){
    const before=get(K_CUSTOM,[]).map(x=>x.id),r=dup.apply(this,arguments),after=get(K_CUSTOM,[]),created=after.find(x=>!before.includes(x.id));if(created)enrichCustom(created.id);return r;
  };

  applyMoves();
})();