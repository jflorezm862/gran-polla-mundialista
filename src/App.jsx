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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

// Horarios en hora Colombia (COL = ET - 1h)
const GROUP_MATCHES = [
  // GRUPO A
  {id:"GA01",phase:"groups",group:"A",home:"México",away:"Sudáfrica",        date:"Jue 11 Jun",time:"2:00 PM",city:"Ciudad de México"},
  {id:"GA23",phase:"groups",group:"A",home:"Rep. de Corea",away:"Rep. Checa",date:"Jue 11 Jun",time:"9:00 PM",city:"Zapopan"},
  {id:"GA02",phase:"groups",group:"A",home:"Rep. Checa",away:"Sudáfrica",    date:"Mié 18 Jun",time:"11:00 AM",city:"Atlanta"},
  {id:"GA13",phase:"groups",group:"A",home:"México",away:"Rep. de Corea",    date:"Mié 18 Jun",time:"8:00 PM",city:"Zapopan"},
  {id:"GA03",phase:"groups",group:"A",home:"Rep. Checa",away:"México",       date:"Mar 24 Jun",time:"8:00 PM",city:"Ciudad de México"},
  {id:"GA12",phase:"groups",group:"A",home:"Sudáfrica",away:"Rep. de Corea", date:"Mar 24 Jun",time:"8:00 PM",city:"Monterrey"},
  // GRUPO B
  {id:"GB01",phase:"groups",group:"B",home:"Canadá",away:"Bosnia H.",        date:"Vie 12 Jun",time:"2:00 PM",city:"Toronto"},
  {id:"GB23",phase:"groups",group:"B",home:"Qatar",away:"Suiza",             date:"Sáb 13 Jun",time:"2:00 PM",city:"Santa Clara"},
  {id:"GB13",phase:"groups",group:"B",home:"Suiza",away:"Bosnia H.",         date:"Mié 18 Jun",time:"2:00 PM",city:"Inglewood"},
  {id:"GB02",phase:"groups",group:"B",home:"Canadá",away:"Qatar",            date:"Mié 18 Jun",time:"5:00 PM",city:"Vancouver"},
  {id:"GB12",phase:"groups",group:"B",home:"Suiza",away:"Canadá",            date:"Mar 24 Jun",time:"2:00 PM",city:"Vancouver"},
  {id:"GB03",phase:"groups",group:"B",home:"Bosnia H.",away:"Qatar",         date:"Mar 24 Jun",time:"2:00 PM",city:"Seattle"},
  // GRUPO C
  {id:"GC01",phase:"groups",group:"C",home:"Brasil",away:"Marruecos",        date:"Sáb 13 Jun",time:"5:00 PM",city:"East Rutherford"},
  {id:"GC23",phase:"groups",group:"C",home:"Haití",away:"Escocia",           date:"Sáb 13 Jun",time:"8:00 PM",city:"Foxborough"},
  {id:"GC13",phase:"groups",group:"C",home:"Escocia",away:"Marruecos",       date:"Jue 19 Jun",time:"5:00 PM",city:"Foxborough"},
  {id:"GC02",phase:"groups",group:"C",home:"Brasil",away:"Haití",            date:"Jue 19 Jun",time:"7:30 PM",city:"Philadelphia"},
  {id:"GC12",phase:"groups",group:"C",home:"Escocia",away:"Brasil",          date:"Mar 24 Jun",time:"5:00 PM",city:"Miami Gardens"},
  {id:"GC03",phase:"groups",group:"C",home:"Marruecos",away:"Haití",         date:"Mar 24 Jun",time:"5:00 PM",city:"Atlanta"},
  // GRUPO D
  {id:"GD01",phase:"groups",group:"D",home:"USA",away:"Paraguay",            date:"Vie 12 Jun",time:"8:00 PM",city:"Inglewood"},
  {id:"GD23",phase:"groups",group:"D",home:"Australia",away:"Turquía",       date:"Dom 14 Jun",time:"11:00 PM",city:"Vancouver"},
  {id:"GD02",phase:"groups",group:"D",home:"USA",away:"Australia",           date:"Jue 19 Jun",time:"2:00 PM",city:"Seattle"},
  {id:"GD13",phase:"groups",group:"D",home:"Turquía",away:"Paraguay",        date:"Jue 19 Jun",time:"10:00 PM",city:"Santa Clara"},
  {id:"GD03",phase:"groups",group:"D",home:"Turquía",away:"USA",             date:"Mié 25 Jun",time:"9:00 PM",city:"Inglewood"},
  {id:"GD12",phase:"groups",group:"D",home:"Paraguay",away:"Australia",      date:"Mié 25 Jun",time:"9:00 PM",city:"Santa Clara"},
  // GRUPO E
  {id:"GE01",phase:"groups",group:"E",home:"Alemania",away:"Curazao",        date:"Dom 14 Jun",time:"12:00 PM",city:"Houston"},
  {id:"GE23",phase:"groups",group:"E",home:"Costa de Marfil",away:"Ecuador", date:"Dom 14 Jun",time:"6:00 PM",city:"Philadelphia"},
  {id:"GE02",phase:"groups",group:"E",home:"Alemania",away:"Costa de Marfil",date:"Vie 20 Jun",time:"3:00 PM",city:"Toronto"},
  {id:"GE13",phase:"groups",group:"E",home:"Ecuador",away:"Curazao",         date:"Vie 20 Jun",time:"7:00 PM",city:"Kansas City"},
  {id:"GE03",phase:"groups",group:"E",home:"Curazao",away:"Costa de Marfil", date:"Mié 25 Jun",time:"3:00 PM",city:"Philadelphia"},
  {id:"GE12",phase:"groups",group:"E",home:"Ecuador",away:"Alemania",        date:"Mié 25 Jun",time:"3:00 PM",city:"East Rutherford"},
  // GRUPO F
  {id:"GF01",phase:"groups",group:"F",home:"Países Bajos",away:"Japón",      date:"Dom 14 Jun",time:"3:00 PM",city:"Arlington"},
  {id:"GF23",phase:"groups",group:"F",home:"Suecia",away:"Túnez",            date:"Dom 14 Jun",time:"9:00 PM",city:"Monterrey"},
  {id:"GF02",phase:"groups",group:"F",home:"Países Bajos",away:"Suecia",     date:"Vie 20 Jun",time:"12:00 PM",city:"Houston"},
  {id:"GF13",phase:"groups",group:"F",home:"Túnez",away:"Japón",             date:"Dom 21 Jun",time:"11:00 PM",city:"Monterrey"},
  {id:"GF03",phase:"groups",group:"F",home:"Japón",away:"Suecia",            date:"Mié 25 Jun",time:"6:00 PM",city:"Arlington"},
  {id:"GF12",phase:"groups",group:"F",home:"Túnez",away:"Países Bajos",      date:"Mié 25 Jun",time:"6:00 PM",city:"Kansas City"},
  // GRUPO G
  {id:"GG01",phase:"groups",group:"G",home:"Bélgica",away:"Egipto",          date:"Lun 15 Jun",time:"2:00 PM",city:"Seattle"},
  {id:"GG23",phase:"groups",group:"G",home:"Irán",away:"Nueva Zelanda",      date:"Lun 15 Jun",time:"8:00 PM",city:"Inglewood"},
  {id:"GG02",phase:"groups",group:"G",home:"Bélgica",away:"Irán",            date:"Dom 21 Jun",time:"2:00 PM",city:"Inglewood"},
  {id:"GG13",phase:"groups",group:"G",home:"Nueva Zelanda",away:"Egipto",    date:"Dom 21 Jun",time:"8:00 PM",city:"Vancouver"},
  {id:"GG03",phase:"groups",group:"G",home:"Egipto",away:"Irán",             date:"Vie 26 Jun",time:"10:00 PM",city:"Seattle"},
  {id:"GG12",phase:"groups",group:"G",home:"Nueva Zelanda",away:"Bélgica",   date:"Vie 26 Jun",time:"10:00 PM",city:"Vancouver"},
  // GRUPO H
  {id:"GH01",phase:"groups",group:"H",home:"España",away:"Cabo Verde",       date:"Lun 15 Jun",time:"11:00 AM",city:"Atlanta"},
  {id:"GH23",phase:"groups",group:"H",home:"Arabia Saudita",away:"Uruguay",  date:"Lun 15 Jun",time:"5:00 PM",city:"Miami Gardens"},
  {id:"GH02",phase:"groups",group:"H",home:"España",away:"Arabia Saudita",   date:"Dom 21 Jun",time:"11:00 AM",city:"Atlanta"},
  {id:"GH13",phase:"groups",group:"H",home:"Uruguay",away:"Cabo Verde",      date:"Dom 21 Jun",time:"5:00 PM",city:"Miami Gardens"},
  {id:"GH03",phase:"groups",group:"H",home:"Cabo Verde",away:"Arabia Saudita",date:"Vie 26 Jun",time:"7:00 PM",city:"Houston"},
  {id:"GH12",phase:"groups",group:"H",home:"Uruguay",away:"España",          date:"Vie 26 Jun",time:"7:00 PM",city:"Zapopan"},
  // GRUPO I
  {id:"GI01",phase:"groups",group:"I",home:"Francia",away:"Senegal",         date:"Mar 16 Jun",time:"2:00 PM",city:"East Rutherford"},
  {id:"GI23",phase:"groups",group:"I",home:"Irak",away:"Noruega",            date:"Mar 16 Jun",time:"5:00 PM",city:"Foxborough"},
  {id:"GI02",phase:"groups",group:"I",home:"Francia",away:"Irak",            date:"Lun 22 Jun",time:"4:00 PM",city:"Philadelphia"},
  {id:"GI13",phase:"groups",group:"I",home:"Noruega",away:"Senegal",         date:"Lun 22 Jun",time:"7:00 PM",city:"East Rutherford"},
  {id:"GI03",phase:"groups",group:"I",home:"Noruega",away:"Francia",         date:"Jue 26 Jun",time:"2:00 PM",city:"Foxborough"},
  {id:"GI12",phase:"groups",group:"I",home:"Senegal",away:"Irak",            date:"Jue 26 Jun",time:"2:00 PM",city:"Toronto"},
  // GRUPO J
  {id:"GJ01",phase:"groups",group:"J",home:"Argentina",away:"Algeria",       date:"Mar 16 Jun",time:"8:00 PM",city:"Kansas City"},
  {id:"GJ23",phase:"groups",group:"J",home:"Austria",away:"Jordania",        date:"Mié 17 Jun",time:"11:00 PM",city:"Santa Clara"},
  {id:"GJ02",phase:"groups",group:"J",home:"Argentina",away:"Austria",       date:"Lun 22 Jun",time:"12:00 PM",city:"Arlington"},
  {id:"GJ13",phase:"groups",group:"J",home:"Jordania",away:"Algeria",        date:"Lun 22 Jun",time:"10:00 PM",city:"Santa Clara"},
  {id:"GJ03",phase:"groups",group:"J",home:"Algeria",away:"Austria",         date:"Sáb 27 Jun",time:"9:00 PM",city:"Kansas City"},
  {id:"GJ12",phase:"groups",group:"J",home:"Jordania",away:"Argentina",      date:"Sáb 27 Jun",time:"9:00 PM",city:"Arlington"},
  // GRUPO K
  {id:"GK01",phase:"groups",group:"K",home:"Portugal",away:"RD Congo",       date:"Mié 17 Jun",time:"12:00 PM",city:"Houston"},
  {id:"GK23",phase:"groups",group:"K",home:"Uzbekistán",away:"Colombia",     date:"Mié 17 Jun",time:"9:00 PM",city:"Ciudad de México"},
  {id:"GK02",phase:"groups",group:"K",home:"Portugal",away:"Uzbekistán",     date:"Mar 23 Jun",time:"12:00 PM",city:"Houston"},
  {id:"GK13",phase:"groups",group:"K",home:"Colombia",away:"RD Congo",       date:"Mar 23 Jun",time:"9:00 PM",city:"Zapopan"},
  {id:"GK03",phase:"groups",group:"K",home:"Colombia",away:"Portugal",       date:"Sáb 27 Jun",time:"6:30 PM",city:"Miami Gardens"},
  {id:"GK12",phase:"groups",group:"K",home:"RD Congo",away:"Uzbekistán",     date:"Sáb 27 Jun",time:"6:30 PM",city:"Atlanta"},
  // GRUPO L
  {id:"GL01",phase:"groups",group:"L",home:"Inglaterra",away:"Croacia",      date:"Mié 17 Jun",time:"3:00 PM",city:"Arlington"},
  {id:"GL23",phase:"groups",group:"L",home:"Ghana",away:"Panamá",            date:"Mié 17 Jun",time:"6:00 PM",city:"Toronto"},
  {id:"GL02",phase:"groups",group:"L",home:"Inglaterra",away:"Ghana",        date:"Mar 23 Jun",time:"3:00 PM",city:"Foxborough"},
  {id:"GL13",phase:"groups",group:"L",home:"Panamá",away:"Croacia",          date:"Mar 23 Jun",time:"6:00 PM",city:"Toronto"},
  {id:"GL03",phase:"groups",group:"L",home:"Panamá",away:"Inglaterra",       date:"Sáb 27 Jun",time:"4:00 PM",city:"East Rutherford"},
  {id:"GL12",phase:"groups",group:"L",home:"Croacia",away:"Ghana",           date:"Sáb 27 Jun",time:"4:00 PM",city:"Philadelphia"},
];

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

// Fecha/hora límite: kickoff de México vs Sudáfrica (Jue 11 Jun 2026, 2:00 PM hora Colombia = UTC-5)
const ELIMINATION_DEADLINE = new Date("2026-06-11T14:00:00-05:00");

// Fecha/hora límite Fase 2 — Ronda de 32 (Lun 29 Jun 2026, 2:00 PM hora Colombia = UTC-5)
const PHASE2_HARD_DEADLINE = new Date("2026-06-29T14:00:00-05:00");

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

// ── Helper: convierte la fecha actual al formato usado en GROUP_MATCHES ("Jue 11 Jun") ──
const DOW_ES=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MON_ES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function todayMatchDateLabel(){
  const d=new Date();
  return `${DOW_ES[d.getDay()]} ${d.getDate()} ${MON_ES[d.getMonth()]}`;
}
function todayLongLabel(){
  const d=new Date();
  return d.toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}

