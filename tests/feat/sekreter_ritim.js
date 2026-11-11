const {openApp,fixture,SH,uid}=require("../lib/harness");const {check}=require("../lib/checker");
const iz=(a,b)=>{const o={};for(let d=a;d<=b;d++)o[d]="izin";return o;};
function fx(extraOpts={},people){
  return fixture({month:"2026-11",shifts:[SH("Vardiya","08:00","23:00"),SH("Vardiya","08:00","20:00"),SH("Vardiya","07:00","20:00",1,[1,1,1,1,1,1,0])],
   opts:{sen:{on:true},pins:[],arife:"",bal_dn:true,bal_we:false,blocks:[],rhythm:{on:true,oMax:3,oMin:2,wMax:2,wMin:2},gen_day:25,wish_pri:"normal",leave_prop:true,min_rest_h:8,quota_month:"2026-11",partner_mode:"rotate",...extraOpts},
   people:people||[{name:"Yönetici Test",noDuty:true},{name:"Kişi A"},{name:"Kişi B"},{name:"Kişi C"},{name:"Kişi D"},{name:"Kişi E"},{name:"Kişi F"}],
   prefs:{3:iz(1,8),0:{4:"avoid",5:"avoid",6:"avoid",12:"yes",14:"never",15:"avoid",17:"yes",18:"yes",19:"must",24:"izin",25:"izin",26:"izin"}}});
}
(async()=>{
  const F=fx();
  const {w,E,errors}=await openApp(F);
  console.log("errors:",errors.slice(0,3));
  console.log("rrCfg",JSON.stringify(E("rrCfg()")),"slots",E("totalSlots()"),"slotDays",E("totalSlotDays()"));
  const t0=Date.now();E("generate()");const dr=E("draft");console.log("ms",Date.now()-t0);
  console.log("exact",dr.exact,"empty",dr.emptyCount);console.log(dr.viol.join("\n"));
  console.log("cnt",JSON.stringify(Object.values(dr.cnt)));
  const r=check(F,dr,{allowEmpty:true,allowRhythm:true});console.log(JSON.stringify(r.info.rhythmDet.slice(0,12),null,0),r.problems);
  // gün gün kim çalışıyor
  const names=E("members.map(p=>p.name)"),ids=E("members.map(p=>p.id)");
  for(const id of ids){let s="";for(let d=1;d<=30;d++)s+=(dr.asg[d]||[]).some(e=>e.id===id)?"█":"·";console.log(s,names[ids.indexOf(id)]);}
  console.log("SONUÇ:", errors.length || r.problems.length ? "sorun: " + [...errors, ...r.problems].slice(0, 3).join(" | ") : "TAMAM");
  process.exit(0);
})();
