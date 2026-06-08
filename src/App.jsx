import { useState, useEffect, useCallback, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, onSnapshot,
  collection, getDocs, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ============================================================
// DATA – Copa del Mundo 2026
// ============================================================
const GROUPS = {
  A:["México","Sudáfrica","Rep. de Corea","Rep. Checa"],
  B:["Canadá","Bosnia H.","Qatar","Suiza"],
  C:["Brasil","Marruecos","Haití","Escocia"],
  D:["USA","Paraguay","Australia","Turquía"],
  E:["Alemania","Curazao","Costa de Marfil","Ecuador"],
  F:["Países Bajos","Japón","Suecia","Túnez"],
  G:["Bélgica","Egipto","Irán","Nueva Zelanda"],
  H:["España","Cabo Verde","Arabia Saudita","Uruguay"],
  I:["Francia","Senegal","Irak","Noruega"],
  J:["Argentina","Algeria","Austria","Jordania"],
  K:["Portugal","RD Congo","Uzbekistán","Colombia"],
  L:["Inglaterra","Croacia","Ghana","Panamá"],
};

const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([grp,teams])=>{
  const p=[];
  for(let i=0;i<teams.length;i++)
    for(let j=i+1;j<teams.length;j++)
      p.push({id:`G${grp}${i}${j}`,phase:"groups",group:grp,home:teams[i],away:teams[j]});
  return p;
});

const KNOCKOUT_ROUNDS=[
  {id:"R32_1",phase:"round32",label:"Ronda 32 · 1"},{id:"R32_2",phase:"round32",label:"Ronda 32 · 2"},
  {id:"R32_3",phase:"round32",label:"Ronda 32 · 3"},{id:"R32_4",phase:"round32",label:"Ronda 32 · 4"},
  {id:"R32_5",phase:"round32",label:"Ronda 32 · 5"},{id:"R32_6",phase:"round32",label:"Ronda 32 · 6"},
  {id:"R32_7",phase:"round32",label:"Ronda 32 · 7"},{id:"R32_8",phase:"round32",label:"Ronda 32 · 8"},
  {id:"R32_9",phase:"round32",label:"Ronda 32 · 9"},{id:"R32_10",phase:"round32",label:"Ronda 32 · 10"},
  {id:"R32_11",phase:"round32",label:"Ronda 32 · 11"},{id:"R32_12",phase:"round32",label:"Ronda 32 · 12"},
  {id:"R32_13",phase:"round32",label:"Ronda 32 · 13"},{id:"R32_14",phase:"round32",label:"Ronda 32 · 14"},
  {id:"R32_15",phase:"round32",label:"Ronda 32 · 15"},{id:"R32_16",phase:"round32",label:"Ronda 32 · 16"},
  {id:"R16_1",phase:"round16",label:"Octavos · 1"},{id:"R16_2",phase:"round16",label:"Octavos · 2"},
  {id:"R16_3",phase:"round16",label:"Octavos · 3"},{id:"R16_4",phase:"round16",label:"Octavos · 4"},
  {id:"R16_5",phase:"round16",label:"Octavos · 5"},{id:"R16_6",phase:"round16",label:"Octavos · 6"},
  {id:"R16_7",phase:"round16",label:"Octavos · 7"},{id:"R16_8",phase:"round16",label:"Octavos · 8"},
  {id:"QF1",phase:"quarters",label:"Cuartos · 1"},{id:"QF2",phase:"quarters",label:"Cuartos · 2"},
  {id:"QF3",phase:"quarters",label:"Cuartos · 3"},{id:"QF4",phase:"quarters",label:"Cuartos · 4"},
  {id:"SF1",phase:"semis",label:"Semifinal · 1"},{id:"SF2",phase:"semis",label:"Semifinal · 2"},
  {id:"3RD",phase:"third",label:"🥉 Tercer Lugar"},{id:"FINAL",phase:"final",label:"⚽ GRAN FINAL"},
];

const ALL_MATCHES=[...GROUP_MATCHES,...KNOCKOUT_ROUNDS];

const POINTS={
  groups:{exactScore:3,correctResult:1},
  round32:{exactScore:4,correctResult:2},
  round16:{exactScore:5,correctResult:3},
  quarters:{exactScore:6,correctResult:4},
  semis:{exactScore:7,correctResult:5},
  third:{exactScore:8,correctResult:6},
  final:{exactScore:10,correctResult:7},
};

function getResultWinner(h,a){return h>a?"H":a>h?"A":"D";}
function calcPoints(pred,actual,phase){
  if(!actual||actual.home===""||actual.away==="") return 0;
  const pts=POINTS[phase]||POINTS.groups;
  const pH=parseInt(pred?.home??-1),pA=parseInt(pred?.away??-1);
  const aH=parseInt(actual.home),aA=parseInt(actual.away);
  if(isNaN(pH)||isNaN(pA)) return 0;
  if(pH===aH&&pA===aA) return pts.exactScore;
  if(getResultWinner(pH,pA)===getResultWinner(aH,aA)) return pts.correctResult;
  return 0;
}

// ============================================================
// LIVE RESULTS via Claude API + Web Search
// ============================================================
async function fetchLiveResults(matchesToSearch){
  const matchList=matchesToSearch.map(m=>{
    const label=m.home&&m.away?`${m.home} vs ${m.away}`:m.label;
    return `- ${label} (ID: ${m.id})`;
  }).join("\n");
  const prompt=`Busca en la web los resultados más recientes de la Copa del Mundo FIFA 2026 (junio-julio 2026, sede: Canadá, México y Estados Unidos).
Necesito los marcadores finales de ESTOS partidos (si ya se jugaron):
${matchList}
Responde ÚNICAMENTE con un JSON válido, sin texto extra, sin backticks:
{"results":[{"id":"GA01","home":2,"away":1,"played":true},{"id":"GB12","home":0,"away":0,"played":false}],"lastUpdated":"2026-06-11T14:30:00Z","source":"nombre de la fuente"}
Si no se ha jugado pon played:false.`;
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",max_tokens:1200,
      tools:[{type:"web_search_20250305",name:"web_search"}],
      messages:[{role:"user",content:prompt}]
    })
  });
  const data=await response.json();
  const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function useNotifications(){
  const [notes,setNotes]=useState([]);
  const add=useCallback((msg,type="goal")=>{
    const id=Date.now();
    setNotes(n=>[{id,msg,type,...(type==="goal"?{emoji:"⚽"}:type==="result"?{emoji:"🏁"}:{emoji:"🔔"})},...n.slice(0,4)]);
    setTimeout(()=>setNotes(n=>n.filter(x=>x.id!==id)),6000);
  },[]);
  return {notes,add};
}