// ── Genera y descarga el PDF: Ranking + calendario de partidos de hoy ──
function downloadRankingPDF(allScores, results){
  const docPdf=new jsPDF({orientation:"portrait",unit:"pt",format:"a4"});
  const pageWidth=docPdf.internal.pageSize.getWidth();
  const todayLabel=todayMatchDateLabel();
  const todayLong=todayLongLabel();

  // Header
  docPdf.setFillColor(8,12,22);
  docPdf.rect(0,0,pageWidth,70,"F");
  docPdf.setTextColor(249,168,37);
  docPdf.setFont("helvetica","bold");
  docPdf.setFontSize(18);
  docPdf.text("GRAN POLLA MUNDIALISTA 2026", pageWidth/2, 30, {align:"center"});
  docPdf.setTextColor(255,255,255);
  docPdf.setFontSize(11);
  docPdf.setFont("helvetica","normal");
  docPdf.text(`Ranking del día — ${todayLong}`, pageWidth/2, 50, {align:"center"});

  // Tabla de Ranking
  const rankingRows = allScores
    .filter(s=>!s.isAdmin)
    .map((s,i)=>[
      s.eliminated ? "❌" : `${i+1}`,
      s.eliminated ? `${s.name} (ELIMINADO)` : s.name,
      s.eliminated ? "0" : `${s.score}`,
    ]);

  autoTable(docPdf, {
    startY:90,
    head:[["POS","JUGADOR","PUNTOS"]],
    body:rankingRows,
    theme:"grid",
    headStyles:{fillColor:[21,37,61],textColor:[249,168,37],fontStyle:"bold"},
    bodyStyles:{textColor:[40,40,40],fontSize:10},
    alternateRowStyles:{fillColor:[245,245,245]},
    columnStyles:{0:{halign:"center",cellWidth:50},2:{halign:"center",cellWidth:80}},
    margin:{left:40,right:40},
  });

  // Calendario de partidos de HOY
  let cursorY = docPdf.lastAutoTable.finalY + 30;
  docPdf.setTextColor(21,37,61);
  docPdf.setFont("helvetica","bold");
  docPdf.setFontSize(13);
  docPdf.text(`⚽ Partidos de hoy (${todayLabel})`, 40, cursorY);
  cursorY += 10;

  const todaysMatches = GROUP_MATCHES.filter(m=>m.date===todayLabel);

  if(todaysMatches.length===0){
    docPdf.setFont("helvetica","normal");
    docPdf.setFontSize(11);
    docPdf.setTextColor(100,100,100);
    docPdf.text("No hay partidos programados para el día de hoy.", 40, cursorY+20);
  } else {
    const matchRows = todaysMatches.map(m=>{
      const r = results[m.id];
      const score = (r&&r.home!==""&&r.away!=="") ? `${r.home}–${r.away}` : "—";
      return [m.group, `${m.home} vs ${m.away}`, m.time, m.city, score];
    });
    autoTable(docPdf, {
      startY:cursorY+10,
      head:[["GRUPO","PARTIDO","HORA (COL)","SEDE","RESULTADO"]],
      body:matchRows,
      theme:"grid",
      headStyles:{fillColor:[21,37,61],textColor:[249,168,37],fontStyle:"bold"},
      bodyStyles:{textColor:[40,40,40],fontSize:10},
      alternateRowStyles:{fillColor:[245,245,245]},
      margin:{left:40,right:40},
    });
  }

  // Footer
  const pageHeight=docPdf.internal.pageSize.getHeight();
  docPdf.setFontSize(8);
  docPdf.setTextColor(150,150,150);
  docPdf.text(`Generado el ${new Date().toLocaleString("es-CO")}`, 40, pageHeight-20);

  const fileDate = new Date().toISOString().slice(0,10);
  docPdf.save(`ranking-gran-polla-${fileDate}.pdf`);
}

// ============================================================
// BRACKET ENGINE — calcula clasificados y cruces según pronósticos
// ============================================================

// Calcula la tabla de posiciones de un grupo basado en pronósticos del usuario
function calcGroupStandings(group, preds){
  const teams = GROUPS[group];
  const standings = teams.map(t=>({team:t,PJ:0,G:0,E:0,P:0,GF:0,GC:0,DG:0,PTS:0}));
  const idx = t => standings.findIndex(s=>s.team===t);
  GROUP_MATCHES.filter(m=>m.group===group).forEach(m=>{
    const pred=preds[m.id];
    if(!pred||pred.home===""||pred.away==="") return;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return;
    const hi=idx(m.home), ai=idx(m.away);
    if(hi===-1||ai===-1) return;
    standings[hi].PJ++; standings[hi].GF+=h; standings[hi].GC+=a; standings[hi].DG+=(h-a);
    standings[ai].PJ++; standings[ai].GF+=a; standings[ai].GC+=h; standings[ai].DG+=(a-h);
    if(h>a){ standings[hi].G++; standings[hi].PTS+=3; standings[ai].P++; }
    else if(a>h){ standings[ai].G++; standings[ai].PTS+=3; standings[hi].P++; }
    else { standings[hi].E++; standings[hi].PTS++; standings[ai].E++; standings[ai].PTS++; }
  });
  return standings.sort((a,b)=>b.PTS-a.PTS||b.DG-a.DG||b.GF-a.GF);
}

// ============================================================
// FIFA ANNEX C — Tabla oficial de 495 combinaciones
// Columnas: [3rdVs1A, 3rdVs1B, 3rdVs1D, 3rdVs1E, 3rdVs1G, 3rdVs1I, 3rdVs1K, 3rdVs1L]
// Cada fila: grupos que clasifican sus terceros (8 de 12)
// ============================================================
const FIFA_ANNEX_C = [
  // No.: groups → [vs1A, vs1B, vs1D, vs1E, vs1G, vs1I, vs1K, vs1L]
  ["E","F","G","H","I","J","K","L","E","J","I","F","H","G","L","K"],
  ["D","F","G","H","I","J","K","L","H","G","I","D","J","F","L","K"],
  ["D","E","G","H","I","J","K","L","E","J","I","D","H","G","L","K"],
  ["D","E","F","H","I","J","K","L","E","J","I","D","H","F","L","K"],
  ["D","E","F","G","I","J","K","L","E","G","I","D","J","F","L","K"],
  ["D","E","F","G","H","J","K","L","E","G","J","D","H","F","L","K"],
  ["D","E","F","G","H","I","K","L","E","G","I","D","H","F","L","K"],
  ["D","E","F","G","H","I","J","L","E","G","J","D","H","F","L","I"],
  ["D","E","F","G","H","I","J","K","E","G","J","D","H","F","I","K"],
  ["C","F","G","H","I","J","K","L","H","G","I","C","J","F","L","K"],
  ["C","E","G","H","I","J","K","L","E","J","I","C","H","G","L","K"],
  ["C","E","F","H","I","J","K","L","E","J","I","C","H","F","L","K"],
  ["C","E","F","G","I","J","K","L","E","G","I","C","J","F","L","K"],
  ["C","E","F","G","H","J","K","L","E","G","J","C","H","F","L","K"],
  ["C","E","F","G","H","I","K","L","E","G","I","C","H","F","L","K"],
  ["C","E","F","G","H","I","J","L","E","G","J","C","H","F","L","I"],
  ["C","E","F","G","H","I","J","K","E","G","J","C","H","F","I","K"],
  ["C","D","G","H","I","J","K","L","H","G","I","C","J","D","L","K"],
  ["C","D","F","H","I","J","K","L","C","J","I","D","H","F","L","K"],
  ["C","D","F","G","I","J","K","L","C","G","I","D","J","F","L","K"],
  ["C","D","F","G","H","J","K","L","C","G","J","D","H","F","L","K"],
  ["C","D","F","G","H","I","K","L","C","G","I","D","H","F","L","K"],
  ["C","D","F","G","H","I","J","L","C","G","J","D","H","F","L","I"],
  ["C","D","F","G","H","I","J","K","C","G","J","D","H","F","I","K"],
  ["C","D","E","H","I","J","K","L","E","J","I","C","H","D","L","K"],
  ["C","D","E","G","I","J","K","L","E","G","I","C","J","D","L","K"],
  ["C","D","E","G","H","J","K","L","E","G","J","C","H","D","L","K"],
  ["C","D","E","G","H","I","K","L","E","G","I","C","H","D","L","K"],
  ["C","D","E","G","H","I","J","L","E","G","J","C","H","D","L","I"],
  ["C","D","E","G","H","I","J","K","E","G","J","C","H","D","I","K"],
  ["C","D","E","F","I","J","K","L","C","J","E","D","I","F","L","K"],
  ["C","D","E","F","H","J","K","L","C","J","E","D","H","F","L","K"],
  ["C","D","E","F","H","I","K","L","C","E","I","D","H","F","L","K"],
  ["C","D","E","F","H","I","J","L","C","J","E","D","H","F","L","I"],
  ["C","D","E","F","H","I","J","K","C","J","E","D","H","F","I","K"],
  ["C","D","E","F","G","J","K","L","C","G","E","D","J","F","L","K"],
  ["C","D","E","F","G","I","K","L","C","G","E","D","I","F","L","K"],
  ["C","D","E","F","G","I","J","L","C","G","E","D","J","F","L","I"],
  ["C","D","E","F","G","I","J","K","C","G","E","D","J","F","I","K"],
  ["C","D","E","F","G","H","K","L","C","G","E","D","H","F","L","K"],
  ["C","D","E","F","G","H","J","L","C","G","J","D","H","F","L","E"],
  ["C","D","E","F","G","H","J","K","C","G","J","D","H","F","E","K"],
  ["C","D","E","F","G","H","I","L","C","G","E","D","H","F","L","I"],
  ["C","D","E","F","G","H","I","K","C","G","E","D","H","F","I","K"],
  ["C","D","E","F","G","H","I","J","C","G","J","D","H","F","E","I"],
];

// Encuentra la fila del Annex C para los 8 grupos clasificados
function findAnnexC(best8Groups){
  const sorted = [...best8Groups].sort();
  for(const row of FIFA_ANNEX_C){
    const rowGroups = row.slice(0,8).sort();
    if(rowGroups.join("")===sorted.join("")) return row;
  }
  return null;
}


// ============================================================
// RESULTADOS REALES — Fase de Grupos Mundial 2026
// Clasificados confirmados al cierre de grupos (27 jun 2026)
// ============================================================
const REAL_CLASSIFIED = {
  A: ["México","Sudáfrica"],
  B: ["Suiza","Canadá"],
  C: ["Brasil","Marruecos"],
  D: ["Estados Unidos","Australia"],
  E: ["Alemania","Costa de Marfil"],
  F: ["Países Bajos","Japón"],
  G: ["Bélgica","Egipto"],
  H: ["España","Cabo Verde"],
  I: ["Francia","Noruega"],
  J: ["Argentina","Austria"],
  K: ["Colombia","RD Congo"],
  L: ["Inglaterra","Ghana"],
};

// 8 mejores terceros clasificados (grupos B,D,E,F,I,J,K,L)
// Mapeados al cruce real confirmado FIFA
const REAL_R32 = [
  {id:"R32_1",  home:"Sudáfrica",      away:"Canadá",             date:"Dom 28 Jun", city:"Los Ángeles"},
  {id:"R32_2",  home:"Alemania",       away:"Paraguay",           date:"Lun 29 Jun", city:"Boston"},
  {id:"R32_3",  home:"Países Bajos",   away:"Marruecos",          date:"Mié 1 Jul",  city:"Dallas"},
  {id:"R32_4",  home:"Brasil",         away:"Japón",              date:"Lun 29 Jun", city:"Houston"},
  {id:"R32_5",  home:"Costa de Marfil",away:"Noruega",            date:"Mar 30 Jun", city:"Dallas"},
  {id:"R32_6",  home:"Francia",        away:"Suecia",             date:"Mar 30 Jun", city:"East Rutherford"},
  {id:"R32_7",  home:"México",         away:"Ecuador",            date:"Mar 30 Jun", city:"Ciudad de México"},
  {id:"R32_8",  home:"Inglaterra",     away:"RD Congo",           date:"Mié 1 Jul",  city:"Atlanta"},
  {id:"R32_9",  home:"Bélgica",        away:"Senegal",            date:"Mié 1 Jul",  city:"Seattle"},
  {id:"R32_10", home:"Estados Unidos", away:"Bosnia H.",          date:"Mié 1 Jul",  city:"Santa Clara"},
  {id:"R32_11", home:"España",         away:"Austria",            date:"Jue 2 Jul",  city:"Los Ángeles"},
  {id:"R32_12", home:"RD Congo",       away:"Ghana",              date:"Jue 2 Jul",  city:"Toronto"},
  {id:"R32_13", home:"Suiza",          away:"Argelia",            date:"Jue 2 Jul",  city:"Vancouver"},
  {id:"R32_14", home:"Australia",      away:"Egipto",             date:"Vie 3 Jul",  city:"Dallas"},
  {id:"R32_15", home:"Argentina",      away:"Cabo Verde",         date:"Vie 3 Jul",  city:"Miami"},
  {id:"R32_16", home:"Colombia",       away:"Ghana",              date:"Vie 3 Jul",  city:"Kansas City"},
];

