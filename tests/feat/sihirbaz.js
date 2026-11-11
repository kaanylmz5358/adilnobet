const {openApp,fixture,SH}=require("../lib/harness");
async function flow(F,answers,label){
  const {w,E,db,errors}=await openApp(F);
  E("openSetupWizard()");
  const seen=[];let guard=0;
  while(guard++<40){
    await new Promise(r=>setTimeout(r,40));
    if(!E("WZ")||!w.document.getElementById("wizard").classList.contains("is-open"))break;
    const t=w.document.querySelector(".wz__q").textContent;seen.push(t);
    const a=answers[t];
    if(a){for(const [k,v] of Object.entries(a)){if(k.startsWith("$")){E(`WZ.d.${k.slice(1)}=${JSON.stringify(v)}`);}else{E(`wzPick(${JSON.stringify(k)},${JSON.stringify(v)})`);await new Promise(r=>setTimeout(r,300));}}}
    if(E("WZ")&&w.document.querySelector(".wz__q")&&w.document.querySelector(".wz__q").textContent===t){await E("wzNext()");await new Promise(r=>setTimeout(r,80));}
  }
  const D=db.departments[0];
  console.log(`\n== ${label}: ${seen.length} ekran`);seen.forEach((t,i)=>console.log(`  ${i+1}. ${t}`));
  console.log("  errors:",errors.slice(0,2));if(errors.length)global.__wzErr=(global.__wzErr||0)+1;
  return {D,E,w};
}
(async()=>{
  // 1) basit oda listesi: varsayılanlarla
  const F1=fixture({mode:"rooms",dept:{general_rooms:1},opts:{setup_done:false},people:[{name:"Yönetici"},{name:"Ali"},{name:"Ayşe"},{name:"Veli"}]});
  F1.db.departments[0].opts={};
  let r=await flow(F1,{},"Basit oda listesi (her şeye Devam)");
  console.log("  opts:",JSON.stringify({rhythm:r.D.opts.rhythm,sen:r.D.opts.sen,gen:r.D.opts.gen,setup:r.D.opts.setup_done,pat:[r.D.pattern_on,r.D.pattern_off]}));
  // 2) karmaşık vardiyalı ekip
  const F2=fixture({shifts:[],opts:{},people:Array.from({length:8},(_,i)=>({name:"H"+i}))});
  F2.db.departments[0].opts={};
  r=await flow(F2,{
    "Nöbetler nasıl tutuluyor?":{kind:"shift"},
    "Vardiyalar nasıl?":{tpl:"dn","$tplN":2},
    "Nöbetten sonra ne olur?":{after:"all"},
    "Sen de nöbet tutuyor musun?":{me:"no"},
    "Belirli bir çalışma düzeni var mı?":{rh:"range"},
    "Çalışma düzeni":{"$wMin":2,"$wMax":3,"$oMin":2,"$oMax":3},
    "Her nöbette kıdemli ve yeni birlikte olsun mu?":{sen:"yes"},
    "Kıdem kuralı":{"$th":4,"$hiMin":1,"$loMin":1},
    "Kıdeme göre aylık nöbet sayısı farklı mı?":{sq:"yes","$qHi":12,"$qLo":14},
    "Kadın–erkek dengesi gerekli mi?":{gen:"mix"},
    "Ekipten başka bir listede de nöbet tutan var mı?":{link:"yes",lm:"rest"},
    "Başka kuralın var mı?":{"$xr":{h:{on:true,n:45},an:{on:true,n:2},nr:{on:false,n:2},wk:{on:true,n:0},wm:{on:false,n:2}}},
    "Ayrıntıları da şimdi ayarlamak ister misin?":{adv:"yes"},
    "Her nöbet yeri mutlaka dolsun mu?":{fill:"all"},
    "İki vardiya arası en az kaç saat dinlenme?":{"$mr":11},
    "Gece ve gündüzler nasıl dağılsın?":{dn:"eq"},
    "Hafta sonu nöbetleri eşit dağılsın mı?":{we:"no"},
    "Aynı gün birlikte çalışanlar…":{pm:"rotate"},
    "Kişilerin istediği günler ne kadar önemli?":{wish:"high"},
  },"Karmaşık vardiyalı ekip");
  const D=r.D;console.log("  kaydedilen:",JSON.stringify({mode:D.sched_mode,work:D.work_model,shifts:(D.shifts||[]).map(x=>x.start+"-"+x.end+"x"+x.count),pat:[D.pattern_on,D.pattern_off],rhythm:D.opts.rhythm,sen:D.opts.sen,senq:D.opts.senq,gen:D.opts.gen,link:D.opts.link_default,fill:D.fill_policy,rest:D.opts.min_rest_h,bal:[D.opts.bal_dn,D.opts.bal_we],pm:D.opts.partner_mode,wish:D.opts.wish_pri,setup:D.opts.setup_done}));
  console.log("  kurallar:",JSON.stringify(r.E("rulesAll().map(ruleText)")));
  console.log("  Yönetici noDuty:",JSON.stringify(r.E("sp(members.find(x=>x.id===me.id))")));
  // 3) kurulumdan sonra liste gerçekten bu ayarlarla kuruluyor mu (kıdem/cinsiyet girilmeden)
  r.E("generate()");console.log("  taslak:",JSON.stringify(r.E("draft.rep")),"boş",r.E("draft.emptyCount"));
  console.log("SONUÇ:", global.__wzErr ? "JS hatası" : "TAMAM");
  process.exit(0);
})();
