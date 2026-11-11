const {openApp,fixture,SH,uid}=require("../lib/harness");const {check}=require("../lib/checker");
const P=n=>Array.from({length:n},(_,i)=>({name:"Kişi "+(i+1)}));
(async()=>{
  const F=fixture({shifts:[SH("G","08:00","20:00",2),SH("N","20:00","08:00",2),SH("İcap","08:00","08:00",1,[1,1,1,1,1,1,1],{icap:true})],opts:{min_rest_h:8,rhythm:{on:true,wMin:2,wMax:3,oMin:2,oMax:4}},people:P(10)});
  const {w,E,db,errors}=await openApp(F);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const O=()=>db.departments[0].opts;
  E("setPage('root')");console.log("ayar satırı:",E("[...document.querySelectorAll('#setLanding .nd-row__title')].map(x=>x.textContent).filter(t=>/kural/i.test(t))"));
  E("setPage('kural')");await wait(50);
  console.log("sayfa görünür:",E("!$('ruleCard').classList.contains('pg-hide')"),"| kart sayısı:",E("document.querySelectorAll('#ruleList .rl-card').length"));
  // kural ekle: tür seçimi -> cümle -> kaydet
  E("ruleNew()");console.log("tür kutuları:",E("document.querySelectorAll('.rb-type').length"));
  E("rbPick('lim')");E("rbSet('per','week')");E("rbSet('n',45)");console.log("önizleme:",E("document.querySelector('.rb-prev').textContent.trim()"));
  await E("rbSave()");await wait(50);
  console.log("kaydedildi:",JSON.stringify(O().rules));
  E("ruleNew()");E("rbPick('after')");E("rbSet('n',2)");await E("rbSave()");await wait(30);
  E("ruleNew()");E("rbPick('need')");console.log("etiket yok hatası:",E("rbErr(RB_ED.r)"));E("ruleClose()");
  // kişiye etiket ver
  E(`openPerson('${uid(1)}')`);console.log("kişi kartında yetkinlik:",E("/Yetkinlik/.test($('personSheetBody').innerHTML)"));
  E(`(()=>{const i=document.querySelector('#personSheetBody .tagchips input');i.value='YB';addPersonTag('${uid(1)}',i);})()`);await wait(30);
  E(`(()=>{const i=document.querySelector('#personSheetBody .tagchips input');i.value='YB';addPersonTag('${uid(4)}',i);})()`);await wait(30);
  E(`setPersonAttr('${uid(2)}','ratio',50)`);await wait(30);E("closePerson()");
  console.log("people:",JSON.stringify(O().people));
  E("ruleNew()");E("rbPick('need')");console.log("varsayılan etiket:",E("RB_ED.r.tag"));E("rbSet('scope','day')");await E("rbSave()");await wait(30);
  E("ruleNew()");E("rbPick('cycle')");E("rbPat('clr')");["G","G","N","N","-","-","-","-"].forEach(c=>E(`rbPat('${c}')`));console.log("döngü:",E("RB_ED.r.pat"),E("document.querySelectorAll('.cy-c').length"));E("ruleClose()");
  E("ruleNew()");E("rbPick('staff')");E("rbSet('sel','wd')");E("rbSet('wd',2)");console.log("staff wd:",JSON.stringify(E("RB_ED.r.wd")),E("ruleText(RB_ED.r)"));E("ruleClose()");
  E("renderRules()");
  console.log("önem sırası:",JSON.stringify(E("priKeys()")));
  E("rulePri(0,1)");await wait(30);console.log("sıra değişti:",JSON.stringify(O().pri));
  const id0=O().rules[0].id;E(`ruleToggle('${id0}',false)`);await wait(30);console.log("kapalı:",O().rules[0].on, "rulesOn:",E("rulesOn().length"));
  E(`ruleToggle('${id0}',true)`);await wait(30);
  console.log("kartlar:",E("[...document.querySelectorAll('#ruleList .rl-txt')].map(x=>x.textContent)"));
  // liste hazırla
  E("generate()");for(let i=0;i<400;i++){await wait(250);if(!E("ALT.busy"))break;}console.log("öneri süresi",E("ALT.tried"),"/",E("ALT.total"));
  console.log("rep:",JSON.stringify(E("draft.rep")),"icap:",JSON.stringify(E("draft.icapCnt")));
  console.log("uyarılar:",E("draft.viol.slice(0,6)"));
  console.log("öneriler:",E("ALT.list.map(f=>f.title)"));
  console.log("neler uymuyor satırı:",E("document.querySelectorAll('#issueBox .iss-row').length"),E("[...document.querySelectorAll('#issueBox .iss-h')].map(x=>x.textContent)"));
  const r=E("document.querySelector('#issueBox .iss-row[onclick]')");if(r){E("document.querySelector('#issueBox .iss-row[onclick]').click()");console.log("gün açıldı:",E("$('daySheet').classList.contains('on')"),E("draftUI.sel"));}
  console.log("karar satırı örnek:",E("document.querySelector('#decideBody .nd-row__sub').textContent"));
  const c=check(F.__fx||F,{asg:E("draft.asg")},{allowRules:true,allowRhythm:true});
  console.log("JS hataları:",errors.slice(0,5));
  console.log("SONUÇ:", errors.length ? "JS hatası" : "TAMAM");
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