// Construye el bracket completo personalizado basado en pronósticos del usuario
function buildPersonalBracket(preds){
  const bracket = {};

  // 1. CLASIFICADOS REALES — resultados oficiales fase de grupos
  // Los cruces de Ronda de 32 usan los equipos reales, no pronósticos del usuario
  const classified = REAL_CLASSIFIED;

  // Helpers (mantienen compatibilidad con el resto del bracket)
  const w1 = g => classified[g]?.[0]||`1°${g}`;
  const w2 = g => classified[g]?.[1]||`2°${g}`;

  // 4. RONDA DE 32 — Cruces reales confirmados FIFA (cierre grupos 27 jun 2026)
  const r32 = REAL_R32;

  r32.forEach(m=>{
    bracket[m.id]={home:m.home,away:m.away,date:m.date,city:m.city,phase:"round32",label:`${m.home} vs ${m.away}`};
  });

  // Helper para obtener ganador de ronda 32 según pronóstico (con penales)
  const winR32 = (id) => {
    const m = bracket[id];
    if(!m) return "?";
    const pred = preds[id];
    if(!pred||pred.home===""||pred.away==="") return `G(${id})`;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return `G(${id})`;
    if(h>a) return m.home;
    if(a>h) return m.away;
    // Empate → penales
    if(pred.penHome&&pred.penAway){
      const ph=parseInt(pred.penHome), pa=parseInt(pred.penAway);
      if(ph>pa) return m.home;
      if(pa>ph) return m.away;
    }
    return m.home; // default local si no hay penales
  };

  // 4. OCTAVOS DE FINAL
  const r16 = [
    {id:"R16_1", home:winR32("R32_1"), away:winR32("R32_3"),  date:"Sáb 4 Jul",  city:"Houston"},
    {id:"R16_2", home:winR32("R32_2"), away:winR32("R32_6"),  date:"Sáb 4 Jul",  city:"Philadelphia"},
    {id:"R16_3", home:winR32("R32_4"), away:winR32("R32_5"),  date:"Dom 5 Jul",  city:"East Rutherford"},
    {id:"R16_4", home:winR32("R32_7"), away:winR32("R32_8"),  date:"Dom 5 Jul",  city:"Ciudad de México"},
    {id:"R16_5", home:winR32("R32_11"),away:winR32("R32_12"), date:"Lun 6 Jul",  city:"Arlington"},
    {id:"R16_6", home:winR32("R32_9"), away:winR32("R32_10"), date:"Lun 6 Jul",  city:"Seattle"},
    {id:"R16_7", home:winR32("R32_15"),away:winR32("R32_14"), date:"Mar 7 Jul",  city:"Atlanta"},
    {id:"R16_8", home:winR32("R32_13"),away:winR32("R32_16"), date:"Mar 7 Jul",  city:"Vancouver"},
  ];
  r16.forEach(m=>{
    bracket[m.id]={home:m.home, away:m.away, date:m.date, city:m.city, phase:"round16", label:`${m.home} vs ${m.away}`};
  });

  const winR16 = (id) => {
    const m = bracket[id]; if(!m) return "?";
    const pred=preds[id];
    if(!pred||pred.home===""||pred.away==="") return `G(${id})`;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return `G(${id})`;
    if(h>a) return m.home; if(a>h) return m.away;
    if(pred.penHome&&pred.penAway){const ph=parseInt(pred.penHome),pa=parseInt(pred.penAway);if(ph>pa)return m.home;if(pa>ph)return m.away;}
    return m.home;
  };

  // 5. CUARTOS
  const qf = [
    {id:"QF1", home:winR16("R16_1"), away:winR16("R16_2"), date:"Jue 9 Jul",  city:"Foxborough"},
    {id:"QF2", home:winR16("R16_5"), away:winR16("R16_6"), date:"Vie 10 Jul", city:"Inglewood"},
    {id:"QF3", home:winR16("R16_3"), away:winR16("R16_4"), date:"Sáb 11 Jul", city:"Miami Gardens"},
    {id:"QF4", home:winR16("R16_7"), away:winR16("R16_8"), date:"Sáb 11 Jul", city:"Kansas City"},
  ];
  qf.forEach(m=>{
    bracket[m.id]={home:m.home, away:m.away, date:m.date, city:m.city, phase:"quarters", label:`${m.home} vs ${m.away}`};
  });

  const winQF = (id) => {
    const m=bracket[id]; if(!m) return "?";
    const pred=preds[id];
    if(!pred||pred.home===""||pred.away==="") return `G(${id})`;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return `G(${id})`;
    if(h>a) return m.home; if(a>h) return m.away;
    if(pred.penHome&&pred.penAway){const ph=parseInt(pred.penHome),pa=parseInt(pred.penAway);if(ph>pa)return m.home;if(pa>ph)return m.away;}
    return m.home;
  };

  // 6. SEMIS
  bracket["SF1"]={home:winQF("QF1"), away:winQF("QF2"), date:"Mar 14 Jul", city:"Arlington",     phase:"semis", label:`${winQF("QF1")} vs ${winQF("QF2")}`};
  bracket["SF2"]={home:winQF("QF3"), away:winQF("QF4"), date:"Mié 15 Jul", city:"Atlanta",       phase:"semis", label:`${winQF("QF3")} vs ${winQF("QF4")}`};

  const winSF = (id) => {
    const m=bracket[id]; if(!m) return "?";
    const pred=preds[id];
    if(!pred||pred.home===""||pred.away==="") return `G(${id})`;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return `G(${id})`;
    if(h>a) return m.home; if(a>h) return m.away;
    if(pred.penHome&&pred.penAway){const ph=parseInt(pred.penHome),pa=parseInt(pred.penAway);if(ph>pa)return m.home;if(pa>ph)return m.away;}
    return m.home;
  };
  const loseSF = (id) => {
    const m=bracket[id]; if(!m) return "?";
    const pred=preds[id];
    if(!pred||pred.home===""||pred.away==="") return `P(${id})`;
    const h=parseInt(pred.home), a=parseInt(pred.away);
    if(isNaN(h)||isNaN(a)) return `P(${id})`;
    if(h>a) return m.away; if(a>h) return m.home;
    if(pred.penHome&&pred.penAway){const ph=parseInt(pred.penHome),pa=parseInt(pred.penAway);if(ph>pa)return m.away;if(pa>ph)return m.home;}
    return m.away;
  };

  // 7. TERCER LUGAR & FINAL
  bracket["3RD"]  ={home:loseSF("SF1"), away:loseSF("SF2"), date:"Sáb 18 Jul", city:"Miami Gardens", phase:"third", label:`${loseSF("SF1")} vs ${loseSF("SF2")}`};
  bracket["FINAL"]={home:winSF("SF1"),  away:winSF("SF2"),  date:"Dom 19 Jul", city:"East Rutherford",phase:"final", label:`${winSF("SF1")} vs ${winSF("SF2")}`};

  return bracket;
}


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
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY;
  if(!apiKey) throw new Error("Falta VITE_ANTHROPIC_KEY en variables de entorno");

  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key": apiKey,
      "anthropic-version":"2023-06-01",
      "anthropic-dangerous-direct-browser-access":"true",
    },
    body:JSON.stringify({
      model:"claude-sonnet-4-6",max_tokens:1200,
      tools:[{type:"web_search_20250305",name:"web_search"}],
      messages:[{role:"user",content:prompt}]
    })
  });
  if(!response.ok){
    const err=await response.json().catch(()=>({}));
    throw new Error(`API error ${response.status}: ${err?.error?.message||response.statusText}`);
  }
  const data=await response.json();
  const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  if(!text) throw new Error("Respuesta vacía de la API");
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
  const [allProfiles,setAllProfiles]=useState({});
  const [myPreds,setMyPreds]=useState({});
  const [myGrpP,setMyGrpP]=useState({});
  const [myChamp,setMyChamp]=useState({});
  const [allScores,setAllScores]=useState([]);
  const [allPredictions,setAllPredictions]=useState({});
  const [allSubmitted,setAllSubmitted]=useState({}); // {uid: {matches:{...}}}
  const [submitted,setSubmitted]=useState(false);
  const [submitted2,setSubmitted2]=useState(false); // fase 2 bloqueada
  const [phase2Open,setPhase2Open]=useState(false);  // admin abre fase 2
  const [phase2Deadline,setPhase2Deadline]=useState(null); // fecha límite fase 2

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

  // ── Listen to shared config (phase2, results) ────────────
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"shared","config"),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        console.log("Firebase config:", d);
        setPhase2Open(d.phase2Open===true);
        setPhase2Deadline(d.phase2Deadline||null);
      } else {
        console.log("No config doc found");
        setPhase2Open(false);
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
  useEffect(()=>{
    if(!fbUser) return;
    const unsub=onSnapshot(doc(db,"predictions",fbUser.uid),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        setMyPreds(d.matches||{});
        setMyGrpP(d.groups||{});
        setMyChamp(d.champ||{});
        setSubmitted(d.submitted||false);
        setSubmitted2(d.submitted2||false);
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

  // ── Load all predictions for ranking + comparativo ───────
  // Se re-ejecuta cuando cambian los perfiles O los resultados
  useEffect(()=>{
    if(!Object.keys(allProfiles).length) return;
    const fetchScores=async()=>{
      const scores=[];
      const allPreds={};
      const submittedMap={};
      for(const [uid,prof] of Object.entries(allProfiles)){
        const snap=await getDoc(doc(db,"predictions",uid));
        const data=snap.exists()?snap.data():{};
        const preds=data.matches||{};
        allPreds[uid]=preds;
        submittedMap[uid]=data.submitted===true;

        // ── Eliminación: no envió Fase 1, o la envió después del kickoff de México vs Sudáfrica ──
        const submittedAtMs = data.submittedAt?.toMillis ? data.submittedAt.toMillis() : null;
        const sentOnTime = data.submitted===true && submittedAtMs!==null && submittedAtMs <= ELIMINATION_DEADLINE.getTime();
        const eliminated = !prof.isAdmin && !sentOnTime;

        let total=0;
        ALL_MATCHES.forEach(m=>{
          const actual=results[m.id];
          const pred=preds[m.id];
          if(actual&&actual.home!==""&&actual.away!==""&&pred){
            total+=calcPoints(pred,actual,m.phase);
          }
        });

        // ── Puntos por posición en grupos (1°=4pts, 2°=3pts, 3°=2pts, 4°=1pt) ──
        // Se calcula desde los pronósticos de partidos del usuario (no de data.groups)
        const GRP_POS_PTS = [4,3,2,1];
        Object.keys(GROUPS).forEach(g=>{
          // Posición real (basada en resultados reales ingresados por admin)
          const realStandings = calcGroupStandings(g, results);
          // Posición pronosticada por el usuario (basada en sus pronósticos de partidos)
          const userStandings = calcGroupStandings(g, preds);
          userStandings.forEach((userTeam, idx)=>{
            const realPos = realStandings.findIndex(s=>s.team===userTeam.team);
            if(realPos === idx) total += GRP_POS_PTS[idx]||0;
          });
        });

        if(eliminated) total=0;
        scores.push({uid,name:prof.name,score:total,isAdmin:prof.isAdmin,eliminated});
      }
      scores.sort((a,b)=> (a.eliminated===b.eliminated) ? b.score-a.score : (a.eliminated?1:-1));
      setAllScores(scores);
      setAllPredictions(allPreds);
      setAllSubmitted(submittedMap);
    };
    fetchScores();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[allProfiles, results]);

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
      console.error("fetchLiveResults error:", e.message);
      setLiveStatus(s=>({...s,loading:false,error:e.message||"Error al conectar"}));
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
  async function savePrediction(id,h,a,penHome="",penAway=""){
    const isGroup = GROUP_MATCHES.some(m=>m.id===id);
    if(isGroup && submitted) return;
    if(!isGroup && submitted2) return;
    if(!isGroup && !phase2Open) return; // fase 2 no abierta
    if(!isGroup && new Date() >= PHASE2_HARD_DEADLINE) return; // cierre automático
    const entry={home:h,away:a};
    if(penHome!==""&&penAway!==""){entry.penHome=penHome;entry.penAway=penAway;}
    const updated={...myPreds,[id]:entry};
    setMyPreds(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{matches:updated},{merge:true});
  }
  async function saveGroupRank(grp,ranks){
    if(submitted) return;
    const updated={...myGrpP,[grp]:ranks};
    setMyGrpP(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{groups:updated},{merge:true});
  }
  async function saveChampPrediction(field,value){
    const locked = phase2Open ? submitted2 : submitted;
    if(locked) return;
    const updated={...myChamp,[field]:value};
    setMyChamp(updated);
    await setDoc(doc(db,"predictions",fbUser.uid),{champ:updated},{merge:true});
  }

  // ── Submit phase 1 (groups) ───────────────────────────────
  async function submitPredictions(){
    await setDoc(doc(db,"predictions",fbUser.uid),{submitted:true,submittedAt:serverTimestamp()},{merge:true});
    setSubmitted(true);
    addNote("✅ ¡Pronósticos Fase 1 enviados!","result");
  }

  // ── Submit phase 2 (knockouts) ────────────────────────────
  async function submitPredictions2(){
    await setDoc(doc(db,"predictions",fbUser.uid),{submitted2:true,submittedAt2:serverTimestamp()},{merge:true});
    setSubmitted2(true);
    addNote("✅ ¡Pronósticos Fase 2 enviados!","result");
  }

  // ── Admin: open/close phase 2 ─────────────────────────────
  async function adminSetPhase2(open, deadline){
    await setDoc(doc(db,"shared","config"),{phase2Open:open, phase2Deadline:deadline||null},{merge:true});
    addNote(`📡 Fase 2 ${open?"ABIERTA":"CERRADA"}`,"result");
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
    {key:"comparativo",label:"📊 Comparativo"},
    {key:"live",label:"📡 En Vivo"},
    {key:"bracket",label:"🏟️ Bracket"},
    {key:"ranking",label:"🏆 Ranking"},
    {key:"reglas",label:"📋 Reglas"},
    {key:"sponsors",label:"🤝 Patrocinadores"},
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
                <p style={S.authDesc}>La gran <strong style={{color:"#f9a825"}}>POLLA MUNDIALISTA</strong>, diversión para la familia y los amigos — ¡inscríbete y participa!</p>
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

            {/* ── EPIC WORLD CUP BANNER ── */}
            <WorldCupBanner totalPlayed={totalPlayed} allScores={allScores}/>

            <button style={S.btnPrimary} onClick={()=>setPage("predict")}>🎯 IR A MIS PRONÓSTICOS</button>
          </div>
        )}

        {/* PREDICT */}
        {page==="predict"&&fbUser&&(
          <PredictPage results={results} myPreds={myPreds} myGrpP={myGrpP} myChamp={myChamp}
            savePrediction={savePrediction} saveGroupRank={saveGroupRank} saveChampPrediction={saveChampPrediction}
            submitted={submitted} submitPredictions={submitPredictions}
            phase2Open={phase2Open} phase2Deadline={phase2Deadline}
            submitted2={submitted2} submitPredictions2={submitPredictions2}/>
        )}

        {/* LIVE */}
        {page==="live"&&fbUser&&(
          <LivePage results={results} refreshLive={refreshLive} liveStatus={liveStatus} saveResult={saveResult} addNote={addNote}/>
        )}

        {/* BRACKET */}
        {page==="bracket"&&<BracketPage results={results}/>}

        {/* COMPARATIVO */}
        {page==="comparativo"&&fbUser&&(
          <ComparativoPage
            allProfiles={allProfiles}
            allPredictions={allPredictions}
            allSubmitted={allSubmitted}
            allScores={allScores}
            results={results}
            currentUid={fbUser?.uid}
          />
        )}

        {/* RANKING */}
        {page==="ranking"&&(
          <div style={S.section}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:22,borderBottom:"1px solid #1a2f4a",paddingBottom:10}}>
              <h2 style={{...S.sectionTitle,marginBottom:0,borderBottom:"none",paddingBottom:0}}>🏆 Ranking en Tiempo Real</h2>
              <button
                style={{background:"linear-gradient(135deg,#1565c0,#1e88e5)",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}
                onClick={()=>downloadRankingPDF(allScores, results)}>
                📄 Descargar PDF del día
              </button>
            </div>

            {/* DEBUG — quitar después de verificar */}
            <div style={{background:"rgba(0,0,0,.4)",border:"1px solid #37474f",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:11,fontFamily:"monospace",color:"#90a4ae"}}>
              <div>👥 allScores.length: <strong style={{color:"#f9a825"}}>{allScores.length}</strong></div>
              <div>⚽ results en Firebase: <strong style={{color:"#f9a825"}}>{Object.keys(results).length}</strong> docs</div>
              <div>📊 partidos con resultado: <strong style={{color:"#f9a825"}}>{totalPlayed}</strong></div>
              <div>🔑 API Key cargada: <strong style={{color:import.meta.env.VITE_ANTHROPIC_KEY?"#81c784":"#ef5350"}}>{import.meta.env.VITE_ANTHROPIC_KEY?"✅ Sí":"❌ No"}</strong></div>
              <div>👤 Usuarios: {allScores.map(s=>`${s.name}(admin:${s.isAdmin},pts:${s.score}${s.eliminated?",ELIMINADO":""})`).join(" | ")}</div>
            </div>

            {allScores.length===0&&<p style={{color:"#546e7a",padding:"20px 0"}}>Sin participantes aún o cargando...</p>}

            {/* Resumen de partidos jugados */}
            <div style={{background:"rgba(249,168,37,.08)",border:"1px solid rgba(249,168,37,.2)",borderRadius:10,padding:"12px 20px",marginBottom:16,display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:13,color:"#f9a825",fontWeight:700}}>⚽ Partidos con resultado: <strong style={{color:"#fff"}}>{totalPlayed}</strong></span>
              <span style={{fontSize:13,color:"#4fc3f7",fontWeight:700}}>👥 Participantes: <strong style={{color:"#fff"}}>{allScores.length}</strong></span>
              <span style={{fontSize:12,color:"#546e7a"}}>Se actualiza automáticamente con cada resultado</span>
            </div>

            <div style={{background:"#131d2e",borderRadius:12,overflow:"hidden",border:"1px solid #1a2f4a"}}>
              {/* Header tabla */}
              <div style={{display:"grid",gridTemplateColumns:"60px 1fr 80px 80px 80px 100px",padding:"10px 20px",background:"rgba(255,255,255,.04)",fontSize:11,fontWeight:700,color:"#546e7a",letterSpacing:1.5,textTransform:"uppercase",borderBottom:"2px solid rgba(255,255,255,.06)",gap:8}}>
                <span style={{textAlign:"center"}}>POS</span>
                <span>JUGADOR</span>
                <span style={{textAlign:"center"}}>✅ EXACTO</span>
                <span style={{textAlign:"center"}}>👍 TENDENCIA</span>
                <span style={{textAlign:"center"}}>🎯 ACIERTOS</span>
                <span style={{textAlign:"right"}}>PUNTOS</span>
              </div>

              {allScores.map((r,i)=>{
                const preds = allPredictions[r.uid]||{};
                let exactos=0, tendencia=0;
                ALL_MATCHES.forEach(m=>{
                  const actual=results[m.id];
                  const pred=preds[m.id];
                  if(!actual||actual.home===""||actual.away===""||!pred) return;
                  const pts=calcPoints(pred,actual,m.phase);
                  const ph=POINTS[m.phase]||POINTS.groups;
                  if(pts===ph.exactScore) exactos++;
                  else if(pts===ph.correctResult) tendencia++;
                });
                const totalAciertos=exactos+tendencia;
                const isMe=r.uid===fbUser?.uid;
                const medals=["🥇","🥈","🥉"];
                const isElim = r.eliminated;
                return(
                  <div key={r.uid} style={{
                    display:"grid",gridTemplateColumns:"60px 1fr 80px 80px 80px 100px",
                    alignItems:"center",padding:"14px 20px",gap:8,
                    borderBottom:"1px solid rgba(255,255,255,.04)",
                    background:isElim?"rgba(239,83,80,.05)":(isMe?"rgba(249,168,37,.07)":"transparent"),
                    borderLeft:isElim?"3px solid #ef5350":(isMe?"3px solid #f9a825":"3px solid transparent"),
                    opacity:isElim?0.65:1,
                  }}>
                    <span style={{textAlign:"center",fontSize:i<3&&!isElim?24:16,fontWeight:700,color:isElim?"#546e7a":(i===0?"#f9a825":i===1?"#bdbdbd":i===2?"#a1887f":"#546e7a")}}>
                      {isElim?"❌":(medals[i]||`#${i+1}`)}
                    </span>
                    <div>
                      <div style={{fontWeight:i<3&&!isElim?800:500,fontSize:15,color:isElim?"#90a4ae":(isMe?"#f9a825":"#e0e0e0"),display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{textDecoration:isElim?"line-through":"none"}}>{r.name}</span>{r.isAdmin?" ⚙️":""}
                        {isElim&&(
                          <span style={{fontSize:10,fontWeight:800,color:"#ef5350",background:"rgba(239,83,80,.15)",border:"1px solid #ef5350",borderRadius:5,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase",textDecoration:"none"}}>
                            ELIMINADO
                          </span>
                        )}
                      </div>
                      {isMe&&!isElim&&<div style={{fontSize:10,color:"#f9a825",letterSpacing:1}}>▶ TÚ</div>}
                    </div>
                    <span style={{textAlign:"center",fontSize:15,fontWeight:700,color:isElim?"#546e7a":"#81c784"}}>{isElim?"—":(exactos||"—")}</span>
                    <span style={{textAlign:"center",fontSize:15,fontWeight:700,color:isElim?"#546e7a":"#4fc3f7"}}>{isElim?"—":(tendencia||"—")}</span>
                    <span style={{textAlign:"center",fontSize:15,fontWeight:700,color:isElim?"#546e7a":"#b0bec5"}}>{isElim?"—":(totalAciertos||"—")}</span>
                    <span style={{textAlign:"right",fontSize:26,fontWeight:900,color:isElim?"#ef5350":(i===0?"#f9a825":i===1?"#bdbdbd":i===2?"#a1887f":"#e0e0e0")}}>{r.score}</span>
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div style={{display:"flex",gap:20,marginTop:14,flexWrap:"wrap"}}>
              <div style={{fontSize:12,color:"#546e7a",display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:"#81c784",fontWeight:700}}>✅ Exacto</span> — marcador exacto acertado
              </div>
              <div style={{fontSize:12,color:"#546e7a",display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:"#4fc3f7",fontWeight:700}}>👍 Tendencia</span> — resultado correcto (G/E/P)
              </div>
            </div>
          </div>
        )}

        {/* SPONSORS */}
        {page==="sponsors"&&<SponsorsPage/>}

        {/* REGLAS */}
        {page==="reglas"&&<ReglasPage/> }

        {/* ADMIN */}
        {page==="admin"&&isAdmin&&(
          <AdminPage results={results} saveResult={saveResult}
            phase2Open={phase2Open} phase2Deadline={phase2Deadline} adminSetPhase2={adminSetPhase2}
            allScores={allScores} allProfiles={allProfiles} allSubmitted={allSubmitted}/>
        )}
      </main>
    </div>
  );
}

// ============================================================
// COUNTDOWN TIMER COMPONENT
// ============================================================
function Countdown({deadline}){
  const [time,setTime]=useState(null);
  useEffect(()=>{
    function calc(){
      const diff=new Date(deadline)-new Date();
      if(diff<=0){setTime(null);return;}
      const d=Math.floor(diff/86400000);
      const h=Math.floor((diff%86400000)/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      setTime({d,h,m,s});
    }
    calc();
    const t=setInterval(calc,1000);
    return()=>clearInterval(t);
  },[deadline]);

  if(!time) return <span style={{color:"#ef5350",fontWeight:700}}>⏰ ¡Tiempo agotado!</span>;

  return(
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      {[["d","días"],["h","hrs"],["m","min"],["s","seg"]].map(([k,label])=>(
        <div key={k} style={{textAlign:"center",background:"rgba(0,0,0,.3)",borderRadius:8,padding:"6px 10px",minWidth:52}}>
          <div style={{fontSize:22,fontWeight:900,color:"#f9a825",lineHeight:1}}>{String(time[k]).padStart(2,"0")}</div>
          <div style={{fontSize:10,color:"#546e7a",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PREDICT PAGE
// ============================================================
function PredictPage({results,myPreds,myGrpP,myChamp,savePrediction,saveGroupRank,saveChampPrediction,submitted,submitPredictions,phase2Open,phase2Deadline,submitted2,submitPredictions2}){
  const [tab,setTab]=useState("groups");
  const [selGrp,setSelGrp]=useState("A");
  const [showConfirm,setShowConfirm]=useState(false);
  const [showConfirm2,setShowConfirm2]=useState(false);
  const [submitting,setSubmitting]=useState(false);

  async function handleSubmit(){
    setSubmitting(true);
    await submitPredictions();
    setShowConfirm(false);
    setSubmitting(false);
  }
  async function handleSubmit2(){
    setSubmitting(true);
    await submitPredictions2();
    setShowConfirm2(false);
    setSubmitting(false);
  }

  const groupFilled = GROUP_MATCHES.filter(m=>myPreds[m.id]?.home!==undefined&&myPreds[m.id]?.home!=="").length;
  const totalGroup = GROUP_MATCHES.length;

  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>🎯 Mis Pronósticos</h2>

      {/* ── PHASE 1 SUBMIT BANNER ── */}
      {!submitted ? (
        <div style={{background:"rgba(249,168,37,.1)",border:"1px solid rgba(249,168,37,.4)",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:28,flexShrink:0}}>📋</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"#f9a825",marginBottom:4}}>
                FASE 1 — Pronósticos de Grupos
              </div>
              <div style={{fontSize:13,color:"#b0bec5",lineHeight:1.6,marginBottom:10}}>
                Ingresa tus pronósticos de los <strong style={{color:"#fff"}}>72 partidos de fase de grupos</strong>.
                Cuando termines presiona <strong style={{color:"#f9a825"}}>ENVIAR PRONÓSTICOS FASE 1</strong>.
                <strong style={{color:"#ef5350"}}> Una vez enviados no podrás modificarlos.</strong>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:13,color:"#90a4ae"}}>
                  Completados: <strong style={{color:groupFilled===totalGroup?"#81c784":"#f9a825"}}>{groupFilled}/{totalGroup}</strong>
                </div>
                <button style={{background:"linear-gradient(135deg,#f9a825,#ffa726)",color:"#000",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5}}
                  onClick={()=>setShowConfirm(true)}>
                  🔒 ENVIAR FASE 1
                </button>
              </div>
            </div>
          </div>
        </div>
      ):(
        <div style={{background:"rgba(129,199,132,.1)",border:"2px solid #81c784",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:24}}>✅</span>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:"#81c784"}}>Fase 1 enviada y bloqueada ✓</div>
            <div style={{fontSize:12,color:"#546e7a",marginTop:2}}>Pronósticos de grupos registrados correctamente.</div>
          </div>
        </div>
      )}

      {/* ── PHASE 2 BANNER ── */}
      {submitted && !phase2Open && new Date() < PHASE2_HARD_DEADLINE && (
        <div style={{background:"rgba(239,83,80,.15)",border:"2px solid #ef5350",borderRadius:12,padding:"20px",marginBottom:20,animation:"pulse 2s infinite"}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <span style={{fontSize:36,flexShrink:0}}>🚨</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,fontSize:18,color:"#ef5350",marginBottom:8,letterSpacing:.5}}>
                ¡ATENCIÓN! FASE 2 — ELIMINATORIAS
              </div>
              <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:10,background:"rgba(239,83,80,.2)",borderRadius:8,padding:"10px 14px",border:"1px solid #ef5350"}}>
                ⏰ Tienes hasta HOY LUNES 29 DE JUNIO A LAS 2:00 PM (hora Colombia) para completar y ENVIAR tus pronósticos de Eliminatorias.
              </div>
              <div style={{fontSize:13,color:"#ffcdd2",lineHeight:1.7,marginBottom:12}}>
                Los cruces reales de la Ronda de 32 están cargados. Ingresa tus pronósticos, luego haz click en
                <strong style={{color:"#ef5350"}}> 🔒 ENVIAR FASE 2</strong>.
                <strong style={{color:"#ff8a80",display:"block",marginTop:8}}> ⚠️ Si no envías antes de las 2:00 PM de hoy quedarás DESCALIFICADO de la etapa eliminatoria.</strong>
              </div>
              <div style={{marginBottom:12}}>
                <Countdown deadline={PHASE2_HARD_DEADLINE}/>
              </div>
              <button style={{background:"linear-gradient(135deg,#c62828,#ef5350)",color:"#fff",border:"none",borderRadius:8,padding:"12px 28px",fontWeight:900,fontSize:15,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5,boxShadow:"0 4px 12px rgba(239,83,80,.4)"}}
                onClick={()=>setShowConfirm2(true)}>
                🔒 ENVIAR FASE 2 AHORA
              </button>
            </div>
          </div>
        </div>
      )}
      {submitted && !phase2Open && new Date() >= PHASE2_HARD_DEADLINE && !submitted2 && (
        <div style={{background:"rgba(239,83,80,.1)",border:"2px solid #ef5350",borderRadius:12,padding:"20px",marginBottom:20}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:36}}>🔴</span>
            <div>
              <div style={{fontWeight:900,fontSize:16,color:"#ef5350",marginBottom:6}}>FASE 2 CERRADA</div>
              <div style={{fontSize:13,color:"#b0bec5"}}>El plazo para enviar tus pronósticos de Eliminatorias venció el Lunes 29 de Junio a las 2:00 PM hora Colombia. No podrás participar en la etapa eliminatoria.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 2 OPEN — countdown + submit ── */}
      {submitted && phase2Open && !submitted2 && (
        <div style={{background:"rgba(239,83,80,.15)",border:"2px solid #ef5350",borderRadius:12,padding:"20px",marginBottom:20}}>
          <div style={{fontWeight:900,fontSize:18,color:"#ef5350",marginBottom:8}}>
            🚨 ¡FASE 2 ABIERTA — ACTÚA AHORA!
          </div>
          <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:10,background:"rgba(239,83,80,.2)",borderRadius:8,padding:"10px 14px",border:"1px solid #ef5350"}}>
            ⏰ Tienes hasta HOY LUNES 29 DE JUNIO A LAS 2:00 PM (hora Colombia) para completar y ENVIAR.
          </div>
          <div style={{fontSize:13,color:"#ffcdd2",lineHeight:1.6,marginBottom:14}}>
            Los cruces reales están cargados. Ingresa tus pronósticos de la Ronda de 32, Octavos, Cuartos, Semis y Final.
            <strong style={{color:"#ff8a80",display:"block",marginTop:8}}>⚠️ Si no envías antes de las 2:00 PM de hoy quedarás DESCALIFICADO de la etapa eliminatoria.</strong>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:"#546e7a",marginBottom:6}}>⏰ TIEMPO RESTANTE</div>
            <Countdown deadline={phase2Deadline||PHASE2_HARD_DEADLINE.toISOString()}/>
            <div style={{fontSize:11,color:"#546e7a",marginTop:6}}>
              Fecha límite: Lunes 29 de junio de 2026, 2:00 p.m.
            </div>
          </div>
          <button style={{background:"linear-gradient(135deg,#c62828,#ef5350)",color:"#fff",border:"none",borderRadius:8,padding:"12px 28px",fontWeight:900,fontSize:15,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5,boxShadow:"0 4px 12px rgba(239,83,80,.4)"}}
            onClick={()=>setShowConfirm2(true)}>
            🔒 ENVIAR FASE 2 AHORA
          </button>
        </div>
      )}

      {submitted && phase2Open && submitted2 && (
        <div style={{background:"rgba(129,199,132,.1)",border:"2px solid #81c784",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:24}}>✅</span>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:"#81c784"}}>Fase 2 enviada y bloqueada ✓</div>
            <div style={{fontSize:12,color:"#546e7a",marginTop:2}}>Pronósticos de eliminatorias registrados. ¡Buena suerte! 🏆</div>
          </div>
        </div>
      )}

      {/* Confirm modal fase 1 */}
      {showConfirm&&(
        <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#131d2e",border:"2px solid #f9a825",borderRadius:16,padding:32,maxWidth:400,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>🔒</div>
            <h3 style={{fontSize:20,fontWeight:800,color:"#f9a825",marginBottom:12}}>¿Enviar Fase 1?</h3>
            <p style={{color:"#b0bec5",fontSize:14,lineHeight:1.6,marginBottom:24}}>
              Tus pronósticos de <strong style={{color:"#fff"}}>grupos</strong> quedarán bloqueados.
              Podrás completar la <strong style={{color:"#4fc3f7"}}>Fase 2 (eliminatorias)</strong> cuando se abra después del 27 de junio.
            </p>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              <button style={{background:"transparent",border:"1px solid #546e7a",color:"#90a4ae",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14}}
                onClick={()=>setShowConfirm(false)} disabled={submitting}>Cancelar</button>
              <button style={{background:"linear-gradient(135deg,#f9a825,#ffa726)",color:"#000",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:14,...(submitting?{opacity:.6}:{})}}
                onClick={handleSubmit} disabled={submitting}>{submitting?"Enviando...":"✅ Sí, enviar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal fase 2 */}
      {showConfirm2&&(
        <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#131d2e",border:"2px solid #1e88e5",borderRadius:16,padding:32,maxWidth:400,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>🔒</div>
            <h3 style={{fontSize:20,fontWeight:800,color:"#4fc3f7",marginBottom:12}}>¿Enviar Fase 2?</h3>
            <p style={{color:"#b0bec5",fontSize:14,lineHeight:1.6,marginBottom:24}}>
              Tus pronósticos de <strong style={{color:"#fff"}}>eliminatorias</strong> quedarán bloqueados definitivamente. Esta acción es <strong style={{color:"#ef5350"}}>irreversible</strong>.
            </p>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              <button style={{background:"transparent",border:"1px solid #546e7a",color:"#90a4ae",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14}}
                onClick={()=>setShowConfirm2(false)} disabled={submitting}>Cancelar</button>
              <button style={{background:"linear-gradient(135deg,#1565c0,#1e88e5)",color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:14,...(submitting?{opacity:.6}:{})}}
                onClick={handleSubmit2} disabled={submitting}>{submitting?"Enviando...":"✅ Sí, enviar"}</button>
            </div>
          </div>
        </div>
      )}
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
            <h3 style={S.cardTitle}>Grupo {selGrp} {submitted&&<span style={{fontSize:11,color:"#ef5350",marginLeft:8}}>🔒 Bloqueado</span>}</h3>
            {GROUP_MATCHES.filter(m=>m.group===selGrp).map(m=>(
              <MatchRow key={m.id} match={m} pred={myPreds[m.id]} result={results[m.id]} savePrediction={savePrediction} locked={submitted}/>
            ))}
          </div>

          {/* TABLA DE POSICIONES */}
          <GroupStandingsTable group={selGrp} teams={GROUPS[selGrp]} myPreds={myPreds}/>

        </>
      )}
      {tab==="knockouts"&&(
        <div>
          {!phase2Open ? (
            <div style={{background:"rgba(21,101,192,.1)",border:"1px solid rgba(30,136,229,.25)",borderRadius:12,padding:"28px 24px",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>⏳</div>
              <h3 style={{fontSize:20,fontWeight:800,color:"#4fc3f7",marginBottom:10}}>Eliminatorias — Próximamente</h3>
              <p style={{color:"#90a4ae",fontSize:14,lineHeight:1.7,maxWidth:480,margin:"0 auto 16px"}}>
                Esta sección se habilitará una vez finalice la <strong style={{color:"#fff"}}>Fase de Grupos (27 Jun)</strong> y
                el administrador cargue los cruces oficiales de la Ronda de 32.
              </p>
              <div style={{background:"rgba(0,0,0,.25)",borderRadius:8,padding:"12px 20px",display:"inline-block"}}>
                <div style={{fontSize:12,color:"#546e7a",marginBottom:4}}>ÚLTIMO PARTIDO DE GRUPOS</div>
                <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>📅 Sábado 27 de Junio, 2026</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{background:"rgba(30,136,229,.12)",border:"1px solid rgba(30,136,229,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:20,flexShrink:0}}>🧠</span>
                <div style={{fontSize:13,color:"#90a4ae",lineHeight:1.6}}>
                  Los equipos en cada partido corresponden a los <strong style={{color:"#4fc3f7"}}>clasificados reales</strong> de la fase de grupos.
                  {submitted2&&<strong style={{color:"#ef5350"}}> 🔒 Tus pronósticos están bloqueados.</strong>}
                </div>
              </div>
              {(()=>{
                const bracket=buildPersonalBracket(myPreds);
                return [
                  {key:"round32",label:"Ronda de 32",ids:["R32_1","R32_2","R32_3","R32_4","R32_5","R32_6","R32_7","R32_8","R32_9","R32_10","R32_11","R32_12","R32_13","R32_14","R32_15","R32_16"]},
                  {key:"round16",label:"Octavos de Final",ids:["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"]},
                  {key:"quarters",label:"Cuartos de Final",ids:["QF1","QF2","QF3","QF4"]},
                  {key:"semis",label:"Semifinales",ids:["SF1","SF2"]},
                  {key:"third",label:"🥉 Tercer Lugar",ids:["3RD"]},
                  {key:"final",label:"⚽ Gran Final",ids:["FINAL"]},
                ].map(ph=>(
                  <div key={ph.key} style={S.card}>
                    <h3 style={S.cardTitle}>{ph.label}{submitted2&&<span style={{fontSize:11,color:"#ef5350",marginLeft:8}}>🔒</span>}</h3>
                    {ph.ids.map(id=>{
                      const bm=bracket[id];
                      const matchObj=bm?{id,phase:ph.key,home:bm.home,away:bm.away,date:bm.date,city:bm.city,label:bm.label}:{id,phase:ph.key,label:id};
                      return(<MatchRow key={id} match={matchObj} pred={myPreds[id]} result={results[id]} savePrediction={savePrediction} locked={submitted2}/>);
                    })}
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      )}
      {tab==="champion"&&(
        <div style={S.card}>
          <h3 style={S.cardTitle}>🏆 Predicción del Campeón {submitted&&<span style={{fontSize:11,color:"#ef5350",marginLeft:8}}>🔒 Bloqueado</span>}</h3>
          {[{key:"champion",label:"🥇 Campeón",pts:"15 pts"},{key:"runnerUp",label:"🥈 Subcampeón",pts:"10 pts"},{key:"third",label:"🥉 Tercer Lugar",pts:"7 pts"},{key:"fourth",label:"4° Lugar",pts:"5 pts"}].map(f=>(
            <div key={f.key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <span style={{minWidth:160,fontWeight:700,fontSize:15}}>{f.label}</span>
              <select style={{...S.select,...(submitted?{opacity:.6,cursor:"not-allowed"}:{})}}
                value={myChamp[f.key]||""} disabled={submitted}
                onChange={e=>saveChampPrediction(f.key,e.target.value)}>
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

// ============================================================
// GROUP STANDINGS TABLE
// ============================================================
function GroupStandingsTable({group, teams, myPreds}){
  // Calculate standings from user predictions
  const standings = teams.map(team => ({
    team, PJ:0, G:0, E:0, P:0, GF:0, GC:0, DG:0, PTS:0
  }));

  const getTeamIdx = (team) => standings.findIndex(s => s.team === team);

  GROUP_MATCHES.filter(m => m.group === group).forEach(m => {
    const pred = myPreds[m.id];
    if(!pred || pred.home === "" || pred.away === "") return;
    const h = parseInt(pred.home), a = parseInt(pred.away);
    if(isNaN(h) || isNaN(a)) return;

    const hi = getTeamIdx(m.home);
    const ai = getTeamIdx(m.away);
    if(hi === -1 || ai === -1) return;

    // Home team
    standings[hi].PJ++;
    standings[hi].GF += h;
    standings[hi].GC += a;
    standings[hi].DG += (h - a);

    // Away team
    standings[ai].PJ++;
    standings[ai].GF += a;
    standings[ai].GC += h;
    standings[ai].DG += (a - h);

    if(h > a){
      standings[hi].G++; standings[hi].PTS += 3;
      standings[ai].P++;
    } else if(a > h){
      standings[ai].G++; standings[ai].PTS += 3;
      standings[hi].P++;
    } else {
      standings[hi].E++; standings[hi].PTS++;
      standings[ai].E++; standings[ai].PTS++;
    }
  });

  // Sort: PTS → DG → GF
  standings.sort((a,b) => b.PTS - a.PTS || b.DG - a.DG || b.GF - a.GF);

  const hasAnyPred = standings.some(s => s.PJ > 0);

  return(
    <div style={S.card}>
      <h3 style={S.cardTitle}>📊 Tabla de Posiciones — Tu Pronóstico</h3>
      {!hasAnyPred && (
        <p style={{color:"#546e7a",fontSize:13}}>Ingresa tus pronósticos arriba para ver la tabla automáticamente.</p>
      )}
      {hasAnyPred && (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:"2px solid #1a2f4a"}}>
                {["#","Equipo","PJ","G","E","P","GF","GC","DG","PTS"].map(h=>(
                  <th key={h} style={{
                    padding:"6px 8px",textAlign: h==="Equipo"?"left":"center",
                    color:"#546e7a",fontWeight:700,fontSize:11,letterSpacing:.5,
                    textTransform:"uppercase",whiteSpace:"nowrap"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((s,i)=>{
                const isTop2 = i < 2;
                const rowBg = i===0?"rgba(249,168,37,.08)":i===1?"rgba(30,136,229,.07)":"transparent";
                return(
                  <tr key={s.team} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:rowBg,transition:"background .2s"}}>
                    <td style={{padding:"8px",textAlign:"center",fontWeight:800,color:i===0?"#f9a825":i===1?"#4fc3f7":"#546e7a",fontSize:16}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                    </td>
                    <td style={{padding:"8px",fontWeight:isTop2?700:400,color:isTop2?"#fff":"#b0bec5",whiteSpace:"nowrap"}}>
                      {s.team}
                      {isTop2 && <span style={{marginLeft:6,fontSize:10,color:"#81c784",fontWeight:700}}>CLASIFICA</span>}
                    </td>
                    <td style={{padding:"8px",textAlign:"center",color:"#90a4ae"}}>{s.PJ}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#81c784",fontWeight:s.G>0?700:400}}>{s.G}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#f9a825",fontWeight:s.E>0?700:400}}>{s.E}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#ef5350",fontWeight:s.P>0?700:400}}>{s.P}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#e0e0e0"}}>{s.GF}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#e0e0e0"}}>{s.GC}</td>
                    <td style={{padding:"8px",textAlign:"center",color:s.DG>0?"#81c784":s.DG<0?"#ef5350":"#90a4ae",fontWeight:700}}>
                      {s.DG>0?`+${s.DG}`:s.DG}
                    </td>
                    <td style={{padding:"8px",textAlign:"center",fontWeight:900,fontSize:16,color:i===0?"#f9a825":i===1?"#4fc3f7":"#e0e0e0"}}>
                      {s.PTS}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{fontSize:11,color:"#37474f",marginTop:10,textAlign:"right"}}>
            * Basado en tus pronósticos · Los 2 primeros clasifican
          </p>
        </div>
      )}
    </div>
  );
}

function MatchRow({match,pred,result,savePrediction,locked}){
  const isKnockout = ["round32","round16","quarters","semis","third","final"].includes(match.phase);
  const [h,setH]=useState(pred?.home??"");
  const [a,setA]=useState(pred?.away??"");
  const [ph,setPh]=useState(pred?.penHome??""); // penales local
  const [pa,setPa]=useState(pred?.penAway??""); // penales visitante
  useEffect(()=>{
    setH(pred?.home??""); setA(pred?.away??"");
    setPh(pred?.penHome??""); setPa(pred?.penAway??"");
  },[pred]);

  const isDraw = h!==""&&a!==""&&parseInt(h)===parseInt(a);
  const scored = result&&result.home!==""&&result.away!=="";
  const pts = scored?calcPoints(pred,result,match.phase):null;
  const maxPts = scored?(POINTS[match.phase]?.exactScore||3):null;
  const label = match.label||(match.home&&match.away?`${match.home} vs ${match.away}`:"");

  function onBlur(){
    if(locked) return;
    if(h===""||a==="") return;
    const penH = (isKnockout&&isDraw) ? ph : "";
    const penA = (isKnockout&&isDraw) ? pa : "";
    // Validate penalties: must have a winner
    if(isKnockout&&isDraw&&ph!==""&&pa!==""){
      if(parseInt(ph)===parseInt(pa)){return;} // no winner in penalties — don't save
    }
    savePrediction(match.id, h, a, penH, penA);
  }

  const rowBg=scored?(pts===maxPts?"rgba(129,199,132,.08)":pts>0?"rgba(249,168,37,.07)":"rgba(239,83,80,.06)"):"transparent";

  return(
    <div style={{...S.matchRow,background:rowBg,flexDirection:"column",alignItems:"flex-start",gap:6}}>
      {/* Date/time/city */}
      {(match.date||match.city) && (
        <div style={{display:"flex",gap:12,fontSize:11,color:"#546e7a",letterSpacing:.5}}>
          {match.date && <span>📅 {match.date}</span>}
          {match.time && <span>🕐 {match.time} (COL)</span>}
          {match.city && <span>📍 {match.city}</span>}
        </div>
      )}
      {/* Score row */}
      <div style={{display:"flex",alignItems:"center",gap:12,width:"100%",flexWrap:"wrap"}}>
        <span style={{flex:1,fontSize:14,fontWeight:600,minWidth:140,color:"#cfd8dc"}}>{label}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input className="scoreIn" style={{...S.scoreIn,...(locked?{opacity:.6,cursor:"not-allowed",borderColor:"#37474f"}:{})}}
            type="number" min="0" max="20" value={h} disabled={locked}
            onChange={e=>setH(e.target.value)} onBlur={onBlur} placeholder="—"/>
          <span style={{color:"#f9a825",fontWeight:900,fontSize:22,lineHeight:1}}>:</span>
          <input className="scoreIn" style={{...S.scoreIn,...(locked?{opacity:.6,cursor:"not-allowed",borderColor:"#37474f"}:{})}}
            type="number" min="0" max="20" value={a} disabled={locked}
            onChange={e=>setA(e.target.value)} onBlur={onBlur} placeholder="—"/>
          {locked&&<span style={{fontSize:12,color:"#546e7a"}}>🔒</span>}
        </div>
        {scored&&(
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
            <span style={{color:"#37474f"}}>Real:</span>
            <span style={{fontWeight:800,color:"#eceff1"}}>{result.home}–{result.away}</span>
            {result.penHome&&<span style={{color:"#4fc3f7",fontSize:11}}>(pen {result.penHome}–{result.penAway})</span>}
            <span style={{background:pts===maxPts?"#1b5e20":pts>0?"#e65100":"#b71c1c",color:"#fff",padding:"2px 8px",borderRadius:4,fontWeight:800,fontSize:12}}>+{pts}pts</span>
          </div>
        )}
      </div>
      {/* Penalty field — only for knockout + draw */}
      {isKnockout && isDraw && locked && pred?.penHome && (
        <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:8,paddingTop:4,borderTop:"1px dashed rgba(79,195,247,.2)",width:"100%"}}>
          <span style={{fontSize:12,color:"#4fc3f7",fontWeight:700}}>🥅 Penales:</span>
          <span style={{fontWeight:800,color:"#4fc3f7"}}>{pred.penHome} – {pred.penAway}</span>
          <span style={{fontSize:11,color:"#81c784",fontWeight:700}}>🔒</span>
        </div>
      )}
      {isKnockout && isDraw && !locked && (
        <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:8,paddingTop:6,borderTop:"1px dashed rgba(79,195,247,.3)",width:"100%",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#4fc3f7",fontWeight:700,letterSpacing:.5}}>🥅 PENALES:</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input className="scoreIn"
              style={{...S.scoreIn,width:44,fontSize:16,borderColor:"rgba(79,195,247,.5)"}}
              type="number" min="0" max="10" value={ph}
              onChange={e=>setPh(e.target.value)}
              placeholder="—"/>
            <span style={{color:"#4fc3f7",fontWeight:900,fontSize:18}}>:</span>
            <input className="scoreIn"
              style={{...S.scoreIn,width:44,fontSize:16,borderColor:"rgba(79,195,247,.5)"}}
              type="number" min="0" max="10" value={pa}
              onChange={e=>setPa(e.target.value)}
              placeholder="—"/>
          </div>
          {ph!==""&&pa!==""&&parseInt(ph)===parseInt(pa)&&(
            <span style={{color:"#ef5350",fontSize:11,fontWeight:700}}>⚠️ Debe haber un ganador</span>
          )}
          {ph!==""&&pa!==""&&parseInt(ph)!==parseInt(pa)&&(
            <>
              <span style={{color:"#81c784",fontSize:11,fontWeight:700}}>
                ✓ Avanza: {parseInt(ph)>parseInt(pa)?match.home:match.away}
              </span>
              <button
                style={{background:"#1b5e20",border:"none",borderRadius:6,padding:"5px 12px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}
                onClick={()=>savePrediction(match.id,h,a,ph,pa)}>
                💾 Guardar
              </button>
            </>
          )}
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

// ============================================================
// SPONSORS PAGE
// ============================================================
function SponsorsPage(){
  const benefits=[
    {icon:"📍",title:"Logo en la plataforma",desc:"Tu logo visible en todas las páginas de la Gran Polla Mundialista durante todo el torneo (11 Jun – 19 Jul 2026)."},
    {icon:"👥",title:"Audiencia activa",desc:"Participantes conectados diariamente siguiendo resultados, rankings y pronósticos — alta frecuencia de visitas."},
    {icon:"⏱️",title:"39 días de exposición",desc:"Todo el Mundial. Tu marca presente desde el partido inaugural hasta la Gran Final."},
    {icon:"📱",title:"100% digital",desc:"Plataforma accesible desde celular, tablet y computador. Tu logo llega a todos los dispositivos."},
    {icon:"🎁",title:"Premio en bono digital",desc:"Tu aporte es 100% en bonos digitales — sin efectivo. Canjeable por productos o servicios de tu negocio."},
    {icon:"🏆",title:"Asociación con el campeón",desc:"Tu marca aparece destacada en la pantalla del ganador y en el ranking final del torneo."},
  ];

  const spots=[
    {pos:"🥇 PATROCINADOR PRINCIPAL",color:"#f9a825",desc:"Logo grande en el header y dashboard · Mención en todas las notificaciones · Logo en pantalla del campeón · 1 cupo disponible",bono:"Bono digital $500.000 COP"},
    {pos:"🥈 PATROCINADOR OFICIAL",color:"#bdbdbd",desc:"Logo mediano en el ranking y bracket · Mención en la página de inicio · Varios cupos disponibles",bono:"Bono digital $200.000 COP"},
    {pos:"🥉 PATROCINADOR COLABORADOR",color:"#a1887f",desc:"Logo en la página de patrocinadores · Enlace a tu negocio o redes sociales · Varios cupos disponibles",bono:"Bono digital $100.000 COP"},
  ];

  const currentSponsors=[
    // Agregar patrocinadores aquí cuando se confirmen
  ];

  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>🤝 Patrocinadores</h2>

      {/* Hero de campaña */}
      <div style={{...S.heroCard,background:"linear-gradient(135deg,#1a1200 0%,#2d2000 50%,#1a1200 100%)",border:"1px solid rgba(249,168,37,.3)",marginBottom:20}}>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:12,letterSpacing:3,color:"#f9a825",textTransform:"uppercase",marginBottom:8}}>Campaña de patrocinio</div>
          <h3 style={{fontSize:28,fontWeight:700,color:"#fff",letterSpacing:1,marginBottom:12,lineHeight:1.2}}>
            ¡Sé parte de la<br/><span style={{color:"#f9a825"}}>Gran Polla Mundialista 2026!</span>
          </h3>
          <p style={{color:"#b0bec5",fontSize:14,lineHeight:1.7,maxWidth:600}}>
            La Gran Polla Mundialista lleva más de 15 años uniendo familias y amigos en torno al fútbol.
            Esta edición 2026 es la más grande de la historia — 48 equipos, 104 partidos, 39 días de emoción.
            <strong style={{color:"#fff"}}> Tu marca puede ser parte de esta celebración.</strong>
          </p>
          <div style={{marginTop:16,padding:"12px 16px",background:"rgba(249,168,37,.1)",borderRadius:8,border:"1px solid rgba(249,168,37,.3)",display:"inline-block"}}>
            <div style={{fontSize:12,color:"#f9a825",letterSpacing:1,marginBottom:4}}>CONTACTO EXCLUSIVO</div>
            <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>📧 mundialistagranpolla@gmail.com</div>
            <div style={{fontSize:12,color:"#90a4ae",marginTop:4}}>Toda la negociación se realiza únicamente por este correo</div>
          </div>
        </div>
        <div style={{fontSize:100,opacity:.06,position:"absolute",right:-10,bottom:-10,lineHeight:1}}>🤝</div>
      </div>

      {/* Beneficios */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>✨ ¿Por qué patrocinar?</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {benefits.map(b=>(
            <div key={b.title} style={{background:"rgba(255,255,255,.03)",border:"1px solid #1a2f4a",borderRadius:10,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:28,flexShrink:0}}>{b.icon}</span>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#e0e0e0",marginBottom:4}}>{b.title}</div>
                <div style={{fontSize:12,color:"#78909c",lineHeight:1.6}}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Paquetes */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>📦 Paquetes disponibles</h3>
        <p style={{color:"#546e7a",fontSize:13,marginBottom:16}}>
          Todos los aportes son <strong style={{color:"#81c784"}}>100% bonos digitales</strong>, sin efectivo.
        </p>
        {/* Prize table clarification */}
        <div style={{background:"rgba(249,168,37,.08)",border:"1px solid rgba(249,168,37,.3)",borderRadius:10,padding:"14px 16px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:24,flexShrink:0}}>📢</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#f9a825",marginBottom:4}}>Tabla de premiación</div>
            <div style={{fontSize:13,color:"#b0bec5",lineHeight:1.7}}>
              La tabla de premiación en regalos y bonos digitales de los patrocinadores <strong style={{color:"#fff"}}>se definirá antes del primer partido del Mundial</strong>, de acuerdo al número de participantes y patrocinadores confirmados. ¡Entre más patrocinadores, más premios para todos!
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {spots.map(s=>(
            <div key={s.pos} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${s.color}40`,borderLeft:`4px solid ${s.color}`,borderRadius:10,padding:"16px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
                <span style={{fontSize:16,fontWeight:800,color:s.color}}>{s.pos}</span>
                <span style={{background:`${s.color}20`,border:`1px solid ${s.color}60`,borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,color:s.color}}>{s.bono}</span>
              </div>
              <p style={{fontSize:13,color:"#90a4ae",lineHeight:1.6}}>{s.desc}</p>
              <a href="mailto:mundialistagranpolla@gmail.com?subject=Patrocinio Gran Polla Mundialista 2026"
                style={{display:"inline-block",marginTop:12,background:"linear-gradient(135deg,#1565c0,#1e88e5)",color:"#fff",border:"none",borderRadius:6,padding:"8px 18px",fontWeight:700,fontSize:13,textDecoration:"none",fontFamily:"inherit",cursor:"pointer",letterSpacing:.5}}>
                ✉️ Quiero este paquete
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Condiciones */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>📋 Condiciones del patrocinio</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            ["🎁","Todos los aportes son en bonos digitales — cero efectivo","#81c784"],
            ["📅","Vigencia: desde el 11 de junio hasta el 19 de julio de 2026 (todo el Mundial)","#4fc3f7"],
            ["🖼️","El patrocinador debe suministrar su logo en formato PNG o SVG fondo transparente","#f9a825"],
            ["📧","Toda la negociación se realiza únicamente por mundialistagranpolla@gmail.com","#f9a825"],
            ["🏆","El bono digital del premio se entrega al ganador al finalizar el torneo","#81c784"],
            ["❌","No se aceptan aportes en efectivo bajo ninguna modalidad","#ef5350"],
            ["✅","Se aceptan restaurantes, tiendas, almacenes, servicios digitales y cualquier negocio formal","#81c784"],
          ].map(([icon,text,color])=>(
            <div key={text} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"8px 10px",background:"rgba(255,255,255,.02)",borderRadius:8}}>
              <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
              <span style={{fontSize:13,color:"#90a4ae",lineHeight:1.6}}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MOCKUPS - Así se verá tu logo */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>👁️ Así se verá tu logo en la plataforma</h3>
        <p style={{color:"#546e7a",fontSize:13,marginBottom:20}}>Vista previa de cada ubicación publicitaria durante el torneo.</p>

        {/* PRINCIPAL - Header mockup */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:"#f9a825",marginBottom:10,letterSpacing:1}}>🥇 PATROCINADOR PRINCIPAL — Header de la plataforma</div>
          <div style={{background:"rgba(8,12,22,.97)",border:"2px solid #f9a825",borderRadius:10,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#FCD116,#003893,#CE1126)"}}/>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#fff",letterSpacing:2}}>GRAN POLLA <span style={{color:"#f9a825"}}>MUNDIALISTA 2026</span></div>
                <div style={{fontSize:8,color:"#546e7a",letterSpacing:2}}>CANADÁ · MÉXICO · ESTADOS UNIDOS</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:9,color:"#546e7a",letterSpacing:1}}>PATROCINADO POR</div>
              <div style={{background:"rgba(249,168,37,.15)",border:"2px dashed #f9a825",borderRadius:8,padding:"6px 16px",display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:16}}>🏢</span>
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:"#f9a825"}}>TU LOGO AQUÍ</div>
                  <div style={{fontSize:9,color:"#78909c"}}>tu empresa</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#37474f",marginTop:6,textAlign:"right"}}>★ Visible en TODAS las páginas · 39 días de exposición</div>
        </div>

        {/* OFICIAL - Ranking mockup */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:"#bdbdbd",marginBottom:10,letterSpacing:1}}>🥈 PATROCINADOR OFICIAL — Ranking y Bracket</div>
          <div style={{background:"#131d2e",border:"1px solid #1a2f4a",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"rgba(21,101,192,.2)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>🏆 Ranking en Tiempo Real</span>
              <div style={{background:"rgba(189,189,189,.15)",border:"2px dashed #bdbdbd",borderRadius:6,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14}}>🏪</span>
                <div style={{fontSize:10,fontWeight:800,color:"#bdbdbd"}}>TU LOGO AQUÍ</div>
              </div>
            </div>
            {[["🥇","Carlos H.","284"],["🥈","Sebastián F.","261"],["🥉","María L.","248"]].map(([med,name,pts])=>(
              <div key={name} style={{display:"flex",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                <span style={{width:40,fontSize:18}}>{med}</span>
                <span style={{flex:1,fontSize:13,color:"#cfd8dc"}}>{name}</span>
                <span style={{fontWeight:900,fontSize:18,color:"#f9a825"}}>{pts}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"#37474f",marginTop:6,textAlign:"right"}}>★ Visible en Ranking y Bracket durante todo el torneo</div>
        </div>

        {/* COLABORADOR - Sponsors page mockup */}
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#a1887f",marginBottom:10,letterSpacing:1}}>🥉 PATROCINADOR COLABORADOR — Página de Patrocinadores</div>
          <div style={{background:"#131d2e",border:"1px solid #1a2f4a",borderRadius:10,padding:"16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#f9a825",marginBottom:12,letterSpacing:.5}}>🌟 NUESTROS PATROCINADORES</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                {icon:"🍕",name:"Tu Restaurante",cat:"Gastronomía",highlight:true},
                {icon:"👕",name:"Tu Almacén",cat:"Moda"},
                {icon:"💻",name:"Tu Servicio",cat:"Digital"},
              ].map(sp=>(
                <div key={sp.name} style={{background:sp.highlight?"rgba(161,136,127,.15)":"rgba(255,255,255,.03)",border:sp.highlight?"2px dashed #a1887f":"1px solid #1a2f4a",borderRadius:8,padding:"12px",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>{sp.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:sp.highlight?"#a1887f":"#90a4ae"}}>{sp.name}</div>
                  <div style={{fontSize:10,color:"#37474f",marginTop:2}}>{sp.cat}</div>
                  {sp.highlight&&<div style={{fontSize:9,color:"#a1887f",marginTop:4,fontWeight:700}}>← TU LOGO AQUÍ</div>}
                </div>
              ))}
            </div>
          </div>
          <div style={{fontSize:11,color:"#37474f",marginTop:6,textAlign:"right"}}>★ Enlace directo a tu negocio o redes sociales</div>
        </div>
      </div>

      {/* Patrocinadores actuales */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>🌟 Nuestros Patrocinadores</h3>
        {currentSponsors.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:48,marginBottom:12,opacity:.3}}>🤝</div>
            <p style={{color:"#37474f",fontSize:14}}>Aún no hay patrocinadores confirmados.</p>
            <p style={{color:"#37474f",fontSize:13,marginTop:4}}>¡Sé el primero en unirte!</p>
            <a href="mailto:mundialistagranpolla@gmail.com?subject=Patrocinio Gran Polla Mundialista 2026"
              style={{display:"inline-block",marginTop:16,background:"linear-gradient(135deg,#f9a825,#ffa726)",color:"#000",border:"none",borderRadius:8,padding:"12px 24px",fontWeight:800,fontSize:14,textDecoration:"none",letterSpacing:1}}>
              📧 CONTACTAR AHORA
            </a>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {currentSponsors.map(sp=>(
              <div key={sp.name} style={{background:"rgba(255,255,255,.04)",border:"1px solid #1a2f4a",borderRadius:10,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>{sp.icon||"🏢"}</div>
                <div style={{fontWeight:700,fontSize:14,color:"#e0e0e0"}}>{sp.name}</div>
                <div style={{fontSize:11,color:"#546e7a",marginTop:4}}>{sp.category}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA final */}
      <div style={{textAlign:"center",padding:"32px 20px",background:"linear-gradient(135deg,#0d2137,#1a3a5c)",borderRadius:16,border:"1px solid rgba(30,136,229,.3)"}}>
        <div style={{fontSize:36,marginBottom:12}}>⚽🏆🎁</div>
        <h3 style={{fontSize:22,fontWeight:700,color:"#fff",marginBottom:8}}>¿Listo para patrocinar?</h3>
        <p style={{color:"#90a4ae",fontSize:14,marginBottom:20,maxWidth:400,margin:"0 auto 20px"}}>
          Escríbenos al correo y en menos de 24 horas te respondemos con todos los detalles.
        </p>
        <a href="mailto:mundialistagranpolla@gmail.com?subject=Patrocinio Gran Polla Mundialista 2026&body=Hola, me interesa patrocinar la Gran Polla Mundialista 2026. Por favor envíenme más información."
          style={{display:"inline-block",background:"linear-gradient(135deg,#f9a825,#ffa726)",color:"#000",border:"none",borderRadius:10,padding:"14px 32px",fontWeight:800,fontSize:16,textDecoration:"none",letterSpacing:1}}>
          📧 mundialistagranpolla@gmail.com
        </a>
      </div>
    </div>
  );
}

// ============================================================
// WORLD CUP BANNER
// ============================================================
function WorldCupBanner({totalPlayed, allScores}){
  const [tick, setTick] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [flagIdx, setFlagIdx] = useState(0);

  const TOURNAMENT_END   = new Date("2026-07-19T21:00:00-05:00");
  const TOURNAMENT_START = new Date("2026-06-11T14:00:00-05:00");
  const now = new Date();
  const totalMs = TOURNAMENT_END - TOURNAMENT_START;
  const elapsed = Math.max(0, Math.min(now - TOURNAMENT_START, totalMs));
  const progress = Math.round((elapsed / totalMs) * 100);
  const daysLeft = Math.max(0, Math.ceil((TOURNAMENT_END - now) / 86400000));

  const flags = [
    {flag:"🇲🇽", name:"México",  color:"#006847"},
    {flag:"🇺🇸", name:"USA",     color:"#B22234"},
    {flag:"🇨🇦", name:"Canadá",  color:"#FF0000"},
  ];

  useEffect(()=>{
    const t = setInterval(()=>{ setTick(n=>n+1); setBallAngle(a=>(a+2)%360); }, 50);
    const f = setInterval(()=>setFlagIdx(i=>(i+1)%3), 3000);
    return()=>{clearInterval(t);clearInterval(f);};
  },[]);

  const curFlag = flags[flagIdx];

  return(
    <div style={{borderRadius:16,overflow:"hidden",marginBottom:16,position:"relative",
      background:"linear-gradient(135deg,#050d18 0%,#0a1a2e 40%,#0d1f3c 100%)",
      border:"1px solid rgba(249,168,37,.2)",
      boxShadow:"0 8px 32px rgba(0,0,0,.5), 0 0 60px rgba(249,168,37,.05)"}}>
      {/* Stars */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(20)].map((_,i)=>(
          <div key={i} style={{position:"absolute",width:i%3===0?2:1,height:i%3===0?2:1,
            borderRadius:"50%",background:"#fff",
            opacity:0.1+(Math.sin(tick*0.05+i)*0.1),
            left:`${(i*17+7)%100}%`,top:`${(i*13+5)%100}%`,transition:"opacity .1s"}}/>
        ))}
        <div style={{position:"absolute",top:0,left:`${(tick*0.3)%120-20}%`,
          width:"15%",height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,.03),transparent)",pointerEvents:"none"}}/>
      </div>

      <div style={{position:"relative",zIndex:1,padding:"20px 24px"}}>
        {/* Title + ball */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:10,letterSpacing:4,color:"#f9a825",fontWeight:700,marginBottom:4}}>FIFA WORLD CUP</div>
            <div style={{fontSize:24,fontWeight:900,letterSpacing:2,color:"#fff",lineHeight:1}}>CANADA · MEXICO · USA</div>
            <div style={{fontSize:36,fontWeight:900,color:"#f9a825",letterSpacing:1,lineHeight:1.1}}>2026</div>
          </div>
          <div style={{position:"relative",flexShrink:0}}>
            <svg width="80" height="80" viewBox="0 0 48 48"
              style={{filter:"drop-shadow(0 0 16px rgba(252,209,22,.6))",
                transform:`rotate(${ballAngle}deg)`,transition:"transform .05s linear"}}>
              <defs>
                <radialGradient id="wcb" cx="40%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FCD116"/>
                  <stop offset="45%" stopColor="#003893"/>
                  <stop offset="100%" stopColor="#CE1126"/>
                </radialGradient>
                <clipPath id="wcc"><circle cx="24" cy="24" r="21"/></clipPath>
              </defs>
              <circle cx="24" cy="24" r="21" fill="url(#wcb)"/>
              <ellipse cx="24" cy="10" rx="16" ry="10" fill="#FCD116" opacity=".55" clipPath="url(#wcc)"/>
              <ellipse cx="24" cy="38" rx="16" ry="10" fill="#CE1126" opacity=".5" clipPath="url(#wcc)"/>
              <ellipse cx="17" cy="15" rx="5" ry="3" fill="#fff" opacity=".2" transform="rotate(-25,17,15)"/>
            </svg>
            <div style={{position:"absolute",inset:-4,borderRadius:"50%",
              border:"1px solid rgba(249,168,37,.3)",animation:"pulse 2s infinite"}}/>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:16}}>
          {[
            {icon:"⚽",val:totalPlayed,max:104,label:"Partidos"},
            {icon:"👥",val:allScores.length,max:null,label:"Participantes"},
            {icon:"📅",val:daysLeft,max:null,label:"Días restantes"},
            {icon:"🏟️",val:16,max:null,label:"Ciudades sede"},
          ].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 8px",
              border:"1px solid rgba(255,255,255,.07)",textAlign:"center"}}>
              <div style={{fontSize:18,marginBottom:3}}>{s.icon}</div>
              <div style={{fontSize:22,fontWeight:900,color:"#f9a825",lineHeight:1}}>
                {s.val}{s.max?<span style={{fontSize:11,color:"#546e7a",fontWeight:400}}>/{s.max}</span>:""}
              </div>
              <div style={{fontSize:9,color:"#546e7a",letterSpacing:.5,marginTop:2,textTransform:"uppercase"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#546e7a",marginBottom:4}}>
            <span>11 Jun 2026</span>
            <span style={{color:"#f9a825",fontWeight:700}}>🏆 {progress}% del torneo</span>
            <span>19 Jul 2026</span>
          </div>
          <div style={{height:6,background:"rgba(255,255,255,.07)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:3,width:`${Math.max(1,progress)}%`,
              background:"linear-gradient(90deg,#003893,#FCD116,#CE1126)",transition:"width .5s"}}/>
          </div>
        </div>

        {/* Rotating flag */}
        <div style={{display:"flex",alignItems:"center",gap:10,
          background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 14px",
          border:`1px solid ${curFlag.color}40`,transition:"border .5s"}}>
          <span style={{fontSize:26}}>{curFlag.flag}</span>
          <div>
            <div style={{fontSize:10,color:"#546e7a",letterSpacing:1}}>PAÍS SEDE</div>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{curFlag.name}</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:10,color:"#546e7a",textAlign:"right"}}>
            <div style={{color:"#f9a825",fontWeight:700,fontSize:11}}>104 partidos</div>
            <div>48 equipos · 12 grupos</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REGLAS PAGE
// ============================================================
function ReglasPage(){
  const puntos=[
    {fase:"Fase de Grupos",items:[["Resultado exacto (score correcto)","3 pts","#81c784"],["Resultado correcto (ganador/empate)","1 pt","#aed581"]]},
    {fase:"Ronda de 32",items:[["Resultado exacto","4 pts","#4fc3f7"],["Resultado correcto","2 pts","#81d4fa"]]},
    {fase:"Octavos de Final",items:[["Resultado exacto","5 pts","#4dd0e1"],["Resultado correcto","3 pts","#80deea"]]},
    {fase:"Cuartos de Final",items:[["Resultado exacto","6 pts","#f9a825"],["Resultado correcto","4 pts","#ffd54f"]]},
    {fase:"Semifinales",items:[["Resultado exacto","7 pts","#ffa726"],["Resultado correcto","5 pts","#ffcc80"]]},
    {fase:"Tercer Lugar",items:[["Resultado exacto","8 pts","#ff7043"],["Resultado correcto","6 pts","#ffab91"]]},
    {fase:"Gran Final",items:[["Resultado exacto","10 pts","#ef5350"],["Resultado correcto","7 pts","#ef9a9a"]]},
    {fase:"Predicción Campeón",items:[["Acertar campeón","15 pts","#f9a825"],["Acertar subcampeón","10 pts","#bdbdbd"],["Acertar tercer lugar","7 pts","#a1887f"],["Acertar cuarto lugar","5 pts","#90a4ae"]]},
  ];
  return(
    <div style={{animation:"slideIn .3s ease"}}>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:22,letterSpacing:1,textTransform:"uppercase",borderBottom:"1px solid #1a2f4a",paddingBottom:10,color:"#e8eaf6"}}>
        📋 Reglas y Sistema de Puntuación
      </h2>
      <div style={{background:"linear-gradient(135deg,#0d2137,#1a3a5c)",borderRadius:12,padding:"20px 24px",marginBottom:16,border:"1px solid #1a2f4a"}}>
        <h3 style={{fontSize:15,fontWeight:700,color:"#f9a825",marginBottom:12}}>¿Cómo funciona la Gran Polla Mundialista?</h3>
        {[["1️⃣","Regístrate y completa tus pronósticos de los 72 partidos de la Fase de Grupos (Grupos A–L)."],
          ["2️⃣","Presiona ENVIAR FASE 1 antes del primer partido para bloquear tus pronósticos. Una vez enviados, no se pueden modificar."],
          ["3️⃣","Después del 27 de junio se abre la Fase 2: completa tus pronósticos de Eliminatorias hasta la Gran Final."],
          ["4️⃣","El ranking se actualiza automáticamente cada vez que entra un resultado oficial."],
          ["5️⃣","¡El participante con más puntos al finalizar el torneo el 19 de julio es el campeón!"],
        ].map(([n,t])=>(
          <div key={n} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:8}}>
            <span style={{fontSize:18,flexShrink:0}}>{n}</span>
            <span style={{fontSize:13,color:"#b0bec5",lineHeight:1.6}}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{background:"#131d2e",borderRadius:12,padding:20,marginBottom:16,border:"1px solid #1a2f4a"}}>
        <h3 style={{fontSize:15,fontWeight:700,color:"#f9a825",marginBottom:16,textTransform:"uppercase",letterSpacing:.5}}>⭐ Sistema de Puntuación por Fase</h3>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {puntos.map(p=>(
            <div key={p.fase}>
              <div style={{fontSize:11,fontWeight:700,color:"#546e7a",letterSpacing:1,textTransform:"uppercase",marginBottom:6,paddingBottom:4,borderBottom:"1px solid rgba(255,255,255,.05)"}}>{p.fase}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                {p.items.map(([k,v,c])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"rgba(255,255,255,.02)",borderRadius:6}}>
                    <span style={{color:"#78909c",fontSize:12}}>{k}</span>
                    <span style={{color:c,fontWeight:800,fontSize:13}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:"#131d2e",borderRadius:12,padding:20,border:"1px solid #1a2f4a"}}>
        <h3 style={{fontSize:15,fontWeight:700,color:"#f9a825",marginBottom:14,textTransform:"uppercase",letterSpacing:.5}}>⚠️ Reglas Importantes</h3>
        {[["🔒","Una vez presionado ENVIAR, los pronósticos quedan bloqueados definitivamente. No hay excepciones."],
          ["📅","La Fase 1 debe enviarse ANTES del primer partido: México vs Sudáfrica, 11 Jun, 2:00 PM hora Colombia."],
          ["⚽","En partidos de eliminatorias que terminen en empate, se debe pronosticar el resultado de penales. El ganador en penales avanza al bracket."],
          ["📊","Los pronósticos de todos los participantes se hacen públicos 30 minutos antes del primer partido."],
          ["🏆","La tabla de premiación en bonos digitales se anunciará antes del inicio del torneo, según participantes y patrocinadores confirmados."],
          ["📧","Ante cualquier duda: mundialistagranpolla@gmail.com"],
        ].map(([icon,text])=>(
          <div key={text} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"8px 10px",background:"rgba(255,255,255,.02)",borderRadius:8,marginBottom:6}}>
            <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
            <span style={{fontSize:13,color:"#90a4ae",lineHeight:1.6}}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================
function AdminPage({results,saveResult,phase2Open,phase2Deadline,adminSetPhase2,allScores,allProfiles,allSubmitted}){
  const [phase,setPhase]=useState("groups");
  const [selGrp,setSelGrp]=useState("A");
  const [deadlineInput,setDeadlineInput]=useState(phase2Deadline||"");
  const [showRanking,setShowRanking]=useState(false);
  const [copied,setCopied]=useState(false);
  const [copiedAll,setCopiedAll]=useState(false);

  // Users who have NOT submitted yet
  const pending = Object.entries(allProfiles)
    .filter(([uid,p]) => !allSubmitted[uid] && !p.isAdmin)
    .map(([uid,p]) => ({uid, name:p.name, email:p.email||""}));

  const pendingEmails = pending.map(p=>p.email).filter(Boolean).join(", ");

  // ALL participants (excluding admin)
  const allParticipants = Object.entries(allProfiles)
    .filter(([uid,p]) => !p.isAdmin)
    .map(([uid,p]) => ({uid, name:p.name, email:p.email||""}));
  const allEmails = allParticipants.map(p=>p.email).filter(Boolean).join(", ");

  function copyEmails(){
    navigator.clipboard.writeText(pendingEmails).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 2500);
    });
  }

  function copyAllEmails(){
    navigator.clipboard.writeText(allEmails).then(()=>{
      setCopiedAll(true);
      setTimeout(()=>setCopiedAll(false), 2500);
    });
  }

  const phases=[
    {key:"groups",label:"Grupos"},{key:"round32",label:"Ronda 32"},
    {key:"round16",label:"Octavos"},{key:"quarters",label:"Cuartos"},
    {key:"semis",label:"Semis"},{key:"third",label:"3er Lugar"},{key:"final",label:"Final"},
  ];
  const matches=phase==="groups"
    ?GROUP_MATCHES.filter(m=>m.group===selGrp)
    :KNOCKOUT_ROUNDS.filter(m=>m.phase===phase);

  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>⚙️ Panel Admin</h2>

      {/* Phase 2 controls */}
      <div style={{...S.card,border:`1px solid ${phase2Open?"#81c784":"#1a2f4a"}`}}>
        <h3 style={S.cardTitle}>🚀 Control Fase 2 — Eliminatorias</h3>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap",marginBottom:16}}>
          <div style={{flex:1,minWidth:250}}>
            <div style={{fontSize:13,color:"#90a4ae",marginBottom:8}}>
              Estado actual: <strong style={{color:phase2Open?"#81c784":"#ef5350"}}>{phase2Open?"🟢 ABIERTA":"🔴 CERRADA"}</strong>
            </div>
            <div style={{fontSize:12,color:"#546e7a",lineHeight:1.6}}>
              Al abrir la Fase 2, todos los participantes que hayan enviado su Fase 1 podrán ingresar pronósticos de eliminatorias.
              Asegúrate de haber cargado los resultados reales de grupos antes de abrir.
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:12}}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{fontSize:12,color:"#546e7a",marginBottom:4}}>Fecha límite Fase 2 (ISO 8601):</div>
            <input style={{...S.input,fontSize:13}} placeholder="2026-06-29T23:59:00-05:00"
              value={deadlineInput} onChange={e=>setDeadlineInput(e.target.value)}/>
            <div style={{fontSize:11,color:"#37474f",marginTop:4}}>Ej: 2026-06-29T23:59:00-05:00 (hora Colombia)</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button style={{background:"linear-gradient(135deg,#1b5e20,#2e7d32)",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}
            onClick={()=>adminSetPhase2(true,deadlineInput||null)}>
            🟢 Abrir Fase 2
          </button>
          <button style={{background:"rgba(239,83,80,.15)",border:"1px solid #ef5350",color:"#ef5350",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}
            onClick={()=>adminSetPhase2(false,null)}>
            🔴 Cerrar Fase 2
          </button>
        </div>
        {phase2Deadline&&(
          <div style={{marginTop:10,fontSize:12,color:"#90a4ae"}}>
            Límite actual: {new Date(phase2Deadline).toLocaleString("es-CO",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})}
          </div>
        )}
      </div>

      {/* Pending users */}
      <div style={{...S.card,border:`1px solid ${pending.length>0?"rgba(249,168,37,.4)":"#1a2f4a"}`}}>
        <h3 style={S.cardTitle}>
          ⏳ Pendientes por enviar Fase 1
          <span style={{marginLeft:8,background:"rgba(249,168,37,.2)",color:"#f9a825",fontSize:11,padding:"2px 8px",borderRadius:4,fontWeight:700}}>
            {pending.length} de {Object.keys(allProfiles).length-1} participantes
          </span>
        </h3>
        {pending.length===0 ? (
          <p style={{color:"#81c784",fontSize:13}}>✅ ¡Todos los participantes ya enviaron su Fase 1!</p>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
              {pending.map(p=>(
                <div key={p.uid} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"rgba(249,168,37,.05)",borderRadius:7,border:"1px solid rgba(249,168,37,.15)"}}>
                  <span style={{fontSize:16}}>⏳</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:"#e0e0e0"}}>{p.name}</span>
                  <span style={{fontSize:12,color:"#546e7a"}}>{p.email}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <button style={{background:"linear-gradient(135deg,#1565c0,#1e88e5)",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}
                onClick={copyEmails}>
                {copied?"✅ ¡Copiado!":"📋 Copiar correos"}
              </button>
              <a href={`mailto:?bcc=${pendingEmails}&subject=⏰ Recordatorio: Envía tus pronósticos — Gran Polla Mundialista 2026&body=Hola!%0D%0A%0D%0ARecordamos que aún no has enviado tus pronósticos de la Fase 1 en la Gran Polla Mundialista 2026.%0D%0A%0D%0A👉 Ingresa aquí: https://granpollamundialista.com%0D%0A%0D%0AUna vez ingreses tus pronósticos en todos los grupos, presiona el botón 🔒 ENVIAR FASE 1 para bloquearlos.%0D%0A%0D%0A¡No te quedes por fuera!%0D%0A%0D%0AOrganización Gran Polla Mundialista 2026`}
                style={{background:"rgba(129,199,132,.15)",border:"1px solid #81c784",color:"#81c784",borderRadius:7,padding:"8px 16px",fontWeight:700,fontSize:13,textDecoration:"none",fontFamily:"inherit"}}>
                ✉️ Abrir Gmail con recordatorio
              </a>
            </div>
            <p style={{fontSize:11,color:"#37474f",marginTop:8}}>
              El botón "Abrir Gmail" abre tu cliente de correo con todos los pendientes en BCC y el mensaje de recordatorio listo.
            </p>
          </>
        )}
      </div>

      {/* Ranking preview */}
      <div style={{...S.card,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <h3 style={S.cardTitle}>🏆 Ranking Actual ({allScores.length} participantes)</h3>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button
              style={{background:copiedAll?"linear-gradient(135deg,#1b5e20,#2e7d32)":"linear-gradient(135deg,#4a148c,#7b1fa2)",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit",transition:"all .2s"}}
              onClick={copyAllEmails}>
              {copiedAll?"✅ ¡Copiados!":"📧 Copiar todos los correos"}
            </button>
            <button style={{...S.tab,fontSize:11}} onClick={()=>setShowRanking(s=>!s)}>
              {showRanking?"Ocultar":"Ver ranking"}
            </button>
          </div>
        </div>
        {showRanking&&(
          <div style={{marginTop:10}}>
            {allScores.map((r,i)=>(
              <div key={r.uid} style={{display:"flex",alignItems:"center",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,.04)",borderRadius:6,opacity:r.eliminated?0.65:1}}>
                <span style={{width:36,textAlign:"center",fontSize:18}}>{r.eliminated?"❌":(["🥇","🥈","🥉"][i]||`#${i+1}`)}</span>
                <span style={{flex:1,fontSize:13,color:"#cfd8dc",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{textDecoration:r.eliminated?"line-through":"none"}}>{r.name}</span>
                  {r.eliminated&&(
                    <span style={{fontSize:9,fontWeight:800,color:"#ef5350",background:"rgba(239,83,80,.15)",border:"1px solid #ef5350",borderRadius:5,padding:"1px 6px",letterSpacing:.5,textTransform:"uppercase"}}>
                      ELIMINADO
                    </span>
                  )}
                </span>
                <span style={{fontWeight:800,fontSize:16,color:r.eliminated?"#ef5350":"#f9a825"}}>{r.score} pts</span>
              </div>
            ))}
            {allScores.length===0&&<p style={{color:"#37474f",fontSize:13}}>Sin participantes aún.</p>}
          </div>
        )}
      </div>

      {/* Results entry */}
      <div style={S.tabRow}>
        {phases.map(p=>(
          <button key={p.key} onClick={()=>setPhase(p.key)} style={{...S.tab,...(phase===p.key?S.tabActive:{})}}>{p.label}</button>
        ))}
      </div>
      {phase==="groups"&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {Object.keys(GROUPS).map(g=>(
            <button key={g} onClick={()=>setSelGrp(g)} style={{...S.groupTab,...(selGrp===g?S.groupTabActive:{})}}>{g}</button>
          ))}
        </div>
      )}
      <div style={S.card}>
        {matches.map(m=>(
          <ResultRow key={m.id} m={m} res={results[m.id]} saveResult={saveResult}/>
        ))}
      </div>
    </div>
  );
}

// ── Fila individual de resultado (necesita su propio componente para poder usar useState) ──
function ResultRow({m, res, saveResult}){
  const [h,setH]=useState(res?.home??"");
  const [a,setA]=useState(res?.away??"");
  const saved=res&&res.home!=="";
  const label=m.label||(m.home&&m.away?`${m.home} vs ${m.away}`:"");

  // Sincronizar si el resultado externo cambia (otro admin lo guardó)
  useEffect(()=>{
    if(res?.home!==undefined) setH(res.home);
    if(res?.away!==undefined) setA(res.away);
  },[res?.home, res?.away]);

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
}
function ComparativoPage({allProfiles, allPredictions, allSubmitted, allScores, results, currentUid}){
  const [selGroup, setSelGroup] = useState("A");
  const [now, setNow] = useState(new Date());

  // First match: Mexico vs Sudafrica - Jun 11 2026 2:00 PM COL (UTC-5) = 19:00 UTC
  const FIRST_MATCH = new Date("2026-06-11T19:00:00Z");
  const PUBLISH_AT  = new Date(FIRST_MATCH.getTime() - 30 * 60 * 1000);
  const isPublished = now >= PUBLISH_AT;
  const msLeft = PUBLISH_AT - now;

  useEffect(()=>{
    if(isPublished) return;
    const t = setInterval(()=>setNow(new Date()), 1000);
    return ()=>clearInterval(t);
  },[isPublished]);

  function formatCountdown(ms){
    if(ms <= 0) return null;
    const h = Math.floor(ms/3600000);
    const m = Math.floor((ms%3600000)/60000);
    const s = Math.floor((ms%60000)/1000);
    const d = Math.floor(ms/86400000);
    if(d > 0) return `${d}d ${String(h%24).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  // Count submitted — use allSubmitted if loaded, else fallback to allScores length
  const submittedCount = Object.values(allSubmitted).filter(v=>v===true).length || 0;
  const displayCount = submittedCount > 0 ? submittedCount : allScores.length;

  // Only show players who submitted phase 1
  const players = Object.entries(allProfiles)
    .filter(([uid]) => allSubmitted[uid] === true)
    .map(([uid, p]) => ({uid, name: p.name}))
    .sort((a,b) => a.name.localeCompare(b.name));

  const matches = GROUP_MATCHES.filter(m => m.group === selGroup);

  function getCellStyle(pred, actual){
    if(!actual || actual.home === "") return {};
    if(!pred || pred.home === "") return {};
    const pts = calcPoints(pred, actual, "groups");
    const max = POINTS.groups.exactScore;
    if(pts === max) return {background:"rgba(129,199,132,.18)", color:"#81c784"};
    if(pts > 0)     return {background:"rgba(249,168,37,.12)", color:"#f9a825"};
    return {background:"rgba(239,83,80,.08)", color:"#ef5350"};
  }

  // Not yet published — show countdown
  if(!isPublished){
    return(
      <div style={S.section}>
        <h2 style={S.sectionTitle}>📊 Comparativo de Pronósticos</h2>
        <div style={{background:"rgba(21,101,192,.12)",border:"1px solid rgba(30,136,229,.3)",borderRadius:16,padding:"40px 24px",textAlign:"center",marginTop:8}}>
          <div style={{fontSize:52,marginBottom:12}}>🔒</div>
          <h3 style={{fontSize:22,fontWeight:800,color:"#4fc3f7",marginBottom:10}}>
            Pronósticos bloqueados hasta 30 min antes del inicio
          </h3>
          <p style={{color:"#90a4ae",fontSize:14,lineHeight:1.7,maxWidth:480,margin:"0 auto 24px"}}>
            Los pronósticos de todos los participantes se publicarán automáticamente
            <strong style={{color:"#fff"}}> 30 minutos antes del primer partido</strong>:<br/>
            México vs Sudáfrica — Miércoles 11 de junio, 2:00 PM hora Colombia
          </p>
          <div style={{display:"inline-flex",gap:8,justifyContent:"center",marginBottom:16}}>
            {formatCountdown(msLeft)?.split(":").length === 3 ?
              formatCountdown(msLeft).split(":").map((v,i)=>(
                <div key={i} style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:"12px 16px",minWidth:64,textAlign:"center"}}>
                  <div style={{fontSize:32,fontWeight:900,color:"#f9a825",lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:"#546e7a",letterSpacing:1,marginTop:4}}>{["HRS","MIN","SEG"][i]}</div>
                </div>
              )) : (
                <div style={{fontSize:20,fontWeight:700,color:"#f9a825"}}>{formatCountdown(msLeft)}</div>
              )
            }
          </div>
          <div style={{fontSize:13,color:"#546e7a"}}>
            Se publicarán los pronósticos de <strong style={{color:"#fff"}}>{displayCount} participante{displayCount!==1?"s":""}</strong> que ya enviaron su Fase 1
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={S.section}>
      <h2 style={S.sectionTitle}>📊 Comparativo de Pronósticos</h2>
      <p style={{color:"#546e7a",fontSize:13,marginBottom:16}}>
        Pronósticos de los {players.length} participantes que enviaron su Fase 1.
        <span style={{marginLeft:12,display:"inline-flex",gap:10,flexWrap:"wrap"}}>
          <span style={{background:"rgba(129,199,132,.18)",color:"#81c784",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>✓ Exacto</span>
          <span style={{background:"rgba(249,168,37,.12)",color:"#f9a825",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>~ Correcto</span>
          <span style={{background:"rgba(239,83,80,.08)",color:"#ef5350",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>✗ Incorrecto</span>
        </span>
      </p>

      {/* Group selector */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {Object.keys(GROUPS).map(g=>(
          <button key={g} onClick={()=>setSelGroup(g)}
            style={{...S.groupTab,...(selGroup===g?S.groupTabActive:{})}}>
            {g}
          </button>
        ))}
      </div>

      {players.length === 0 && (
        <div style={S.card}>
          <p style={{color:"#37474f",textAlign:"center",padding:"20px 0"}}>
            Ningún participante ha enviado su Fase 1 aún.
          </p>
        </div>
      )}

      {players.length > 0 && (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:600}}>
            <thead>
              <tr style={{borderBottom:"2px solid #1a2f4a"}}>
                <th style={{padding:"8px 10px",textAlign:"left",color:"#546e7a",fontWeight:700,fontSize:11,letterSpacing:.5,textTransform:"uppercase",minWidth:160,position:"sticky",left:0,background:"#131d2e",zIndex:2}}>
                  Partido
                </th>
                <th style={{padding:"8px 10px",textAlign:"center",color:"#f9a825",fontWeight:700,fontSize:11,background:"#131d2e",whiteSpace:"nowrap"}}>
                  ⚽ Real
                </th>
                {players.map(p=>(
                  <th key={p.uid} style={{
                    padding:"8px 8px",textAlign:"center",
                    color: p.uid===currentUid?"#f9a825":"#90a4ae",
                    fontWeight: p.uid===currentUid?800:600,
                    fontSize:11,whiteSpace:"nowrap",minWidth:76,
                    background: p.uid===currentUid?"rgba(249,168,37,.08)":"#131d2e",
                  }}>
                    {p.name.split(" ")[0]}
                    {p.uid===currentUid&&<div style={{fontSize:9,color:"#f9a825"}}>▶ TÚ</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m,i)=>{
                const actual = results[m.id];
                const hasResult = actual && actual.home !== "";
                return(
                  <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2===0?"transparent":"rgba(255,255,255,.02)"}}>
                    <td style={{padding:"7px 10px",fontWeight:600,color:"#cfd8dc",position:"sticky",left:0,background:i%2===0?"#0f1624":"#131d2e",zIndex:1,fontSize:11}}>
                      {m.home} vs {m.away}
                      {m.date&&<div style={{fontSize:9,color:"#546e7a",marginTop:1}}>📅 {m.date} {m.time&&`· ${m.time}`}</div>}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"center",fontWeight:800,
                      color:hasResult?"#fff":"#37474f",
                      background:hasResult?"rgba(255,255,255,.05)":"transparent",
                      whiteSpace:"nowrap"}}>
                      {hasResult?`${actual.home}–${actual.away}`:"—"}
                    </td>
                    {players.map(p=>{
                      const pred = allPredictions[p.uid]?.[m.id];
                      const hasPred = pred && pred.home!=="" && pred.away!=="";
                      const cs = hasResult?getCellStyle(pred,actual):{};
                      return(
                        <td key={p.uid} style={{
                          padding:"7px 6px",textAlign:"center",
                          fontWeight:hasPred?700:400,
                          color:cs.color||(hasPred?"#b0bec5":"#37474f"),
                          background:cs.background||(p.uid===currentUid?"rgba(249,168,37,.04)":"transparent"),
                          fontSize:12,whiteSpace:"nowrap",
                        }}>
                          {hasPred?`${pred.home}–${pred.away}`:"—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{borderTop:"2px solid #1a2f4a",background:"rgba(255,255,255,.04)"}}>
                <td style={{padding:"8px 10px",fontWeight:800,color:"#f9a825",fontSize:11,position:"sticky",left:0,background:"rgba(21,37,61,.95)"}}>
                  PUNTOS GRUPO {selGroup}
                </td>
                <td></td>
                {players.map(p=>{
                  const preds=allPredictions[p.uid]||{};
                  let pts=0;
                  matches.forEach(m=>{
                    const actual=results[m.id];
                    const pred=preds[m.id];
                    if(actual&&pred) pts+=calcPoints(pred,actual,"groups");
                  });
                  return(
                    <td key={p.uid} style={{
                      padding:"8px 6px",textAlign:"center",fontWeight:900,fontSize:14,
                      color:p.uid===currentUid?"#f9a825":"#e0e0e0",
                      background:p.uid===currentUid?"rgba(249,168,37,.1)":"transparent",
                    }}>
                      {pts>0?pts:"—"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
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