function NotificationStack({notes}){
  if(!notes.length) return null;
  return(
    <div style={{position:"fixed",top:80,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:10,maxWidth:320}}>
      {notes.map(n=>(
        <div key={n.id} style={{
          background:n.type==="goal"?"rgba(21,101,192,.97)":n.type==="result"?"rgba(27,94,32,.97)":"rgba(230,81,0,.97)",
          border:"1px solid rgba(255,255,255,.15)",borderRadius:12,padding:"12px 16px",
          backdropFilter:"blur(12px)",boxShadow:"0 8px 32px rgba(0,0,0,.5)",
          animation:"slideInRight .3s ease",display:"flex",alignItems:"flex-start",gap:10
        }}>
          <span style={{fontSize:24,flexShrink:0}}>{n.emoji}</span>
          <div style={{fontWeight:700,fontSize:14,color:"#fff",fontFamily:"'Oswald',sans-serif"}}>{n.msg}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// BALL LOGO SVG
// ============================================================
function BallLogo({size=48,id="main"}){
  return(
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="logo-ball"
      style={{filter:"drop-shadow(0 0 10px rgba(252,209,22,.5))"}}>
      <defs>
        <radialGradient id={`bg-${id}`} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FCD116"/>
          <stop offset="45%" stopColor="#003893"/>
          <stop offset="100%" stopColor="#CE1126"/>
        </radialGradient>
        <clipPath id={`cl-${id}`}><circle cx="24" cy="24" r="21"/></clipPath>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#bg-${id})`}/>
      <ellipse cx="24" cy="10" rx="16" ry="10" fill="#FCD116" opacity=".55" clipPath={`url(#cl-${id})`}/>
      <ellipse cx="24" cy="38" rx="16" ry="10" fill="#CE1126" opacity=".5" clipPath={`url(#cl-${id})`}/>
      <ellipse cx="17" cy="15" rx="5" ry="3" fill="#fff" opacity=".18" transform="rotate(-25,17,15)"/>
    </svg>
  );
}

// ============================================================
// BRACKET
// ============================================================
function BracketPage({results}){
  const getRes=(id)=>{const r=results[id];return(!r||r.home==="")?null:r;};
  const phases=[
    {label:"RONDA DE 32",ids:["R32_1","R32_2","R32_3","R32_4","R32_5","R32_6","R32_7","R32_8","R32_9","R32_10","R32_11","R32_12","R32_13","R32_14","R32_15","R32_16"]},
    {label:"OCTAVOS",ids:["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"]},
    {label:"CUARTOS",ids:["QF1","QF2","QF3","QF4"]},
    {label:"SEMIS",ids:["SF1","SF2"]},
    {label:"FINAL",ids:["FINAL"]},
  ];
  const groupSummary=Object.entries(GROUPS).map(([g,teams])=>{
    const ms=GROUP_MATCHES.filter(m=>m.group===g);
    const played=ms.filter(m=>{const r=results[m.id];return r&&r.home!==""}).length;
    return{group:g,teams,played,total:ms.length};
  });
  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>🏟️ Bracket del Torneo</h2>
      <div style={S.card}>
        <h3 style={S.cardTitle}>📊 Fase de Grupos — Resumen</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {groupSummary.map(({group,teams,played,total})=>(
            <div key={group} style={S.groupSummaryCard}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:"#4fc3f7",letterSpacing:1}}>GRUPO {group}</span>
                <span style={{fontSize:11,color:played===total?"#81c784":"#90a4ae"}}>{played}/{total}</span>
              </div>
              <div style={{height:4,background:"rgba(255,255,255,.05)",borderRadius:2,marginBottom:10}}>
                <div style={{height:4,background:"linear-gradient(90deg,#1e88e5,#81c784)",borderRadius:2,width:`${(played/total)*100}%`,transition:"width .5s"}}/>
              </div>
              {teams.map(t=>(
                <div key={t} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:"#1e88e5",flexShrink:0}}/>
                  <span style={{fontSize:13,color:"#b0bec5"}}>{t}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={S.cardTitle}>⚡ Fase Eliminatoria</h3>
        <div style={{overflowX:"auto",paddingBottom:8}}>
          <div style={{display:"flex",gap:0,minWidth:900,alignItems:"stretch"}}>
            {phases.map(phase=>(
              <div key={phase.label} style={{flex:1,display:"flex",flexDirection:"column"}}>
                <div style={{textAlign:"center",padding:"8px 4px",background:"rgba(21,101,192,.3)",borderBottom:"2px solid #1e88e5",marginBottom:12,fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#4fc3f7",textTransform:"uppercase"}}>{phase.label}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,padding:"0 4px",justifyContent:"space-around",flex:1}}>
                  {phase.ids.map(id=>{
                    const match=ALL_MATCHES.find(m=>m.id===id);
                    const res=getRes(id);
                    const hW=res&&parseInt(res.home)>parseInt(res.away);
                    const aW=res&&parseInt(res.away)>parseInt(res.home);
                    return(
                      <div key={id} style={{background:"rgba(255,255,255,.03)",border:"1px solid #1a2f4a",borderRadius:8,overflow:"hidden",position:"relative",minWidth:120}}>
                        <div style={{display:"flex",alignItems:"center",padding:"6px 8px",gap:4,background:hW?"rgba(129,199,132,.15)":"transparent",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                          <span style={{flex:1,fontSize:12,color:hW?"#81c784":"#b0bec5",fontWeight:hW?700:400}}>{match?.home||"TBD"}</span>
                          {res&&<span style={{fontWeight:900,color:hW?"#81c784":"#fff",fontSize:14}}>{res.home}</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",padding:"6px 8px",gap:4,background:aW?"rgba(129,199,132,.15)":"transparent"}}>
                          <span style={{flex:1,fontSize:12,color:aW?"#81c784":"#b0bec5",fontWeight:aW?700:400}}>{match?.away||"TBD"}</span>
                          {res&&<span style={{fontWeight:900,color:aW?"#81c784":"#fff",fontSize:14}}>{res.away}</span>}
                        </div>
                        {!res&&<div style={{position:"absolute",top:"50%",right:4,transform:"translateY(-50%)",fontSize:9,color:"#37474f"}}>PEND.</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {results["FINAL"]&&results["FINAL"].home!==""&&(
        <div style={S.championCard}>
          <div style={{fontSize:64,marginBottom:8}}>🏆</div>
          <div style={{fontSize:13,letterSpacing:3,color:"#f9a825",textTransform:"uppercase",marginBottom:4}}>Campeón del Mundo 2026</div>
          <div style={{fontSize:40,fontWeight:700,letterSpacing:2}}>
            {parseInt(results["FINAL"].home)>parseInt(results["FINAL"].away)
              ?ALL_MATCHES.find(m=>m.id==="FINAL")?.home||"—"
              :parseInt(results["FINAL"].away)>parseInt(results["FINAL"].home)
              ?ALL_MATCHES.find(m=>m.id==="FINAL")?.away||"—"
              :"Penales"}
          </div>
          <div style={{fontSize:20,color:"#90a4ae",marginTop:8}}>{results["FINAL"].home} – {results["FINAL"].away}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App(){
  // ── Firebase state ────────────────────────────────────────
  const [fbUser,setFbUser]=useState(undefined); // undefined = loading
  const [profile,setProfile]=useState(null);    // {name, isAdmin}
  const [results,setResults]=useState({});       // shared – realtime
  const [allProfiles,setAllProfiles]=useState({}); // {uid: {name}}
  const [myPreds,setMyPreds]=useState({});
  const [myGrpP,setMyGrpP]=useState({});
  const [myChamp,setMyChamp]=useState({});
  const [allScores,setAllScores]=useState([]);   // [{uid,name,score}]

  const [page,setPage]=useState("login");
  const [liveStatus,setLiveStatus]=useState(null);
  const prevResultsRef=useRef({});
  const {notes,add:addNote}=useNotifications();

  // ── Auth listener ─────────────────────────────────────────
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      setFbUser(user);
      if(user){
        const snap=await getDoc(doc(db,"users",user.uid));
        if(snap.exists()){
          setProfile(snap.data());
          setPage("dashboard");
        }
      } else {
        setProfile(null);
        setPage("login");
      }
    });
    return unsub;
  },[]);

  // ── Listen to shared results (realtime) ───────────────────
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"shared","results"),(snap)=>{
      if(snap.exists()) setResults(snap.data().matches||{});
    });
    return unsub;
  },[]);

  // ── Listen to my predictions (realtime) ──────────────────
  useEffect(()=>{
    if(!fbUser) return;
    const unsub=onSnapshot(doc(db,"predictions",fbUser.uid),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        setMyPreds(d.matches||{});
        setMyGrpP(d.groups||{});
        setMyChamp(d.champ||{});
      }
    });
    return unsub;
  },[fbUser]);

  // ── Load all profiles for ranking ────────────────────────
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"users"),(snap)=>{
      const profiles={};
      snap.forEach(d=>{ profiles[d.id]=d.data(); });
      setAllProfiles(profiles);
    });
    return unsub;
  },[]);

  // ── Load all predictions for ranking ─────────────────────
  useEffect(()=>{
    if(!Object.keys(allProfiles).length) return;
    const fetchScores=async()=>{
      const scores=[];
      for(const [uid,prof] of Object.entries(allProfiles)){
        const snap=await getDoc(doc(db,"predictions",uid));
        const preds=snap.exists()?(snap.data().matches||{}):{};
        let total=0;
        ALL_MATCHES.forEach(m=>{
          const actual=results[m.id];
          const pred=preds[m.id];
          if(actual&&pred) total+=calcPoints(pred,actual,m.phase);
        });
        scores.push({uid,name:prof.name,score:total,isAdmin:prof.isAdmin});
      }
      scores.sort((a,b)=>b.score-a.score);
      setAllScores(scores);
    };
    fetchScores();
  },[allProfiles,results]);

  // ── Notifications on new results ─────────────────────────
  useEffect(()=>{
    const prev=prevResultsRef.current;
    Object.entries(results).forEach(([id,r])=>{
      if(!r||r.home===""||r.away==="") return;
      const old=prev[id];
      if(!old||(old.home!==r.home||old.away!==r.away)){
        const m=ALL_MATCHES.find(x=>x.id===id);
        const label=m?.home&&m?.away?`${m.home} vs ${m.away}`:m?.label||id;
        if(m?.phase==="final") addNote(`🏆 FINAL: ${label} · ${r.home}–${r.away}`,"result");
        else if(["semis","quarters"].includes(m?.phase)) addNote(`🏁 ${label} · ${r.home}–${r.away}`,"result");
        else addNote(`⚽ ${label} · ${r.home}–${r.away}`,"goal");
      }
    });
    prevResultsRef.current={...results};
  },[results]);

  // ── Auto-refresh live ─────────────────────────────────────
  const refreshLive=useCallback(async()=>{
    setLiveStatus(s=>({...s,loading:true,error:null}));
    try{
      const data=await fetchLiveResults(GROUP_MATCHES.slice(0,20));
      if(data?.results){
        const nr={...results};
        let updated=0;
        data.results.forEach(r=>{
          if(r.played&&r.home!==undefined&&r.away!==undefined){
            nr[r.id]={home:String(r.home),away:String(r.away)};updated++;
          }
        });
        await setDoc(doc(db,"shared","results"),{matches:nr,updatedAt:serverTimestamp()},{merge:true});
        setLiveStatus({loading:false,lastUpdated:data.lastUpdated||new Date().toISOString(),source:data.source||"Web",updated,error:null});
      }
    }catch(e){
      setLiveStatus(s=>({...s,loading:false,error:"Sin conexión — reintentando..."}));
    }
  },[results]);

  useEffect(()=>{
    if(!fbUser) return;
    refreshLive();
    const t=setInterval(refreshLive,5*60*1000);
    return()=>clearInterval(t);
  },[fbUser]);

  // ── Auth actions ──────────────────────────────────────────
  const [authForm,setAuthForm]=useState({email:"",password:"",name:""});
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);

  async function register(){
    const {email,password,name}=authForm;
    if(!email||!password||!name){setAuthError("Completa todos los campos");return;}
    if(password.length<6){setAuthError("La contraseña debe tener al menos 6 caracteres");return;}
    setAuthLoading(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      await setDoc(doc(db,"users",cred.user.uid),{
        name,email,isAdmin:false,createdAt:serverTimestamp()
      });
      setProfile({name,isAdmin:false});
      addNote(`Bienvenido, ${name}! 🎉`,"info");
      setPage("predict");
    }catch(e){
      setAuthError(e.code==="auth/email-already-in-use"?"Este correo ya está registrado":e.message);
    }
    setAuthLoading(false);
  }

  async function login(){
    const {email,password}=authForm;
    if(!email||!password){setAuthError("Ingresa tu correo y contraseña");return;}
    setAuthLoading(true);
    try{
      await signInWithEmailAndPassword(auth,email,password);
      // onAuthStateChanged handles the rest
    }catch(e){
      setAuthError(e.code==="auth/invalid-credential"?"Correo o contraseña incorrectos":e.message);
    }
    setAuthLoading(false);
  }

  async function logout(){
    await signOut(auth);
    setMyPreds({});setMyGrpP({});setMyChamp({});
    setPage("login");
  }

  // ── Save predictions ──────────────────────────────────────
  async function savePrediction(id,h,a){
    const updated={...myPreds,[id]:{home:h,away:a}};
    setMyPreds(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{matches:updated},{merge:true});
  }
  async function saveGroupRank(grp,ranks){
    const updated={...myGrpP,[grp]:ranks};
    setMyGrpP(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{groups:updated},{merge:true});
  }
  async function saveChampPrediction(field,value){
    const updated={...myChamp,[field]:value};
    setMyChamp(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{champ:updated},{merge:true});
  }

  // ── Admin: save result ────────────────────────────────────
  async function saveResult(id,h,a){
    const updated={...results,[id]:{home:h,away:a}};
    await setDoc(doc(db,"shared","results"),{matches:updated,updatedAt:serverTimestamp()},{merge:true});
    const m=ALL_MATCHES.find(x=>x.id===id);
    const label=m?.home&&m?.away?`${m.home} ${h}–${a} ${m.away}`:m?.label||id;
    addNote(`✅ Resultado: ${label}`,"result");
  }

  const isAdmin=profile?.isAdmin;
  const myPos=(allScores.findIndex(s=>s.uid===fbUser?.uid))+1;
  const myScore=allScores.find(s=>s.uid===fbUser?.uid)?.score||0;
  const totalPlayed=Object.values(results).filter(r=>r&&r.home!=="").length;

  const navItems=fbUser?[
    {key:"dashboard",label:"🏠 Inicio"},
    {key:"predict",label:"🎯 Pronósticos"},
    {key:"live",label:"📡 En Vivo"},
    {key:"bracket",label:"🏟️ Bracket"},
    {key:"ranking",label:"🏆 Ranking"},
    ...(isAdmin?[{key:"admin",label:"⚙️ Admin"}]:[]),
  ]:[];

  // Loading spinner while Firebase initializes
  if(fbUser===undefined){
    return(
      <div style={{...S.root,display:"flex",justifyContent:"center",alignItems:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center"}}>
          <BallLogo size={80} id="load"/>
          <div style={{marginTop:16,color:"#f9a825",fontSize:14,letterSpacing:2}}>CARGANDO...</div>
        </div>
      </div>
    );
  }

  return(
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:5px;background:#080c16;}
        ::-webkit-scrollbar-thumb{background:#1a2f4a;border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 10px rgba(249,168,37,.2)}50%{box-shadow:0 0 30px rgba(249,168,37,.6)}}
        @keyframes slowspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .logo-ball{animation:slowspin 8s linear infinite;}
        .navBtn:hover{border-color:rgba(255,255,255,.2)!important;color:#fff!important;}
        .scoreIn:focus{border-color:#1e88e5!important;box-shadow:0 0 0 2px rgba(30,136,229,.3);}
      `}</style>

      <NotificationStack notes={notes}/>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <div style={{position:"relative",flexShrink:0}}>
              <BallLogo size={44} id="hdr"/>
              {liveStatus?.loading&&<span style={{position:"absolute",top:-2,right:-2,width:10,height:10,background:"#FCD116",borderRadius:"50%",animation:"pulse 1s infinite"}}/>}
            </div>
            <div>
              <div style={S.logoText}>GRAN POLLA <span style={{color:"#f9a825"}}>MUNDIALISTA 2026</span></div>
              <div style={S.logoSub}>CANADÁ · MÉXICO · ESTADOS UNIDOS</div>
            </div>
          </div>
          <nav style={S.nav}>
            {navItems.map(n=>(
              <button key={n.key} className="navBtn" onClick={()=>setPage(n.key)}
                style={{...S.navBtn,...(page===n.key?S.navActive:{})}}>
                {n.label}
              </button>
            ))}
            {fbUser&&<button onClick={logout} style={S.logoutBtn}>Salir</button>}
          </nav>
        </div>
      </header>

      <main style={S.main}>
        {/* LOGIN */}
        {page==="login"&&(
          <div style={S.authWrap}>
            <div style={S.authCard}>
              <div style={{textAlign:"center",marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
                  <BallLogo size={84} id="login"/>
                </div>
                <h1 style={S.authTitle}>GRAN POLLA<br/><span style={{color:"#f9a825"}}>MUNDIALISTA 2026</span></h1>
                <p style={S.authSub}>Canadá · México · Estados Unidos</p>
                <p style={S.authDesc}>La gran POLLA MUNDIALISTA, diversión para la familia y los amigos — ¡inscríbete y participa!</p>
              </div>
              {authError&&<div style={S.errorBox}>{authError}</div>}
              <input className="scoreIn" style={S.input} placeholder="Correo electrónico" type="email" value={authForm.email}
                onChange={e=>{setAuthForm(f=>({...f,email:e.target.value}));setAuthError("");}}/>
              <input className="scoreIn" style={S.input} type="password" placeholder="Contraseña" value={authForm.password}
                onChange={e=>{setAuthForm(f=>({...f,password:e.target.value}));setAuthError("");}}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
              <button style={{...S.btnPrimary,...(authLoading?{opacity:.6}:{})}} onClick={login} disabled={authLoading}>
                {authLoading?"ENTRANDO...":"ENTRAR AL TORNEO"}
              </button>
              <p style={{textAlign:"center",color:"#546e7a",fontSize:13}}>
                ¿Sin cuenta? <span style={S.link} onClick={()=>{setPage("register");setAuthError("");}}>Regístrate gratis</span>
              </p>
            </div>
          </div>
        )}

        {/* REGISTER */}
        {page==="register"&&(
          <div style={S.authWrap}>
            <div style={S.authCard}>
              <div style={{textAlign:"center",marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                  <BallLogo size={64} id="reg"/>
                </div>
                <h1 style={S.authTitle}>CREAR CUENTA</h1>
                <p style={S.authSub}>Únete a la Gran Polla Mundialista</p>
              </div>
              {authError&&<div style={S.errorBox}>{authError}</div>}
              <input className="scoreIn" style={S.input} placeholder="Nombre completo" value={authForm.name}
                onChange={e=>{setAuthForm(f=>({...f,name:e.target.value}));setAuthError("");}}/>
              <input className="scoreIn" style={S.input} type="email" placeholder="Correo electrónico" value={authForm.email}
                onChange={e=>{setAuthForm(f=>({...f,email:e.target.value}));setAuthError("");}}/>
              <input className="scoreIn" style={S.input} type="password" placeholder="Contraseña (mín. 6 caracteres)" value={authForm.password}
                onChange={e=>{setAuthForm(f=>({...f,password:e.target.value}));setAuthError("");}}/>
              <button style={{...S.btnPrimary,...(authLoading?{opacity:.6}:{})}} onClick={register} disabled={authLoading}>
                {authLoading?"REGISTRANDO...":"REGISTRARME"}
              </button>
              <p style={{textAlign:"center",color:"#546e7a",fontSize:13}}>
                ¿Ya tienes cuenta? <span style={S.link} onClick={()=>{setPage("login");setAuthError("");}}>Inicia sesión</span>
              </p>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {page==="dashboard"&&fbUser&&(
          <div style={S.section}>
            <div style={S.heroCard}>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{color:"#546e7a",fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Bienvenido de vuelta</div>
                <div style={{fontSize:38,fontWeight:700,letterSpacing:2,marginBottom:20}}>{profile?.name}</div>
                <div style={{display:"flex",gap:28,flexWrap:"wrap",alignItems:"center"}}>
                  <div><div style={{fontSize:38,fontWeight:700,color:"#f9a825",lineHeight:1}}>{myPos||"—"}</div><div style={{fontSize:11,color:"#546e7a",letterSpacing:.5,textTransform:"uppercase"}}>/ {allScores.length} posición</div></div>
                  <div style={{width:1,height:44,background:"#1a2f4a"}}/>
                  <div><div style={{fontSize:38,fontWeight:700,color:"#4fc3f7",lineHeight:1}}>{myScore}</div><div style={{fontSize:11,color:"#546e7a",letterSpacing:.5,textTransform:"uppercase"}}>puntos</div></div>
                  <div style={{width:1,height:44,background:"#1a2f4a"}}/>
                  <div><div style={{fontSize:38,fontWeight:700,color:"#81c784",lineHeight:1}}>{totalPlayed}</div><div style={{fontSize:11,color:"#546e7a",letterSpacing:.5,textTransform:"uppercase"}}>partidos jugados</div></div>
                </div>
              </div>
              <div style={{fontSize:120,opacity:.06,position:"absolute",right:-10,bottom:-20,lineHeight:1}}>🏆</div>
            </div>
            <div style={{...S.card,background:"rgba(21,101,192,.12)",border:"1px solid rgba(30,136,229,.25)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"14px 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{liveStatus?.loading?"⏳":"📡"}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#e3f2fd"}}>
                    {liveStatus?.loading?"Actualizando...":liveStatus?.error?`⚠️ ${liveStatus.error}`:`✅ ${liveStatus?.source||"—"}`}
                  </div>
                  {liveStatus?.lastUpdated&&!liveStatus.loading&&(
                    <div style={{fontSize:12,color:"#546e7a"}}>{new Date(liveStatus.lastUpdated).toLocaleString("es-CO")} · {liveStatus.updated||0} partidos</div>
                  )}
                </div>
              </div>
              <button style={S.refreshBtn} onClick={refreshLive} disabled={liveStatus?.loading}>🔄 Actualizar</button>
            </div>
            <div style={S.card}>
              <h3 style={S.cardTitle}>📋 Sistema de Puntuación</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                {[["Resultado exacto — Grupos","3 pts","#81c784"],["Resultado correcto — Grupos","1 pt","#aed581"],["Exacto — Ronda 32","4 pts","#4fc3f7"],["Exacto — Octavos","5 pts","#4dd0e1"],["Exacto — Cuartos","6 pts","#f9a825"],["Exacto — Semis","7 pts","#ffa726"],["Exacto — Final","10 pts","#ef5350"],["1° posición grupo","6 pts","#f9a825"],["2° posición grupo","4 pts","#bdbdbd"],["3° posición grupo","2 pts","#a1887f"],["Acertar campeón","15 pts","#f9a825"],["Acertar subcampeón","10 pts","#bdbdbd"]].map(([k,v,c])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"rgba(255,255,255,.02)",borderRadius:6}}>
                    <span style={{color:"#78909c",fontSize:13}}>{k}</span>
                    <span style={{color:c,fontWeight:800,fontSize:14}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <button style={S.btnPrimary} onClick={()=>setPage("predict")}>🎯 IR A MIS PRONÓSTICOS</button>
          </div>
        )}

        {/* PREDICT */}
        {page==="predict"&&fbUser&&(
          <PredictPage results={results} myPreds={myPreds} myGrpP={myGrpP} myChamp={myChamp}
            savePrediction={savePrediction} saveGroupRank={saveGroupRank} saveChampPrediction={saveChampPrediction}/>
        )}

        {/* LIVE */}
        {page==="live"&&fbUser&&(
          <LivePage results={results} refreshLive={refreshLive} liveStatus={liveStatus} saveResult={saveResult} addNote={addNote}/>
        )}

        {/* BRACKET */}
        {page==="bracket"&&<BracketPage results={results}/>}

        {/* RANKING */}
        {page==="ranking"&&(
          <div style={S.section}>
            <h2 style={S.sectionTitle}>🏆 Ranking en Tiempo Real</h2>
            {allScores.length===0&&<p style={{color:"#37474f"}}>Sin participantes aún.</p>}
            <div style={{background:"#131d2e",borderRadius:12,overflow:"hidden",border:"1px solid #1a2f4a"}}>
              <div style={{display:"flex",padding:"10px 20px",background:"rgba(255,255,255,.04)",fontSize:11,fontWeight:700,color:"#546e7a",letterSpacing:1.5,textTransform:"uppercase",borderBottom:"2px solid rgba(255,255,255,.06)"}}>
                <span style={{width:60,textAlign:"center"}}>POS</span><span style={{flex:1}}>JUGADOR</span><span style={{width:100,textAlign:"right"}}>PUNTOS</span>
              </div>
              {allScores.map((r,i)=>(
                <div key={r.uid} style={{display:"flex",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,.04)",background:r.uid===fbUser?.uid?"rgba(249,168,37,.07)":"transparent",borderLeft:r.uid===fbUser?.uid?"3px solid #f9a825":"3px solid transparent"}}>
                  <span style={{width:60,textAlign:"center",fontSize:24}}>{["🥇","🥈","🥉"][i]||`#${i+1}`}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:i<3?800:500,fontSize:16}}>{r.name}</div>
                    {r.uid===fbUser?.uid&&<div style={{fontSize:10,color:"#f9a825",letterSpacing:1}}>▶ TÚ</div>}
                  </div>
                  <span style={{width:100,textAlign:"right",fontSize:26,fontWeight:900,color:i===0?"#f9a825":i===1?"#bdbdbd":i===2?"#a1887f":"#e0e0e0"}}>{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN */}
        {page==="admin"&&isAdmin&&(
          <AdminPage results={results} saveResult={saveResult}/>
        )}
      </main>
    </div>
  );
}

// ============================================================
// PREDICT PAGE
// ============================================================
function PredictPage({results,myPreds,myGrpP,myChamp,savePrediction,saveGroupRank,saveChampPrediction}){
  const [tab,setTab]=useState("groups");
  const [selGrp,setSelGrp]=useState("A");
  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>🎯 Mis Pronósticos</h2>
      <div style={S.tabRow}>
        {[{key:"groups",label:"📊 Grupos"},{key:"knockouts",label:"⚡ Eliminatorias"},{key:"champion",label:"🏆 Campeón"}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{...S.tab,...(tab===t.key?S.tabActive:{})}}>{t.label}</button>
        ))}
      </div>
      {tab==="groups"&&(
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} onClick={()=>setSelGrp(g)} style={{...S.groupTab,...(selGrp===g?S.groupTabActive:{})}}>{g}</button>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={S.cardTitle}>Grupo {selGrp}</h3>
            {GROUP_MATCHES.filter(m=>m.group===selGrp).map(m=>(
              <MatchRow key={m.id} match={m} pred={myPreds[m.id]} result={results[m.id]} savePrediction={savePrediction}/>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={S.cardTitle}>Clasificación Grupo {selGrp}</h3>
            {[0,1,2,3].map(pos=>{
              const grpRank=myGrpP[selGrp]||["","","",""];
              return(
                <div key={pos} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <span style={{fontSize:22,minWidth:36,textAlign:"center"}}>{["🥇","🥈","🥉","4°"][pos]}</span>
                  <select style={S.select} value={grpRank[pos]||""}
                    onChange={e=>{const u=[...(myGrpP[selGrp]||["","","",""])];u[pos]=e.target.value;saveGroupRank(selGrp,u);}}>
                    <option value="">— Seleccionar equipo —</option>
                    {GROUPS[selGrp].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab==="knockouts"&&(
        <div>
          {[{key:"round32",label:"Ronda de 32"},{key:"round16",label:"Octavos"},{key:"quarters",label:"Cuartos"},{key:"semis",label:"Semifinales"},{key:"third",label:"Tercer Lugar"},{key:"final",label:"⚽ Gran Final"}].map(ph=>{
            const ms=KNOCKOUT_ROUNDS.filter(r=>r.phase===ph.key);
            return(
              <div key={ph.key} style={S.card}>
                <h3 style={S.cardTitle}>{ph.label}</h3>
                {ms.map(m=><MatchRow key={m.id} match={m} pred={myPreds[m.id]} result={results[m.id]} savePrediction={savePrediction}/>)}
              </div>
            );
          })}
        </div>
      )}
      {tab==="champion"&&(
        <div style={S.card}>
          <h3 style={S.cardTitle}>🏆 Predicción del Campeón</h3>
          {[{key:"champion",label:"🥇 Campeón",pts:"15 pts"},{key:"runnerUp",label:"🥈 Subcampeón",pts:"10 pts"},{key:"third",label:"🥉 Tercer Lugar",pts:"7 pts"},{key:"fourth",label:"4° Lugar",pts:"5 pts"}].map(f=>(
            <div key={f.key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <span style={{minWidth:160,fontWeight:700,fontSize:15}}>{f.label}</span>
              <select style={S.select} value={myChamp[f.key]||""} onChange={e=>saveChampPrediction(f.key,e.target.value)}>
                <option value="">— Seleccionar —</option>
                {Object.values(GROUPS).flat().map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{color:"#f9a825",fontWeight:800,whiteSpace:"nowrap"}}>{f.pts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({match,pred,result,savePrediction}){
  const [h,setH]=useState(pred?.home??"");
  const [a,setA]=useState(pred?.away??"");
  useEffect(()=>{setH(pred?.home??"");setA(pred?.away??"");},[pred]);
  const scored=result&&result.home!==""&&result.away!=="";
  const pts=scored?calcPoints(pred,result,match.phase):null;
  const maxPts=scored?(POINTS[match.phase]?.exactScore||3):null;
  const label=match.label||(match.home&&match.away?`${match.home} vs ${match.away}`:"");
  function onBlur(){if(h!==""&&a!=="") savePrediction(match.id,h,a);}
  return(
    <div style={{...S.matchRow,background:scored?(pts===maxPts?"rgba(129,199,132,.08)":pts>0?"rgba(249,168,37,.07)":"rgba(239,83,80,.06)"):"transparent"}}>
      <span style={{flex:1,fontSize:14,fontWeight:600,minWidth:140,color:"#cfd8dc"}}>{label}</span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <input className="scoreIn" style={S.scoreIn} type="number" min="0" max="20" value={h} onChange={e=>setH(e.target.value)} onBlur={onBlur} placeholder="—"/>
        <span style={{color:"#f9a825",fontWeight:900,fontSize:22,lineHeight:1}}>:</span>
        <input className="scoreIn" style={S.scoreIn} type="number" min="0" max="20" value={a} onChange={e=>setA(e.target.value)} onBlur={onBlur} placeholder="—"/>
      </div>
      {scored&&(
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
          <span style={{color:"#37474f"}}>Real:</span>
          <span style={{fontWeight:800,color:"#eceff1"}}>{result.home}–{result.away}</span>
          <span style={{background:pts===maxPts?"#1b5e20":pts>0?"#e65100":"#b71c1c",color:"#fff",padding:"2px 8px",borderRadius:4,fontWeight:800,fontSize:12}}>+{pts}pts</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LIVE PAGE
// ============================================================
function LivePage({results,refreshLive,liveStatus,saveResult,addNote}){
  const [searching,setSearching]=useState(false);
  const [phase,setPhase]=useState("groups");
  const [group,setGroup]=useState("A");
  const [aiResp,setAiResp]=useState(null);
  const [aiError,setAiError]=useState(null);

  async function searchNow(){
    setSearching(true);setAiError(null);setAiResp(null);
    try{
      const matches=phase==="groups"?GROUP_MATCHES.filter(m=>m.group===group):KNOCKOUT_ROUNDS.filter(m=>m.phase===phase);
      const data=await fetchLiveResults(matches);
      setAiResp(data);
      if(data?.results){
        let cnt=0;
        for(const r of data.results){
          if(r.played&&r.home!==undefined&&r.away!==undefined){
            await saveResult(r.id,String(r.home),String(r.away));cnt++;
          }
        }
        if(cnt>0) addNote(`📡 ${cnt} resultados actualizados`,"result");
      }
    }catch(e){setAiError("Error: "+e.message);}
    setSearching(false);
  }

  const played=Object.entries(results).filter(([,v])=>v&&v.home!=="").map(([id,v])=>{
    const m=ALL_MATCHES.find(x=>x.id===id);
    return{id,label:m?.label||(m?.home&&m?.away?`${m.home} vs ${m.away}`:id),home:v.home,away:v.away,phase:m?.phase};
  });

  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>📡 Resultados en Vivo</h2>
      <div style={S.card}>
        <h3 style={S.cardTitle}>🔍 Buscar por Fase</h3>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {[{key:"groups",label:"Grupos"},{key:"round32",label:"Ronda 32"},{key:"round16",label:"Octavos"},{key:"quarters",label:"Cuartos"},{key:"semis",label:"Semis"},{key:"final",label:"Final"}].map(p=>(
            <button key={p.key} onClick={()=>setPhase(p.key)} style={{...S.tab,...(phase===p.key?S.tabActive:{})}}>{p.label}</button>
          ))}
        </div>
        {phase==="groups"&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} onClick={()=>setGroup(g)} style={{...S.groupTab,...(group===g?S.groupTabActive:{})}}>{g}</button>
            ))}
          </div>
        )}
        <button style={{...S.btnPrimary,...(searching?{opacity:.6,cursor:"not-allowed"}:{})}} onClick={searchNow} disabled={searching}>
          {searching?"⏳ Consultando la web...":"🌐 Buscar Resultados Ahora"}
        </button>
        {aiError&&<div style={{...S.errorBox,marginTop:10}}>{aiError}</div>}
        {aiResp&&(
          <div style={{marginTop:14,background:"rgba(0,0,0,.25)",borderRadius:8,padding:12}}>
            <div style={{color:"#81c784",fontWeight:700,marginBottom:8,fontSize:13}}>✅ Fuente: {aiResp.source} · {aiResp.results?.filter(r=>r.played).length||0} partidos</div>
            {aiResp.results?.map(r=>{
              const m=ALL_MATCHES.find(x=>x.id===r.id);
              return(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:13}}>
                  <span style={{color:"#78909c"}}>{m?.label||(m?.home&&m?.away?`${m.home} vs ${m.away}`:r.id)}</span>
                  <span style={{fontWeight:700,color:r.played?"#f9a825":"#37474f"}}>{r.played?`${r.home} – ${r.away}`:"Pendiente"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={S.card}>
        <h3 style={S.cardTitle}>📋 Resultados Registrados ({played.length})</h3>
        {played.length===0&&<p style={{color:"#37474f",fontSize:13}}>Sin resultados aún.</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
          {played.map(m=>(
            <div key={m.id} style={{background:"rgba(255,255,255,.03)",border:"1px solid #1a2f4a",borderRadius:8,padding:"10px 12px",display:"flex",flexDirection:"column",gap:4}}>
              <span style={{color:"#546e7a",fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{m.phase}</span>
              <span style={{fontSize:13,fontWeight:600,color:"#b0bec5"}}>{m.label}</span>
              <span style={{color:"#f9a825",fontWeight:900,fontSize:18}}>{m.home} – {m.away}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================
function AdminPage({results,saveResult}){
  const [phase,setPhase]=useState("groups");
  const [selGrp,setSelGrp]=useState("A");
  const phases=[{key:"groups",label:"Grupos"},{key:"round32",label:"Ronda 32"},{key:"round16",label:"Octavos"},{key:"quarters",label:"Cuartos"},{key:"semis",label:"Semis"},{key:"third",label:"3er Lugar"},{key:"final",label:"Final"}];
  const matches=phase==="groups"?GROUP_MATCHES.filter(m=>m.group===selGrp):KNOCKOUT_ROUNDS.filter(m=>m.phase===phase);
  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>⚙️ Panel Admin</h2>
      <div style={S.tabRow}>
        {phases.map(p=><button key={p.key} onClick={()=>setPhase(p.key)} style={{...S.tab,...(phase===p.key?S.tabActive:{})}}>{p.label}</button>)}
      </div>
      {phase==="groups"&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {Object.keys(GROUPS).map(g=><button key={g} onClick={()=>setSelGrp(g)} style={{...S.groupTab,...(selGrp===g?S.groupTabActive:{})}}>{g}</button>)}
        </div>
      )}
      <div style={S.card}>
        {matches.map(m=>{
          const res=results[m.id];
          const [h,setH]=useState(res?.home??"");
          const [a,setA]=useState(res?.away??"");
          const saved=res&&res.home!=="";
          const label=m.label||(m.home&&m.away?`${m.home} vs ${m.away}`:"");
          return(
            <div key={m.id} style={{...S.matchRow,...(saved?{borderLeft:"3px solid #81c784",paddingLeft:10}:{})}}>
              <span style={{flex:1,fontSize:14,fontWeight:600,color:"#cfd8dc",minWidth:140}}>{label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input className="scoreIn" style={S.scoreIn} type="number" min="0" max="20" value={h} onChange={e=>setH(e.target.value)} placeholder="—"/>
                <span style={{color:"#f9a825",fontWeight:900,fontSize:22}}>:</span>
                <input className="scoreIn" style={S.scoreIn} type="number" min="0" max="20" value={a} onChange={e=>setA(e.target.value)} placeholder="—"/>
                <button style={{background:"#1b5e20",border:"none",borderRadius:6,padding:"7px 14px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}
                  onClick={()=>{if(h!==""&&a!=="")saveResult(m.id,h,a);}}>✓ Guardar</button>
              </div>
              {saved&&<span style={{color:"#81c784",fontSize:12}}>✓ {res.home}–{res.away}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const S={
  root:{minHeight:"100vh",background:"linear-gradient(160deg,#080c16 0%,#0c1524 60%,#081020 100%)",color:"#e8eaf6",fontFamily:"'Oswald','Barlow Condensed','Arial Narrow',sans-serif"},
  header:{background:"rgba(8,12,22,.97)",borderBottom:"2px solid #f9a825",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)"},
  headerInner:{maxWidth:1280,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64,gap:16},
  logo:{display:"flex",alignItems:"center",gap:12},
  logoText:{fontSize:18,fontWeight:700,letterSpacing:2,color:"#fff",textTransform:"uppercase",lineHeight:1.1},
  logoSub:{fontSize:9,color:"#546e7a",letterSpacing:2,textTransform:"uppercase"},
  nav:{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"},
  navBtn:{background:"transparent",border:"1px solid transparent",color:"#546e7a",padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,letterSpacing:.5,fontFamily:"inherit",transition:"all .15s"},
  navActive:{borderColor:"#f9a825",color:"#f9a825",background:"rgba(249,168,37,.1)"},
  logoutBtn:{background:"transparent",border:"1px solid #ef5350",color:"#ef5350",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"},
  main:{maxWidth:1280,margin:"0 auto",padding:"28px 16px 80px"},
  section:{animation:"slideIn .3s ease"},
  sectionTitle:{fontSize:24,fontWeight:700,marginBottom:22,letterSpacing:1,textTransform:"uppercase",borderBottom:"1px solid #1a2f4a",paddingBottom:10},
  card:{background:"#131d2e",borderRadius:12,padding:20,marginBottom:16,border:"1px solid #1a2f4a"},
  cardTitle:{fontSize:15,fontWeight:700,color:"#f9a825",marginBottom:14,textTransform:"uppercase",letterSpacing:.5},
  heroCard:{background:"linear-gradient(135deg,#0d2137 0%,#1a3a5c 100%)",borderRadius:16,padding:"28px 32px",marginBottom:16,border:"1px solid #1a2f4a",position:"relative",overflow:"hidden"},
  authWrap:{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"75vh"},
  authCard:{background:"#131d2e",border:"1px solid #1a2f4a",borderRadius:16,padding:40,width:"100%",maxWidth:460,display:"flex",flexDirection:"column",gap:14},
  authTitle:{fontSize:24,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"#fff",marginBottom:4,lineHeight:1.2},
  authSub:{color:"#546e7a",fontSize:13,letterSpacing:1},
  authDesc:{color:"#78909c",fontSize:12,lineHeight:1.6,marginTop:10,padding:"10px 14px",background:"rgba(249,168,37,.05)",borderLeft:"2px solid #f9a825",borderRadius:"0 6px 6px 0",textAlign:"left"},
  errorBox:{background:"rgba(239,83,80,.12)",border:"1px solid #ef5350",borderRadius:8,padding:"8px 12px",color:"#ef5350",fontSize:13},
  input:{background:"#0a1220",border:"1px solid #1a2f4a",borderRadius:8,padding:"10px 14px",color:"#e8eaf6",fontSize:15,outline:"none",width:"100%",fontFamily:"inherit"},
  btnPrimary:{background:"linear-gradient(135deg,#1565c0,#1e88e5)",color:"#fff",border:"none",borderRadius:8,padding:"12px 24px",fontWeight:700,fontSize:15,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",fontFamily:"inherit",width:"100%",display:"block"},
  link:{color:"#1e88e5",cursor:"pointer",fontWeight:700},
  tabRow:{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"},
  tab:{background:"transparent",border:"1px solid #1a2f4a",color:"#546e7a",padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",letterSpacing:.5,transition:"all .15s"},
  tabActive:{background:"#1565c0",borderColor:"#1565c0",color:"#fff"},
  groupTab:{background:"transparent",border:"1px solid #1a2f4a",color:"#546e7a",padding:"5px 13px",borderRadius:6,cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"inherit"},
  groupTabActive:{background:"#f9a825",borderColor:"#f9a825",color:"#000"},
  matchRow:{display:"flex",alignItems:"center",gap:12,padding:"9px 8px",borderRadius:6,marginBottom:3,flexWrap:"wrap",transition:"background .2s"},
  scoreIn:{width:50,background:"#0a1220",border:"1px solid #1a2f4a",borderRadius:6,padding:"6px 6px",color:"#fff",fontSize:20,fontWeight:700,textAlign:"center",outline:"none",fontFamily:"inherit"},
  select:{background:"#0a1220",border:"1px solid #1a2f4a",borderRadius:8,padding:"8px 12px",color:"#e8eaf6",fontSize:14,outline:"none",flex:1,fontFamily:"inherit"},
  refreshBtn:{background:"#1e88e5",border:"none",borderRadius:6,padding:"8px 16px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  groupSummaryCard:{background:"rgba(255,255,255,.02)",border:"1px solid #1a2f4a",borderRadius:10,padding:12},
  championCard:{background:"linear-gradient(135deg,#1a2f00,#2e5800)",border:"2px solid #f9a825",borderRadius:16,padding:"40px 24px",textAlign:"center",marginTop:20,animation:"glow 2s infinite"},
};
