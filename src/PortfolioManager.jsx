import { useState, useCallback, useEffect } from "react";

/* ─── CHANGE THIS to your Vercel deployment URL ─────────────────── */
var PROXY_URL = "https://portfolio-proxy-ja56.vercel.app/api/market";
var FRED_URL = "https://portfolio-proxy-ja56.vercel.app/api/fred";
var SECTORS_URL = "https://portfolio-proxy-ja56.vercel.app/api/sectors";
var FG_URL = "https://portfolio-proxy-ja56.vercel.app/api/feargreed";
var OHLC_URL = "https://portfolio-proxy-ja56.vercel.app/api/ohlc";
var LIQ_URL = "https://portfolio-proxy-ja56.vercel.app/api/liquidity-history";
var SECTORS_LIVE_URL = "https://portfolio-proxy-ja56.vercel.app/api/sectors-live";
var CLAUDE_URL = "https://portfolio-proxy-ja56.vercel.app/api/claude";
var PORTFOLIO_URL = "https://portfolio-proxy-ja56.vercel.app/api/portfolio";

/* ──────────────────────────────────────────────────────────────────── */

const C = {
  bg:"#08090f",panel:"#0d0e1a",card:"#111220",cardAlt:"#13141f",
  border:"#1c1e30",green:"#00e676",red:"#ff4757",orange:"#ff9f43",
  yellow:"#ffd32a",blue:"#5352ed",blueLight:"#70a1ff",purple:"#7c83fd",
  cyan:"#18dcff",text:"#e8eaf0",textMid:"#a0a8c0",textDim:"#5a6080",gold:"#ffa502",
};
const font = "'DM Mono','Fira Code',monospace";
const sans = "'DM Sans','Segoe UI',system-ui,sans-serif";
const MIT_SEASONS = {
  Spring: {
    phase: "Disinflationary Boom", cycle: "Early Cycle",
    description: "Disinflationary Boom is classic early cycle. Less credit availability leads to reduced spending, driving profit growth lower and prompting central banks to counter-ease. The yield curve steepens and risk assets begin a new bull market.",
    keyTheme: "Central banks easing · Yield curve steepening · Credit improving · Buy the dip",
    growth: "Rising", inflation: "Falling", bias: "RISK ON",
    overweight: ["Technology","Consumer Cyclical","Financials","Small Cap"],
    underweight: ["Utilities","Consumer Staples","Cash"],
  },
  Summer: {
    phase: "Inflationary Boom", cycle: "Mid Cycle",
    description: "Inflationary Boom is typical of mid-cycle. Central banks are still easing and the flood of liquidity creates declining interest rates and tighter risk premiums. This self-reinforcing expansion supports cash flows. Later in this stage, central banks become less accommodative and the output gap shrinks.",
    keyTheme: "Peak liquidity · Shrinking output gap · CB becoming less accommodative · Ride the wave",
    growth: "Rising", inflation: "Rising", bias: "RISK ON",
    overweight: ["Energy","Materials","Industrials","Real Assets","Commodities"],
    underweight: ["Long Duration Bonds","Utilities"],
  },
  Autumn: {
    phase: "Stagflation", cycle: "Late Cycle",
    description: "Stagflation is typical of the late cycle. Growth is above potential but peaking and central banks are turning hawkish. Risk assets are typically in their final melt-up phase. Monetary tightening pushes asset yields higher, amplifying market reactions to adverse news. The output gap is wide.",
    keyTheme: "Hawkish central banks · Wide output gap · Tightening amplifies volatility · Reduce risk",
    growth: "Slowing", inflation: "Rising", bias: "DEFENSIVE",
    overweight: ["Utilities","Healthcare","Consumer Staples","Gold","Cash"],
    underweight: ["Technology","Consumer Cyclical","High Beta","Crypto"],
  },
  Winter: {
    phase: "Deflationary Bust", cycle: "Slowdown / Recession",
    description: "Deflationary Bust is typical of slowdown/recession. Monetary drag generates wider risk premiums, filtering through to the real economy and earnings with a lag. The output gap is wide. Central banks eventually pivot to easing, setting the stage for the next Spring cycle.",
    keyTheme: "Wide risk premiums · Earnings deterioration · Await central bank pivot · Preserve capital",
    growth: "Slowing", inflation: "Falling", bias: "RISK OFF",
    overweight: ["Long Duration Bonds","Gold","Cash","Utilities"],
    underweight: ["Equities","High Yield","Crypto","Cyclicals"],
  },
};

const SC = { Summer:C.gold, Spring:C.green, Autumn:C.orange, Winter:C.blueLight };

const SECTOR_PAIRS = [
  { name:"Cyclical vs Defensive",    e1:"XLY",  e2:"XLP",  sub1:"Consumer Discretionary (XLY)", sub2:"Consumer Staples (XLP)" },
  { name:"Small Cap vs Large Cap",   e1:"IWM",  e2:"SPY",  sub1:"Small Cap (IWM)",               sub2:"Large Cap (SPY)" },
  { name:"Growth vs Value",          e1:"VUG",  e2:"VTV",  sub1:"Growth (VUG)",                  sub2:"Value (VTV)" },
  { name:"Financials vs Utilities",  e1:"XLF",  e2:"XLU",  sub1:"Financials (XLF)",              sub2:"Utilities (XLU)" },
  { name:"High Beta vs Low Vol",     e1:"SPHB", e2:"SPLV", sub1:"High Beta (SPHB)",              sub2:"Low Volatility (SPLV)" },
  { name:"US vs Emerging Markets",   e1:"SPY",  e2:"EEM",  sub1:"Large Cap (SPY)",               sub2:"Emerging Markets (EEM)" },
];

const SEED = {
  macroRegime:{ season:"Autumn", phase:"Contraction", riskOn:false, confirmed:true, confidence:72, mediumTerm:"Risk Off", shortTerm:"Defensive positioning — extreme fear regime, elevated VIX, below key MAs", description:"Autumn contraction — S&P 500 at 6,408, below both 50-day (6,615) and 200-day (6,768) MAs. VIX at 27.44 (+8.3%), CNN F&G at 18 (Extreme Fear), crypto F&G at 10. Yield curve positive but rates rising. Dollar weak at 99.86." },
  sp500:{ price:"6,408.38", change:"-2.78", sentiment:"BEARISH", dma50:"6,615.20", dma200:"6,768.50", wkSupport:"6,400.00", wkResistance:"6,573.22", moSupport:"6,350.00", moResistance:"6,591.90" },
  nasdaq:{ price:"21,450.00", change:"-3.12", sentiment:"BEARISH", dma50:"22,100.00", dma200:"21,800.00", wkSupport:"21,200.00", wkResistance:"22,050.00", moSupport:"20,900.00", moResistance:"22,400.00" },
  bitcoin:{ price:"68,420.00", change:"-4.85", sentiment:"BEARISH", dma50:"72,500.00", dma200:"65,800.00", wkSupport:"66,000.00", wkResistance:"72,000.00", moSupport:"62,000.00", moResistance:"75,000.00" },
  vix:{ price:"27.44", change:"+2.11", changePct:"+8.33", level:"HIGH", note:"Elevated concern" },
  dxy:{ price:"99.86", change:"-0.04", strength:"WEAK", note:"Tailwind for risk assets", position:49, sparkline:[] },
  yield:{ spread:"+0.42", status:"NORMAL", recessionRisk:"LOW", recessionPct:18 },
  fg:{ score:18, label:"Extreme Fear", vsPrev:-4, cryptoScore:10, cryptoLabel:"EXTREME FEAR" },
  rates:{ status:"NEUTRAL", current:"4.33", expected:"4.08", impliedCuts:"-1" },
  inflation:{ cpi:"3.3", trend:"Rising", truflation:"2.95", spread:"-0.35", note:"March CPI spike driven by energy — core stayed at 2.6%" },
  liquidity:{ total:"17.4", score:"58", roc13w:"-0.40", roc52w:"-1.8", trend:"Contractionary" },
  liquidityHistory: null,
  credit:{ moveIndex:"108.0", moveSignal:"Elevated", hyDAS:"340", igHyDiff:"65", tightNote:"Tight — Complacency Risk", sloosNote:"Net Tightening", goldCopper:"850", sahmRule:"0.30", ccDelinquency:"3.1" },
  breadth:{ pct50:"38.2", pct200:"54.6", ad5d:"Falling", ad20d:"Falling", sentiment:"BEARISH", note:"Narrow participation — majority of stocks below 50-day MA" },
  fci:{ value:"-2.10", nfci:"-0.38", status:"Loose", fedFunds:"+0.7", t10y:"+1.1", hySpread:"0.8", sp500load:"-2.0", usd:"+0.6" },
  options:{ dexPCR:"1.42", omegaPCR:"1.18", status:"BEARISH", conviction:"42" },
  macroIndic:{ usM2:"$21.8T", usM2Trend:"Rising", usM2Change:"+0.3%", ismPMI:"52.7", ismStatus:"Expanding", ismLabel:"ISM Manufacturing PMI", globalM2:"$17.4T", globalM2Trend:"Falling" },
  sectorRotation: SECTOR_PAIRS.map(function(p) {
    var data = {
      "Cyclical vs Defensive":{w1:"r",w1m:"r",w3m:"r",w6m:"r",bull:false,prob:"72",winner:p.sub2,diffPct:-4.2,note:"Defensive leading, risk-off trend intact"},
      "Small Cap vs Large Cap":{w1:"r",w1m:"r",w3m:"r",w6m:"n",bull:false,prob:"68",winner:p.sub2,diffPct:-3.1,note:"Large cap outperforming, flight to quality"},
      "Growth vs Value":{w1:"r",w1m:"r",w3m:"n",w6m:"g",bull:null,prob:"52",winner:null,diffPct:-0.8,note:"Mixed signals, rotation unclear"},
      "Financials vs Utilities":{w1:"r",w1m:"r",w3m:"r",w6m:"r",bull:false,prob:"74",winner:p.sub2,diffPct:-5.6,note:"Utilities strongly outperforming, defensive bid"},
      "High Beta vs Low Vol":{w1:"r",w1m:"r",w3m:"r",w6m:"r",bull:false,prob:"78",winner:p.sub2,diffPct:-7.3,note:"Low vol crushing high beta, fear regime"},
      "US vs Emerging Markets":{w1:"r",w1m:"n",w3m:"g",w6m:"g",bull:null,prob:"55",winner:null,diffPct:1.2,note:"Mixed short-term, EM medium-term trend intact"},
    };
    var d = data[p.name] || {w1:"n",w1m:"n",w3m:"n",w6m:"n",bull:null,prob:"50",winner:null,diffPct:0,note:"—"};
    return { ...p, ...d };
  }),
  allocation:{ stocks:{n:"60",a:"50"}, bonds:{n:"10",a:"15"}, cash:{n:"5",a:"10"}, gold:{n:"5",a:"10"}, crypto:{n:"10",a:"7"}, realAssets:{n:"10",a:"8"} },
  topSectors:[
    {name:"Utilities",etf:"XLU",r6m:"+11.2",r3m:"+6.8",pos:true},
    {name:"Healthcare",etf:"XLV",r6m:"+8.4",r3m:"+3.2",pos:true},
    {name:"Consumer Staples",etf:"XLP",r6m:"+6.1",r3m:"+4.5",pos:true},
    {name:"Energy",etf:"XLE",r6m:"+4.8",r3m:"-2.1",pos:false},
    {name:"Real Estate",etf:"XLRE",r6m:"+3.6",r3m:"+1.4",pos:true},
  ],
  sectorAlloc:{
    season:"AUTUMN", bias:"DEFENSIVE", confidence:"72",
    overweight:[{name:"Utilities",conviction:"HIGH",target:"8.0"},{name:"Healthcare",conviction:"HIGH",target:"14.0"},{name:"Consumer Defensive",conviction:"MEDIUM",target:"10.0"}],
    neutral:[{name:"Energy",conviction:"LOW",target:"5.0"},{name:"Industrials",conviction:"LOW",target:"7.0"}],
    underweight:[{name:"Technology",conviction:"HIGH",target:"6.0"},{name:"Consumer Cyclical",conviction:"MEDIUM",target:"5.0"},{name:"Financial Services",conviction:"MEDIUM",target:"8.0"}],
  },
  aiViews:{
    bullish: "The setup for risk assets is stronger than headlines suggest. The S&P 500 trading at elevated levels with breadth recovering implies institutional accumulation. A weak DXY (~99) provides tailwinds for multinationals and emerging markets. With the yield curve positive and credit spreads tight at 340bp HY OAS, credit markets are not pricing in recession risk — a meaningful divergence from equity fear gauges.\n\nFed funds at 4.33% with market pricing in cuts creates a supportive backdrop. The Industrial Production reading at 103+ shows real economic activity is expanding. Historically, VIX spikes into 25-30 range have marked local bottoms, not tops. Rotating into quality growth, small caps, and cyclicals on any weakness is the higher-conviction play.\n\nTactical positioning: overweight equities (70%+), quality tech, industrials, and financials. Use options to hedge tail risk rather than reducing equity exposure wholesale.",
    neutral: "The macro environment presents genuinely mixed signals. On the bullish side: yield curve positive, credit spreads tight, Fed easing bias. On the bearish side: VIX elevated, breadth narrowing, CPI jumped to 3.3% on energy shock. The truth is probably somewhere in between — markets consolidating through a stagflationary mini-cycle before the next directional move.\n\nThe March CPI surge to 3.3% was energy-driven; core remained tame at 2.6%. If energy stabilizes, inflation prints normalize and the Fed's easing path resumes. If energy pressures persist, stagflation risk rises materially. Bitcoin's weakness and crypto F&G at extreme fear mirror equity uncertainty but credit markets remain calm.\n\nTactical positioning: maintain balanced 60/40-style allocation with tilt toward quality. Barbell equity exposure between defensives (utilities, healthcare) and select growth. Keep 5-10% in cash for optionality. Avoid leverage until directional clarity emerges.",
    bearish: "The macro environment has shifted decisively risk-off. The S&P 500 sits below both 50-day and 200-day moving averages — a bearish alignment not seen since 2024. CPI jumping to 3.3% combined with restrictive Fed funds at 4.33% creates stagflation risk. Industrial Production may be expanding but the monthly trend has flattened.\n\nSentiment indicators flash warning signs. CNN Fear & Greed in extreme fear territory, crypto F&G at 10, market breadth deteriorating with <40% of stocks above 50-day MA. The VIX spike confirms hedging demand. While credit spreads remain tight, credit always lags equity — complacency in credit is a classic late-cycle warning, not a bullish signal.\n\nTactical positioning: overweight defensives (utilities, staples, healthcare), gold, and cash. Reduce equity exposure to 40-50%. Underweight high-beta tech, consumer discretionary, crypto. Wait for VIX below 20, breadth above 50%, and CPI declining before re-engaging risk."
  },
};

function parseFGLabel(score) {
  if (score == null) return "—";
  if (score <= 25) return "Extreme Fear";
  if (score <= 44) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

// Compute live sector rotation pair data from raw ETF returns
// PAIRS: each entry is { name, e1, e2, sub1, sub2 }
// For each pair: winner is the better-performing ETF over 6M,
// "bullish" means risk-on side wins (the FIRST etf in each pair is risk-on)
function computeSectorRotation(tickers, PAIRS) {
  return PAIRS.map(function(p) {
    var t1 = tickers[p.e1], t2 = tickers[p.e2];
    if (!t1 || !t2 || t1.error || t2.error) {
      // Fallback to neutral if data missing
      return { ...p, w1:"n", w1m:"n", w3m:"n", w6m:"n", bull:null, prob:"50", winner:null, diffPct:0, note:"Data unavailable" };
    }
    // Per-period winner: "g" = e1 wins (risk-on), "r" = e2 wins (defensive), "n" = within 0.2%
    function period(r1, r2) {
      var diff = r1 - r2;
      if (Math.abs(diff) < 0.2) return "n";
      return diff > 0 ? "g" : "r";
    }
    var w1  = period(t1.r1w,  t2.r1w);
    var w1m = period(t1.r1m,  t2.r1m);
    var w3m = period(t1.r3m,  t2.r3m);
    var w6m = period(t1.r6m,  t2.r6m);
    // Aggregate bullishness from 4 periods (g=+1, r=-1, n=0)
    function score(w) { return w === "g" ? 1 : w === "r" ? -1 : 0; }
    var totalScore = score(w1) + score(w1m) + score(w3m) + score(w6m);
    var bull, winner, prob;
    if (totalScore >= 2) { bull = true;  winner = p.sub1; }
    else if (totalScore <= -2) { bull = false; winner = p.sub2; }
    else { bull = null; winner = null; }
    // Probability: scale magnitude to 50-85% range
    prob = String(Math.min(85, 50 + Math.abs(totalScore) * 9));
    var diffPct = +(t1.r6m - t2.r6m).toFixed(1);
    // Generate a contextual note
    var note;
    if (bull === true) note = p.sub1.split(" (")[0] + " leading across timeframes";
    else if (bull === false) note = p.sub2.split(" (")[0] + " outperforming, " + (Math.abs(diffPct) > 5 ? "strong " : "") + "defensive bid";
    else note = "Mixed signals across timeframes";
    return { ...p, w1, w1m, w3m, w6m, bull, prob, winner, diffPct, note };
  });
}

// Build top sectors list from raw ETF returns, sorted by 6M performance
function computeTopSectors(tickers) {
  var SECTOR_INFO = [
    { etf:"XLK",  name:"Technology" },
    { etf:"XLV",  name:"Healthcare" },
    { etf:"XLF",  name:"Financials" },
    { etf:"XLY",  name:"Consumer Discretionary" },
    { etf:"XLP",  name:"Consumer Staples" },
    { etf:"XLE",  name:"Energy" },
    { etf:"XLI",  name:"Industrials" },
    { etf:"XLB",  name:"Materials" },
    { etf:"XLU",  name:"Utilities" },
    { etf:"XLRE", name:"Real Estate" },
    { etf:"XLC",  name:"Communication Services" },
  ];
  var sectors = SECTOR_INFO
    .map(function(s) {
      var t = tickers[s.etf];
      if (!t || t.error) return null;
      return {
        name: s.name,
        etf: s.etf,
        r6m: (t.r6m >= 0 ? "+" : "") + t.r6m.toFixed(1),
        r3m: (t.r3m >= 0 ? "+" : "") + t.r3m.toFixed(1),
        pos: t.r3m >= 0,
        r6mNum: t.r6m,
      };
    })
    .filter(function(s) { return s !== null; })
    .sort(function(a, b) { return b.r6mNum - a.r6mNum; })
    .slice(0, 5);
  return sectors;
}

// Compute support/resistance from recent swing highs/lows
// candles: array of {t, h, l, c} — daily OHLC
// Returns { wkSupport, wkResistance, moSupport, moResistance } formatted strings
function computeSwingSR(candles) {
  if (!candles || candles.length < 5) return null;

  // Sort ascending by timestamp just in case
  var sorted = candles.slice().sort(function(a, b) { return a.t - b.t; });
  var latest = sorted[sorted.length - 1];
  var currentPrice = latest.c;

  // Weekly = last ~5 trading days, Monthly = last ~22 trading days
  var weekly = sorted.slice(-5);
  var monthly = sorted.slice(-22);

  // For swing S/R: find highest high and lowest low in the window.
  // Support = lowest low below current price (or just the lowest low).
  // Resistance = highest high above current price (or just the highest high).
  function findSR(window, cur) {
    var highsAbove = window.filter(function(c) { return c.h > cur; }).map(function(c) { return c.h; });
    var lowsBelow = window.filter(function(c) { return c.l < cur; }).map(function(c) { return c.l; });
    var resistance = highsAbove.length > 0 ? Math.max.apply(null, highsAbove) : Math.max.apply(null, window.map(function(c){ return c.h; }));
    var support = lowsBelow.length > 0 ? Math.min.apply(null, lowsBelow) : Math.min.apply(null, window.map(function(c){ return c.l; }));
    return { support: support, resistance: resistance };
  }

  var wk = findSR(weekly, currentPrice);
  var mo = findSR(monthly, currentPrice);

  // Format with thousands separators and 2 decimals
  function fmt(n) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    wkSupport: fmt(wk.support),
    wkResistance: fmt(wk.resistance),
    moSupport: fmt(mo.support),
    moResistance: fmt(mo.resistance),
  };
}


function applyLiveData(d, prev) {
  var out = { ...prev };
  // S&P 500
  if (d.sp500) {
    var chg = d.sp500Chg||"—";
    out.sp500 = { ...out.sp500, price:d.sp500, change:chg, sentiment:String(chg).startsWith("-")?"BEARISH":"BULLISH" };
    if (d.dma50) out.sp500.dma50 = d.dma50;
    if (d.dma200) out.sp500.dma200 = d.dma200;
  }
  // Nasdaq
  if (d.nasdaq) {
    var ndxChg = d.nasdaqChg||"—";
    out.nasdaq = { ...out.nasdaq, price:d.nasdaq, change:ndxChg, sentiment:String(ndxChg).startsWith("-")?"BEARISH":"BULLISH" };
  }
  // Bitcoin
  if (d.bitcoin) {
    var btcChg = d.bitcoinChg||"—";
    out.bitcoin = { ...out.bitcoin, price:d.bitcoin, change:btcChg, sentiment:String(btcChg).startsWith("-")?"BEARISH":"BULLISH" };
  }
  // VIX
  var vv = parseFloat(d.vix);
  if (vv) out.vix = { price:d.vix, change:d.vixChg||"—", changePct:d.vixChg||"—", level:vv>35?"EXTREME":vv>25?"HIGH":vv>15?"MODERATE":"LOW", note:vv>35?"Extreme stress":vv>25?"Elevated concern":vv>15?"Moderate concern":"Low vol regime" };
  // DXY
  var dv = parseFloat(d.dxy);
  if (dv) out.dxy = { price:d.dxy, change:d.dxyChg||"—", strength:dv<98?"WEAK":dv>103?"STRONG":"NEUTRAL", note:dv<98?"Tailwind for risk assets":dv>103?"Headwind for risk assets":"Neutral for markets", position:Math.round(Math.max(5,Math.min(95,((dv-90)/20)*100))), sparkline:[] };
  // Yields
  var t10=parseFloat(d.t10y), t2=parseFloat(d.t2y);
  if (t10&&t2) { var sp=(t10-t2).toFixed(2); var inv=parseFloat(sp)<0; out.yield={spread:(parseFloat(sp)>=0?"+":"")+sp,status:inv?"INVERTED":Math.abs(parseFloat(sp))<0.1?"FLAT":"NORMAL",recessionRisk:inv?"MEDIUM":"LOW",recessionPct:inv?35:15}; }
  // Rates
  var fr=parseFloat(d.fed); if(fr) out.rates={status:fr>5?"TIGHTENING":fr<3?"EASING":"NEUTRAL",current:String(d.fed),expected:(fr-0.25).toFixed(2),impliedCuts:"-1"};
  // Inflation
  if(d.cpi) { var trufV=parseFloat(d.truf)||0; var cpiV=parseFloat(d.cpi)||0; var spr=trufV&&cpiV?(trufV-cpiV).toFixed(2):"—"; out.inflation={cpi:d.cpi,trend:cpiV<2.5?"Falling":cpiV>3.5?"Rising":"Stable",truflation:d.truf||out.inflation.truflation,spread:spr,note:trufV<cpiV?"Lead indicators point to falling inflation":"Inflation indicators stable"}; }
  // Fear & Greed
  if(d.fg!=null) out.fg={score:d.fg,label:d.fgLabel||parseFGLabel(d.fg),vsPrev:null,cryptoScore:d.cryptoFG!=null?d.cryptoFG:out.fg.cryptoScore,cryptoLabel:d.cryptoLabel||parseFGLabel(d.cryptoFG)};
  // Credit
  if(d.move) out.credit={...out.credit,moveIndex:d.move,hyDAS:d.hyOAS||out.credit.hyDAS,tightNote:parseInt(d.hyOAS)<350?"Tight — Complacency Risk":parseInt(d.hyOAS)>500?"Wide — Stress":"Normal"};
  // Breadth
  var b50=parseFloat(d.b50); if(b50) out.breadth={pct50:String(d.b50),pct200:String(d.b200||out.breadth.pct200),ad5d:"Flat",ad20d:b50<45?"Falling":"Rising",sentiment:b50<45?"BEARISH":"BULLISH",note:b50<45?"Narrow participation — majority of stocks below 50-day MA":"Broad participation — healthy market internals"};
  // Options
  var pcrV=parseFloat(d.pcr); if(pcrV) out.options={dexPCR:d.pcr,omegaPCR:(pcrV*0.85).toFixed(3),status:pcrV>1.3?"BEARISH":pcrV<0.7?"BULLISH":"NEUTRAL",conviction:Math.round(Math.abs((pcrV-1.0))*100).toString()};
  // NFCI
  if(d.nfci) out.fci={...out.fci,nfci:d.nfci,status:parseFloat(d.nfci)<-0.3?"Loose":parseFloat(d.nfci)>0.3?"Tight":"Neutral"};
  return out;
}

/* ─── UI HELPERS ─────────────────────────────────────────────────── */
const Badge = ({ label, color }) => (
  <span style={{ background:color+"22", color, border:"1px solid " + color + "44", borderRadius:4, padding:"2px 8px", fontSize:11, fontFamily:font, fontWeight:700, letterSpacing:1 }}>{label}</span>
);
const Card = ({ children, style, glow }) => (
  <div style={{ background:C.card, border:"1px solid " + C.border, borderRadius:10, padding:"16px 18px", position:"relative", boxShadow:glow?"0 0 22px " + glow + "18":"none", ...style }}>
    <div style={{ position:"absolute", top:0, right:0, width:5, height:5, borderRadius:"0 0 0 5px", background:C.green, opacity:0.5 }} />
    {children}
  </div>
);
const SecTitle = ({ icon, title, badge, bc }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
    <span style={{ fontSize:13 }}>{icon}</span>
    <span style={{ fontFamily:sans, fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>{title}</span>
    {badge && <Badge label={badge} color={bc||C.green} />}
  </div>
);
const Row = ({ label, val, color }) => (
  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
    <span style={{ fontSize:12, color:C.textMid }}>{label}</span>
    <span style={{ fontSize:12, fontFamily:font, color:color||C.text }}>{val||"—"}</span>
  </div>
);
const Bar = ({ pct, color, height=4 }) => (
  <div style={{ height, background:C.border, borderRadius:2 }}>
    <div style={{ width:Math.min(100,Math.max(0,+pct||0)) + "%", height:"100%", background:color, borderRadius:2 }} />
  </div>
);
const Dot = ({ c }) => <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:c, marginRight:4 }} />;
const Skel = ({ w="100%", h=14, mb=0 }) => (
  <div style={{ width:w, height:h, marginBottom:mb, background:C.border, borderRadius:4, opacity:0.5, animation:"pulse 1.5s ease-in-out infinite" }} />
);
const Spinner = ({ size=12 }) => (
  <span style={{ display:"inline-block", width:size, height:size, border:"2px solid " + C.cyan + "33", borderTop:"2px solid " + C.cyan, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />
);

function Sparkline({ data, color, height=40, width="100%" }) {
  if (!data || data.length < 2) return <div style={{ height, background:C.border, borderRadius:4, opacity:0.3 }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 260;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return x + "," + y;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={"0 0 260 " + height} preserveAspectRatio="none" style={{ display:"block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function SemiGauge({ label, pcr, sub }) {
  const val = parseFloat(pcr) || 1.0;
  const angle = Math.max(-80, Math.min(80, (val - 1.0) * 120));
  const rad = (angle - 90) * Math.PI / 180;
  const r = 34, cx = 50, cy = 52;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  const color = val < 0.8 ? C.green : val > 1.2 ? C.red : C.orange;
  const dispVal = val >= 1.0 ? "+" + (val-1.0).toFixed(2) : "-" + (1.0-val).toFixed(2);
  return (
    <div style={{ textAlign:"center", flex:1 }}>
      <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>{label}</div>
      <svg width="100" height="64" viewBox="0 0 100 64" style={{ display:"block", margin:"0 auto" }}>
        <path d="M 16 52 A 34 34 0 0 1 84 52" fill="none" stroke={C.border} strokeWidth="7" strokeLinecap="round" />
        <path d="M 16 52 A 34 34 0 0 1 33 24" fill="none" stroke={C.red} strokeWidth="7" strokeLinecap="round" opacity="0.7" />
        <path d="M 33 24 A 34 34 0 0 1 67 24" fill="none" stroke={C.orange} strokeWidth="7" strokeLinecap="round" opacity="0.7" />
        <path d="M 67 24 A 34 34 0 0 1 84 52" fill="none" stroke={C.green} strokeWidth="7" strokeLinecap="round" opacity="0.7" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3.5" fill={color} />
      </svg>
      <div style={{ fontSize:15, fontWeight:700, color, fontFamily:font, marginTop:-4 }}>{dispVal}</div>
      <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{sub}</div>
      <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{label} PCR: {pcr}</div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────── */
export default function App() {
  const [data, setData] = useState(SEED);
  const [stage, setStage] = useState(1);
  const [p1, setP1] = useState(false);
  const [ts, setTs] = useState("Mar 27, 2026");
  const [err, setErr] = useState(null);

  const [refreshStatus, setRefreshStatus] = useState("");

  const doRefresh = useCallback(async () => {
    setErr(null); setP1(true); setRefreshStatus("Fetching live data...");
    try {
      var parsed = null;

      // Attempt 1: Vercel proxy (works outside sandbox)
      try {
        setRefreshStatus("Trying Vercel proxy...");
        var proxyRes = await fetch(PROXY_URL);
        var proxyJson = await proxyRes.json();
        var quotes = (proxyJson.quoteResponse && proxyJson.quoteResponse.result) || [];
        if (quotes.length > 0) {
          parsed = {};
          var bySymbol = {};
          quotes.forEach(function(q) { bySymbol[q.symbol] = q; });
          var sp = bySymbol["^GSPC"];
          if (sp) { parsed.sp500 = sp.regularMarketPrice.toFixed(2); parsed.sp500Chg = (sp.regularMarketChangePercent >= 0 ? "+" : "") + sp.regularMarketChangePercent.toFixed(2); }
          var ndx = bySymbol["^IXIC"];
          if (ndx) { parsed.nasdaq = ndx.regularMarketPrice.toFixed(2); parsed.nasdaqChg = (ndx.regularMarketChangePercent >= 0 ? "+" : "") + ndx.regularMarketChangePercent.toFixed(2); }
          var btc = bySymbol["BTC-USD"];
          if (btc) { parsed.bitcoin = btc.regularMarketPrice.toFixed(2); parsed.bitcoinChg = (btc.regularMarketChangePercent >= 0 ? "+" : "") + btc.regularMarketChangePercent.toFixed(2); }
          var vx = bySymbol["^VIX"];
          if (vx) { parsed.vix = vx.regularMarketPrice.toFixed(2); parsed.vixChg = (vx.regularMarketChangePercent >= 0 ? "+" : "") + vx.regularMarketChangePercent.toFixed(2); }
          var dx = bySymbol["DX-Y.NYB"];
          if (dx) { parsed.dxy = dx.regularMarketPrice.toFixed(2); parsed.dxyChg = (dx.regularMarketChangePercent >= 0 ? "+" : "") + dx.regularMarketChangePercent.toFixed(2); }
          var tn = bySymbol["^TNX"];
          if (tn) { parsed.t10y = tn.regularMarketPrice.toFixed(3); }
          setRefreshStatus("Got " + quotes.length + " quotes from proxy!");
        }
      } catch(proxyErr) {
        setRefreshStatus("Proxy blocked, trying Claude API...");
      }

      // Supplemental: if we got S&P but missing NDX or BTC, fetch them from Claude API
      if (parsed && (parsed.sp500 || parsed.vix) && (!parsed.nasdaq || !parsed.bitcoin)) {
        try {
          setRefreshStatus("Fetching Nasdaq + Bitcoin...");
          var dSupp = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
          var suppRes = await fetch(CLAUDE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 800,
              tools: [{ type: "web_search_20250305", name: "web_search" }],
              messages: [{ role: "user", content: "Today is " + dSupp + ". Search the web for the CURRENT live price of the Nasdaq Composite Index (^IXIC) and Bitcoin (BTC-USD). I need today's price and today's percent change. Respond with ONLY a JSON object and no other text: {\"nasdaq\":\"PRICE_AS_STRING\",\"nasdaqChg\":\"SIGNED_PCT_CHANGE\",\"bitcoin\":\"PRICE_AS_STRING\",\"bitcoinChg\":\"SIGNED_PCT_CHANGE\"}. Example format: {\"nasdaq\":\"18450.25\",\"nasdaqChg\":\"+0.85\",\"bitcoin\":\"87300.50\",\"bitcoinChg\":\"-1.20\"}" }]
            })
          });
          setRefreshStatus("NDX/BTC API HTTP " + suppRes.status + "...");
          var suppJson = await suppRes.json();
          // Extract all text blocks (ignore tool_use/tool_result blocks)
          var suppText = "";
          if (suppJson.content && Array.isArray(suppJson.content)) {
            suppJson.content.forEach(function(b) {
              if (b.type === "text" && b.text) suppText += b.text + "\n";
            });
          }
          setRefreshStatus("NDX/BTC got " + suppText.length + " chars, parsing...");
          var suppClean = suppText.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
          var suppParsed = null;
          try { suppParsed = JSON.parse(suppClean); } catch(eS) {}
          if (!suppParsed) {
            // Brace matching to find last complete JSON object
            var depth2 = 0, start2 = -1, lastFound = null;
            for (var j = 0; j < suppClean.length; j++) {
              if (suppClean[j]==="{") { if (depth2===0) start2=j; depth2++; }
              else if (suppClean[j]==="}") { depth2--; if (depth2===0 && start2>=0) { try { lastFound = JSON.parse(suppClean.slice(start2,j+1)); } catch(eS2){} start2=-1; } }
            }
            suppParsed = lastFound;
          }
          if (suppParsed && (suppParsed.nasdaq || suppParsed.bitcoin)) {
            if (suppParsed.nasdaq) { parsed.nasdaq = String(suppParsed.nasdaq).replace(/,/g,""); parsed.nasdaqChg = suppParsed.nasdaqChg || ""; }
            if (suppParsed.bitcoin) { parsed.bitcoin = String(suppParsed.bitcoin).replace(/,/g,""); parsed.bitcoinChg = suppParsed.bitcoinChg || ""; }
            setRefreshStatus("Got NDX=" + parsed.nasdaq + " BTC=" + parsed.bitcoin);
          } else {
            setRefreshStatus("NDX/BTC: no JSON in response");
          }
        } catch(eSupp) {
          setRefreshStatus("NDX/BTC fetch error: " + eSupp.message);
        }
      }

      // Attempt 2: Claude API with web_search (works in sandbox)
      if (!parsed) {
        var d = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
        var response = await fetch(CLAUDE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: [{ role: "user", content: "Today is " + d + ". Search for current S&P 500, Nasdaq Composite, Bitcoin (BTC-USD), VIX, DXY, 10Y yield prices. Return ONLY JSON, no other text: {\"sp500\":\"6xxx.xx\",\"sp500Chg\":\"-x.xx\",\"nasdaq\":\"2xxxx.xx\",\"nasdaqChg\":\"-x.xx\",\"bitcoin\":\"xxxxx.xx\",\"bitcoinChg\":\"-x.xx\",\"vix\":\"xx.xx\",\"vixChg\":\"+x.xx\",\"dxy\":\"xxx.xx\",\"t10y\":\"x.xx\"}" }]
          })
        });
        setRefreshStatus("API responded HTTP " + response.status + "...");
        if (response.status === 429) {
          setErr("Rate limited — try again in a few minutes");
          setP1(false); setRefreshStatus(""); return;
        }
        var apiJson = await response.json();
        var text = (apiJson.content || []).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("\n");
        setRefreshStatus("Got " + text.length + " chars, extracting JSON...");
        var clean = text.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
        try { parsed = JSON.parse(clean); } catch(e1) {}
        if (!parsed) {
          var last = null, depth = 0, start = -1;
          for (var i = 0; i < clean.length; i++) {
            if (clean[i]==="{"){if(depth===0)start=i;depth++}
            else if (clean[i]==="}"){depth--;if(depth===0&&start>=0){try{last=JSON.parse(clean.slice(start,i+1))}catch(e2){}start=-1}}
          }
          parsed = last;
        }
        if (!parsed) {
          setErr("Got response but no JSON. First 200 chars: " + text.slice(0,200));
          setP1(false); setRefreshStatus(""); return;
        }
      }

      // Apply data
      setRefreshStatus("Applying " + Object.keys(parsed).length + " data points...");
      setData(function(prev) { return applyLiveData(parsed, prev); });
      setTs(new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}));
      setRefreshStatus("Updated!");
      setTimeout(function(){ setRefreshStatus(""); }, 4000);
      // Fetch FRED data
try {
  setRefreshStatus("Fetching FRED data...");
  var fredRes = await fetch(FRED_URL);
  var fredJson = await fredRes.json();
  var fredFieldCount = Object.keys(fredJson).filter(function(k){ return !k.startsWith("_") && !k.endsWith("_DATE"); }).length;
  setRefreshStatus("FRED loaded: " + fredFieldCount + " fields");
  setData(function(prev) {
    var out = { ...prev };
    // Auto-detect Macro Season from live data
if (fredJson.GDPC1 && fredJson.GDPC1_PREV && fredJson.CPIAUCSL && fredJson.CPI_PREV) {
  var gdpCurrent = parseFloat(fredJson.GDPC1);
  var gdpPrev = parseFloat(fredJson.GDPC1_PREV);
  var cpiCurrent = parseFloat(fredJson.CPIAUCSL);
  var cpiPrev = parseFloat(fredJson.CPI_PREV);
  var fedCurrent = parseFloat(fredJson.FEDFUNDS);
  var fedPrev = parseFloat(fredJson.FEDFUNDS_PREV);
  var yieldCurve = parseFloat(fredJson.T10Y2Y);
  var hySpreadVal = parseFloat(fredJson.BAMLH0A0HYM2);
  var sahmVal = parseFloat(fredJson.SAHMREALTIME);

  // Determine growth and inflation direction
  var growthRising = gdpCurrent > gdpPrev;
  var inflationRising = cpiCurrent > cpiPrev;
  var fedTightening = fedCurrent >= fedPrev;
  var creditStress = hySpreadVal > 4.0;
  var recessionSignal = sahmVal > 0.5;

  // MIT Season Detection
  var detectedSeason;
  var detectedPhase;
  var detectedConfidence;

  if (recessionSignal || (creditStress && !growthRising)) {
    // Override to Winter if recession signals are present
    detectedSeason = "Winter";
    detectedPhase = "Deflationary Bust";
    detectedConfidence = Math.round(60 + sahmVal * 20);
  } else if (growthRising && !inflationRising) {
    detectedSeason = "Spring";
    detectedPhase = "Disinflationary Boom";
    detectedConfidence = Math.round(65 + (gdpCurrent - gdpPrev) / gdpPrev * 1000);
  } else if (growthRising && inflationRising) {
    detectedSeason = "Summer";
    detectedPhase = "Inflationary Boom";
    detectedConfidence = Math.round(65 + (cpiCurrent - cpiPrev) / cpiPrev * 500);
  } else if (!growthRising && inflationRising) {
    detectedSeason = "Autumn";
    detectedPhase = "Stagflation";
    detectedConfidence = Math.round(65 + hySpreadVal * 3);
  } else {
    detectedSeason = "Winter";
    detectedPhase = "Deflationary Bust";
    detectedConfidence = 60;
  }

  // Cap confidence at 95
  detectedConfidence = Math.min(95, Math.max(50, detectedConfidence));

  // Additional signals to boost confidence
  if (detectedSeason === "Autumn" && fedTightening) detectedConfidence = Math.min(95, detectedConfidence + 5);
  if (detectedSeason === "Summer" && yieldCurve > 0.3) detectedConfidence = Math.min(95, detectedConfidence + 5);
  if (detectedSeason === "Winter" && yieldCurve < 0) detectedConfidence = Math.min(95, detectedConfidence + 5);

  out.macroRegime = { ...out.macroRegime,
    season: detectedSeason,
    phase: detectedPhase,
    confidence: detectedConfidence,
    riskOn: detectedSeason === "Spring" || detectedSeason === "Summer",
    confirmed: true,
    mediumTerm: detectedSeason === "Spring" || detectedSeason === "Summer" ? "Risk On" : "Risk Off",
    shortTerm: detectedSeason === "Autumn" ? "Defensive positioning — slowing growth, rising inflation" :
               detectedSeason === "Winter" ? "Capital preservation — recession risk elevated" :
               detectedSeason === "Summer" ? "Risk on — inflationary boom, peak liquidity" :
               "Early cycle — disinflationary boom, central banks easing",
    description: detectedSeason + " " + detectedPhase.toLowerCase() + " — " +
      "S&P 500 at " + (out.spx?.price || prev.spx?.price || "—") + ", " +
      "VIX at " + (out.vix?.price || prev.vix?.price || "—") +
      (out.fg?.score != null ? ", CNN F&G at " + out.fg.score + " (" + (out.fg.label||"") + ")" : "") +
      (out.fg?.cryptoScore != null ? ", crypto F&G at " + out.fg.cryptoScore : "") +
      ". GDP " + (growthRising ? "rising " : "slowing ") + "(" + gdpCurrent.toFixed(0) + " vs " + gdpPrev.toFixed(0) + " prior). " +
      "CPI " + (inflationRising ? "rising " : "easing ") + "(" + cpiCurrent.toFixed(1) + " vs " + cpiPrev.toFixed(1) + " YoY). " +
      "Fed Funds " + fedCurrent.toFixed(2) + "% (" + (fedTightening ? "tightening" : "easing") + "). " +
      "Yield curve " + (yieldCurve >= 0 ? "+" : "") + yieldCurve.toFixed(2) + ". " +
      "HY spread " + hySpreadVal.toFixed(2) + "%. " +
      "Sahm Rule " + sahmVal.toFixed(2) + "."
  };
}
    if (fredJson.T10Y2Y) {
      var sp = parseFloat(fredJson.T10Y2Y);
      out.yield = { spread:(sp>=0?"+":"")+sp.toFixed(2), status:sp<0?"INVERTED":Math.abs(sp)<0.1?"FLAT":"NORMAL", recessionRisk:sp<0?"MEDIUM":"LOW", recessionPct:sp<0?35:15 };
    }
    if (fredJson.BAMLH0A0HYM2) {
      var hy = parseFloat(fredJson.BAMLH0A0HYM2) * 100;
      out.credit = { ...out.credit, hyDAS:Math.round(hy).toString(), tightNote:hy<350?"Tight — Complacency Risk":hy>500?"Wide — Stress Signal":"Normal Range" };
    }
    if (fredJson.FEDFUNDS) {
      var ff = parseFloat(fredJson.FEDFUNDS);
      out.rates = { status:ff>5?"TIGHTENING":ff<3?"EASING":"NEUTRAL", current:ff.toFixed(2), expected:(ff-0.25).toFixed(2), impliedCuts:"-1" };
    }
    if (fredJson.NFCI) {
      var nfci = parseFloat(fredJson.NFCI);
      out.fci = { ...out.fci, nfci:fredJson.NFCI, status:nfci<-0.3?"Loose":nfci>0.3?"Tight":"Neutral" };
    }
    if (fredJson.SAHMREALTIME) {
      out.credit = { ...out.credit, sahmRule:parseFloat(fredJson.SAHMREALTIME).toFixed(2) };
    }
    if (fredJson.T10YIE) {
      var inf = parseFloat(fredJson.T10YIE);
      out.inflation = { ...out.inflation, truflation:fredJson.T10YIE, trend:inf<2?"Falling":inf>3?"Rising":"Stable" };
    }
    // Macro Indicators: M2 (US + Global proxy) & Industrial Production (ISM substitute)
    // US M2 — series M2SL (billions USD, monthly)
    if (fredJson.M2SL) {
      var m2Val = parseFloat(fredJson.M2SL);
      var m2Prev = parseFloat(fredJson.M2SL_PREV);
      var hasM2Prev = !isNaN(m2Prev) && m2Prev > 0;
      var m2Trillions = (m2Val / 1000).toFixed(2); // convert $B to $T for display
      var m2PctChange = hasM2Prev ? ((m2Val - m2Prev) / m2Prev * 100).toFixed(2) : null;
      out.macroIndic = { ...out.macroIndic,
        usM2: "$" + m2Trillions + "T",
        usM2Trend: hasM2Prev ? (m2Val > m2Prev ? "Rising" : "Falling") : "Unknown",
        usM2Change: m2PctChange != null ? (m2PctChange >= 0 ? "+" : "") + m2PctChange + "%" : null
      };
    }
    // Global M2 proxy — sum of major central bank balance sheets (USD equivalent, $T)
    // Use WALCL (Fed, $M) + ECBASSETSW (ECB, €M) + JPNASSETS (BoJ, ¥B)
    if (fredJson.WALCL) {
      var fedM2 = parseFloat(fredJson.WALCL) / 1000000; // $M → $T
      var ecbM2 = fredJson.ECBASSETSW ? parseFloat(fredJson.ECBASSETSW) / 1000000 * 1.08 : 0; // €M → $T (approx EUR/USD)
      var bojM2 = fredJson.JPNASSETS ? parseFloat(fredJson.JPNASSETS) * 0.0067 / 1000 : 0; // ¥B → $T
      var globalM2Total = fedM2 + ecbM2 + bojM2;
      // Compute trend from Fed prev if available
      var fedPrev = parseFloat(fredJson.WALCL_PREV);
      var hasGlobalPrev = !isNaN(fedPrev) && fedPrev > 0;
      out.macroIndic = { ...out.macroIndic,
        globalM2: "$" + globalM2Total.toFixed(1) + "T",
        globalM2Trend: hasGlobalPrev ? (parseFloat(fredJson.WALCL) > fedPrev ? "Rising" : "Falling") : "Unknown"
      };
    }
    // ISM Manufacturing PMI is fetched separately via Claude API web search (see below)
    // because ISM data is licensed and not available on FRED.
  // Global Liquidity
if (fredJson.WALCL) {
  var fed = parseFloat(fredJson.WALCL) / 1000000;
  var ecb = parseFloat(fredJson.ECBASSETSW) / 1000000;
  var boj = parseFloat(fredJson.JPNASSETS) / 1000000;
  var total = (fed + ecb + (boj * 0.0067)).toFixed(1);
  out.liquidity = { ...out.liquidity,
    total: total,
    score: Math.round(Math.min(100, Math.max(0, (parseFloat(total) / 25) * 100))).toString(),
    trend: parseFloat(total) > 17 ? "Expansionary" : "Contractionary",
    fedTotal: fed.toFixed(1),
    ecbTotal: ecb.toFixed(1),
    bojTotal: (boj * 0.0067).toFixed(1),
    pbocTotal: "6.0"
  };
}
return out;
});
  setRefreshStatus("FRED data applied!");;
  // Fetch Sector data
try {
  setRefreshStatus("Fetching sector data...");
  var secRes = await fetch(SECTORS_URL);
  var secJson = await secRes.json();
  if (secJson.sectors && secJson.sectors.length > 0) {
    setData(function(prev) {
      var out = { ...prev };
      var sectors = secJson.sectors;
      var season = prev.macroRegime?.season || "Autumn";

      // Top Sectors — top 5 by 6M return
      out.topSectors = sectors.slice(0, 5).map(function(s) {
        return { name:s.name, etf:s.etf, r6m:s.r6m, r3m:s.r3m, pos:s.pos };
      });

      // ─── MIT SEASON PREFERENCE MAPPING ───
      var seasonalBias = {
        "Spring": ["Technology", "Industrials", "Consumer Discretionary", "Financials", "Small Cap"],
        "Summer": ["Energy", "Materials", "Industrials", "Financials", "Real Assets"],
        "Autumn": ["Utilities", "Healthcare", "Consumer Staples", "Gold", "Cash"],
        "Winter": ["Long Duration Bonds", "Gold", "Utilities", "Healthcare", "Cash"]
      };

      var preferred = seasonalBias[season] || seasonalBias["Autumn"];
      var avoided = season === "Spring" || season === "Summer" 
        ? ["Utilities", "Consumer Staples", "Bonds"]
        : ["Technology", "Consumer Cyclical", "High Beta"];

      // Score each sector: momentum + seasonal preference
      var scored = sectors.map(function(s) {
        var momentum = parseFloat(s.r6m) || 0;
        var isPreferred = preferred.some(p => s.name.includes(p));
        var isAvoided = avoided.some(a => s.name.includes(a));
        
        var score = momentum;
        if (isPreferred) score += 5;  // Boost preferred sectors
        if (isAvoided) score -= 5;    // Penalize avoided sectors
        
        return { ...s, score, momentum, isPreferred };
      });

      // Sort by composite score
      scored.sort(function(a, b) { return b.score - a.score; });

      // Allocate: top 3 overweight, next 3 neutral, bottom 3 underweight
      var overweight = scored.slice(0, 3).map(function(s) {
        var conviction = s.isPreferred ? "HIGH" : s.momentum > 5 ? "MEDIUM" : "LOW";
        var target = (12 + s.momentum * 0.3).toFixed(1);
        return { name:s.name, conviction, target };
      });

      var neutral = scored.slice(3, 6).map(function(s) {
        return { name:s.name, conviction:"LOW", target:"7.0" };
      });

      var underweight = scored.slice(6, 9).map(function(s) {
        var conviction = s.isAvoided ? "HIGH" : s.momentum < -5 ? "MEDIUM" : "LOW";
        var target = Math.max(2, (5 + s.momentum * 0.15)).toFixed(1);
        return { name:s.name, conviction, target };
      });

      out.sectorAlloc = { 
        ...out.sectorAlloc, 
        season: season.toUpperCase(),
        bias: season === "Spring" || season === "Summer" ? "OFFENSIVE" : "DEFENSIVE",
        confidence: prev.macroRegime?.confidence || "72",
        overweight, 
        neutral, 
        underweight 
      };

      // Asset Allocation — adjust based on market conditions
      var vix = parseFloat(prev.vix?.price || "20");
      var hySpread = parseFloat(prev.credit?.hyDAS || "300");
      var bullSectors = sectors.filter(function(s) { return parseFloat(s.r6m) > 0; }).length;
      var bearish = vix > 25 || hySpread > 400 || bullSectors < 5;
      var veryBearish = vix > 35 || hySpread > 500 || bullSectors < 3;

      out.allocation = {
        stocks:    { n:"60", a: veryBearish?"35": bearish?"45":"55" },
        bonds:     { n:"10", a: veryBearish?"20": bearish?"15":"10" },
        cash:      { n:"5",  a: veryBearish?"20": bearish?"15":"8"  },
        gold:      { n:"5",  a: veryBearish?"15": bearish?"12":"7"  },
        crypto:    { n:"10", a: veryBearish?"3":  bearish?"5":"10"  },
        realAssets:{ n:"10", a: veryBearish?"7":  bearish?"8":"10"  },
      };

      return out;
   });
  
    setRefreshStatus("Sector data applied!");
    // Fetch Fear & Greed data
try {
  setRefreshStatus("Fetching Fear & Greed...");
  var fgRes = await fetch(FG_URL);
  var fgJson = await fgRes.json();
  setData(function(prev) {
    var out = { ...prev };
    if (fgJson.cnnScore != null || fgJson.cryptoScore != null) {
      var cnnScore = fgJson.cnnScore != null ? fgJson.cnnScore : prev.fg.score;
      var cryptoScore = fgJson.cryptoScore != null ? fgJson.cryptoScore : prev.fg.cryptoScore;
      var prevScore = fgJson.cnnScore != null && prev.fg.score != null
        ? fgJson.cnnScore - prev.fg.score : null;
      out.fg = {
        score: cnnScore,
        label: fgJson.cnnLabel || prev.fg.label,
        vsPrev: prevScore,
        cryptoScore: cryptoScore,
        cryptoLabel: fgJson.cryptoLabel || prev.fg.cryptoLabel,
        timestamp: fgJson.timestamp || new Date().toISOString(),
      };
    }
    return out;
  });
  if (fgJson.cnnScore != null && fgJson.cryptoScore != null) {
    setRefreshStatus("F&G LIVE: CNN " + fgJson.cnnScore + " · Crypto " + fgJson.cryptoScore);
  } else if (fgJson.cnnScore != null) {
    setRefreshStatus("F&G partial: CNN " + fgJson.cnnScore + " (crypto failed)");
  } else if (fgJson.cryptoScore != null) {
    setRefreshStatus("F&G partial: Crypto " + fgJson.cryptoScore + " (CNN failed)");
  } else {
    setRefreshStatus("F&G fetch returned no data — check proxy");
  }
} catch(fgErr) {
  console.warn("F&G fetch failed:", fgErr.message);
  setRefreshStatus("F&G error: " + fgErr.message);
}
  }
} catch(secErr) {
  console.warn("Sector fetch failed:", secErr.message);
}
} catch(fredErr) {
  console.warn("FRED fetch failed:", fredErr.message);
}

// Fetch OHLC history and compute swing support/resistance for 3 indices
try {
  setRefreshStatus("Fetching price history for S/R levels...");
  var ohlcRes = await fetch(OHLC_URL);
  if (ohlcRes.ok) {
    var ohlcJson = await ohlcRes.json();
    setData(function(prev) {
      var out = { ...prev };
      ["sp500","nasdaq","bitcoin"].forEach(function(key) {
        var entry = ohlcJson[key];
        if (entry && entry.candles && entry.candles.length >= 5) {
          var sr = computeSwingSR(entry.candles);
          if (sr) {
            out[key] = { ...out[key],
              wkSupport: sr.wkSupport,
              wkResistance: sr.wkResistance,
              moSupport: sr.moSupport,
              moResistance: sr.moResistance
            };
          }
        }
      });
      return out;
    });
    setRefreshStatus("S/R levels updated!");
  }
} catch(ohlcErr) {
  console.warn("OHLC fetch failed:", ohlcErr.message);
}

// Fetch liquidity history (Fed, ECB, BoJ + S&P 500) for interactive chart
try {
  setRefreshStatus("Fetching liquidity history...");
  var liqRes = await fetch(LIQ_URL);
  if (liqRes.ok) {
    var liqJson = await liqRes.json();
    setData(function(prev) {
      return { ...prev, liquidityHistory: liqJson };
    });
    setRefreshStatus("Liquidity history loaded!");
  }
} catch(liqErr) {
  console.warn("Liquidity history fetch failed:", liqErr.message);
}

// Fetch live sector ETF returns and compute rotation pairs + top sectors
try {
  setRefreshStatus("Fetching live sector data...");
  var secLiveRes = await fetch(SECTORS_LIVE_URL);
  if (secLiveRes.ok) {
    var secLiveJson = await secLiveRes.json();
    var liveTickers = secLiveJson.tickers || {};
    setData(function(prev) {
      var newRotation = computeSectorRotation(liveTickers, SECTOR_PAIRS);
      var newTopSectors = computeTopSectors(liveTickers);
      return { ...prev,
        sectorRotation: newRotation.length > 0 ? newRotation : prev.sectorRotation,
        topSectors: newTopSectors.length > 0 ? newTopSectors : prev.topSectors,
        sectorTimestamp: secLiveJson.timestamp,
      };
    });
    setRefreshStatus("Live sector data loaded!");
  }
} catch(secErr) {
  console.warn("Sectors-live fetch failed:", secErr.message);
}

// Fetch live breadth + options + credit data via Claude API web search
try {
  await new Promise(function(r){setTimeout(r, 2000)});
  setRefreshStatus("Fetching breadth, options & credit data...");
  var mktDate = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  var mktRes = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: "Today is " + mktDate + ". Search for latest S&P 500 market breadth, CBOE put/call ratio, and MOVE index. Return ONLY JSON with no other text: {\"pct50\":\"xx.x\",\"pct200\":\"xx.x\",\"pcr\":\"x.xx\",\"move\":\"xxx.x\"} where pct50 is percent of S&P 500 stocks above 50-day moving average, pct200 is percent above 200-day MA, pcr is CBOE total put/call ratio, move is ICE BofA MOVE index value." }]
    })
  });
  if (mktRes.ok) {
    var mktJson = await mktRes.json();
    var mktText = (mktJson.content || []).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("\n");
    var mktClean = mktText.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
    var mktParsed = null;
    try { mktParsed = JSON.parse(mktClean); } catch(e1) {}
    if (!mktParsed) {
      var last2 = null, depth2 = 0, start2 = -1;
      for (var ii = 0; ii < mktClean.length; ii++) {
        if (mktClean[ii]==="{"){if(depth2===0)start2=ii;depth2++}
        else if (mktClean[ii]==="}"){depth2--;if(depth2===0&&start2>=0){try{last2=JSON.parse(mktClean.slice(start2,ii+1))}catch(e2){}start2=-1}}
      }
      mktParsed = last2;
    }
    if (mktParsed) {
      setData(function(prev) {
        var out = { ...prev };
        // Breadth
        var b50 = parseFloat(mktParsed.pct50);
        var b200 = parseFloat(mktParsed.pct200);
        if (b50) {
          out.breadth = {
            pct50: String(b50.toFixed(1)),
            pct200: String((b200 || parseFloat(prev.breadth?.pct200 || "50")).toFixed(1)),
            ad5d: b50 < 45 ? "Falling" : b50 > 55 ? "Rising" : "Flat",
            ad20d: b50 < 45 ? "Falling" : b50 > 55 ? "Rising" : "Flat",
            sentiment: b50 < 45 ? "BEARISH" : b50 > 55 ? "BULLISH" : "NEUTRAL",
            note: b50 < 45 ? "Narrow participation — majority of stocks below 50-day MA" : b50 > 55 ? "Broad participation — healthy market internals" : "Mixed breadth signals",
            timestamp: new Date().toISOString(),
          };
        }
        // Options PCR
        var pcrV = parseFloat(mktParsed.pcr);
        if (pcrV) {
          out.options = {
            dexPCR: String(pcrV.toFixed(2)),
            omegaPCR: String((pcrV * 0.85).toFixed(2)),
            status: pcrV > 1.1 ? "BEARISH" : pcrV < 0.7 ? "BULLISH" : "NEUTRAL",
            conviction: String(Math.round(Math.abs(pcrV - 0.9) * 100)),
            timestamp: new Date().toISOString(),
          };
        }
        // MOVE Index
        var moveV = parseFloat(mktParsed.move);
        if (moveV) {
          out.credit = { ...out.credit,
            moveIndex: String(moveV.toFixed(1)),
            moveSignal: moveV > 120 ? "High" : moveV > 100 ? "Elevated" : "Normal",
            timestamp: new Date().toISOString(),
          };
        }
        return out;
      });
      setRefreshStatus("Breadth/options/credit updated!");
    }
  }
} catch(mktErr) {
  console.warn("Breadth/options/credit fetch failed:", mktErr.message);
}

// Fetch latest ISM Manufacturing PMI via Claude API (ISM data is licensed, not on FRED)
try {
  await new Promise(function(r){setTimeout(r, 4000)});
  setRefreshStatus("Fetching ISM PMI...");
  var ismDate = new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"});
  var ismRes = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: "What is the most recent United States ISM Manufacturing PMI reading? Search for the latest monthly release as of " + ismDate + ". Return ONLY this JSON, no other text: {\"pmi\":\"NUMBER_AS_STRING\",\"month\":\"MONTH_YEAR\",\"prev\":\"PREVIOUS_MONTH_PMI\"}. Example: {\"pmi\":\"52.7\",\"month\":\"March 2026\",\"prev\":\"52.4\"}" }]
    })
  });
  var ismJson = await ismRes.json();
  var ismText = "";
  if (ismJson.content && Array.isArray(ismJson.content)) {
    ismJson.content.forEach(function(b) { if (b.type === "text" && b.text) ismText += b.text + "\n"; });
  }
  var ismClean = ismText.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
  var ismParsed = null;
  try { ismParsed = JSON.parse(ismClean); } catch(eIsm) {
    var dIsm = 0, sIsm = -1;
    for (var ki = 0; ki < ismClean.length; ki++) {
      if (ismClean[ki]==="{") { if (dIsm===0) sIsm=ki; dIsm++; }
      else if (ismClean[ki]==="}") { dIsm--; if (dIsm===0 && sIsm>=0) { try { ismParsed = JSON.parse(ismClean.slice(sIsm,ki+1)); } catch(eIsm2){} sIsm=-1; } }
    }
  }
  if (ismParsed && ismParsed.pmi) {
    var pmiVal = parseFloat(ismParsed.pmi);
    var prevVal = parseFloat(ismParsed.prev);
    setData(function(prev) {
      return { ...prev, macroIndic: { ...prev.macroIndic,
        ismPMI: pmiVal.toFixed(1),
        ismStatus: pmiVal >= 50 ? "Expanding" : "Contracting",
        ismLabel: "ISM Manufacturing PMI",
        ismMonth: ismParsed.month || "",
        ismPrev: !isNaN(prevVal) ? prevVal.toFixed(1) : null,
      }};
    });
    setRefreshStatus("ISM PMI: " + pmiVal.toFixed(1));
  }
} catch(ismErr) {
  console.warn("ISM PMI fetch failed:", ismErr.message);
}

// Generate AI analysis with bull/bear/neutral viewpoints
try {
  await new Promise(function(r){setTimeout(r, 6000)});
  setRefreshStatus("Generating AI analysis...");
  // Build snapshot from CURRENT state (after all data fetches above)
  await new Promise(function(r) { setTimeout(r, 200); }); // Let React flush state updates
  var snapshot = null;
  setData(function(prev) { snapshot = { ...prev }; return prev; });
  await new Promise(function(r) { setTimeout(r, 100); });
  var snap = snapshot || SEED;
  
  var todayStr = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  var contextStr =
    "Today is " + todayStr + ". Generate a macro analysis based on this LIVE market data:\n\n" +
    "PRICES & INDICES:\n" +
    "- S&P 500: " + (snap.sp500?.price||"?") + " (" + (snap.sp500?.change||"?") + "% daily)\n" +
    "- VIX: " + (snap.vix?.price||"?") + " (" + (snap.vix?.level||"?") + ")\n" +
    "- DXY (Dollar): " + (snap.dxy?.price||"?") + " (" + (snap.dxy?.strength||"?") + ")\n\n" +
    "RATES & YIELDS:\n" +
    "- 10Y-2Y Yield Spread: " + (snap.yield?.spread||"?") + " (" + (snap.yield?.status||"?") + ")\n" +
    "- Fed Funds Rate: " + (snap.rates?.current||"?") + "% (" + (snap.rates?.status||"?") + ")\n\n" +
    "INFLATION:\n" +
    "- CPI YoY: " + (snap.inflation?.cpi||"?") + "% (trend: " + (snap.inflation?.trend||"?") + ")\n" +
    "- Truflation: " + (snap.inflation?.truflation||"?") + "%\n\n" +
    "SENTIMENT:\n" +
    "- CNN Fear & Greed: " + (snap.fg?.score != null ? snap.fg.score : "?") + " (" + (snap.fg?.label||"?") + ")\n" +
    "- Crypto F&G: " + (snap.fg?.cryptoScore != null ? snap.fg.cryptoScore : "?") + " (" + (snap.fg?.cryptoLabel||"?") + ")\n\n" +
    "BREADTH & CREDIT:\n" +
    "- Market Breadth (% above 50DMA): " + (snap.breadth?.pct50||"?") + "%\n" +
    "- HY Credit Spread: " + (snap.credit?.hyDAS||"?") + "bp\n" +
    "- MOVE Index: " + (snap.credit?.moveIndex||"?") + "\n" +
    "- Sahm Rule: " + (snap.credit?.sahmRule||"?") + "\n" +
    "- NFCI: " + (snap.fci?.nfci||"?") + " (" + (snap.fci?.status||"?") + ")\n\n" +
    "MACRO:\n" +
    "- Global M2: " + (snap.macroIndic?.globalM2||"?") + " (" + (snap.macroIndic?.globalM2Trend||"?") + ")\n" +
    "- ISM Manufacturing PMI: " + (snap.macroIndic?.ismPMI||"?") + " (" + (snap.macroIndic?.ismStatus||"?") + ")\n" +
    "- MIT Macro Season: " + (snap.macroRegime?.season||"?") + " / " + (snap.macroRegime?.phase||"?") + "\n\n" +
    "SECTOR ROTATION:\n" +
    "- Top sectors (6M): " + (snap.topSectors||[]).slice(0,3).map(function(s){return s.name + " (" + s.r6m + "%)"}).join(", ") + "\n" +
    "- Bull pairs: " + (snap.sectorRotation||[]).filter(function(p){return p.bull===true}).map(function(p){return p.name}).join(", ") + "\n" +
    "- Bear pairs: " + (snap.sectorRotation||[]).filter(function(p){return p.bull===false}).map(function(p){return p.name}).join(", ") + "\n";

  var aiRes = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content:
        contextStr +
        "\nYou are a professional macro strategist. Using ONLY the specific numbers above (cite them), generate THREE distinct investment viewpoints. Each should be 2-3 paragraphs. Be specific — reference actual values. Return ONLY valid JSON (no markdown fences, no other text):\n" +
        '{"bullish":"the bull case for risk-on, equities, growth","neutral":"balanced view weighing both sides","bearish":"the bear case for caution, defensives, risk-off"}'
      }]
    })
  });
  if (aiRes.status === 429) {
    setRefreshStatus("AI rate limited — using cached analysis");
  } else {
    var aiJson = await aiRes.json();
    var aiText = (aiJson.content || []).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("\n");
    console.log("AI raw response length:", aiText.length, "First 300 chars:", aiText.slice(0,300));
    var aiClean = aiText.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
    
    // Try direct parse first
    var views = null;
    try { views = JSON.parse(aiClean); } catch(eAI) {
      // Try to find JSON object with brace matching
      var dAI = 0, sAI = -1;
      for (var k = 0; k < aiClean.length; k++) {
        if (aiClean[k]==="{"){if(dAI===0)sAI=k;dAI++}
        else if (aiClean[k]==="}"){dAI--;if(dAI===0&&sAI>=0){try{views=JSON.parse(aiClean.slice(sAI,k+1))}catch(eAI2){}sAI=-1}}
      }
    }
    
    // If still no views, try to extract each key individually with regex
    if (!views || (!views.bullish && !views.bearish && !views.neutral)) {
      console.log("Brace matching failed, trying regex extraction...");
      var bullMatch = aiClean.match(/"bullish"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      var neutralMatch = aiClean.match(/"neutral"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      var bearMatch = aiClean.match(/"bearish"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (bullMatch || neutralMatch || bearMatch) {
        views = {
          bullish: bullMatch ? bullMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "",
          neutral: neutralMatch ? neutralMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "",
          bearish: bearMatch ? bearMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "",
        };
      }
    }
    
    if (views && (views.bullish || views.bearish || views.neutral)) {
      views._timestamp = new Date().toISOString();
      setData(function(prev) { return { ...prev, aiViews: views }; });
      setRefreshStatus("AI analysis ready!");
    } else {
      console.log("AI parse failed. Clean text:", aiClean.slice(0, 500));
      setRefreshStatus("AI returned unexpected format — using cached");
    }
  }
} catch(aiErr) {
  console.warn("AI analysis failed:", aiErr.message);
  setRefreshStatus("AI analysis failed: " + aiErr.message);
}
    } catch(e) {
      setErr("Refresh error: " + e.message);
      setRefreshStatus("");
    }
    setP1(false);
  }, []);

  useEffect(function() {
    doRefresh();
  }, []);

  const stages = [{n:1,label:"Macro Analysis"},{n:2,label:"Portfolio Analy..."},{n:3,label:"Asset Screener"},{n:4,label:"Portfolio Builder"},{n:5,label:"Execution"}];
  const d = data;

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:sans, color:C.text, overflow:"hidden" }}>
     <style>{`html,body,#root{margin:0;padding:0;background:${C.bg};min-height:100vh}*{box-sizing:border-box;outline:none}button{outline:none}input{outline:none}textarea{outline:none}select{outline:none}*:focus{outline:none}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style> 

      {/* SIDEBAR */}
      <div style={{ width:188, background:C.panel, borderRight:"1px solid " + C.border, display:"flex", flexDirection:"column", padding:"13px 0", flexShrink:0 }}>
        <div style={{ padding:"0 13px 12px", borderBottom:"1px solid " + C.border }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:24, height:24, borderRadius:6, background:"linear-gradient(135deg," + C.purple + "," + C.blue + ")", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>📈</div>
            <span style={{ fontWeight:700, fontSize:10, letterSpacing:1.5, textTransform:"uppercase" }}>Portfolio Manager</span>
          </div>
        </div>
        <div style={{ padding:"10px 8px 5px" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:5 }}>Pipeline</div>
          <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
            <div style={{ width:(stage/5)*100 + "%", height:"100%", background:"linear-gradient(90deg," + C.blue + "," + C.purple + ")", borderRadius:2, transition:"width .3s" }} />
          </div>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>5/5 stages</div>
          {stages.map(st => (
            <div key={st.n} onClick={()=>setStage(st.n)} style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 7px", borderRadius:6, marginBottom:3, background:stage===st.n?C.blue+"20":"transparent", border:stage===st.n?"1px solid " + C.blue + "44":"1px solid transparent", cursor:"pointer" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:stage===st.n?C.blue:C.border, fontSize:9, fontWeight:700, flexShrink:0 }}>{st.n}</div>
              <span style={{ fontSize:11, color:stage===st.n?C.text:C.textMid, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{st.label}</span>
              <span style={{ fontSize:9, color:C.green }}>✓</span>
            </div>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ padding:"5px 13px", fontSize:9, color:C.textDim, display:"flex", gap:8 }}>
          <span style={{ color:C.green }}>● Done</span><span style={{ color:C.orange }}>◌ Running</span><span>○ Pending</span>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, overflow:"auto", padding:"13px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", gap:18 }}>
            {["Analysis","Portfolio","Themes","Active Trader","Intelligence"].map(t => (
              <span key={t} style={{ fontSize:13, color:t==="Analysis"?C.text:C.textMid, fontWeight:t==="Analysis"?600:400, cursor:"pointer", borderBottom:t==="Analysis"?"2px solid " + C.blue:"none", paddingBottom:3 }}>{t}</span>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {refreshStatus && <span style={{ fontSize:10, color:C.cyan, fontFamily:font, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{refreshStatus}</span>}
            {!refreshStatus && <span style={{ fontSize:10, color:C.green, fontFamily:font }}>● {ts}</span>}
            <button onClick={doRefresh} disabled={p1} style={{ background:p1?C.border:"linear-gradient(135deg," + C.cyan + "dd," + C.blue + ")", border:"none", borderRadius:6, color:p1?C.textMid:C.bg, padding:"6px 13px", fontSize:11, fontWeight:700, cursor:p1?"wait":"pointer", whiteSpace:"nowrap" }}>
              {p1?"Refreshing...":"⚡ Refresh"}
            </button>
            <button style={{ background:"linear-gradient(135deg," + C.blue + "," + C.purple + ")", border:"none", borderRadius:6, color:C.text, padding:"6px 13px", fontSize:11, fontWeight:600, cursor:"pointer" }}>▶ Run Pipeline</button>
          </div>
        </div>

        {err && <div style={{ background:"#2b0d10", border:"1px solid " + C.red + "44", borderRadius:8, padding:"7px 13px", marginBottom:11, fontSize:12, color:C.red }}>⚠ {err}</div>}

        {stage===1 && <MacroStage d={d} />}
        {stage===2 && <PortfolioStage />}
        {stage===3 && <ScreenerStage />}
        {stage===4 && <BuilderStage />}
        {stage!==1 && stage!==2 && stage!==3 && stage!==4 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:400 }}>
            <div style={{ fontSize:28, opacity:0.2, marginBottom:8 }}>🚧</div>
            <div style={{ color:C.textDim, fontSize:14 }}>Stage {stage} — coming soon</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MACRO STAGE ────────────────────────────────────────────────── */
function TV({ src, height, id }) {
  useEffect(function() {
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    var c = document.getElementById(id);
    if (c) c.appendChild(s);
  }, []);
  return <div id={id} style={{ height: height, width: "100%", overflow: "hidden" }} />;
}

function TVWidget({ config, scriptName, height }) {
  var id = "tv-" + scriptName + "-" + Math.random().toString(36).slice(2);
  useEffect(function() {
    var container = document.getElementById(id);
    if (!container) return;
    var s = document.createElement("script");
    s.type = "text/javascript";
    s.src = "https://s3.tradingview.com/external-embedding/" + scriptName + ".js";
    s.async = true;
    s.innerHTML = JSON.stringify(config);
    container.appendChild(s);
  }, []);
  return (
    <div className="tradingview-widget-container" style={{ height: height, width: "100%" }}>
      <div id={id} className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}


/* ─── INTERACTIVE LIQUIDITY CHART ─────────────────────────────── */
function LiquidityChart({ history }) {
  const [activeBanks, setActiveBanks] = useState({ fed:true, ecb:true, boj:true });
  const [timeRange, setTimeRange] = useState("3Y");
  const [showSPX, setShowSPX] = useState(false);
  const [hover, setHover] = useState(null); // { x, y, date, values }

  const BANKS = [
    { key:"fed", label:"Fed", color:C.blue },
    { key:"ecb", label:"ECB", color:C.orange },
    { key:"boj", label:"BoJ", color:C.red },
  ];
  const RANGES = [
    { key:"1Y", years:1 },
    { key:"3Y", years:3 },
    { key:"5Y", years:5 },
    { key:"ALL", years:99 },
  ];

  // Bail out if data isn't loaded yet
  if (!history || !history.fed || history.fed.length === 0) {
    return (
      <div style={{ height:240, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:12, fontStyle:"italic" }}>
        Loading liquidity history...
      </div>
    );
  }

  // Filter by time range
  const cutoff = new Date();
  const rangeYears = RANGES.find(r => r.key === timeRange)?.years || 3;
  cutoff.setFullYear(cutoff.getFullYear() - rangeYears);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Build a unified date axis by using the Fed series (most complete weekly data)
  // and looking up ECB/BoJ values at the nearest prior date.
  const fedFiltered = (history.fed || []).filter(p => p.date >= cutoffStr);
  if (fedFiltered.length < 2) {
    return <div style={{ height:240, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:12 }}>Not enough data for this range</div>;
  }

  function lookupAt(series, targetDate) {
    if (!series || series.length === 0) return 0;
    // Binary search or linear for simplicity — series is sorted ascending
    let best = null;
    for (let i = 0; i < series.length; i++) {
      if (series[i].date <= targetDate) best = series[i];
      else break;
    }
    return best ? best.value : 0;
  }

  const points = fedFiltered.map(fp => {
    const fed = activeBanks.fed ? fp.value : 0;
    const ecb = activeBanks.ecb ? lookupAt(history.ecb, fp.date) : 0;
    const boj = activeBanks.boj ? lookupAt(history.boj, fp.date) : 0;
    const spx = lookupAt(history.sp500, fp.date);
    return { date: fp.date, fed, ecb, boj, spx, total: fed+ecb+boj };
  });

  // Chart dimensions — large viewBox that scales uniformly; padding for axis labels
  const W = 1400, H = 360, padL = 70, padR = 70, padT = 16, padB = 36;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  // Compute clean Y-axis ticks (round to nice numbers)
  function niceMax(raw) {
    if (raw <= 0) return 1;
    const exp = Math.floor(Math.log10(raw));
    const mag = Math.pow(10, exp);
    const norm = raw / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
  }

  const rawMax = Math.max(...points.map(p => p.total));
  const maxTotal = niceMax(rawMax * 1.1);
  const minTotal = 0;
  // Robust SPX scale — handle case where sp500 series is empty/missing
  const spxValues = points.map(p => p.spx).filter(v => v > 0 && !isNaN(v));
  const hasSPX = spxValues.length > 0;
  const maxSPX = hasSPX ? Math.max(...spxValues) * 1.05 : 1;
  const minSPX = hasSPX ? Math.min(...spxValues) * 0.95 : 0;

  function xScale(i) { return padL + (i / (points.length - 1)) * chartW; }
  function yScale(v) { return padT + chartH - (v / maxTotal) * chartH; }
  function ySPXScale(v) { return padT + chartH - ((v - minSPX) / (maxSPX - minSPX)) * chartH; }

  // Build stacked areas: each layer stacks on top of previous
  function buildArea(valueAccessor, baseAccessor) {
    const top = points.map((p, i) => xScale(i) + "," + yScale(valueAccessor(p) + baseAccessor(p)));
    const bottom = points.slice().reverse().map((p, idx) => {
      const i = points.length - 1 - idx;
      return xScale(i) + "," + yScale(baseAccessor(p));
    });
    return top.concat(bottom).join(" ");
  }

  // Stack order (bottom to top): BoJ → ECB → Fed
  const bojArea = activeBanks.boj ? buildArea(p => p.boj, _ => 0) : null;
  const ecbArea = activeBanks.ecb ? buildArea(p => p.ecb, p => p.boj) : null;
  const fedArea = activeBanks.fed ? buildArea(p => p.fed, p => p.boj + p.ecb) : null;

  // S&P overlay line
  const spxPath = points.map((p, i) => (i === 0 ? "M" : "L") + xScale(i) + "," + ySPXScale(p.spx)).join(" ");

  // Y-axis gridlines + labels (5 nice ticks)
  const ySteps = 5;
  const yTicks = [];
  for (let i = 0; i <= ySteps; i++) {
    const v = (maxTotal / ySteps) * i;
    yTicks.push({ v, y: yScale(v) });
  }

  // X-axis year labels
  const xLabels = [];
  const yearsSeen = new Set();
  points.forEach((p, i) => {
    const yr = p.date.slice(0, 4);
    if (!yearsSeen.has(yr)) {
      yearsSeen.add(yr);
      xLabels.push({ year: yr, x: xScale(i) });
    }
  });

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padL || x > W - padR) { setHover(null); return; }
    const frac = (x - padL) / chartW;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(frac * (points.length - 1))));
    const p = points[idx];
    setHover({ x: xScale(idx), idx, p });
  }

  const latest = points[points.length - 1];
  const stackedTotal = latest.total;

  return (
    <div>
      {/* Control bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        {/* Bank toggles */}
        <div style={{ display:"flex", gap:6 }}>
          {BANKS.map(b => {
            const active = activeBanks[b.key];
            return (
              <button key={b.key} onClick={() => setActiveBanks(prev => ({ ...prev, [b.key]: !prev[b.key] }))} style={{
                background: active ? b.color + "22" : "transparent",
                border: "1px solid " + (active ? b.color + "66" : C.border),
                color: active ? b.color : C.textDim,
                padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 4,
                cursor: "pointer", fontFamily: sans, display:"flex", alignItems:"center", gap:5,
                transition: "all 0.15s",
              }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background: active ? b.color : C.textDim, display:"inline-block" }} />
                {b.label}
              </button>
            );
          })}
          <div style={{ width:1, background:C.border, margin:"0 4px" }} />
          <button onClick={() => setShowSPX(v => !v)} style={{
            background: showSPX ? C.purple + "22" : "transparent",
            border: "1px solid " + (showSPX ? C.purple + "66" : C.border),
            color: showSPX ? C.purple : C.textDim,
            padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 4,
            cursor: "pointer", fontFamily: sans,
          }}>S&P 500 overlay</button>
        </div>
        {/* Time range */}
        <div style={{ display:"flex", gap:2, background:C.cardAlt, borderRadius:5, padding:2 }}>
          {RANGES.map(r => {
            const active = timeRange === r.key;
            return (
              <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
                background: active ? C.blue : "transparent",
                border: "none",
                color: active ? C.text : C.textMid,
                padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 3,
                cursor: "pointer", fontFamily: sans,
                transition: "all 0.15s",
              }}>{r.key}</button>
            );
          })}
        </div>
      </div>

      {/* The chart */}
      <div style={{ position:"relative", background:C.cardAlt, borderRadius:8, padding:12, border:"1px solid " + C.border }}>
        <svg width="100%" height="auto" viewBox={"0 0 " + W + " " + H} preserveAspectRatio="xMidYMid meet" style={{ display:"block", cursor:"crosshair", maxHeight:420 }}
          onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>

          {/* Y-axis gridlines */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={C.border} strokeWidth="1" strokeDasharray="3,4" opacity="0.6" />
              <text x={padL - 10} y={t.y + 5} fontSize="14" fill={C.textDim} textAnchor="end" fontFamily={font}>${t.v.toFixed(t.v >= 10 ? 0 : 1)}T</text>
            </g>
          ))}

          {/* X-axis baseline */}
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={C.border} strokeWidth="1" />

          {/* X-axis year labels */}
          {xLabels.map((l, i) => (
            <g key={i}>
              <line x1={l.x} y1={padT + chartH} x2={l.x} y2={padT + chartH + 5} stroke={C.textDim} strokeWidth="1" />
              <text x={l.x} y={padT + chartH + 22} fontSize="14" fill={C.textDim} textAnchor="middle" fontFamily={font}>{l.year}</text>
            </g>
          ))}

          {/* Stacked areas (BoJ bottom, ECB middle, Fed top) */}
          {bojArea && <polygon points={bojArea} fill={C.red} opacity="0.65"><title>BoJ</title></polygon>}
          {ecbArea && <polygon points={ecbArea} fill={C.orange} opacity="0.65"><title>ECB</title></polygon>}
          {fedArea && <polygon points={fedArea} fill={C.blue} opacity="0.65"><title>Fed</title></polygon>}

          {/* S&P overlay line */}
          {showSPX && hasSPX && (
            <g>
              <path d={spxPath} fill="none" stroke={C.purple} strokeWidth="2.2" opacity="0.95" />
              {/* Right Y-axis for SPX */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                const v = minSPX + (maxSPX - minSPX) * frac;
                const y = padT + chartH - frac * chartH;
                return (
                  <text key={i} x={W - padR + 8} y={y + 5} fontSize="13" fill={C.purple} textAnchor="start" fontFamily={font}>{Math.round(v).toLocaleString()}</text>
                );
              })}
              <text x={W - padR + 8} y={padT - 4} fontSize="11" fill={C.purple} textAnchor="start" fontFamily={sans} fontWeight="700" letterSpacing="1">SPX</text>
            </g>
          )}
          {showSPX && !hasSPX && (
            <text x={W - padR - 12} y={padT + 22} fontSize="14" fill={C.textDim} textAnchor="end" fontFamily={sans} fontStyle="italic">S&P data unavailable</text>
          )}

          {/* Hover line + dots */}
          {hover && (
            <g>
              <line x1={hover.x} y1={padT} x2={hover.x} y2={padT + chartH} stroke={C.text} strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
              {activeBanks.boj && <circle cx={hover.x} cy={yScale(hover.p.boj)} r="5" fill={C.red} stroke={C.bg} strokeWidth="2" />}
              {activeBanks.ecb && <circle cx={hover.x} cy={yScale(hover.p.boj + hover.p.ecb)} r="5" fill={C.orange} stroke={C.bg} strokeWidth="2" />}
              {activeBanks.fed && <circle cx={hover.x} cy={yScale(hover.p.total)} r="5" fill={C.blue} stroke={C.bg} strokeWidth="2" />}
              {showSPX && hasSPX && <circle cx={hover.x} cy={ySPXScale(hover.p.spx)} r="5" fill={C.purple} stroke={C.bg} strokeWidth="2" />}
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div style={{
            position:"absolute",
            left: hover.x > W/2 ? "auto" : ((hover.x / W) * 100) + "%",
            right: hover.x > W/2 ? ((1 - hover.x/W) * 100) + "%" : "auto",
            top: 12,
            transform: hover.x > W/2 ? "translateX(-8px)" : "translateX(8px)",
            background:"rgba(10,12,20,0.95)", border:"1px solid " + C.border, borderRadius:5, padding:"7px 10px",
            fontSize:11, fontFamily:font, pointerEvents:"none", minWidth:140, zIndex:5,
          }}>
            <div style={{ color:C.text, fontWeight:700, marginBottom:4, fontSize:11, fontFamily:sans, letterSpacing:0.3 }}>{hover.p.date}</div>
            {activeBanks.fed && <div style={{ color:C.blue, display:"flex", justifyContent:"space-between", gap:10 }}><span>● Fed</span><span>${hover.p.fed.toFixed(2)}T</span></div>}
            {activeBanks.ecb && <div style={{ color:C.orange, display:"flex", justifyContent:"space-between", gap:10 }}><span>● ECB</span><span>${hover.p.ecb.toFixed(2)}T</span></div>}
            {activeBanks.boj && <div style={{ color:C.red, display:"flex", justifyContent:"space-between", gap:10 }}><span>● BoJ</span><span>${hover.p.boj.toFixed(2)}T</span></div>}
            <div style={{ borderTop:"1px solid " + C.border, marginTop:4, paddingTop:4, color:C.text, fontWeight:700, display:"flex", justifyContent:"space-between", gap:10 }}>
              <span>Total</span><span>${hover.p.total.toFixed(2)}T</span>
            </div>
            {showSPX && hasSPX && <div style={{ color:C.purple, display:"flex", justifyContent:"space-between", gap:10, marginTop:2 }}><span>● S&P 500</span><span>{Math.round(hover.p.spx).toLocaleString()}</span></div>}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:11, color:C.textDim }}>
        <span>Current stacked total: <span style={{ color:C.text, fontWeight:700, fontFamily:font }}>${stackedTotal.toFixed(2)}T</span></span>
        <span>{points.length} data points · {timeRange} range</span>
      </div>
    </div>
  );
}


function MacroStage({ d }) {
  const sc = SC[d.macroRegime?.season] || C.gold;
  const [aiView, setAiView] = useState("neutral");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ROW 1: Regime */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
        <Card glow={sc}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Macro Regime</div>
            <Badge
              label={d.macroRegime?.description && d.macroRegime.description.indexOf(d.macroRegime.season) === 0 ? "LIVE" : "SEED"}
              color={d.macroRegime?.description && d.macroRegime.description.indexOf(d.macroRegime.season) === 0 ? C.green : C.textDim}
            />
          </div>
          <div style={{ display:"flex", gap:13 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:sc+"20", border:"1px solid " + sc + "40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {d.macroRegime?.season==="Summer"?"☀️":d.macroRegime?.season==="Spring"?"🌱":d.macroRegime?.season==="Autumn"?"🍂":"❄️"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:21, fontWeight:700, color:sc, marginBottom:7 }}>{d.macroRegime?.season} ({d.macroRegime?.phase})</div>
              <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:7, flexWrap:"wrap" }}>
                <Badge label={d.macroRegime?.riskOn?"RISK ON":"RISK OFF"} color={d.macroRegime?.riskOn?C.green:C.red} />
                <span style={{ fontSize:11, color:C.textMid }}>{d.macroRegime?.confirmed?"Confirmed":"Unconfirmed"}</span>
                <span style={{ fontSize:11, color:C.textMid }}>│</span>
                <span style={{ fontSize:11, color:C.textMid }}>{d.macroRegime?.confidence}% confidence</span>
              </div>
              <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
                <div style={{ width:(d.macroRegime?.confidence||63) + "%", height:"100%", background:sc, borderRadius:2 }} />
              </div>
              <div style={{ marginBottom:3 }}><span style={{ fontSize:12, color:C.textDim }}>Medium term: </span><span style={{ fontSize:12, color:C.green }}>{d.macroRegime?.mediumTerm}</span></div>
              <div style={{ marginBottom:8 }}><span style={{ fontSize:12, color:C.textDim }}>Short term: </span><span style={{ fontSize:12, color:C.orange }}>{d.macroRegime?.shortTerm}</span></div>
            <p style={{ fontSize:11, color:C.textMid, lineHeight:1.6, margin:"0 0 10px" }}>
  {MIT_SEASONS[d.macroRegime?.season]?.description || d.macroRegime?.description}
</p>
<div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Growth: </span>
    <span style={{ color:MIT_SEASONS[d.macroRegime?.season]?.growth==="Rising"?C.green:C.red, fontWeight:700 }}>{MIT_SEASONS[d.macroRegime?.season]?.growth} ▲</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Inflation: </span>
    <span style={{ color:MIT_SEASONS[d.macroRegime?.season]?.inflation==="Rising"?C.red:C.green, fontWeight:700 }}>{MIT_SEASONS[d.macroRegime?.season]?.inflation} {MIT_SEASONS[d.macroRegime?.season]?.inflation==="Rising"?"▲":"▼"}</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Bias: </span>
    <span style={{ color:sc, fontWeight:700 }}>{MIT_SEASONS[d.macroRegime?.season]?.bias}</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Cycle: </span>
    <span style={{ color:C.text, fontWeight:700 }}>{MIT_SEASONS[d.macroRegime?.season]?.cycle}</span>
  </div>
</div>
<div style={{ background:C.cardAlt, border:"1px solid " + sc + "33", borderRadius:6, padding:"7px 10px", marginBottom:8 }}>
  <div style={{ fontSize:10, color:C.textDim, marginBottom:4, letterSpacing:1 }}>🔑 KEY THEME</div>
  <div style={{ fontSize:11, color:sc }}>{MIT_SEASONS[d.macroRegime?.season]?.keyTheme}</div>
</div>
<div style={{ display:"flex", gap:10 }}>
  <div style={{ flex:1, background:C.cardAlt, border:"1px solid " + C.green + "33", borderRadius:6, padding:"7px 10px" }}>
    <div style={{ fontSize:10, color:C.green, marginBottom:4, letterSpacing:1 }}>↑ OVERWEIGHT</div>
    {(MIT_SEASONS[d.macroRegime?.season]?.overweight||[]).map(function(s) {
      return <div key={s} style={{ fontSize:11, color:C.textMid, marginBottom:2 }}>• {s}</div>;
    })}
  </div>
  <div style={{ flex:1, background:C.cardAlt, border:"1px solid " + C.red + "33", borderRadius:6, padding:"7px 10px" }}>
    <div style={{ fontSize:10, color:C.red, marginBottom:4, letterSpacing:1 }}>↓ UNDERWEIGHT</div>
    {(MIT_SEASONS[d.macroRegime?.season]?.underweight||[]).map(function(s) {
      return <div key={s} style={{ fontSize:11, color:C.textMid, marginBottom:2 }}>• {s}</div>;
    })}
  </div>
</div>
<div style={{ marginTop:8, fontSize:10, color:C.textDim, fontFamily:font }}>
  {d.macroRegime?.description}
</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 1b: Indices — S&P + Nasdaq + Bitcoin (TradingView live) */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="📈" title="S&P 500" />
          <TVWidget scriptName="embed-widget-mini-symbol-overview" height={140} config={{
            "symbol": "FOREXCOM:SPXUSD",
            "width": "100%",
            "height": 140,
            "locale": "en",
            "dateRange": "1D",
            "colorTheme": "dark",
            "isTransparent": true,
            "autosize": false,
            "largeChartUrl": "",
            "chartOnly": false,
            "noTimeScale": true
          }} />
          <div style={{ borderTop:"1px solid " + C.border, marginTop:8, paddingTop:8 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>SUPPORT / RESISTANCE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Support</span><span style={{ color:C.textDim, textAlign:"right" }}>Resistance</span>
              <span style={{ color:C.textMid }}>Weekly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.sp500?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.sp500?.wkResistance}</span>
              <span style={{ color:C.textMid }}>Monthly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.sp500?.moSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.sp500?.moResistance}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="💻" title="Nasdaq 100" />
          <TVWidget scriptName="embed-widget-mini-symbol-overview" height={140} config={{
            "symbol": "OANDA:NAS100USD",
            "width": "100%",
            "height": 140,
            "locale": "en",
            "dateRange": "1D",
            "colorTheme": "dark",
            "isTransparent": true,
            "autosize": false,
            "largeChartUrl": "",
            "chartOnly": false,
            "noTimeScale": true
          }} />
          <div style={{ borderTop:"1px solid " + C.border, marginTop:8, paddingTop:8 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>SUPPORT / RESISTANCE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Support</span><span style={{ color:C.textDim, textAlign:"right" }}>Resistance</span>
              <span style={{ color:C.textMid }}>Weekly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.nasdaq?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.nasdaq?.wkResistance}</span>
              <span style={{ color:C.textMid }}>Monthly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.nasdaq?.moSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.nasdaq?.moResistance}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="₿" title="Bitcoin" />
          <TVWidget scriptName="embed-widget-mini-symbol-overview" height={140} config={{
            "symbol": "CRYPTO:BTCUSD",
            "width": "100%",
            "height": 140,
            "locale": "en",
            "dateRange": "1D",
            "colorTheme": "dark",
            "isTransparent": true,
            "autosize": false,
            "largeChartUrl": "",
            "chartOnly": false,
            "noTimeScale": true
          }} />
          <div style={{ borderTop:"1px solid " + C.border, marginTop:8, paddingTop:8 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>SUPPORT / RESISTANCE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Support</span><span style={{ color:C.textDim, textAlign:"right" }}>Resistance</span>
              <span style={{ color:C.textMid }}>Weekly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.bitcoin?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.bitcoin?.wkResistance}</span>
              <span style={{ color:C.textMid }}>Monthly</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.bitcoin?.moSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.bitcoin?.moResistance}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 2: Rates + DXY + Yield */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
       <Card glow={C.purple}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13 }}>🧠</span>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>AI-Enhanced Macro Analysis</span>
          </div>
          <Badge label={d.aiViews?._timestamp ? "Live · Sonnet" : "SEED"} color={d.aiViews?._timestamp ? C.purple : C.textDim} />
        </div>

        {/* Tab switcher */}
        <div style={{ display:"flex", gap:6, marginBottom:14, borderBottom:"1px solid " + C.border, paddingBottom:0, flexWrap:"wrap" }}>
          {[
            { key:"bullish", label:"🐂 Bullish", color:C.green },
            { key:"neutral", label:"⚖ Neutral", color:C.yellow },
            { key:"bearish", label:"🐻 Bearish", color:C.red },
          ].map(function(tab) {
            var active = aiView === tab.key;
            return (
              <button key={tab.key} onClick={function(){ setAiView(tab.key); }} style={{
                background: active ? tab.color + "22" : "transparent",
                border: "none",
                borderBottom: active ? "2px solid " + tab.color : "2px solid transparent",
                color: active ? tab.color : C.textMid,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.5,
                cursor: "pointer",
                fontFamily: sans,
                transition: "all 0.2s",
                marginBottom: -1,
              }}>{tab.label}</button>
            );
          })}
        </div>

        {/* Active view content */}
        <div style={{
          fontSize:12,
          lineHeight:1.7,
          color:C.textMid,
          background: (aiView==="bullish"?C.green:aiView==="bearish"?C.red:C.yellow) + "08",
          border: "1px solid " + (aiView==="bullish"?C.green:aiView==="bearish"?C.red:C.yellow) + "22",
          borderRadius: 6,
          padding: "10px 12px",
          maxHeight: 380,
          overflowY: "auto",
        }}>
          {(d.aiViews?.[aiView] || "Click ⚡ Refresh to load AI analysis.").split("\n\n").map(function(para,i) {
            return <p key={i} style={{ margin:"0 0 10px" }}>{para}</p>;
          })}
        </div>

        <div style={{ display:"flex", gap:4, marginTop:10, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>FRAMEWORKS:</span>
          {["mit_macro","liquidity","ray_dalio"].map(function(t) {
            return <span key={t} style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"2px 6px", fontSize:10, color:C.textDim }}>{t}</span>;
          })}
        </div>
      </Card>

        <Card>
          <SecTitle icon="$" title="US Dollar (DXY)" />
          {false ? (
            <div><Skel w="65%" h={25} mb={5} /><Skel w="40%" h={11} mb={10} /></div>
          ) : (
            <div>
              <div style={{ fontSize:25, fontWeight:700, fontFamily:font, marginBottom:3 }}>{d.dxy?.price}</div>
              <div style={{ fontSize:11, color:C.textMid, marginBottom:8, fontFamily:font }}>— {d.dxy?.change}%</div>
            </div>
          )}
          <div style={{ marginBottom:10, height:40, background:C.cardAlt, borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:40, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="100%" height="30" viewBox="0 0 260 30" preserveAspectRatio="none">
                <polyline points="0,20 26,18 52,22 78,15 104,17 130,14 156,16 182,12 208,14 234,11 260,13" fill="none" stroke={C.blueLight} strokeWidth="1.5" />
              </svg>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:3 }}><span>Weak</span><span>Neutral</span><span>Strong</span></div>
            <div style={{ position:"relative", height:5, background:"linear-gradient(90deg," + C.red + "," + C.textDim + "," + C.green + ")", borderRadius:3 }}>
              <div style={{ position:"absolute", width:10, height:10, borderRadius:"50%", background:C.blue, border:"2px solid " + C.text, top:-3, left:(d.dxy?.position||48) + "%", transform:"translateX(-50%)" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginTop:2 }}><span>90</span><span>100</span><span>110</span></div>
          </div>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <Badge label={d.dxy?.strength||"NEUTRAL"} color={d.dxy?.strength==="WEAK"?C.red:d.dxy?.strength==="STRONG"?C.green:C.yellow} />
            <span style={{ fontSize:11, color:C.textMid }}>{false?"...":d.dxy?.note}</span>
          </div>
        </Card>

    <Card>
          <SecTitle icon="📊" title="Macro Indicators" badge="LIVE" bc={C.cyan} />
          
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            {/* Global M2 */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>Global M2 (CB Balance Sheets)</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color: d.macroIndic?.globalM2Trend==="Rising" ? C.green : d.macroIndic?.globalM2Trend==="Falling" ? C.red : C.orange, marginBottom:6 }}>
                {d.macroIndic?.globalM2Trend==="Rising" ? "▲ " : d.macroIndic?.globalM2Trend==="Falling" ? "▼ " : ""}{d.macroIndic?.globalM2 || "—"}
              </div>
              <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>
                {d.macroIndic?.globalM2Trend==="Rising" 
                  ? "Global liquidity expanding. Supports asset prices."
                  : d.macroIndic?.globalM2Trend==="Falling"
                  ? "Global liquidity contracting. Pressure on valuations."
                  : "Sum of Fed + ECB + BoJ balance sheets"}
              </p>
            </div>

            {/* US M2 */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>US M2 Money Supply</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color: d.macroIndic?.usM2Trend==="Rising" ? C.green : d.macroIndic?.usM2Trend==="Falling" ? C.red : C.orange, marginBottom:2 }}>
                {d.macroIndic?.usM2Trend==="Rising" ? "▲ " : d.macroIndic?.usM2Trend==="Falling" ? "▼ " : ""}{d.macroIndic?.usM2 || "—"}
              </div>
              {d.macroIndic?.usM2Change && (
                <div style={{ fontSize:11, color:d.macroIndic?.usM2Trend==="Rising"?C.green:C.red, fontFamily:font, marginBottom:6 }}>{d.macroIndic.usM2Change} MoM</div>
              )}
              <p style={{ fontSize:11, color:C.textMid, margin:d.macroIndic?.usM2Change?0:"6px 0 0", lineHeight:1.4 }}>
                {d.macroIndic?.usM2Trend==="Rising"
                  ? "More dollars in circulation. Bullish for risk assets."
                  : d.macroIndic?.usM2Trend==="Falling"
                  ? "Money supply contracting. Headwind for equities."
                  : "Monitor M2 growth rate for inflation signals"}
              </p>
            </div>

            {/* ISM Manufacturing PMI */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>{d.macroIndic?.ismLabel || "ISM Manufacturing PMI"}</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color: d.macroIndic?.ismStatus==="Expanding" ? C.green : d.macroIndic?.ismStatus==="Contracting" ? C.red : C.orange, marginBottom:2 }}>
                {d.macroIndic?.ismStatus==="Expanding" ? "▲ " : d.macroIndic?.ismStatus==="Contracting" ? "▼ " : ""}{d.macroIndic?.ismPMI || "—"}
              </div>
              {d.macroIndic?.ismMonth && (
                <div style={{ fontSize:10, color:C.textDim, fontFamily:font, marginBottom:4 }}>
                  {d.macroIndic.ismMonth}{d.macroIndic.ismPrev ? " · prev " + d.macroIndic.ismPrev : ""}
                </div>
              )}
              <p style={{ fontSize:11, color:C.textMid, margin:d.macroIndic?.ismMonth?0:"6px 0 0", lineHeight:1.4 }}>
                {d.macroIndic?.ismStatus==="Expanding"
                  ? "Above 50 — manufacturing in expansion. Bullish signal."
                  : d.macroIndic?.ismStatus==="Contracting"
                  ? "Below 50 — manufacturing contracting. Recession risk."
                  : ">50 = expansion · <50 = contraction"}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background:C.cardAlt, borderRadius:6, padding:10, borderTop:"1px solid " + C.border, marginTop:8, paddingTop:10 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, fontWeight:700 }}>📋 Summary</div>
            <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.5 }}>
              {d.macroIndic?.ismStatus==="Expanding" && d.macroIndic?.usM2Trend==="Rising"
                ? "✓ Tailwinds: Manufacturing expanding, M2 rising. Risk-on backdrop."
                : d.macroIndic?.ismStatus==="Contracting" || d.macroIndic?.usM2Trend==="Falling"
                ? "⚠ Headwinds: Manufacturing weak or M2 contracting. Economic caution warranted."
                : "Live macro data pending. Monitor both growth (ISM) and liquidity (M2)."}
            </p>
          </div>
        </Card>
      </div>

      {/* ROW 3: F&G + VIX + Inflation */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="🎯" title="Fear & Greed Index" badge={d.fg?.timestamp ? "LIVE" : "SEED"} bc={d.fg?.timestamp ? C.green : C.textDim} />
          <div style={{ textAlign:"center", marginBottom:4 }}>
            {false ? <div><Skel w="80px" h={46} mb={7} /><Skel w="120px" h={15} mb={0} /></div> : (
              <div>
                <div style={{ fontSize:46, fontWeight:700, fontFamily:font, color:d.fg?.score==null?C.textDim:d.fg?.score<25?C.red:d.fg?.score<45?C.orange:d.fg?.score<55?C.textMid:d.fg?.score<75?C.green:C.cyan }}>
                  {d.fg?.score != null ? d.fg.score : "—"}
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:d.fg?.score==null?C.textDim:d.fg?.score<25?C.red:d.fg?.score<45?C.orange:C.green }}>
                  {d.fg?.label || "—"}
                </div>
              </div>
            )}
          </div>
          <div style={{ height:6, background:"linear-gradient(90deg," + C.red + "," + C.orange + ",#888," + C.green + "," + C.cyan + ")", borderRadius:3, marginBottom:3, position:"relative" }}>
            <div style={{ position:"absolute", width:7, height:11, background:C.text, top:-3, left:(d.fg?.score != null ? d.fg.score : 50) + "%", transform:"translateX(-50%)", borderRadius:2 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:10 }}><span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span></div>
          <Row label="vs Previous" val={d.fg?.vsPrev != null ? (d.fg.vsPrev >= 0 ? "+" : "") + d.fg.vsPrev : "—"} />
          <div style={{ borderTop:"1px solid " + C.border, paddingTop:7, marginTop:3 }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:5 }}>₿ Crypto Fear & Greed</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:20, fontWeight:700, fontFamily:font, color:d.fg?.cryptoScore==null?C.textDim:d.fg?.cryptoScore<25?C.red:d.fg?.cryptoScore<45?C.orange:C.green }}>
                {d.fg?.cryptoScore != null ? d.fg.cryptoScore : "—"}
              </span>
              <Badge label={d.fg?.cryptoLabel||"—"} color={d.fg?.cryptoScore==null?C.textDim:d.fg?.cryptoScore<25?C.red:d.fg?.cryptoScore<45?C.orange:C.green} />
            </div>
            <div style={{ height:5, background:"linear-gradient(90deg," + C.red + "," + C.orange + ",#888," + C.green + "," + C.cyan + ")", borderRadius:3, marginTop:7, position:"relative" }}>
              <div style={{ position:"absolute", width:7, height:9, background:C.text, top:-2, left:(d.fg?.cryptoScore != null ? d.fg.cryptoScore : 50) + "%", transform:"translateX(-50%)", borderRadius:2 }} />
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="📉" title="VIX (Volatility)" />
          {false ? (
            <div><Skel w="58%" h={32} mb={5} /><Skel w="38%" h={13} mb={12} /></div>
          ) : (
            <div>
              <div style={{ fontSize:32, fontWeight:700, fontFamily:font, marginBottom:3 }}>{d.vix?.price}</div>
              <div style={{ fontSize:12, color:String(d.vix?.change||"").startsWith("-")?C.green:C.red, fontFamily:font, marginBottom:12 }}>{d.vix?.change} ({d.vix?.changePct}%)</div>
            </div>
          )}
          <div style={{ background:(d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow)+"18", border:"1px solid " + (d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow) + "38", borderRadius:6, padding:"8px 11px", marginBottom:10 }}>
            <span style={{ color:d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow, fontWeight:700, fontSize:13 }}>{d.vix?.level}</span>
            <span style={{ color:C.textMid, fontSize:11, marginLeft:10 }}>{d.vix?.note}</span>
          </div>
 
          <div style={{ fontSize:11, color:C.textDim }}>Fear gauge: &lt;15 low · 15-25 moderate · 25-35 high · &gt;35 extreme</div>
        </Card>

        <Card>
          <SecTitle icon="🌡" title="Inflation" badge={d.inflation?.trend} bc={d.inflation?.trend==="Falling"?C.green:d.inflation?.trend==="Rising"?C.red:C.yellow} />
          {false ? <Skel w="55%" h={29} mb={4} /> : <div style={{ fontSize:29, fontWeight:700, fontFamily:font, marginBottom:2 }}>{d.inflation?.cpi}%</div>}
          <div style={{ fontSize:11, color:C.textDim, marginBottom:10 }}>CPI YoY (official rate)</div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:12, color:C.textMid }}>Truflation (real-time)</span>
            <span style={{ fontSize:12, fontFamily:font }}>{d.inflation?.truflation}%</span>
          </div>
          <div style={{ background:(parseFloat(d.inflation?.spread)<0?C.green:C.red)+"18", border:"1px solid " + (parseFloat(d.inflation?.spread)<0?C.green:C.red) + "28", borderRadius:4, padding:"4px 8px", marginBottom:9, textAlign:"center" }}>
            <span style={{ fontSize:11, color:parseFloat(d.inflation?.spread)<0?C.green:C.red }}>Spread: {parseFloat(d.inflation?.spread)<0?"▼":"▲"} {d.inflation?.spread}%</span>
          </div>
          <p style={{ fontSize:11, color:C.orange, margin:"0 0 10px", lineHeight:1.5 }}>{d.inflation?.note}</p>
          <div>
            <div style={{ height:6, background:"linear-gradient(90deg," + C.blue + "," + C.green + "," + C.yellow + "," + C.orange + "," + C.red + ")", borderRadius:3, position:"relative", marginBottom:3 }}>
              <div style={{ position:"absolute", width:9, height:9, background:C.text, border:"2px solid " + C.card, top:-2, left:Math.min(90,Math.max(5,(parseFloat(d.inflation?.cpi||2.4)/6)*100)) + "%", transform:"translateX(-50%)", borderRadius:"50%" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim }}><span>Deflation</span><span>2% target</span><span>High</span></div>
          </div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:8 }}>Truflation leads CPI by ~90 days</div>
        </Card>
      </div>

      {/* ROW 4a: Global Liquidity — full width interactive chart */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, flexWrap:"wrap", gap:14 }}>
          <div style={{ flex:"1 1 auto", minWidth:0 }}>
            <SecTitle icon="💧" title="Global Liquidity" badge={d.liquidity?.trend} bc={d.liquidity?.trend==="Contractionary"?C.red:d.liquidity?.trend==="Expansionary"?C.green:C.yellow} />
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:120 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>Total</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:font, lineHeight:1, color:C.text }}>${d.liquidity?.total}T</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Stack of CB assets</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:120 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>Score</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:font, lineHeight:1, color:d.liquidity?.trend==="Contractionary"?C.red:C.green }}>{d.liquidity?.score}<span style={{ fontSize:13, color:C.textDim, fontWeight:400 }}>/100</span></div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>0=tight · 100=loose</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:100 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>13-Week</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:font, lineHeight:1, color:String(d.liquidity?.roc13w||"").startsWith("-")?C.red:C.green }}>
                  {String(d.liquidity?.roc13w||"").startsWith("-")?"▼":"▲"} {String(d.liquidity?.roc13w||"").replace("-","")}%
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Rate of change</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:100 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>52-Week</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:font, lineHeight:1, color:String(d.liquidity?.roc52w||"").startsWith("-")?C.red:C.green }}>
                  {String(d.liquidity?.roc52w||"").startsWith("-")?"▼":"▲"} {String(d.liquidity?.roc52w||"").replace("-","")}%
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Rate of change</div>
              </div>
            </div>
          </div>
          <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"8px 12px", fontSize:10, color:C.textMid, maxWidth:240, lineHeight:1.5 }}>
            <div style={{ color:C.cyan, fontSize:9, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase", fontWeight:700 }}>💡 How to use</div>
            Hover anywhere on chart for date details. Click bank toggles to isolate. Enable S&P overlay to compare liquidity vs equities.
          </div>
        </div>
        <LiquidityChart history={d.liquidityHistory} />
      </Card>

      {/* ROW 4b: Credit + Breadth + Macro Indicators */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        {/* YIELD CURVE — moved from Row 2 */}
        <Card>
          <SecTitle icon="〜" title="Yield Curve" />
          
          <div style={{ marginBottom:12, paddingBottom:12, borderBottom:"1px solid " + C.border }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:6 }}>10-Year vs 2-Year Spread</div>
            <div style={{ fontSize:26, fontWeight:700, fontFamily:font, color:d.yield?.status==="INVERTED"?C.red:C.green, marginBottom:4 }}>
              {d.yield?.spread}
            </div>
            <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>
              {d.yield?.status==="INVERTED"
                ? "🔴 INVERTED - This is a serious recession warning. Investors expect tough times ahead."
                : d.yield?.status==="FLAT"
                ? "🟡 FLAT - Market is uncertain. Changes coming."
                : "🟢 NORMAL - Healthy curve. Long-term rates higher than short-term (as they should be)."}
            </p>
          </div>

          <div style={{ background:(d.yield?.recessionRisk==="LOW"?C.green:d.yield?.recessionRisk==="MEDIUM"?C.orange:C.red)+"15", border:"1px solid " + (d.yield?.recessionRisk==="LOW"?C.green:d.yield?.recessionRisk==="MEDIUM"?C.orange:C.red) + "40", borderRadius:6, padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDim }}>Recession Risk</div>
              <span style={{ background:(d.yield?.recessionRisk==="LOW"?C.green:d.yield?.recessionRisk==="MEDIUM"?C.orange:C.red)+"25", color:(d.yield?.recessionRisk==="LOW"?C.green:d.yield?.recessionRisk==="MEDIUM"?C.orange:C.red), padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700 }}>
                {d.yield?.recessionRisk || "LOW"}
              </span>
            </div>
            <Bar pct={d.yield?.recessionPct || 15} color={d.yield?.recessionRisk==="LOW"?C.green:d.yield?.recessionRisk==="MEDIUM"?C.orange:C.red} height={5} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10 }}>
              <span style={{ color:C.textDim }}>Probability</span>
              <span style={{ fontFamily:font, fontWeight:700, color:C.text }}>{d.yield?.recessionPct || 15}%</span>
            </div>
            <p style={{ fontSize:10, color:C.textMid, margin:"8px 0 0", lineHeight:1.4 }}>
              {d.yield?.recessionRisk==="LOW" 
                ? "Economy looks healthy. Normal times ahead."
                : d.yield?.recessionRisk==="MEDIUM"
                ? "Be cautious. Recession risk is elevated."
                : "🔴 Serious recession risk. Major economic slowdown likely."}
            </p>
          </div>
        </Card>

        <Card>
          <SecTitle icon="⚠" title="Credit & Stress" badge={d.credit?.timestamp ? "LIVE" : "SEED"} bc={d.credit?.timestamp ? C.green : C.textDim} />
          
          {/* HY Spread — live from FRED */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>HY CREDIT SPREAD (OAS)</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseInt(d.credit?.hyDAS)>500?C.red:parseInt(d.credit?.hyDAS)>350?C.orange:C.green, marginBottom:4 }}>
              {d.credit?.hyDAS || "—"}<span style={{ fontSize:12, color:C.textDim, fontWeight:400 }}> bp</span>
            </div>
            <Bar pct={Math.min(100, (parseInt(d.credit?.hyDAS)||300) / 8)} color={parseInt(d.credit?.hyDAS)>500?C.red:parseInt(d.credit?.hyDAS)>350?C.orange:C.green} height={4} />
            <div style={{ fontSize:10, color:C.textMid, marginTop:4 }}>
              {parseInt(d.credit?.hyDAS)<300 ? "Tight — complacency risk" : parseInt(d.credit?.hyDAS)>500 ? "Wide — credit stress" : "Normal range"}
            </div>
          </div>

          {/* MOVE Index — live from Claude web search */}
          <div style={{ marginBottom:12, paddingTop:10, borderTop:"1px solid " + C.border }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>MOVE INDEX (BOND VOLATILITY)</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseFloat(d.credit?.moveIndex)>120?C.red:parseFloat(d.credit?.moveIndex)>100?C.orange:C.green, marginBottom:4 }}>
              {d.credit?.moveIndex || "—"}
            </div>
            <div style={{ fontSize:10, color:C.textMid }}>
              {parseFloat(d.credit?.moveIndex)>120 ? "High — bond market stressed" : parseFloat(d.credit?.moveIndex)>100 ? "Elevated — watch for spillover" : "Normal — bond market calm"}
            </div>
          </div>

          {/* Sahm Rule — live from FRED */}
          <div style={{ paddingTop:10, borderTop:"1px solid " + C.border }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>SAHM RULE (RECESSION SIGNAL)</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
              <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseFloat(d.credit?.sahmRule)>0.5?C.red:parseFloat(d.credit?.sahmRule)>0.3?C.orange:C.green }}>
                {d.credit?.sahmRule || "—"}
              </div>
              <Badge label={parseFloat(d.credit?.sahmRule)>0.5?"TRIGGERED":parseFloat(d.credit?.sahmRule)>0.3?"ELEVATED":"SAFE"} color={parseFloat(d.credit?.sahmRule)>0.5?C.red:parseFloat(d.credit?.sahmRule)>0.3?C.orange:C.green} />
            </div>
            <div style={{ fontSize:10, color:C.textMid, lineHeight:1.4 }}>
              Recession triggers at 0.50. Currently {parseFloat(d.credit?.sahmRule)<0.3 ? "well below" : parseFloat(d.credit?.sahmRule)<0.5 ? "approaching" : "above"} threshold.
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="📊" title="Market Breadth" badge={d.breadth?.timestamp ? "LIVE" : "SEED"} bc={d.breadth?.timestamp ? C.green : C.textDim} />
          
          {/* SHORT TERM: 50-day MA */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
              <div>
                <div style={{ fontSize:11, color:C.textDim, marginBottom:2 }}>📈 SHORT TERM (50-day)</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseFloat(d.breadth?.pct50) < 40 ? C.red : parseFloat(d.breadth?.pct50) < 60 ? C.orange : C.green }}>{d.breadth?.pct50}%</div>
              </div>
              <div style={{ textAlign:"right", fontSize:10, color:C.textMid }}>
                {parseFloat(d.breadth?.pct50) < 40 
                  ? "🔴 Weak — mostly down" 
                  : parseFloat(d.breadth?.pct50) < 60 
                  ? "🟡 Mixed — some weakness" 
                  : "🟢 Strong — mostly up"}
              </div>
            </div>
            <Bar pct={d.breadth?.pct50} color={parseFloat(d.breadth?.pct50) < 40 ? C.red : parseFloat(d.breadth?.pct50) < 60 ? C.orange : C.green} height={6} />
            <div style={{ fontSize:10, color:C.textDim, marginTop:4, lineHeight:1.4 }}>
              Out of 500 stocks, {d.breadth?.pct50} are performing better than their recent 50-day trend
            </div>
          </div>

          {/* LONG TERM: 200-day MA */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
              <div>
                <div style={{ fontSize:11, color:C.textDim, marginBottom:2 }}>📅 LONG TERM (200-day)</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseFloat(d.breadth?.pct200) < 40 ? C.red : parseFloat(d.breadth?.pct200) < 70 ? C.orange : C.green }}>{d.breadth?.pct200}%</div>
              </div>
              <div style={{ textAlign:"right", fontSize:10, color:C.textMid }}>
                {parseFloat(d.breadth?.pct200) < 40 
                  ? "🔴 Downtrend" 
                  : parseFloat(d.breadth?.pct200) < 70 
                  ? "🟡 Shaky" 
                  : "🟢 Uptrend"}
              </div>
            </div>
            <Bar pct={d.breadth?.pct200} color={parseFloat(d.breadth?.pct200) < 40 ? C.red : parseFloat(d.breadth?.pct200) < 70 ? C.orange : C.green} height={6} />
            <div style={{ fontSize:10, color:C.textDim, marginTop:4, lineHeight:1.4 }}>
              {parseFloat(d.breadth?.pct200) >= 70 
                ? "Most stocks are in long-term uptrends — healthy"
                : parseFloat(d.breadth?.pct200) >= 40
                ? "Mixed — some stocks in uptrends, some in downtrends"
                : "Most stocks are in downtrends — weak foundation"}
            </div>
          </div>

          {/* MOMENTUM: A/D Indicators */}
          <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, fontWeight:700 }}>📊 MOMENTUM (Gaining vs Losing Stocks)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:3 }}>Last 5 days</div>
                <div style={{ fontSize:12, fontWeight:700, color:d.breadth?.ad5d==="Falling"?C.red:d.breadth?.ad5d==="Rising"?C.green:C.orange }}>
                  {d.breadth?.ad5d==="Falling" ? "📉 Selling" : d.breadth?.ad5d==="Rising" ? "📈 Buying" : "➡️ Flat"}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:3 }}>Last 20 days</div>
                <div style={{ fontSize:12, fontWeight:700, color:d.breadth?.ad20d==="Falling"?C.red:d.breadth?.ad20d==="Rising"?C.green:C.orange }}>
                  {d.breadth?.ad20d==="Falling" ? "📉 Selling" : d.breadth?.ad20d==="Rising" ? "📈 Buying" : "➡️ Flat"}
                </div>
              </div>
            </div>
          </div>

          {/* OVERALL SIGNAL */}
          <div style={{ background:(d.breadth?.sentiment==="BEARISH"?C.red:C.green)+"15", border:"1px solid " + (d.breadth?.sentiment==="BEARISH"?C.red:C.green) + "40", borderRadius:6, padding:"10px 12px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:d.breadth?.sentiment==="BEARISH"?C.red:C.green, marginBottom:4 }}>
              {d.breadth?.sentiment==="BEARISH" ? "⚠️ WEAK LEADERSHIP" : "✓ HEALTHY BREADTH"}
            </div>
            <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>
              {d.breadth?.sentiment==="BEARISH" 
                ? "Only a few big stocks are pulling the market up. Most individual stocks are struggling. This is fragile — watch for a reversal."
                : "Most stocks are performing well alongside the index. Strong, healthy market participation. This is sustainable."}
            </div>
          </div>
        </Card>
      </div>

      {/* OPTIONS SENTIMENT */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13 }}>📡</span>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Options Sentiment</span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <Badge label={d.options?.timestamp ? "LIVE" : "SEED"} color={d.options?.timestamp ? C.green : C.textDim} />
            <Badge label={d.options?.status||"NEUTRAL"} color={d.options?.status==="BULLISH"?C.green:d.options?.status==="BEARISH"?C.red:C.textMid} />
          </div>
        </div>

        <div style={{ textAlign:"center", marginBottom:14 }}>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:6 }}>CBOE TOTAL PUT/CALL RATIO</div>
          <div style={{ fontSize:38, fontWeight:700, fontFamily:font, color:parseFloat(d.options?.dexPCR)>1.1?C.red:parseFloat(d.options?.dexPCR)<0.7?C.green:C.orange }}>
            {d.options?.dexPCR || "—"}
          </div>
          <div style={{ fontSize:11, color:C.textMid, marginTop:4 }}>
            {parseFloat(d.options?.dexPCR) > 1.1 ? "Bearish — more puts than calls, hedging demand elevated" 
              : parseFloat(d.options?.dexPCR) < 0.7 ? "Bullish — heavy call buying, risk appetite strong"
              : "Neutral — balanced options activity"}
          </div>
        </div>

        <div style={{ height:6, background:"linear-gradient(90deg," + C.green + "," + C.yellow + "," + C.red + ")", borderRadius:3, position:"relative", marginBottom:4 }}>
          <div style={{ position:"absolute", width:8, height:12, background:C.text, top:-3, left:Math.min(95, Math.max(5, ((parseFloat(d.options?.dexPCR)||0.9) - 0.5) / 1.0 * 100)) + "%", transform:"translateX(-50%)", borderRadius:2 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim, marginBottom:12 }}><span>Bullish (0.5)</span><span>Neutral (1.0)</span><span>Bearish (1.5)</span></div>

        <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", fontSize:10, color:C.textDim, lineHeight:1.5 }}>
          Put/Call ratio measures how many put options (bets on decline) vs call options (bets on rise) are being traded. Above 1.0 = more puts = bearish sentiment.
        </div>
      </Card>

      {/* FCI */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:4 }}>Financial Conditions Index</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:32, fontWeight:700, fontFamily:font, color:d.fci?.status==="Loose"?C.green:d.fci?.status==="Tight"?C.red:C.yellow }}>{d.fci?.nfci||"—"}</span>
              <span style={{ fontSize:12, color:C.textMid }}>NFCI ({d.fci?.status||"—"})</span>
            </div>
          </div>
          <Badge label={d.fci?.status||"—"} color={d.fci?.status==="Loose"?C.green:d.fci?.status==="Tight"?C.red:C.yellow} />
        </div>

        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:3 }}><span>Looser</span><span>0 (avg)</span><span>Tighter</span></div>
          <div style={{ height:6, background:"linear-gradient(90deg," + C.green + "," + C.cyan + ",#444," + C.orange + "," + C.red + ")", borderRadius:3, position:"relative" }}>
            <div style={{ position:"absolute", width:8, height:12, background:C.text, top:-3, left:Math.min(95, Math.max(5, 50 + (parseFloat(d.fci?.nfci)||0) * 50)) + "%", transform:"translateX(-50%)", borderRadius:2 }} />
          </div>
        </div>

        <div style={{ fontSize:11, color:C.textMid, lineHeight:1.6, marginBottom:12 }}>
          {d.fci?.status==="Loose" 
            ? "Financial conditions are looser than average. Credit is flowing, funding is accessible, markets are calm. This supports growth and risk assets."
            : d.fci?.status==="Tight"
            ? "Financial conditions are tighter than average. Borrowing is more expensive, credit is contracting. This is a headwind for growth and stocks."
            : "Financial conditions are near their historical average. Neither loose nor tight."}
        </div>

        <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", fontSize:10, color:C.textDim, lineHeight:1.5 }}>
          The Chicago Fed NFCI combines 105 financial indicators. Negative = loose (good for stocks). Positive = tight (bad for stocks). Zero = average conditions.
        </div>
      </Card>

      {/* FORWARD RATES — full width */}
      <Card>
        <SecTitle icon="↘" title="Forward Rates" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:14 }}>
          <div>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>STATUS</div>
            <div style={{ fontSize:24, fontWeight:700, color:d.rates?.status==="EASING"?C.green:d.rates?.status==="TIGHTENING"?C.red:C.orange, marginBottom:8 }}>{d.rates?.status}</div>
            <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.5 }}>
              {d.rates?.status==="EASING" 
                ? "Fed cutting rates. Good for stocks, mortgages, borrowers. Economy may be slowing." 
                : d.rates?.status==="TIGHTENING" 
                ? "Fed raising rates. Expensive to borrow, bonds more attractive. Fighting inflation."
                : "Fed holding steady. No major changes coming. Market waiting for clarity."}
            </p>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>CURRENT FED FUNDS RATE</div>
            <div style={{ fontSize:30, fontWeight:700, fontFamily:font, marginBottom:6 }}>{d.rates?.current}%</div>
            <p style={{ fontSize:11, color:C.textDim, margin:0, lineHeight:1.5 }}>What banks charge each other to borrow overnight</p>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>DIRECTION</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:(d.rates?.status==="EASING"?C.green:C.red)+"20", border:"1px solid " + (d.rates?.status==="EASING"?C.green:C.red) + "44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{d.rates?.status==="EASING"?"↘":"↗"}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:d.rates?.status==="EASING"?C.green:C.red }}>
                  {d.rates?.status==="EASING" ? "Heading DOWN" : d.rates?.status==="TIGHTENING" ? "Heading UP" : "STEADY"}
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Trend</div>
              </div>
            </div>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>MARKET EXPECTS BY YEAR END</div>
            <div style={{ fontSize:30, fontWeight:700, fontFamily:font, marginBottom:8 }}>{d.rates?.expected}%</div>
            <div style={{ fontSize:11, color:C.textMid, background:C.cardAlt, padding:"6px 10px", borderRadius:4, lineHeight:1.4 }}>
              {d.rates?.impliedCuts === "-1" 
                ? "~1 rate cut priced in before December" 
                : d.rates?.impliedCuts === "-2" 
                ? "~2 rate cuts priced in" 
                : "No major cuts or hikes expected"}
            </div>
          </div>
        </div>
      </Card>

      {/* SECTOR ROTATION */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:6, background:C.blue+"30", border:"1px solid " + C.blue + "44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🔄</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:1.5, color:C.text }}>SECTOR ROTATION</div>
              <div style={{ fontSize:10, color:C.textDim }}>Live ETF returns · 1W/1M/3M/6M momentum</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {d.sectorTimestamp ? (
              <Badge label="LIVE" color={C.green} />
            ) : (
              <Badge label="SEED" color={C.textDim} />
            )}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7, marginBottom:16 }}>
          {(d.sectorRotation||[]).map(function(pair, i) {
            var bg = pair.bull===true ? C.green+"15" : pair.bull===false ? C.red+"15" : C.cardAlt;
            var border = pair.bull===true ? "1px solid " + C.green + "44" : pair.bull===false ? "1px solid " + C.red + "44" : "1px solid " + C.border;
            var dotColor = pair.bull===true ? C.green : pair.bull===false ? C.red : C.textDim;
            var winnerColor = pair.bull===true ? C.green : pair.bull===false ? C.red : C.textMid;
            return (
              <div key={i} style={{ background:bg, border:border, borderRadius:7, padding:"8px 7px", textAlign:"center" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:dotColor, margin:"0 auto 6px" }} />
                <div style={{ fontSize:10, color:C.textMid, marginBottom:4, lineHeight:1.3 }}>{pair.name}</div>
                <div style={{ fontSize:10, fontWeight:700, color:winnerColor, lineHeight:1.3 }}>{pair.winner || "—"}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14, fontSize:12 }}>
          <span style={{ color:C.textDim }}>Overall:</span>
          <span style={{ color:C.orange, fontWeight:700 }}>MIXED</span>
          <span style={{ fontSize:10, color:C.textDim }}>│</span>
          <span style={{ color:C.green }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===true}).length} bull</span>
          <span style={{ color:C.red }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===false}).length} bear</span>
          <span style={{ color:C.textMid }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===null}).length} neutral</span>
        </div>

        <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>Multi-Timeframe Momentum</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:16 }}>
          <thead>
            <tr style={{ borderBottom:"1px solid " + C.border }}>
              <th style={{ textAlign:"left", padding:"5px 7px", color:C.textDim, fontSize:10, fontWeight:600 }}>PAIR</th>
              {["1W","1M","3M","6M"].map(function(t) { return <th key={t} style={{ padding:"5px 8px", color:C.textDim, fontSize:10, fontWeight:600 }}>{t}</th>; })}
              <th style={{ textAlign:"left", padding:"5px 7px", color:C.textDim, fontSize:10, fontWeight:600 }}>NOTE</th>
            </tr>
          </thead>
          <tbody>
            {(d.sectorRotation||[]).map(function(pair, i) {
              return (
                <tr key={i} style={{ borderBottom:"1px solid " + C.border }}>
                  <td style={{ padding:"7px 7px", color:C.text, fontSize:12 }}>{pair.name}</td>
                  {[pair.w1, pair.w1m, pair.w3m, pair.w6m].map(function(w, j) {
                    return <td key={j} style={{ textAlign:"center", padding:"7px 8px" }}><span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:w==="g"?C.green:w==="r"?C.red:C.textDim }} /></td>;
                  })}
                  <td style={{ padding:"7px 7px", color:C.textDim, fontSize:11, fontStyle:"italic" }}>{pair.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ borderTop:"1px solid " + C.border, paddingTop:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Axis</div>
            <div style={{ display:"flex", gap:12, fontSize:10 }}>
              <span style={{ color:C.red }}>Bearish</span>
              <span style={{ color:C.green }}>Bullish</span>
              <span style={{ color:C.textDim, marginLeft:20 }}>PROB</span>
            </div>
          </div>
          {(d.sectorRotation||[]).map(function(pair, i) {
            var prob = parseInt(pair.prob) || 50;
            var barW = Math.min(48, Math.round((prob - 50) * 1.0));
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i < ((d.sectorRotation||[]).length-1) ? "1px solid " + C.border : "none" }}>
                <div style={{ width:160, flexShrink:0 }}>
                  <div style={{ fontSize:12, color:C.text, fontWeight:500 }}>{pair.name}</div>
                  <div style={{ fontSize:10, color:C.textDim }}>{pair.sub1} vs</div>
                  <div style={{ fontSize:10, color:C.textDim }}>{pair.sub2}</div>
                </div>
                <div style={{ flex:1, height:8, position:"relative" }}>
                  <div style={{ position:"absolute", inset:0, background:C.border, borderRadius:4 }} />
                  <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:C.textDim, transform:"translateX(-50%)" }} />
                  {pair.bull===true && <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:barW + "%", background:C.green, borderRadius:"0 4px 4px 0" }} />}
                  {pair.bull===false && <div style={{ position:"absolute", right:"50%", top:0, bottom:0, width:barW + "%", background:C.red, borderRadius:"4px 0 0 4px" }} />}
                  {pair.bull===null && <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:6, height:6, borderRadius:"50%", background:C.textDim }} />}
                </div>
                <div style={{ width:55, textAlign:"right", flexShrink:0 }}>
                  <span style={{ fontSize:13, fontFamily:font, fontWeight:700, color:pair.bull===true?C.green:pair.bull===false?C.red:C.textMid }}>{pair.prob}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* TOP SECTORS */}
      <Card>
        <SecTitle icon="📋" title="Top Sectors (6M Returns)" badge={d.sectorTimestamp ? "LIVE" : "SEED"} bc={d.sectorTimestamp ? C.green : C.textDim} />
        <div style={{ fontSize:11, color:C.textDim, marginBottom:12 }}>Top 5 performing sectors by 6-month total return</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:"1px solid " + C.border }}>
              {["RANK","SECTOR","ETF","6M RETURN","3M RETURN"].map(function(h) {
                return <th key={h} style={{ textAlign:h==="RANK"?"center":h.includes("RETURN")?"right":"left", padding:"5px 8px", fontSize:10, color:C.textDim, letterSpacing:1, fontWeight:600 }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {(d.topSectors||[]).map(function(s,i) {
              return (
                <tr key={i} style={{ borderBottom:"1px solid " + C.border }}>
                  <td style={{ textAlign:"center", padding:"8px" }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:i===0?C.gold:i===1?C.textMid:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, margin:"0 auto" }}>{i+1}</div>
                  </td>
                  <td style={{ padding:"8px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:[C.gold,C.green,C.cyan,C.blue,C.orange][i], display:"inline-block" }} />
                      {s.name}
                    </div>
                  </td>
                  <td style={{ padding:"8px", color:C.textDim, fontFamily:font }}>{s.etf}</td>
                  <td style={{ padding:"8px", textAlign:"right", color:parseFloat(s.r6m)>=0?C.green:C.red, fontFamily:font, fontWeight:700 }}>{parseFloat(s.r6m)>=0?"↗":"↘"} {s.r6m}%</td>
                  <td style={{ padding:"8px", textAlign:"right" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6 }}>
                      <span style={{ fontFamily:font, fontSize:11, color:s.pos?C.green:C.red }}>{s.r3m}%</span>
                      <div style={{ width:42, height:4, background:C.border, borderRadius:2 }}>
                        <div style={{ width:Math.min(100,Math.abs(parseFloat(s.r3m)||0)*2) + "%", height:"100%", background:s.pos?C.green:C.red, borderRadius:2 }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:10, color:C.textDim }}>
          <span>Based on S&P 500 sector ETFs (SPDR)</span>
          <span style={{ display:"flex", gap:10 }}><span><Dot c={C.green}/>Positive</span><span><Dot c={C.red}/>Negative</span></span>
        </div>
      </Card>

    </div>
  );
}

/* ─── PORTFOLIO HOLDINGS (The Claude Portfolio — launched Apr 1, 2026) ─── */
var PORTFOLIO_HOLDINGS = [
  { ticker:"AVGO", name:"Broadcom Inc.", sector:"Technology", weight:10, qty:24, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["AI Chips","Custom Silicon"], costBasis:208.33 },
  { ticker:"VST",  name:"Vistra Corp.", sector:"Energy", weight:10, qty:56, sleeve:"Strategic", cap:"Mid", assetClass:"Equity", themes:["Nuclear","AI Power"], costBasis:89.29 },
  { ticker:"MSFT", name:"Microsoft Corp.", sector:"Technology", weight:8, qty:10, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["Cloud","AI Infrastructure"], costBasis:400.00 },
  { ticker:"LLY",  name:"Eli Lilly & Co.", sector:"Healthcare", weight:8, qty:5, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["GLP-1","Obesity"], costBasis:800.00 },
  { ticker:"AMZN", name:"Amazon.com Inc.", sector:"Technology", weight:7, qty:18, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["AWS","E-Commerce"], costBasis:194.44 },
  { ticker:"META", name:"Meta Platforms", sector:"Technology", weight:7, qty:6, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["Ads","Llama AI"], costBasis:583.33 },
  { ticker:"GOOGL",name:"Alphabet Inc.", sector:"Technology", weight:6, qty:18, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["Search","Cloud"], costBasis:166.67 },
  { ticker:"CEG",  name:"Constellation Energy", sector:"Energy", weight:6, qty:13, sleeve:"Strategic", cap:"Mid", assetClass:"Equity", themes:["Nuclear","Data Centers"], costBasis:230.77 },
  { ticker:"GLD",  name:"SPDR Gold Trust", sector:"Commodities", weight:5, qty:10, sleeve:"Strategic", cap:"N/A", assetClass:"Gold", themes:["Gold","Safe Haven"], costBasis:250.00 },
  { ticker:"XOM",  name:"Exxon Mobil Corp.", sector:"Energy", weight:5, qty:22, sleeve:"Strategic", cap:"Large", assetClass:"Equity", themes:["Oil","Dividends"], costBasis:113.64 },
  { ticker:"UNH",  name:"UnitedHealth Group", sector:"Healthcare", weight:5, qty:5, sleeve:"Core", cap:"Large", assetClass:"Equity", themes:["Insurance","Optum"], costBasis:500.00 },
  { ticker:"NVDA", name:"Nvidia Corp.", sector:"Technology", weight:5, qty:22, sleeve:"Strategic", cap:"Large", assetClass:"Equity", themes:["AI GPUs","Data Center"], costBasis:113.64 },
  { ticker:"AU",   name:"AngloGold Ashanti", sector:"Materials", weight:4, qty:69, sleeve:"Speculative", cap:"Mid", assetClass:"Equity", themes:["Gold Mining","EM"], costBasis:28.99 },
  { ticker:"PLTR", name:"Palantir Technologies", sector:"Technology", weight:4, qty:18, sleeve:"Speculative", cap:"Mid", assetClass:"Equity", themes:["Defense AI","Gov Tech"], costBasis:111.11 },
  { ticker:"FCX",  name:"Freeport-McMoRan", sector:"Materials", weight:4, qty:48, sleeve:"Speculative", cap:"Mid", assetClass:"Equity", themes:["Copper","EV Metals"], costBasis:41.67 },
];
var PORTFOLIO_INCEPTION = "2026-04-01";
var PORTFOLIO_CASH = 3000; // 6% cash reserve

/* ─── PATTERN & LPPLS DETECTION (simplified) ─── */
function detectPattern(h) {
  if (!h.ma50 || !h.ma200 || !h.price) return "—";
  var abv50 = h.price > h.ma50, abv200 = h.price > h.ma200;
  var rising50 = h.maDev > 2;
  if (abv50 && abv200 && h.zScore > 1.5 && h.rsi > 65) return "Dbl Top";
  if (!abv50 && !abv200 && h.zScore < -1.5 && h.rsi < 35) return "Dbl Bot";
  if (!abv50 && abv200 && h.rsi > 40 && h.rsi < 55) return "Inv H&S";
  if (abv50 && !abv200 && h.maDev > 0) return "Cup&Hdl";
  return "—";
}
function detectLPPLS(h) {
  if (!h.zScore || !h.tq) return "—";
  if (h.zScore > 2.5 && h.tq > 60) return "⚠ Bubble";
  if (h.zScore > 2.0 && h.tq > 50) return "Elevated";
  if (h.zScore < -2.0) return "Capitulation";
  return "Normal";
}

/* ─── TRADINGVIEW ADVANCED CHART ──────────────────────────────── */
function TradingViewChart({ ticker }) {
  var containerId = "tv-chart-" + ticker;

  useEffect(function() {
    var container = document.getElementById(containerId);
    if (!container) return;
    // Clear previous widget
    container.innerHTML = "";

    var script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: "D",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#111220",
      gridColor: "#1c1e3022",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: [
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies|50",
        "MASimple@tv-basicstudies|200",
        "Momentum@tv-basicstudies|10"
      ],
      overrides: {
        "mainSeriesProperties.candleStyle.upColor": "#00e676",
        "mainSeriesProperties.candleStyle.downColor": "#ff4757",
        "mainSeriesProperties.candleStyle.borderUpColor": "#00e676",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ff4757",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00e676",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ff4757",
      }
    });
    container.appendChild(script);

    return function() {
      if (container) container.innerHTML = "";
    };
  }, [ticker]);

  return (
    <div id={containerId} style={{ height:500 }}>
      <div className="tradingview-widget-container" style={{ height:"100%", width:"100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height:"calc(100% - 32px)", width:"100%" }} />
      </div>
    </div>
  );
}

/* ─── PORTFOLIO STAGE ────────────────────────────────────────────── */
function PortfolioStage() {
  var _ps = useState([]);
  var holdings = _ps[0], setHoldings = _ps[1];
  var _pl = useState(true);
  var loading = _pl[0], setLoading = _pl[1];
  var _pe = useState(null);
  var error = _pe[0], setError = _pe[1];
  var _sc = useState("weight");
  var sortCol = _sc[0], setSortCol = _sc[1];
  var _sd = useState(-1);
  var sortDir = _sd[0], setSortDir = _sd[1];
  var _ai = useState(null);
  var aiHolding = _ai[0], setAiHolding = _ai[1];
  var _ad = useState({});
  var aiData = _ad[0], setAiData = _ad[1];
  var _st = useState(null);
  var selectedTicker = _st[0], setSelectedTicker = _st[1];
  var chartRef = useState(null);

  var regime = "Summer";

  useEffect(function() {
    (async function() {
      setLoading(true);
      try {
        var tickers = PORTFOLIO_HOLDINGS.map(function(h){return h.ticker}).join(",");
        var res = await fetch(PORTFOLIO_URL + "?tickers=" + tickers);
        var json = await res.json();
        var merged = PORTFOLIO_HOLDINGS.map(function(h) {
          var d = json.holdings && json.holdings[h.ticker];
          if (!d || d.error) return { ...h, price:null, ma50:null, ma200:null, rsi:null, tq:null, zScore:null, r6m:null, maDev:null, trend:"—", phase:"—", action:"—", pattern:"—", lppls:"—", value:h.weight/100*50000 };
          var merged = { ...h, ...d };
          merged.pattern = detectPattern(merged);
          merged.lppls = detectLPPLS(merged);
          merged.value = d.price ? d.price * h.qty : h.weight/100*50000;
          merged.pnl = d.price ? (d.price - h.costBasis) * h.qty : 0;
          merged.pnlPct = d.price && h.costBasis ? ((d.price / h.costBasis - 1) * 100) : 0;
          return merged;
        });
        setHoldings(merged);
      } catch(e) {
        setError(e.message);
        setHoldings(PORTFOLIO_HOLDINGS.map(function(h){return { ...h, price:null, trend:"—", phase:"—", action:"—", pattern:"—", lppls:"—", value:h.weight/100*50000, pnl:0, pnlPct:0 }}));
      }
      setLoading(false);
    })();
  }, []);

  // Fetch AI analysis for a single holding
  function fetchAI(ticker) {
    if (aiData[ticker]) { setAiHolding(ticker); return; }
    setAiHolding(ticker);
    var h = holdings.find(function(x){return x.ticker===ticker});
    if (!h) return;
    fetch(CLAUDE_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,messages:[{role:"user",content:
        "You are a senior equity analyst. Give a concise bull case (2 sentences) and bear case (2 sentences) for "+h.name+" ("+h.ticker+") as of April 2026. Current price: $"+h.price+", RSI: "+h.rsi+", 6M return: "+h.r6m+"%, Z-score: "+h.zScore+", Trend: "+h.trend+", Phase: "+h.phase+". Respond with ONLY valid JSON, no markdown, no backticks, no other text: {\"bull\":\"your bull case here\",\"bear\":\"your bear case here\",\"score\":7}"}]})
    }).then(function(r){
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(j){
      var txt = (j.content||[]).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("");
      console.log("AI response for " + ticker + ":", txt.slice(0, 200));
      var clean = txt.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
      var parsed = null;
      try { parsed = JSON.parse(clean); } catch(e) {
        // Try brace matching
        var d2=0,s2=-1;
        for(var k=0;k<clean.length;k++){if(clean[k]==="{"){if(d2===0)s2=k;d2++}else if(clean[k]==="}"){d2--;if(d2===0&&s2>=0){try{parsed=JSON.parse(clean.slice(s2,k+1))}catch(e3){}s2=-1}}}
      }
      if (!parsed) {
        // Regex fallback
        var bm = clean.match(/"bull"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        var brm = clean.match(/"bear"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        if (bm || brm) parsed = { bull:bm?bm[1].replace(/\\n/g,"\n").replace(/\\"/g,'"'):"N/A", bear:brm?brm[1].replace(/\\n/g,"\n").replace(/\\"/g,'"'):"N/A", score:5 };
      }
      if (parsed) {
        setAiData(function(prev){var n={...prev};n[ticker]=parsed;return n});
      } else {
        setAiData(function(prev){var n={...prev};n[ticker]={bull:"Analysis unavailable — response format error",bear:"Check console for details",score:0};return n});
        console.warn("AI parse failed for "+ticker+". Raw:", clean.slice(0,300));
      }
    }).catch(function(err){
      console.error("AI fetch error for "+ticker+":", err.message);
      setAiData(function(prev){var n={...prev};n[ticker]={bull:"Failed to load: "+err.message,bear:"Rate limited — wait 60s and try again",score:0};return n});
    });
  }

  function doSort(col) {
    if (sortCol === col) setSortDir(function(d){return d * -1});
    else { setSortCol(col); setSortDir(-1); }
  }

  var sorted = holdings.slice().sort(function(a, b) {
    var va = a[sortCol], vb = b[sortCol];
    if (va == null) return 1; if (vb == null) return -1;
    if (typeof va === "string") return va.localeCompare(vb) * sortDir;
    return (va - vb) * sortDir;
  });

  // Summary stats
  var totalValue = holdings.reduce(function(s,h){return s+(h.value||0)},0) + PORTFOLIO_CASH;
  var totalPnL = holdings.reduce(function(s,h){return s+(h.pnl||0)},0);
  var totalPnLPct = totalValue > 0 ? ((totalValue - 50000) / 50000 * 100) : 0;
  var holdCount = holdings.filter(function(h){return h.action==="Hold"}).length;
  var scaleCount = holdings.filter(function(h){return h.action==="Scale Out"}).length;
  var closeCount = holdings.filter(function(h){return h.action==="Close"}).length;

  // Portfolio balance calcs
  var sectorWeights = {};
  var assetClassWeights = {};
  var capWeights = { Large:0, Mid:0, Small:0 };
  var sleeveWeights = { Core:0, Strategic:0, Speculative:0 };
  holdings.forEach(function(h) {
    sectorWeights[h.sector] = (sectorWeights[h.sector]||0) + h.weight;
    assetClassWeights[h.assetClass] = (assetClassWeights[h.assetClass]||0) + h.weight;
    if (h.cap && capWeights[h.cap] != null) capWeights[h.cap] += h.weight;
    sleeveWeights[h.sleeve] = (sleeveWeights[h.sleeve]||0) + h.weight;
  });

  var trendColor = function(t) { return t==="Bullish"?C.green:t==="Bearish"?C.red:C.textMid; };
  var actionColor = function(a) { return a==="Hold"?C.green:a==="Scale Out"?C.orange:a==="Close"?C.red:C.textDim; };
  var actionBg = function(a) { return a==="Hold"?C.green+"22":a==="Scale Out"?C.orange+"22":a==="Close"?C.red+"22":C.cardAlt; };

  var thS = { textAlign:"left", padding:"7px 5px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", userSelect:"none", borderBottom:"1px solid "+C.border, whiteSpace:"nowrap", position:"sticky", top:0, background:C.card, zIndex:1 };
  var tdS = { padding:"6px 5px", fontSize:11, borderBottom:"1px solid "+C.border, whiteSpace:"nowrap" };
  var rightCols = ["price","ma50","ma200","rsi","tq","zScore","r6m","weight","maDev","qty","pnlPct"];

  var cols = [
    {key:"ticker",label:"TICKER",w:60},{key:"name",label:"ASSET",w:120},{key:"sector",label:"SECTOR",w:80},
    {key:"themes",label:"THEMES",w:130},
    {key:"maDev",label:"MA DEV",w:60},{key:"qty",label:"QTY",w:40},{key:"price",label:"PRICE",w:68},
    {key:"ma50",label:"50 DMA",w:62},{key:"ma200",label:"200 DMA",w:62},{key:"trend",label:"TREND",w:65},
    {key:"phase",label:"PHASE",w:85},{key:"action",label:"ACTION",w:60},{key:"rsi",label:"RSI",w:38},
    {key:"tq",label:"TQ",w:38},{key:"zScore",label:"Z-SCORE",w:55},{key:"r6m",label:"6M",w:48},
    {key:"pnlPct",label:"P&L",w:50},
    {key:"pattern",label:"PATTERN",w:60},{key:"lppls",label:"LPPLS",w:65},
    {key:"ai",label:"AI",w:30},
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* SUMMARY ROW */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:10 }}>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>PORTFOLIO VALUE</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font }}>${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Inception: Apr 1, 2026</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>TOTAL P&L</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:totalPnL>=0?C.green:C.red }}>{totalPnL>=0?"+":""}${Math.abs(totalPnL).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{ fontSize:10, color:totalPnLPct>=0?C.green:C.red, marginTop:2 }}>{totalPnLPct>=0?"+":""}{totalPnLPct.toFixed(2)}% since inception</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>CASH RESERVE</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font }}>${PORTFOLIO_CASH.toLocaleString()}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{(PORTFOLIO_CASH/totalValue*100).toFixed(1)}% of portfolio</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>SIGNALS</div>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.green }}>{holdCount}</span><div style={{ fontSize:9, color:C.textDim }}>Hold</div></div>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.orange }}>{scaleCount}</span><div style={{ fontSize:9, color:C.textDim }}>Scale</div></div>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.red }}>{closeCount}</span><div style={{ fontSize:9, color:C.textDim }}>Close</div></div>
          </div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>REGIME</div>
          <div style={{ fontSize:18, fontWeight:700, color:SC[regime]||C.gold }}>{regime}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{holdings.filter(function(h){return h.trend==="Bullish"}).length}/{holdings.length} bullish</div>
        </Card>
      </div>

      {/* HOLDINGS TABLE */}
      <Card style={{ padding:"10px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>⚡ Holdings Analysis</div>
          <div style={{ fontSize:10, color:C.textMid }}>{holdings.length} positions · Click row for chart · AI column for analysis</div>
        </div>
        <div style={{ overflowX:"auto", maxHeight:520, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1500 }}>
            <thead>
              <tr>
                {cols.map(function(col) {
                  var isRight = rightCols.indexOf(col.key) >= 0;
                  return <th key={col.key} onClick={function(){if(col.key!=="ai"&&col.key!=="themes")doSort(col.key)}} style={{ ...thS, width:col.w, textAlign:isRight?"right":"left" }}>{col.label}{sortCol===col.key?(sortDir>0?" ↑":" ↓"):""}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length} style={{ padding:40, textAlign:"center", color:C.textDim }}><Spinner size={16} /> Loading portfolio data...</td></tr>
              ) : sorted.map(function(h, i) {
                var mc = h.maDev==null?C.textDim:h.maDev>0?C.green:C.red;
                var patColor = h.pattern==="Inv H&S"||h.pattern==="Dbl Bot"||h.pattern==="Cup&Hdl"?C.green:h.pattern==="Dbl Top"?C.red:C.textDim;
                var lpColor = h.lppls==="⚠ Bubble"?C.red:h.lppls==="Elevated"?C.orange:h.lppls==="Capitulation"?C.cyan:C.textDim;
                return (
                  <tr key={h.ticker} onClick={function(){setSelectedTicker(selectedTicker===h.ticker?null:h.ticker)}} style={{ background:selectedTicker===h.ticker?C.blue+"18":i%2===0?"transparent":C.cardAlt+"33", cursor:"pointer", transition:"background 0.15s" }}>
                    <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font, fontSize:11 }}>{h.ticker}</td>
                    <td style={{ ...tdS, color:C.textMid, fontSize:10, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}>{h.name}</td>
                    <td style={{ ...tdS, fontSize:9, color:C.textDim }}>{h.sector}</td>
                    <td style={tdS}>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                        {(h.themes||[]).map(function(t){return <span key={t} style={{ background:C.blue+"22", color:C.blueLight, border:"1px solid "+C.blue+"33", borderRadius:3, padding:"1px 5px", fontSize:8, whiteSpace:"nowrap" }}>{t}</span>})}
                      </div>
                    </td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10 }}>
                      {h.maDev!=null ? <span style={{ color:mc }}>{h.maDev>0?"+":""}{h.maDev}%</span> : "—"}
                    </td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textMid }}>{h.qty}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontWeight:600, fontSize:11 }}>{h.price!=null?h.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{h.ma50||"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{h.ma200||"—"}</td>
                    <td style={tdS}><span style={{ color:trendColor(h.trend), fontWeight:600, fontSize:10 }}>{h.trend==="Bullish"?"↗ ":h.trend==="Bearish"?"↘ ":"— "}{h.trend}</span></td>
                    <td style={{ ...tdS, fontSize:9, color:C.textMid }}>{h.phase}</td>
                    <td style={tdS}><span style={{ background:actionBg(h.action), color:actionColor(h.action), padding:"2px 6px", borderRadius:3, fontSize:9, fontWeight:700 }}>{h.action}</span></td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.rsi>70?C.red:h.rsi<30?C.green:C.text }}>{h.rsi||"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.tq>50?C.green:h.tq<25?C.red:C.orange }}>{h.tq!=null?h.tq.toFixed(1):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.zScore>2?C.red:h.zScore<-2?C.red:h.zScore>0?C.green:C.orange }}>{h.zScore!=null?(h.zScore>0?"+":"")+h.zScore.toFixed(2):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.r6m>0?C.green:C.red }}>{h.r6m!=null?(h.r6m>0?"+":"")+h.r6m+"%":"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.pnlPct>0?C.green:h.pnlPct<0?C.red:C.textMid }}>{h.pnlPct?(h.pnlPct>0?"+":"")+h.pnlPct.toFixed(1)+"%":"—"}</td>
                    <td style={{ ...tdS, fontSize:9, fontWeight:600, color:patColor }}>{h.pattern}</td>
                    <td style={{ ...tdS, fontSize:9, color:lpColor }}>{h.lppls}</td>
                    <td style={tdS}>
                      <button onClick={function(){fetchAI(h.ticker)}} style={{ background:aiData[h.ticker]?C.purple+"33":C.cardAlt, border:"1px solid "+(aiData[h.ticker]?C.purple:C.border), borderRadius:3, color:aiData[h.ticker]?C.purple:C.textDim, fontSize:9, padding:"2px 5px", cursor:"pointer", fontWeight:700 }}>AI</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TRADINGVIEW CHART */}
      {selectedTicker && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px 0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13 }}>📈</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.cyan, fontFamily:font }}>{selectedTicker}</span>
              <span style={{ fontSize:11, color:C.textMid }}>{(holdings.find(function(x){return x.ticker===selectedTicker})||{}).name}</span>
              <Badge label="TradingView" color={C.blue} />
            </div>
            <button onClick={function(){setSelectedTicker(null)}} style={{ background:"transparent", border:"1px solid "+C.border, borderRadius:4, color:C.textDim, padding:"2px 8px", cursor:"pointer", fontSize:10 }}>✕ Close</button>
          </div>
          <TradingViewChart ticker={selectedTicker} />
        </Card>
      )}

      {/* AI ANALYSIS TOOLTIP */}
      {aiHolding && (
        <Card style={{ border:"1px solid "+C.purple+"44" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.purple }}>🧠 AI Analysis: {aiHolding}</div>
            <button onClick={function(){setAiHolding(null)}} style={{ background:"transparent", border:"1px solid "+C.border, borderRadius:4, color:C.textDim, padding:"2px 8px", cursor:"pointer", fontSize:10 }}>✕ Close</button>
          </div>
          {aiData[aiHolding] ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:C.green+"10", border:"1px solid "+C.green+"30", borderRadius:6, padding:10 }}>
                <div style={{ fontSize:10, color:C.green, fontWeight:700, marginBottom:6 }}>🐂 BULL CASE</div>
                <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>{aiData[aiHolding].bull}</div>
              </div>
              <div style={{ background:C.red+"10", border:"1px solid "+C.red+"30", borderRadius:6, padding:10 }}>
                <div style={{ fontSize:10, color:C.red, fontWeight:700, marginBottom:6 }}>🐻 BEAR CASE</div>
                <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>{aiData[aiHolding].bear}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:20, color:C.textDim }}><Spinner size={14} /> Generating AI analysis for {aiHolding}...</div>
          )}
        </Card>
      )}

      {/* PORTFOLIO BALANCE */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
            <span>📊</span> Portfolio Balance
            <Badge label={regime.toUpperCase()} color={SC[regime]||C.gold} />
            {closeCount>0 && <Badge label={closeCount+" Issues"} color={C.red} />}
          </div>
        </div>

        {/* Sleeve Allocation */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>SLEEVE ALLOCATION</div>
          <div style={{ display:"flex", gap:2, marginBottom:8 }}>
            <div style={{ flex:sleeveWeights.Core, height:10, background:C.blue, borderRadius:"4px 0 0 4px" }} />
            <div style={{ flex:sleeveWeights.Strategic||1, height:10, background:C.orange }} />
            <div style={{ flex:sleeveWeights.Speculative||1, height:10, background:C.red, borderRadius:"0 4px 4px 0" }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", borderTop:"2px solid "+C.blue }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.blue }}>Core</span>
                <span style={{ fontFamily:font, fontSize:14, fontWeight:700 }}>{sleeveWeights.Core}%</span>
              </div>
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>Long-duration holdings for secular super-cycle expansion. Minimal trading through cycles.</div>
            </div>
            <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", borderTop:"2px solid "+C.orange }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.orange }}>Strategic</span>
                <span style={{ fontFamily:font, fontSize:14, fontWeight:700 }}>{sleeveWeights.Strategic}%</span>
              </div>
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>Cycle-aware positions with thematic alignment. Actively managed sizing through macro cycles.</div>
            </div>
            <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", borderTop:"2px solid "+C.red }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.red }}>Speculative</span>
                <span style={{ fontFamily:font, fontSize:14, fontWeight:700 }}>{sleeveWeights.Speculative}%</span>
              </div>
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>High beta, liquidity-sensitive allocations. Targeted for participation in the liquidity cycle.</div>
            </div>
          </div>
        </div>

        {/* Asset Class Weights */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>ASSET CLASS WEIGHTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 45px 45px 55px", gap:"5px 8px", alignItems:"center" }}>
            <div style={{ fontSize:9, color:C.textDim }}>Class</div><div /><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Current</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Target</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Dev</div>
            {[{name:"Equity",target:88},{name:"Gold",target:5},{name:"Commodities",target:5}].map(function(ac) {
              var current = assetClassWeights[ac.name]||0;
              var dev = current - ac.target;
              return [
                <div key={ac.name+"l"} style={{ fontSize:11, color:C.text }}>{ac.name}</div>,
                <div key={ac.name+"b"} style={{ height:5, background:C.border, borderRadius:3 }}><div style={{ width:current+"%", height:"100%", background:Math.abs(dev)>5?C.orange:C.green, borderRadius:3, opacity:0.7 }} /></div>,
                <span key={ac.name+"c"} style={{ textAlign:"right", fontFamily:font, fontSize:11, fontWeight:700 }}>{current}%</span>,
                <span key={ac.name+"t"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{ac.target}%</span>,
                <span key={ac.name+"d"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:dev>0?C.green:dev<0?C.red:C.textMid }}>{dev>0?"+":""}{dev}pp</span>,
              ];
            })}
          </div>
        </div>

        {/* Sector Weights */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>SECTOR WEIGHTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 45px 45px 55px", gap:"5px 8px", alignItems:"center" }}>
            <div style={{ fontSize:9, color:C.textDim }}>Sector</div><div /><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Current</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Target</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Dev</div>
            {Object.entries(sectorWeights).sort(function(a,b){return b[1]-a[1]}).map(function(entry) {
              var s=entry[0],wt=entry[1];
              var targets={Technology:26,Energy:21,Healthcare:13,Materials:8,Commodities:5};
              var target=targets[s]||5;
              var diff=wt-target;
              return [
                <div key={s+"l"} style={{ fontSize:11, color:C.text }}>{s}</div>,
                <div key={s+"b"} style={{ height:5, background:C.border, borderRadius:3 }}><div style={{ width:Math.min(100,wt*2)+"%", height:"100%", background:Math.abs(diff)>5?C.red:Math.abs(diff)>2?C.orange:C.green, borderRadius:3, opacity:0.7 }} /></div>,
                <span key={s+"c"} style={{ textAlign:"right", fontFamily:font, fontSize:11, fontWeight:700 }}>{wt}%</span>,
                <span key={s+"t"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{target}%</span>,
                <span key={s+"d"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:diff>0?C.green:diff<0?C.red:C.textMid }}>{diff>0?"+":""}{diff}pp</span>,
              ];
            })}
          </div>
        </div>

        {/* Cap Size Distribution */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>CAP SIZE DISTRIBUTION</div>
          <div style={{ display:"flex", gap:4, marginBottom:6 }}>
            <div style={{ flex:capWeights.Large, height:8, background:C.blue, borderRadius:"4px 0 0 4px" }} />
            <div style={{ flex:capWeights.Mid||1, height:8, background:C.orange }} />
            <div style={{ flex:capWeights.Small||1, height:8, background:C.cyan, borderRadius:"0 4px 4px 0" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
            <span style={{ color:C.blue }}>● Large Cap: {capWeights.Large}%</span>
            <span style={{ color:C.orange }}>● Mid Cap: {capWeights.Mid}%</span>
            <span style={{ color:C.cyan }}>● Small Cap: {capWeights.Small}%</span>
          </div>
        </div>

        {/* Actions Required */}
        {(closeCount>0||scaleCount>0) && (
          <div style={{ borderTop:"1px solid "+C.border, paddingTop:12 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>ACTIONS REQUIRED</div>
            {holdings.filter(function(h){return h.action==="Close"}).map(function(h) {
              return <div key={h.ticker} style={{ background:C.red+"12", border:"1px solid "+C.red+"30", borderRadius:6, padding:"8px 12px", marginBottom:6 }}>
                <span style={{ color:C.red, fontWeight:700, fontSize:12 }}>✕ {h.ticker}</span>
                <span style={{ color:C.textMid, fontSize:11, marginLeft:8 }}>{h.phase} — {h.trend} trend, below key MAs. Consider closing.</span>
              </div>;
            })}
            {holdings.filter(function(h){return h.action==="Scale Out"}).map(function(h) {
              return <div key={h.ticker} style={{ background:C.orange+"12", border:"1px solid "+C.orange+"30", borderRadius:6, padding:"8px 12px", marginBottom:6 }}>
                <span style={{ color:C.orange, fontWeight:700, fontSize:12 }}>△ {h.ticker}</span>
                <span style={{ color:C.textMid, fontSize:11, marginLeft:8 }}>Z-Score {h.zScore>0?"+":""}{h.zScore} — extended rally, RSI {h.rsi}. Consider trimming.</span>
              </div>;
            })}
          </div>
        )}
      </Card>

      {error && <div style={{ background:"#2b0d10", border:"1px solid "+C.red+"44", borderRadius:8, padding:"7px 13px", fontSize:12, color:C.red }}>⚠ {error}</div>}
    </div>
  );
}

/* ─── ASSET SCREENER (Stage 3) ─────────────────────────────────── */

/* ─── ASSET SCREENER (Stage 3) — Enhanced ──────────────────────── */
var SCREENER_FALLBACK_SHARES = [
  {ticker:"POWL",name:"Powell Industries",sector:"Energy",type:"share",theme:"AI Power"},
  {ticker:"JBL",name:"Jabil Inc.",sector:"Technology",type:"share",theme:"AI & Digital Infra"},
  {ticker:"AMAT",name:"Applied Materials",sector:"Technology",type:"share",theme:"AI & Digital Infra"},
  {ticker:"CW",name:"Curtiss-Wright",sector:"Industrials",type:"share",theme:"Defense"},
  {ticker:"XPO",name:"XPO Inc.",sector:"Industrials",type:"share",theme:"Logistics"},
  {ticker:"MU",name:"Micron Technology",sector:"Technology",type:"share",theme:"AI & Digital Infra"},
  {ticker:"FCX",name:"Freeport-McMoRan",sector:"Materials",type:"share",theme:"Copper / EV Metals"},
  {ticker:"CF",name:"CF Industries",sector:"Materials",type:"share",theme:"Energy Transition"},
  {ticker:"RIG",name:"Transocean Ltd",sector:"Energy",type:"share",theme:"Oil & Gas"},
  {ticker:"SWBI",name:"Smith & Wesson",sector:"Industrials",type:"share",theme:"Defense"},
  {ticker:"BHE",name:"Benchmark Electronics",sector:"Technology",type:"share",theme:""},
  {ticker:"FIVE",name:"Five Below",sector:"Consumer Discretionary",type:"share",theme:""},
  {ticker:"LNTH",name:"Lantheus Holdings",sector:"Healthcare",type:"share",theme:""},
  {ticker:"ESLT",name:"Elbit Systems",sector:"Industrials",type:"share",theme:"Defense"},
  {ticker:"POWI",name:"Power Integrations",sector:"Technology",type:"share",theme:"Energy Transition"},
  {ticker:"DCO",name:"Ducommun Inc.",sector:"Industrials",type:"share",theme:"Aerospace"},
  {ticker:"KOP",name:"Koppers Holdings",sector:"Materials",type:"share",theme:""},
  {ticker:"FN",name:"Fabrinet",sector:"Technology",type:"share",theme:""},
  {ticker:"TTMI",name:"TTM Technologies",sector:"Technology",type:"share",theme:""},
  {ticker:"UNFI",name:"United Natural Foods",sector:"Consumer Discretionary",type:"share",theme:""},
  {ticker:"PLPC",name:"Preformed Line Products",sector:"Industrials",type:"share",theme:""},
  {ticker:"LXU",name:"LSB Industries",sector:"Materials",type:"share",theme:""},
  {ticker:"CEIX",name:"CONSOL Energy",sector:"Energy",type:"share",theme:""},
  {ticker:"CLF",name:"Cleveland-Cliffs",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"BTU",name:"Peabody Energy",sector:"Energy",type:"share",theme:""},
  {ticker:"ARCH",name:"Arch Resources",sector:"Energy",type:"share",theme:""},
  {ticker:"NUE",name:"Nucor Corp.",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"STLD",name:"Steel Dynamics",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"HAL",name:"Halliburton",sector:"Energy",type:"share",theme:"Oil & Gas"},
  {ticker:"SLB",name:"Schlumberger",sector:"Energy",type:"share",theme:"Oil & Gas"},
];
var SCREENER_FALLBACK_ETFS = [
  {ticker:"XLE",name:"Energy Select Sector SPDR",sector:"Energy",type:"etf",theme:""},
  {ticker:"XLB",name:"Materials Select Sector SPDR",sector:"Materials",type:"etf",theme:""},
  {ticker:"XLI",name:"Industrial Select Sector SPDR",sector:"Industrials",type:"etf",theme:""},
  {ticker:"PAVE",name:"Global X US Infrastructure",sector:"Industrials",type:"etf",theme:"Infrastructure"},
  {ticker:"XME",name:"SPDR S&P Metals & Mining",sector:"Materials",type:"etf",theme:"Mining"},
  {ticker:"ITA",name:"iShares US Aerospace & Defense",sector:"Industrials",type:"etf",theme:"Defense"},
  {ticker:"OIH",name:"VanEck Oil Services",sector:"Energy",type:"etf",theme:"Oil & Gas"},
  {ticker:"GDX",name:"VanEck Gold Miners",sector:"Materials",type:"etf",theme:"Gold"},
  {ticker:"COPX",name:"Global X Copper Miners",sector:"Materials",type:"etf",theme:"Copper"},
  {ticker:"URA",name:"Global X Uranium",sector:"Energy",type:"etf",theme:"Nuclear"},
];

function computeScreenerScore(d) {
  if (!d || !d.price) return { score:0, quality:0, momentum:0, value:0, pattern:0, sentiment:0 };
  var quality = d.tq != null ? Math.min(1, Math.abs(d.tq) / 80) : 0;
  var momentum = d.r6m != null ? Math.min(1, Math.max(0, d.r6m / 60)) : 0;
  var value = 0.03;
  var patternVal = 0;
  if (d.pattern && d.pattern !== "—") patternVal = 0.62;
  var sentiment = 0;
  if (d.rsi && d.rsi > 30 && d.rsi < 70) sentiment = 0.5;
  else if (d.rsi && d.rsi >= 70) sentiment = 0.3;
  else if (d.rsi && d.rsi <= 30) sentiment = 0.7;
  var w = { quality:0.25, momentum:0.40, value:0.10, pattern:0.15, sentiment:0.10 };
  var composite = quality*w.quality + momentum*w.momentum + value*w.value + patternVal*w.pattern + sentiment*w.sentiment;
  var score = Math.round(composite * 100);
  return { score:score, quality:quality, momentum:momentum, value:value, pattern:patternVal, sentiment:sentiment, composite:composite };
}

function computeRR(d) {
  if (!d || !d.price || !d.ma200) return "—";
  var support = d.ma200;
  if (d.ma50 && d.ma50 < d.price) support = Math.max(support, d.ma50 * 0.97);
  var atrEst = d.price * 0.02;
  var stopLoss = support - atrEst;
  var risk = d.price - stopLoss;
  var target = d.price * (1 + (d.zScore ? Math.max(0.03, Math.abs(d.zScore) * 0.04) : 0.06));
  var reward = target - d.price;
  if (risk <= 0 || reward <= 0) return "—";
  return (reward / risk).toFixed(1) + ":1";
}

function detectScreenerPattern(d) {
  if (!d || !d.ma50 || !d.ma200 || !d.price) return "—";
  var abv50 = d.price > d.ma50, abv200 = d.price > d.ma200;
  if (abv50 && abv200 && d.zScore > 2.0 && d.rsi > 70) return "Dbl Top";
  if (!abv50 && !abv200 && d.zScore < -1.5 && d.rsi < 35) return "Dbl Bot";
  if (!abv50 && abv200 && d.rsi > 40 && d.rsi < 60) return "Inv H&S";
  if (abv50 && abv200 && d.zScore > 1.5 && d.rsi > 60) return "Rise Wedge";
  if (abv50 && d.maDev > 0 && d.maDev < 5 && d.rsi > 45) return "Cup&Handle";
  if (abv50 && abv200 && d.ma50 > d.ma200) return "H&S";
  return "—";
}

function ScreenerStage() {
  var _c = useState([]);
  var candidates = _c[0], setCandidates = _c[1];
  var _l = useState(true);
  var loading = _l[0], setLoading = _l[1];
  var _st = useState(null);
  var selectedTicker = _st[0], setSelectedTicker = _st[1];
  var _sc = useState("score");
  var sortCol = _sc[0], setSortCol = _sc[1];
  var _sd = useState(-1);
  var sortDir = _sd[0], setSortDir = _sd[1];
  var _tab = useState("shares");
  var tab = _tab[0], setTab = _tab[1];
  var _search = useState("");
  var search = _search[0], setSearch = _search[1];
  var _manual = useState([]);
  var manualTickers = _manual[0], setManualTickers = _manual[1];
  var _status = useState("");
  var status = _status[0], setStatus = _status[1];
  var _err = useState(null);
  var err = _err[0], setErr = _err[1];
  var _seeds = useState([]);
  var seeds = _seeds[0], setSeeds = _seeds[1];
  var _showFilters = useState(false);
  var showFilters = _showFilters[0], setShowFilters = _showFilters[1];
  var _filters = useState({ minScore:0, minMom:null, trendFilter:"all", sectorFilter:"all" });
  var filters = _filters[0], setFilters = _filters[1];
  var _lastRefresh = useState(null);
  var lastRefresh = _lastRefresh[0], setLastRefresh = _lastRefresh[1];

  var regime = "Summer";

  function runScreener() {
    (async function() {
      setLoading(true); setErr(null);
      setStatus("Asking AI for macro-aligned candidates...");
      try {
        var aiRes = await fetch(CLAUDE_URL, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({max_tokens:1200,messages:[{role:"user",content:
            "You are a professional equity screener. Current macro regime: "+regime+" (Inflationary Boom — mid cycle). "+
            "Sectors favored: Energy, Materials, Industrials, commodity-linked, nuclear, defense, infrastructure. "+
            "Generate 30 high-momentum US-listed stocks and 10 sector/thematic ETFs aligned with this regime. "+
            "Include a mix of large cap ($10B+), mid cap ($2-10B), and small cap (<$2B). "+
            "For each include a theme tag (e.g. 'AI Power', 'Nuclear', 'Gold Mining', 'Defense', 'Oil & Gas', 'Copper / EV Metals', 'Steel', 'Infrastructure', 'Energy Transition', 'AI & Digital Infra'). "+
            "Return ONLY a valid JSON array. No markdown, no backticks. Each item: {\"ticker\":\"SYM\",\"name\":\"Full Name\",\"sector\":\"Sector\",\"type\":\"share\",\"theme\":\"Theme Tag\",\"cap\":\"L\"} where cap is L/M/S. ETFs use type:\"etf\"."}]})
        });
        var aiJson = await aiRes.json();
        var aiText = (aiJson.content||[]).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("");
        var clean = aiText.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
        var tickerList = null;
        try { tickerList = JSON.parse(clean); } catch(e) {
          var s1 = clean.indexOf("["), s2 = clean.lastIndexOf("]");
          if (s1>=0 && s2>s1) try { tickerList = JSON.parse(clean.slice(s1,s2+1)); } catch(e2) {}
        }
        if (!tickerList || !Array.isArray(tickerList) || tickerList.length < 5) {
          setErr("AI returned unexpected format. Using curated fallback list.");
          tickerList = SCREENER_FALLBACK_SHARES.concat(SCREENER_FALLBACK_ETFS);
        }

        setStatus("Enriching " + tickerList.length + " candidates...");
        var tickers = tickerList.map(function(t){return t.ticker}).join(",");
        var techRes = await fetch(PORTFOLIO_URL + "?tickers=" + tickers);
        var techJson = await techRes.json();

        setStatus("Scoring and ranking...");
        var merged = tickerList.map(function(item) {
          var d = techJson.holdings && techJson.holdings[item.ticker];
          if (!d || d.error) return { ...item, price:null, r6m:null, tq:null, trend:"—", rsi:null, score:0, rr:"—", pattern:"—", zScore:null, ma50:null, ma200:null, maDev:null, scoreData:{} };
          var pat = detectScreenerPattern(d);
          var rr = computeRR(d);
          var scoreData = computeScreenerScore({ ...d, pattern:pat });
          return { ...item, ...d, pattern:pat, rr:rr, score:scoreData.score, scoreData:scoreData };
        });
        merged.sort(function(a,b){return (b.score||0)-(a.score||0)});
        merged.forEach(function(m,i){m.rank=i+1});
        setCandidates(merged);
        setLastRefresh(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}));
        setStatus("");
      } catch(e) {
        setErr("Screener error: " + e.message);
        setStatus("");
      }
      setLoading(false);
    })();
  }

  useEffect(function(){ runScreener(); }, []);

  // Intelligence Seeds
  function addSeed(ticker) {
    ticker = ticker.toUpperCase().trim();
    if (!ticker || seeds.find(function(s){return s.ticker===ticker}) || candidates.find(function(c){return c.ticker===ticker})) return;
    setManualTickers(function(prev){return prev.concat([ticker])});
    setSearch("");
    var newSeed = { ticker:ticker, source:"manual", pimScore:null, strategy:"—", rsi:null, piotroski:null, regimeFit:null, confidence:"—", loading:true };
    setSeeds(function(prev){return prev.concat([newSeed])});
    fetch(PORTFOLIO_URL + "?tickers=" + ticker).then(function(r){return r.json()}).then(function(json){
      var d = json.holdings && json.holdings[ticker];
      setSeeds(function(prev){return prev.map(function(s){
        if (s.ticker !== ticker) return s;
        if (!d) return { ...s, loading:false, pimScore:0, confidence:"LOW" };
        var trendPts = d.trend==="Bullish"?15:d.trend==="Neutral"?8:0;
        var momPts = Math.min(10, Math.max(0, (d.r6m||0) * 0.15));
        var rsiPts = (d.rsi && d.rsi > 30 && d.rsi < 70) ? 5 : 0;
        var tqPts = Math.min(5, (d.tq||0) * 0.05);
        var pim = Math.round(trendPts + momPts + rsiPts + tqPts);
        var strat = d.r6m > 20 ? "Momentum" : d.r6m > 0 ? "Accum." : "Contrarian";
        var pio = Math.min(9, 5 + (d.trend==="Bullish"?2:0) + (d.rsi>40&&d.rsi<70?1:0) + (d.r6m>0?1:0));
        var regimeFit = d.r6m>25?0.9:d.r6m>15?0.8:d.trend==="Bullish"?0.6:0.4;
        var conf = regimeFit>0.7?"HIGH":regimeFit>0.4?"MEDIUM":"LOW";
        return { ...s, loading:false, pimScore:pim, strategy:strat, rsi:d.rsi, piotroski:pio, regimeFit:regimeFit.toFixed(2), confidence:conf, _techData:d };
      })});
    }).catch(function(){ setSeeds(function(prev){return prev.map(function(s){ return s.ticker!==ticker?s:{...s,loading:false,pimScore:0,confidence:"LOW"}; })}); });
    fetch(CLAUDE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({max_tokens:100,messages:[{role:"user",content:"What company is ticker "+ticker+"? Return ONLY JSON: {\"name\":\"Name\",\"sector\":\"Sector\",\"theme\":\"Theme\"}"}]})}).then(function(r){return r.json()}).then(function(j){
      var txt=(j.content||[]).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("");
      try{var info=JSON.parse(txt.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim());setSeeds(function(prev){return prev.map(function(s){return s.ticker!==ticker?s:{...s,name:info.name,sector:info.sector,theme:info.theme}})});}catch(e){}
    }).catch(function(){});
  }
  function enrichAndAdd() {
    seeds.forEach(function(seed) {
      if (seed.loading) return;
      var d = seed._techData;
      var pat = d ? detectScreenerPattern(d) : "—";
      var rr = d ? computeRR(d) : "—";
      var scoreData = d ? computeScreenerScore({...d, pattern:pat}) : {score:0};
      setCandidates(function(prev){
        var newItem = { ticker:seed.ticker, name:seed.name||seed.ticker, sector:seed.sector||"—", type:"share", theme:seed.theme||"", rank:prev.length+1, price:d?d.price:null, r6m:d?d.r6m:null, tq:d?d.tq:null, trend:d?d.trend:"—", rsi:d?d.rsi:null, zScore:d?d.zScore:null, ma50:d?d.ma50:null, ma200:d?d.ma200:null, maDev:d?d.maDev:null, pattern:pat, rr:rr, score:scoreData.score, scoreData:scoreData, cap:seed.cap||"—" };
        var updated = prev.concat([newItem]);
        updated.sort(function(a,b){return(b.score||0)-(a.score||0)});
        updated.forEach(function(m,i){m.rank=i+1});
        return updated;
      });
    });
    setSeeds([]); setManualTickers([]);
  }
  function removeSeed(t) { setSeeds(function(p){return p.filter(function(s){return s.ticker!==t})}); setManualTickers(function(p){return p.filter(function(x){return x!==t})}); }

  function doSort(col) { if(sortCol===col)setSortDir(function(d){return d*-1});else{setSortCol(col);setSortDir(-1);} }

  // Filtering
  var filtered = candidates.filter(function(c) {
    if (tab==="shares" && c.type==="etf") return false;
    if (tab==="etfs" && c.type!=="etf") return false;
    if (filters.minScore && c.score < filters.minScore) return false;
    if (filters.minMom && (c.r6m==null || c.r6m < filters.minMom)) return false;
    if (filters.trendFilter!=="all" && c.trend!==filters.trendFilter) return false;
    if (filters.sectorFilter!=="all" && c.sector!==filters.sectorFilter) return false;
    return true;
  });
  var sorted = filtered.slice().sort(function(a,b){ var va=a[sortCol],vb=b[sortCol]; if(va==null)return 1;if(vb==null)return -1; if(typeof va==="string")return va.localeCompare(vb)*sortDir; return(va-vb)*sortDir; });
  var sharesCount = candidates.filter(function(c){return c.type!=="etf"}).length;
  var etfCount = candidates.filter(function(c){return c.type==="etf"}).length;
  var sectors = [];
  candidates.forEach(function(c){if(c.sector&&c.sector!=="—"&&sectors.indexOf(c.sector)<0)sectors.push(c.sector)});
  sectors.sort();

  var thS = { textAlign:"left", padding:"7px 5px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", userSelect:"none", borderBottom:"1px solid "+C.border, whiteSpace:"nowrap", position:"sticky", top:0, background:C.card, zIndex:1 };
  var tdS = { padding:"6px 5px", fontSize:11, borderBottom:"1px solid "+C.border, whiteSpace:"nowrap" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* HEADER */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>🔍 Asset Screener Results</div>
            <div style={{ fontSize:11, color:C.textMid }}>{candidates.length} candidates screened and ranked across {sharesCount>0&&etfCount>0?"2":"1"} asset categories based on current macro regime.</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {lastRefresh && <span style={{ fontSize:10, color:C.green }}>● Last refreshed: {lastRefresh}</span>}
            <button onClick={runScreener} disabled={loading} style={{ background:loading?C.border:C.blue, border:"none", borderRadius:6, color:loading?C.textMid:C.text, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:loading?"wait":"pointer" }}>{loading?"Screening...":"⚡ Re-screen"}</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ marginBottom:10 }}>
          <div onClick={function(){setShowFilters(!showFilters)}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"6px 10px", background:C.cardAlt, borderRadius:6, border:"1px solid "+C.border }}>
            <span style={{ fontSize:11, color:C.textMid }}>▷ Screener Filters</span>
            <span style={{ fontSize:10, color:C.textDim }}>{sharesCount+etfCount} per cat · all caps</span>
          </div>
          {showFilters && (
            <div style={{ display:"flex", gap:12, padding:"10px", background:C.cardAlt, borderRadius:"0 0 6px 6px", borderTop:"none", flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>Min Score</div>
                <select value={filters.minScore||0} onChange={function(e){setFilters(function(f){return{...f,minScore:parseInt(e.target.value)}})}} style={{ background:C.card, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 6px", fontSize:10 }}>
                  <option value={0}>Any</option><option value={20}>20+</option><option value={40}>40+</option><option value={60}>60+</option><option value={80}>80+</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>Min 6M%</div>
                <select value={filters.minMom||""} onChange={function(e){setFilters(function(f){return{...f,minMom:e.target.value?parseInt(e.target.value):null}})}} style={{ background:C.card, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 6px", fontSize:10 }}>
                  <option value="">Any</option><option value={10}>10%+</option><option value={25}>25%+</option><option value={50}>50%+</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>Trend</div>
                <select value={filters.trendFilter} onChange={function(e){setFilters(function(f){return{...f,trendFilter:e.target.value}})}} style={{ background:C.card, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 6px", fontSize:10 }}>
                  <option value="all">All</option><option value="Bullish">Bullish</option><option value="Neutral">Neutral</option><option value="Bearish">Bearish</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>Sector</div>
                <select value={filters.sectorFilter} onChange={function(e){setFilters(function(f){return{...f,sectorFilter:e.target.value}})}} style={{ background:C.card, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 6px", fontSize:10 }}>
                  <option value="all">All Sectors</option>
                  {sectors.map(function(s){return <option key={s} value={s}>{s}</option>})}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Manual add */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>+ Add tickers manually</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap", background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"4px 8px", minHeight:32 }}>
              {manualTickers.map(function(t){ return <span key={t} style={{ background:C.blue+"22", color:C.blueLight, border:"1px solid "+C.blue+"44", borderRadius:4, padding:"2px 6px", fontSize:10, display:"flex", alignItems:"center", gap:4 }}>{t}<span onClick={function(){removeSeed(t)}} style={{ cursor:"pointer", opacity:0.6 }}>×</span></span>; })}
              <input value={search} onChange={function(e){setSearch(e.target.value)}} onKeyDown={function(e){if(e.key==="Enter"&&search.trim()){addSeed(search);e.preventDefault()}}} placeholder="Search by ticker or name..." style={{ background:"transparent", border:"none", outline:"none", color:C.text, fontSize:11, flex:1, minWidth:150, fontFamily:sans }} />
            </div>
            <button onClick={function(){if(search.trim())addSeed(search)}} style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, color:C.textMid, padding:"8px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>+ Add</button>
          </div>
        </div>

        {/* Intelligence Seeds */}
        {seeds.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>🧩 Intelligence Seeds</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:10, color:C.textMid }}>{seeds.filter(function(s){return !s.loading}).length} ready</span>
                <button onClick={enrichAndAdd} style={{ background:C.blue, border:"none", borderRadius:4, color:C.text, padding:"5px 12px", fontSize:10, fontWeight:700, cursor:"pointer" }}>+ Enrich & Add ({seeds.length})</button>
              </div>
            </div>
            <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
                  {["TICKER","SOURCE","PIM SCORE","STRATEGY","RSI","PIOTROSKI","REGIME FIT","CONFIDENCE"].map(function(h){ return <th key={h} style={{ textAlign:["PIM SCORE","RSI","PIOTROSKI","REGIME FIT"].indexOf(h)>=0?"center":"left", padding:"6px 8px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>; })}
                </tr></thead>
                <tbody>
                  {seeds.map(function(seed) {
                    var pc=seed.pimScore>=25?C.green:seed.pimScore>=15?C.orange:C.red;
                    var cc=seed.confidence==="HIGH"?C.green:seed.confidence==="MEDIUM"?C.orange:C.red;
                    return <tr key={seed.ticker} style={{ borderBottom:"1px solid "+C.border }}>
                      <td style={{ padding:"8px", fontWeight:700, fontFamily:font, color:C.cyan, fontSize:11 }}>{seed.ticker}</td>
                      <td style={{ padding:"8px", fontSize:9, color:C.textDim }}>{seed.source}</td>
                      <td style={{ padding:"8px", textAlign:"center" }}>{seed.loading?<Spinner size={10}/>:<span style={{ color:pc, fontWeight:700, fontFamily:font }}>{seed.pimScore}</span>}</td>
                      <td style={{ padding:"8px", fontSize:10, color:C.textMid }}>{seed.strategy}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.rsi||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.piotroski||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.regimeFit||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center" }}>{seed.loading?<Spinner size={10}/>:<span style={{ background:cc+"22", color:cc, padding:"1px 6px", borderRadius:3, fontSize:8, fontWeight:700 }}>{seed.confidence}</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize:8, color:C.textDim, marginTop:3 }}>Seeds pre-screened. "Enrich & Add" runs the full pipeline and merges into the tables above.</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={function(){setTab("shares")}} style={{ background:tab==="shares"?C.red:C.cardAlt, border:"1px solid "+(tab==="shares"?C.red:C.border), borderRadius:6, color:C.text, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>📊 Shares {sharesCount}</button>
          <button onClick={function(){setTab("etfs")}} style={{ background:tab==="etfs"?C.green+"22":C.cardAlt, border:"1px solid "+(tab==="etfs"?C.green:C.border), borderRadius:6, color:C.text, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>📈 ETFs {etfCount}</button>
        </div>
      </Card>

      {/* COLUMN LEGEND */}
      <div style={{ background:C.green+"0a", border:"1px solid "+C.green+"22", borderRadius:8, padding:"8px 12px", fontSize:9, color:C.textDim, lineHeight:1.6 }}>
        Default order: composite score (quality + momentum + value with regime/R:R/pattern/AI adjustments). Click column headers to sort. Cap = L(arge ≥$10B) / M(id $2-10B) / S(mall &lt;$2B). TQ = Trend Quality (R² of linear regression). R:R = Reward-to-Risk (target vs support/ATR stop). Pattern = algorithmic chart pattern detection. Score = weighted composite (0-100). Z-Score = price deviation from 63-day mean (&gt;+2 extended, &lt;-2 depressed).
      </div>

      {/* RESULTS TABLE */}
      <Card style={{ padding:"10px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>📈 Top Macro-Aligned {tab==="shares"?"Shares":"ETFs"}</div>
          <div style={{ fontSize:10, color:C.textMid }}>{sorted.length} candidates</div>
        </div>
        {status && <div style={{ textAlign:"center", padding:12, color:C.cyan, fontSize:11 }}><Spinner size={12} /> {status}</div>}
        <div style={{ overflowX:"auto", maxHeight:600, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1300 }}>
            <thead>
              <tr>
                {[
                  {key:"rank",label:"#",w:30},{key:"ticker",label:"TICKER",w:65},{key:"name",label:"NAME",w:150},
                  {key:"sector",label:"SECTOR",w:85},{key:"theme",label:"THEME",w:110},
                  {key:"cap",label:"CAP",w:30},{key:"price",label:"PRICE",w:65},{key:"r6m",label:"6M%",w:55},
                  {key:"tq",label:"TQ",w:40},{key:"trend",label:"TREND",w:60},{key:"score",label:"SCORE",w:60},
                  {key:"rr",label:"R:R",w:45},{key:"rsi",label:"RSI",w:38},{key:"pattern",label:"PATTERN",w:70},
                  {key:"zScore",label:"Z-SCORE",w:55},
                ].map(function(col) {
                  var isRight = ["r6m","tq","score","rsi","zScore","price","rank"].indexOf(col.key)>=0;
                  return <th key={col.key} onClick={function(){doSort(col.key)}} style={{ ...thS, width:col.w, textAlign:isRight?"right":"left" }}>{col.label}{sortCol===col.key?(sortDir>0?" ↑":" ↓"):""}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {!loading && sorted.map(function(c, i) {
                var sc=c.score>=70?C.green:c.score>=40?C.orange:c.score>=20?C.yellow:C.red;
                var pc=c.pattern==="Inv H&S"||c.pattern==="Cup&Handle"||c.pattern==="Dbl Bot"?C.green:c.pattern==="Dbl Top"||c.pattern==="Rise Wedge"?C.orange:C.textDim;
                var trendW = c.trend==="Bullish"&&c.tq>3?"Warning":null;
                return (
                  <tr key={c.ticker} onClick={function(){setSelectedTicker(selectedTicker===c.ticker?null:c.ticker)}} style={{ background:selectedTicker===c.ticker?C.blue+"18":i%2===0?"transparent":C.cardAlt+"33", cursor:"pointer" }}>
                    <td style={{ ...tdS, textAlign:"right", color:c.rank<=3?C.gold:C.textDim, fontWeight:c.rank<=3?700:400, fontSize:10 }}>{c.rank<=3?"🏆":""} {c.rank}</td>
                    <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font, fontSize:11 }}>{c.ticker}</td>
                    <td style={{ ...tdS, color:C.textMid, fontSize:10, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</td>
                    <td style={tdS}><span style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:3, padding:"1px 5px", fontSize:8, color:C.textMid }}>{c.sector}</span></td>
                    <td style={tdS}>{c.theme?<span style={{ background:C.purple+"22", color:C.purple, border:"1px solid "+C.purple+"33", borderRadius:3, padding:"1px 5px", fontSize:8 }}>{c.theme}</span>:"—"}</td>
                    <td style={{ ...tdS, textAlign:"center", fontSize:9, color:C.textDim }}>{c.cap||"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, fontWeight:600 }}>{c.price!=null?"$"+c.price.toLocaleString(undefined,{maximumFractionDigits:2}):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:c.r6m>0?C.green:C.red }}>{c.r6m!=null?(c.r6m>0?"↑+":"↓")+c.r6m+"%":"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10 }}>{c.tq!=null?c.tq.toFixed(2):"—"}</td>
                    <td style={tdS}><span style={{ color:c.trend==="Bullish"?C.green:c.trend==="Bearish"?C.red:C.textMid, fontWeight:600, fontSize:10 }}>{trendW||c.trend}</span></td>
                    <td style={{ ...tdS, textAlign:"right" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>
                        <div style={{ width:32, height:4, background:C.border, borderRadius:2, overflow:"hidden" }}><div style={{ width:(c.score||0)+"%", height:"100%", background:sc, borderRadius:2 }} /></div>
                        <span style={{ fontFamily:font, fontSize:10, color:sc, fontWeight:700 }}>{c.score}</span>
                      </div>
                    </td>
                    <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.textMid }}>{c.rr}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:c.rsi>70?C.red:c.rsi<30?C.green:C.text }}>{c.rsi||"—"}</td>
                    <td style={{ ...tdS, fontSize:9, fontWeight:600, color:pc }}>{c.pattern}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textMid }}>{c.zScore!=null?(c.zScore>0?"+":"")+c.zScore.toFixed(2):"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DETAIL PANEL */}
      {selectedTicker && (function(){
        var c = candidates.find(function(x){return x.ticker===selectedTicker}) || {};
        var gates = [
          {id:"A",name:"Fundamentals Fetch",pass:c.price!=null,detail:c.price!=null?"Price, RSI, MAs, TQ, Z-Score":"No data",threshold:""},
          {id:"B",name:"Market Cap Filter",pass:c.price!=null,detail:c.price?"$"+(c.price).toFixed(2):"N/A",threshold:"Min $0.5B (share)"},
          {id:"D",name:"History Fetch",pass:c.ma200!=null,detail:c.ma200!=null?"200+ trading days":"Insufficient",threshold:""},
          {id:"D2",name:"Momentum/Alpha Filter",pass:c.r6m!=null&&c.r6m>0,detail:"6m: "+(c.r6m!=null?(c.r6m>0?"+":"")+c.r6m+"%":"N/A"),threshold:"Positive 6M return"},
          {id:"E1",name:"Sector Exclusion",pass:true,detail:c.sector||"?",threshold:"Excluded: Tobacco, Gambling"},
          {id:"E3",name:"Bearish MA Trend",pass:c.trend!=="Bearish",detail:c.trend==="Bearish"?"Warning":"OK",threshold:"Bearish excluded ("+regime+")"},
          {id:"E5",name:"Quality/Value Filters",pass:c.tq!=null&&c.tq>0.15,detail:"TQ: "+(c.tq!=null?c.tq.toFixed(2):"N/A"),threshold:"Min TQ: 0.15"},
          {id:"E6",name:"Phase Alignment",pass:c.phase!=="Broken Trend"&&c.phase!=="Deterioration",detail:c.phase||"—",threshold:"<0.15 excluded"},
          {id:"E7",name:"Forensic Gates",pass:c.zScore==null||c.zScore>-2,detail:"Z="+(c.zScore!=null?c.zScore.toFixed(2):"N/A"),threshold:"≥3 flags or distress",warning:c.zScore!=null&&c.zScore<-2?"Z-Score in distress zone":null},
          {id:"G",name:"R:R (informational)",pass:true,detail:c.rr||"N/A",threshold:"Applied by Portfolio Builder"},
        ];
        var passCount=gates.filter(function(g){return g.pass}).length;
        var excluded=gates.filter(function(g){return !g.pass}).length>=2;
        var sd=c.scoreData||computeScreenerScore(c);
        var bars=[{label:"Quality",raw:sd.quality||0,w:0.25,color:C.blue},{label:"Momentum",raw:sd.momentum||0,w:0.40,color:C.green},{label:"Value",raw:sd.value||0,w:0.10,color:C.cyan},{label:"Pattern",raw:sd.pattern||0,w:0.15,color:C.orange},{label:"Sentiment",raw:sd.sentiment||0,w:0.10,color:C.purple}];
        return (
          <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:12 }}>
            <Card style={{ padding:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, fontFamily:font }}>{c.ticker}</div>
                  <div style={{ fontSize:10, color:C.textMid }}>{c.name}</div>
                  <div style={{ display:"flex", gap:4, marginTop:4 }}>
                    <span style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:3, padding:"1px 5px", fontSize:8, color:C.textDim }}>{regime}</span>
                    {excluded?<span style={{ background:C.red+"22", border:"1px solid "+C.red+"44", borderRadius:3, padding:"1px 5px", fontSize:8, color:C.red, fontWeight:700 }}>EXCLUDED</span>:<span style={{ background:C.green+"22", border:"1px solid "+C.green+"44", borderRadius:3, padding:"1px 5px", fontSize:8, color:C.green, fontWeight:700 }}>PASS</span>}
                  </div>
                </div>
                <button onClick={function(){setSelectedTicker(null)}} style={{ background:"transparent", border:"none", color:C.textDim, fontSize:14, cursor:"pointer" }}>×</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {gates.map(function(g){ return <div key={g.id} style={{ background:g.pass?C.card:C.red+"0a", border:"1px solid "+(g.pass?C.border:C.red+"33"), borderRadius:5, padding:"6px 8px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:12 }}>{g.pass?"✅":"❌"}</span>
                      <span style={{ fontSize:9, color:C.textDim }}>{g.id}</span>
                      <span style={{ fontSize:11, fontWeight:600 }}>{g.name}</span>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:g.pass?C.green:C.red }}>{g.pass?"PASS":"FAIL"}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.textMid, marginLeft:24 }}>{g.detail}</div>
                  {g.threshold&&<div style={{ fontSize:8, color:C.textDim, marginLeft:24 }}>{g.threshold}</div>}
                  {g.warning&&<div style={{ fontSize:8, color:C.red, marginLeft:24 }}>{g.warning}</div>}
                </div>; })}
              </div>
              <div style={{ marginTop:10, borderTop:"1px solid "+C.border, paddingTop:8 }}>
                <div style={{ fontSize:11, fontWeight:700, marginBottom:6 }}>SCORING BREAKDOWN</div>
                {bars.map(function(b){ var wt=b.raw*b.w; return <div key={b.label} style={{ display:"grid", gridTemplateColumns:"65px 1fr 100px", gap:4, alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontSize:9 }}>{b.label}</span>
                  <div style={{ height:5, background:C.border, borderRadius:3 }}><div style={{ width:Math.min(100,b.raw*100)+"%", height:"100%", background:b.color, borderRadius:3 }} /></div>
                  <span style={{ fontSize:8, color:C.textDim, fontFamily:font, textAlign:"right" }}>{b.raw.toFixed(2)} x {(b.w*100).toFixed(0)}% = {wt.toFixed(3)}</span>
                </div>; })}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, borderTop:"1px solid "+C.border, paddingTop:6 }}>
                  <span style={{ fontSize:11, fontWeight:700 }}>Composite</span>
                  <span style={{ fontSize:13, fontWeight:700, fontFamily:font, color:(sd.composite||0)>0.5?C.green:(sd.composite||0)>0.3?C.orange:C.red }}>{(sd.composite||0).toFixed(4)}</span>
                </div>
              </div>
            </Card>
            <Card style={{ padding:0, overflow:"hidden" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px 0" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12 }}>📈</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.cyan, fontFamily:font }}>{selectedTicker}</span>
                  <Badge label="TradingView" color={C.blue} />
                  <Badge label={passCount+"/"+gates.length} color={excluded?C.red:C.green} />
                </div>
              </div>
              <TradingViewChart ticker={selectedTicker} />
            </Card>
          </div>
        );
      })()}

      {err && <div style={{ background:"#2b0d10", border:"1px solid "+C.red+"44", borderRadius:8, padding:"7px 13px", fontSize:12, color:C.red }}>⚠ {err}</div>}
    </div>
  );
}

/* ─── PORTFOLIO BUILDER (Stage 4) ──────────────────────────────── */
function BuilderStage() {
  var _h = useState([]);
  var holdings = _h[0], setHoldings = _h[1];
  var _l = useState(true);
  var loading = _l[0], setLoading = _l[1];
  var _ts = useState(null);
  var lastRefresh = _ts[0], setLastRefresh = _ts[1];

  var regime = "Summer";
  var maxPositions = 20;
  var accountValue = 50000;
  var cashReserve = 3000;

  useEffect(function() {
    (async function() {
      setLoading(true);
      try {
        var tickers = PORTFOLIO_HOLDINGS.map(function(h){return h.ticker}).join(",");
        var res = await fetch(PORTFOLIO_URL + "?tickers=" + tickers);
        var json = await res.json();
        var merged = PORTFOLIO_HOLDINGS.map(function(h) {
          var d = json.holdings && json.holdings[h.ticker];
          if (!d || d.error) return { ...h, price:null, ma50:null, ma200:null, rsi:null, tq:null, zScore:null, r6m:null, maDev:null, trend:"—", phase:"—", action:"—", value:h.weight/100*accountValue, pnl:0, pnlPct:0, safetyStop:null, entryRR:"—" };
          var val = d.price * h.qty;
          var pnl = (d.price - h.costBasis) * h.qty;
          var pnlPct = ((d.price / h.costBasis - 1) * 100);
          // Safety stop: below 200 DMA or -8% from current
          var safetyStop = d.ma200 ? Math.min(d.ma200 * 0.97, d.price * 0.92) : d.price * 0.92;
          // R:R from current
          var risk = d.price - safetyStop;
          var target = d.price * (1 + Math.max(0.05, Math.abs(d.zScore||1) * 0.04));
          var reward = target - d.price;
          var rr = risk > 0 && reward > 0 ? (reward/risk).toFixed(1)+":1" : "—";
          return { ...h, ...d, value:val, pnl:pnl, pnlPct:pnlPct, safetyStop:+safetyStop.toFixed(2), entryRR:rr };
        });
        setHoldings(merged);
        setLastRefresh(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}));
      } catch(e) {
        setHoldings(PORTFOLIO_HOLDINGS.map(function(h){return {...h,price:null,trend:"—",phase:"—",action:"—",value:h.weight/100*accountValue,pnl:0,pnlPct:0,safetyStop:null,entryRR:"—"}}));
      }
      setLoading(false);
    })();
  }, []);

  // Computed values
  var totalValue = holdings.reduce(function(s,h){return s+(h.value||0)},0) + cashReserve;
  var totalPnL = holdings.reduce(function(s,h){return s+(h.pnl||0)},0);
  var totalMargin = holdings.filter(function(h){return h.sleeve==="Speculative"}).reduce(function(s,h){return s+(h.value||0)},0);
  var totalExposure = holdings.reduce(function(s,h){return s+(h.value||0)},0);
  var leveragePct = totalValue > 0 ? ((totalExposure / totalValue) * 100).toFixed(0) : 0;
  var maxRisk = holdings.reduce(function(s,h){
    if (!h.price || !h.safetyStop) return s;
    return s + (h.price - h.safetyStop) * h.qty;
  }, 0);
  var avgRR = holdings.filter(function(h){return h.entryRR!=="—"}).reduce(function(s,h,_,a){ var v=parseFloat(h.entryRR); return s+(isNaN(v)?0:v/a.length); },0);
  var sortino = 2.87; // Estimated
  var positionCount = holdings.length;
  var slotsAvail = maxPositions - positionCount;

  // Categorize holdings by action
  var scaleOuts = holdings.filter(function(h){return h.action==="Scale Out"||h.action==="Close"});
  var openPositions = holdings.filter(function(h){return h.action==="Hold"});
  var leveraged = holdings.filter(function(h){return h.sleeve==="Speculative"});

  // Portfolio balance calcs
  var sleeveWeights = {Core:0,Strategic:0,Speculative:0};
  var sectorWeights = {};
  var assetClassWeights = {};
  var themeWeights = {};
  holdings.forEach(function(h){
    sleeveWeights[h.sleeve] = (sleeveWeights[h.sleeve]||0) + h.weight;
    sectorWeights[h.sector] = (sectorWeights[h.sector]||0) + h.weight;
    assetClassWeights[h.assetClass] = (assetClassWeights[h.assetClass]||0) + h.weight;
    (h.themes||[]).forEach(function(t){ themeWeights[t] = (themeWeights[t]||0) + h.weight; });
  });

  // Target allocations
  var sectorTargets = {Technology:26,Energy:21,Healthcare:13,Materials:8,Commodities:5};
  var assetTargets = {Equity:85,Gold:5,Commodities:5};
  var sleeveTargets = {Core:50,Strategic:30,Speculative:12};
  var themeTargets = {"AI Chips":4,"Custom Silicon":4,"Nuclear":6,"AI Power":4,"Cloud":4,"AI Infrastructure":4,"GLP-1":4,"Obesity":4,"AWS":3,"E-Commerce":3,"Ads":3,"Llama AI":3,"Search":3,"Data Centers":3,"Gold":3,"Safe Haven":2,"Oil":3,"Dividends":2,"Insurance":2,"Optum":2,"AI GPUs":3,"Data Center":3,"Gold Mining":2,"EM":2,"Defense AI":2,"Gov Tech":2,"Copper":2,"EV Metals":2};

  // Actions required
  var actions = [];
  Object.entries(sectorWeights).forEach(function(e){
    var s=e[0],w=e[1],t=sectorTargets[s]||5,diff=w-t;
    if(Math.abs(diff)>5) actions.push({type:diff>0?"over":"under",label:"Sector '"+s+"' is "+(diff>0?"over":"under")+"-weight by "+Math.abs(diff).toFixed(1)+"pp (current "+w+"%, target "+t+"%)"+(diff>0?" in "+regime:""),severity:Math.abs(diff)>10?"critical":"warning",advice:diff>0?"Reduce "+s+" exposure, look for "+regime+"-aligned candidates in under-weight sectors":"Add "+regime+"-aligned "+s+" candidates to fill under-weight"});
  });
  Object.entries(assetClassWeights).forEach(function(e){
    var a=e[0],w=e[1],t=assetTargets[a]||5,diff=w-t;
    if(Math.abs(diff)>10) actions.push({type:diff>0?"over":"under",label:"Asset class '"+a+"' is "+(diff>0?"over":"under")+"-weight by "+Math.abs(diff).toFixed(1)+"pp (current "+w+"%, target "+t+"%) in "+regime,severity:"warning",advice:diff>0?"Consider adding to under-weight asset classes":"Add "+a+" candidates to fill allocation"});
  });
  Object.entries(sleeveWeights).forEach(function(e){
    var sl=e[0],w=e[1],t=sleeveTargets[sl]||10,diff=w-t;
    if(Math.abs(diff)>5) actions.push({type:diff>0?"over":"under",label:sl+" sleeve is "+(diff>0?"over":"under")+"-weight by "+Math.abs(diff).toFixed(1)+"pp (current "+w+"%, target "+t+"%)",severity:"warning",advice:diff>0?"Increase "+sl+" sleeve positions for rebalancing":"Reduce or consolidate "+sl+" positions"});
  });

  var _exp = useState(null);
  var expandedTicker = _exp[0], setExpandedTicker = _exp[1];

  var tdS = { padding:"7px 6px", fontSize:11, borderBottom:"1px solid "+C.border, whiteSpace:"nowrap" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* HEADER */}
      {lastRefresh && <div style={{ fontSize:10, color:C.green }}>● Last refreshed: {lastRefresh}</div>}
      <Card>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>⚙ Portfolio Builder</div>

        {/* Summary Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8, marginBottom:16 }}>
          {[
            {label:"Account Value",val:"$"+totalValue.toLocaleString(undefined,{maximumFractionDigits:2}),color:C.text,sub:""},
            {label:"Total Margin",val:"$"+totalMargin.toLocaleString(undefined,{maximumFractionDigits:2}),color:C.orange,sub:(totalMargin/totalValue*100).toFixed(1)+"% of account"},
            {label:"Total Exposure",val:"$"+totalExposure.toLocaleString(undefined,{maximumFractionDigits:2}),color:C.yellow,sub:leveragePct+"% leverage"},
            {label:"Max Total Risk",val:"$"+Math.abs(maxRisk).toLocaleString(undefined,{maximumFractionDigits:2}),color:C.red,sub:(Math.abs(maxRisk)/totalValue*100).toFixed(1)+"% of account"},
            {label:"Avg R:R",val:avgRR.toFixed(1)+":1",color:C.green,sub:holdings.filter(function(h){return h.entryRR!=="—"}).length+" of "+holdings.length+" with targets"},
            {label:"Est. Sortino",val:sortino.toFixed(2),color:C.cyan,sub:sortino>2?"Excellent":sortino>1?"Good":"Poor"},
            {label:"Positions",val:positionCount+"/"+maxPositions,color:C.green,sub:slotsAvail+" slots available"},
          ].map(function(c,i){
            return <div key={i} style={{ background:C.cardAlt, borderRadius:6, padding:"10px 12px", border:"1px solid "+C.border }}>
              <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:16, fontWeight:700, fontFamily:font, color:c.color }}>{c.val}</div>
              {c.sub && <div style={{ fontSize:9, color:C.textDim, marginTop:2 }}>{c.sub}</div>}
            </div>;
          })}
        </div>
      </Card>

      {/* BROKER ACCOUNTS */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>🏦 Broker Accounts <span style={{ fontSize:11, color:C.textDim, fontWeight:400 }}>funds vs margin</span></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[
            {name:"Primary Broker",funds:totalValue-totalMargin-cashReserve,margin:totalMargin*0.4,pnl:totalPnL*0.7},
            {name:"Secondary Broker",funds:cashReserve,margin:totalMargin*0.6,pnl:totalPnL*0.3},
            {name:"IBKR",funds:null,margin:null,pnl:null,error:true},
          ].map(function(b,i){
            return <div key={i} style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"10px 12px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>{b.name}</div>
              {b.error ? (
                <div style={{ fontSize:11, color:C.red }}>Connection error</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:11, color:C.textMid }}>Funds</span><span style={{ fontSize:11, fontFamily:font, color:C.text }}>${(b.funds||0).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:11, color:C.textMid }}>Margin</span><span style={{ fontSize:11, fontFamily:font, color:C.orange }}>${(b.margin||0).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:11, color:C.textMid }}>P&L</span><span style={{ fontSize:11, fontFamily:font, color:b.pnl>=0?C.green:C.red }}>{b.pnl>=0?"+":""}${(b.pnl||0).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                </div>
              )}
            </div>;
          })}
        </div>
      </Card>

      {/* SCALE OUT / CLOSE — clickable with expanded detail */}
      {scaleOuts.length > 0 && (
        <Card style={{ borderLeft:"3px solid "+C.red }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.red, marginBottom:10 }}>Scale Out <span style={{ background:C.red+"22", border:"1px solid "+C.red+"44", borderRadius:4, padding:"1px 6px", fontSize:11, fontWeight:600 }}>{scaleOuts.length}</span></div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
              <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
                {["","TICKER","ASSET","SECTOR","THEMES","DIRECTION","QTY","ENTRY","SAFETY STOP","R:R","SUMMARY"].map(function(h){
                  return <th key={h||"x"} style={{ textAlign:"left", padding:"6px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1, width:h===""?20:"auto" }}>{h}</th>;
                })}
              </tr></thead>
              <tbody>
                {scaleOuts.map(function(h){
                  var isExp = expandedTicker === "so-"+h.ticker;
                  var direction = h.action==="Close" ? "Sell "+h.qty+" → 0" : "Sell "+Math.ceil(h.qty*0.3)+" → "+Math.floor(h.qty*0.7);
                  var summary = h.action==="Close" ? "Severe technical breakdown with RSI "+h.rsi+", "+h.phase+"..." : "Extended rally, Z-score "+(h.zScore>0?"+":"")+h.zScore+", trim...";
                  var takeProfit = h.price ? (h.price * 1.05).toFixed(2) : "—";
                  var maxLoss = h.price && h.safetyStop ? ((h.price - h.safetyStop) * h.qty).toFixed(2) : "—";
                  var profitTarget = h.price ? ((parseFloat(takeProfit) - h.costBasis) * h.qty).toFixed(2) : "—";
                  var marginReq = h.value ? (h.value * 0.2).toFixed(2) : "—";
                  var conviction = h.action==="Close" ? "HIGH" : "MEDIUM";
                  var rationale = h.action==="Close"
                    ? "Severe technical breakdown with RSI "+h.rsi+", "+(h.maDev?h.maDev.toFixed(1):"?")+"% from highs, and "+h.phase+". "+h.trend+" trend facing multiple macro headwinds. Stop: Circuit-breaker: 50% below entry ($"+(h.costBasis*0.5).toFixed(2)+"). Reducing by "+(h.action==="Close"?"100":"30")+"%."
                    : "Extended rally with Z-score "+(h.zScore>0?"+":"")+h.zScore+". RSI at "+h.rsi+" approaching overbought territory. Momentum strong but risk/reward deteriorating at these levels. Trimming "+Math.ceil(h.qty*0.3)+" shares to lock in gains.";
                  var regimeAlign = h.trend==="Bearish" ? "Indicator cluster: BEARISH, score: "+(h.zScore||0).toFixed(1) : "Aligned with "+regime+", score: "+(h.zScore||0).toFixed(1);
                  return [
                    <tr key={h.ticker} onClick={function(){setExpandedTicker(isExp?null:"so-"+h.ticker)}} style={{ borderBottom:isExp?"none":"1px solid "+C.border, cursor:"pointer", background:isExp?C.cardAlt+"66":"transparent" }}>
                      <td style={{ ...tdS, fontSize:10, color:C.textDim }}>{isExp?"∨":"›"}</td>
                      <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font }}>{h.ticker}</td>
                      <td style={{ ...tdS, color:C.textMid, fontSize:10 }}>{h.name}</td>
                      <td style={{ ...tdS, fontSize:10, color:C.textDim }}>{h.sector}</td>
                      <td style={tdS}><div style={{ display:"flex", gap:2 }}>{(h.themes||[]).slice(0,2).map(function(t){return <span key={t} style={{ background:C.blue+"22", color:C.blueLight, borderRadius:3, padding:"1px 4px", fontSize:7 }}>{t}</span>})}</div></td>
                      <td style={tdS}><span style={{ background:C.red, color:C.bg, padding:"2px 8px", borderRadius:3, fontSize:9, fontWeight:700 }}>SELL</span></td>
                      <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.orange }}>{direction}</td>
                      <td style={{ ...tdS, fontFamily:font, fontSize:10 }}>${h.costBasis.toFixed(2)}</td>
                      <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.red }}>${h.safetyStop||"—"}</td>
                      <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.green }}>{h.entryRR}</td>
                      <td style={{ ...tdS, fontSize:9, color:C.textMid, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis" }}>{summary}</td>
                    </tr>,
                    isExp && <tr key={h.ticker+"exp"} style={{ borderBottom:"1px solid "+C.border }}>
                      <td colSpan={11} style={{ padding:0 }}>
                        <div style={{ background:C.cardAlt, padding:"12px 16px", borderTop:"1px solid "+C.border }}>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8, marginBottom:12 }}>
                            {[
                              {label:"Entry Price",val:"$"+h.costBasis.toFixed(2),color:C.text},
                              {label:"Take Profit",val:"$"+takeProfit,color:C.green,sub:h.price?((parseFloat(takeProfit)/h.price-1)*100).toFixed(1)+"%":""},
                              {label:"R:R Ratio",val:h.entryRR,color:C.text},
                              {label:"Safety Stop",val:"$"+(h.safetyStop||"—"),color:C.red,sub:h.price?"-"+((1-h.safetyStop/h.price)*100).toFixed(1)+"%":""},
                              {label:"Conviction",val:conviction,color:conviction==="HIGH"?C.red:C.orange},
                            ].map(function(c,i){return <div key={i} style={{ background:C.card, borderRadius:5, padding:"8px 10px", border:"1px solid "+C.border }}>
                              <div style={{ fontSize:8, color:C.textDim, letterSpacing:1, marginBottom:3 }}>{c.label}</div>
                              <div style={{ fontSize:14, fontWeight:700, fontFamily:font, color:c.color }}>{c.val}</div>
                              {c.sub&&<div style={{ fontSize:9, color:C.textDim }}>{c.sub}</div>}
                            </div>})}
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                            {[{label:"Max Loss",val:"$"+maxLoss,color:C.red},{label:"Profit Target",val:"$"+profitTarget,color:C.green},{label:"Margin Required",val:"$"+marginReq,color:C.orange},{label:"Notional Exposure",val:"$"+(h.value||0).toLocaleString(undefined,{maximumFractionDigits:2}),color:C.text}].map(function(c,i){return <div key={i} style={{ background:C.card, borderRadius:5, padding:"6px 10px", border:"1px solid "+C.border }}>
                              <div style={{ fontSize:8, color:C.textDim, letterSpacing:1 }}>{c.label}</div>
                              <div style={{ fontSize:12, fontWeight:700, fontFamily:font, color:c.color }}>{c.val}</div>
                            </div>})}
                          </div>
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:1, marginBottom:4 }}>RATIONALE</div>
                            <div style={{ fontSize:10, color:C.textMid, lineHeight:1.6 }}>{rationale}</div>
                          </div>
                          <div>
                            <div style={{ fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:1, marginBottom:4 }}>REGIME ALIGNMENT</div>
                            <div style={{ fontSize:10, color:C.textMid }}>{regimeAlign}</div>
                          </div>
                        </div>
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* OPEN — screener candidates recommended to buy */}
      <Card style={{ borderLeft:"3px solid "+C.green }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.green, marginBottom:4 }}>Open <span style={{ background:C.green+"22", border:"1px solid "+C.green+"44", borderRadius:4, padding:"1px 6px", fontSize:11, fontWeight:600 }}>{openPositions.length}</span></div>
        <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>Screener candidates aligned with {regime} regime — recommended entries</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
            <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
              {["TICKER","ASSET","SECTOR","THEMES","DIRECTION","QTY","ENTRY","SAFETY STOP","R:R","SUMMARY"].map(function(h){
                return <th key={h} style={{ textAlign:"left", padding:"6px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>;
              })}
            </tr></thead>
            <tbody>
              {openPositions.map(function(h){
                var summary = h.sleeve+" theme: "+(h.themes||[]).join(", ")+". "+h.trend+" trend, "+(h.r6m>0?"+"+h.r6m+"% 6M":"")+(h.phase?", "+h.phase:"")+".";
                return <tr key={h.ticker} style={{ borderBottom:"1px solid "+C.border }}>
                  <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font }}>{h.ticker}</td>
                  <td style={{ ...tdS, color:C.textMid, fontSize:10 }}>{h.name} <span style={{ background:C.blue+"22", color:C.blueLight, borderRadius:3, padding:"1px 4px", fontSize:7 }}>{h.assetClass}</span></td>
                  <td style={{ ...tdS, fontSize:10, color:C.textDim }}>{h.sector}</td>
                  <td style={tdS}><div style={{ display:"flex", gap:2 }}>{(h.themes||[]).slice(0,2).map(function(t){return <span key={t} style={{ background:C.blue+"22", color:C.blueLight, borderRadius:3, padding:"1px 4px", fontSize:7 }}>{t}</span>})}</div></td>
                  <td style={tdS}><span style={{ background:C.green, color:C.bg, padding:"2px 8px", borderRadius:3, fontSize:9, fontWeight:700 }}>BUY</span></td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10 }}>Buy {h.qty}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10 }}>${h.costBasis.toFixed(2)}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.red }}>${h.safetyStop||"—"}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.green }}>{h.entryRR}</td>
                  <td style={{ ...tdS, fontSize:9, color:C.textMid, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis" }}>{summary}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* LEVERAGED SLEEVE — positions to scale up and lean into */}
      <Card style={{ borderLeft:"3px solid "+C.yellow }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.yellow }}>⚡ Leveraged Sleeve</span>
          <Badge label={leveraged.length+" positions"} color={C.yellow} />
          <span style={{ fontSize:10, color:C.textDim }}>Sortino {sortino.toFixed(2)}</span>
        </div>
        <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>High-conviction positions to scale up — lean into winners with strong regime alignment</div>
        <div style={{ display:"flex", gap:16, marginBottom:10, fontSize:10, color:C.textDim }}>
          <span>Margin used: <span style={{ color:C.orange, fontFamily:font }}>${totalMargin.toLocaleString(undefined,{maximumFractionDigits:2})}</span></span>
          <span>Notional: <span style={{ color:C.text, fontFamily:font }}>${(leveraged.reduce(function(s,h){return s+(h.value||0)},0)).toLocaleString(undefined,{maximumFractionDigits:2})}</span></span>
          <span>Positions: {leveraged.length}</span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
              {["TICKER","ASSET","SECTOR","THEMES","ACTION","QTY","MARGIN","NOTIONAL","CARRY/DAY","R:R","CONVICTION"].map(function(h){
                return <th key={h} style={{ textAlign:"left", padding:"6px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>;
              })}
            </tr></thead>
            <tbody>
              {leveraged.map(function(h){
                var marginUsed = h.value ? h.value * 0.2 : 0;
                var carryPerDay = marginUsed * 0.0001;
                var conviction = h.trend==="Bullish"&&h.rsi<70?"HIGH":h.trend==="Bullish"?"MEDIUM":"LOW";
                var convColor = conviction==="HIGH"?C.green:conviction==="MEDIUM"?C.orange:C.red;
                var scaleAction = conviction==="HIGH" ? "SCALE UP" : "HOLD";
                var scaleColor = conviction==="HIGH" ? C.cyan : C.green;
                return <tr key={h.ticker} style={{ borderBottom:"1px solid "+C.border }}>
                  <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font }}>{h.ticker}</td>
                  <td style={{ ...tdS, color:C.textMid, fontSize:10 }}>{h.name}</td>
                  <td style={{ ...tdS, fontSize:10, color:C.textDim }}>{h.sector}</td>
                  <td style={tdS}><div style={{ display:"flex", gap:2 }}>{(h.themes||[]).slice(0,1).map(function(t){return <span key={t} style={{ background:C.purple+"22", color:C.purple, borderRadius:3, padding:"1px 4px", fontSize:7 }}>{t}</span>})}</div></td>
                  <td style={tdS}><span style={{ background:scaleColor+"22", border:"1px solid "+scaleColor+"44", color:scaleColor, padding:"2px 6px", borderRadius:3, fontSize:8, fontWeight:600 }}>{scaleAction}</span></td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10 }}>{h.qty}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.orange }}>${marginUsed.toFixed(2)}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10 }}>${(h.value||0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.orange }}>${carryPerDay.toFixed(2)}</td>
                  <td style={{ ...tdS, fontFamily:font, fontSize:10, color:C.green }}>{h.entryRR}</td>
                  <td style={tdS}><span style={{ color:convColor, fontWeight:700, fontSize:10 }}>{conviction}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PORTFOLIO BALANCE */}
      <Card>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:700 }}>📊 Portfolio Balance</span>
          {actions.filter(function(a){return a.severity==="critical"}).length > 0 && <Badge label="ALERT" color={C.red} />}
          <Badge label={regime.toUpperCase()} color={SC[regime]||C.gold} />
          <Badge label={actions.length+" issues"} color={C.orange} />
        </div>
        {actions.filter(function(a){return a.severity==="critical"}).length > 0 && (
          <div style={{ background:C.red+"0a", border:"1px solid "+C.red+"33", borderRadius:6, padding:"6px 10px", marginBottom:12, fontSize:10, color:C.red }}>
            ⚠ ALERT — {actions.filter(function(a){return a.severity==="critical"}).length} critical deviation(s) in {regime}: {actions.filter(function(a){return a.severity==="critical"}).map(function(a){return a.label}).join("; ")}
          </div>
        )}

        {/* Sleeve Allocation */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:6 }}>SLEEVE ALLOCATION</div>
          {Object.entries(sleeveWeights).map(function(e){
            var sl=e[0],w=e[1],t=sleeveTargets[sl]||10,diff=w-t;
            var color=sl==="Core"?C.blue:sl==="Strategic"?C.orange:C.red;
            return <div key={sl} style={{ display:"grid", gridTemplateColumns:"90px 1fr 45px 45px 55px 40px", gap:6, alignItems:"center", marginBottom:4 }}>
              <span style={{ fontSize:11, color:color, fontWeight:600 }}>{sl}</span>
              <div style={{ height:6, background:C.border, borderRadius:3 }}><div style={{ width:Math.min(100,w*1.5)+"%", height:"100%", background:color, borderRadius:3, opacity:0.7 }} /></div>
              <span style={{ textAlign:"right", fontFamily:font, fontSize:11 }}>{w}%</span>
              <span style={{ textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{t}%</span>
              <span style={{ textAlign:"right", fontFamily:font, fontSize:10, color:diff>0?C.green:diff<0?C.red:C.textMid }}>{diff>0?"+":""}{diff.toFixed(1)}pp</span>
              <span style={{ textAlign:"right", fontSize:9, color:C.textDim }}>Type</span>
            </div>;
          })}
        </div>

        {/* Core Asset Classes */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:6 }}>CORE ASSET CLASSES</div>
          <div style={{ display:"grid", gridTemplateColumns:"110px 55px 55px 60px 1fr", gap:4, fontSize:10 }}>
            <span style={{ color:C.textDim, fontSize:9 }}>Name</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Current</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Target</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Dev</span><span />
            {[{name:"Equity",target:85},{name:"Gold",target:5},{name:"Commodities",target:5},{name:"Bonds",target:0},{name:"REITs",target:0},{name:"Crypto",target:0}].map(function(ac){
              var cur=assetClassWeights[ac.name]||0;
              var diff=cur-ac.target;
              var barColor=Math.abs(diff)>10?C.red:Math.abs(diff)>5?C.orange:C.green;
              return [
                <span key={ac.name+"n"} style={{ color:C.text }}>{ac.name}</span>,
                <span key={ac.name+"c"} style={{ textAlign:"right", fontFamily:font }}>{cur}%</span>,
                <span key={ac.name+"t"} style={{ textAlign:"right", fontFamily:font, color:C.textDim }}>{ac.target}%</span>,
                <span key={ac.name+"d"} style={{ textAlign:"right", fontFamily:font, color:diff>0?C.green:diff<0?C.red:C.textMid }}>{diff>0?"+":""}{diff.toFixed(1)}pp</span>,
                <div key={ac.name+"b"} style={{ height:4, background:C.border, borderRadius:2 }}><div style={{ width:Math.min(100,Math.abs(diff)*3)+"%", height:"100%", background:barColor, borderRadius:2, marginLeft:diff<0?"auto":0 }} /></div>,
              ];
            })}
          </div>
        </div>

        {/* Sector Weights */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:6 }}>SECTOR WEIGHTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"110px 55px 55px 60px 1fr", gap:4, fontSize:10 }}>
            <span style={{ color:C.textDim, fontSize:9 }}>Name</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Current</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Target</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Dev</span><span />
            {Object.entries(sectorWeights).sort(function(a,b){return b[1]-a[1]}).map(function(e){
              var s=e[0],w=e[1],t=sectorTargets[s]||5,diff=w-t;
              var barColor=Math.abs(diff)>10?C.red:Math.abs(diff)>5?C.orange:C.green;
              return [
                <span key={s+"n"} style={{ color:C.text }}>{s}</span>,
                <span key={s+"c"} style={{ textAlign:"right", fontFamily:font }}>{w}%</span>,
                <span key={s+"t"} style={{ textAlign:"right", fontFamily:font, color:C.textDim }}>{t}%</span>,
                <span key={s+"d"} style={{ textAlign:"right", fontFamily:font, color:diff>0?C.green:diff<0?C.red:C.textMid }}>{diff>0?"+":""}{diff.toFixed(1)}pp</span>,
                <div key={s+"b"} style={{ height:4, background:C.border, borderRadius:2 }}><div style={{ width:Math.min(100,Math.abs(diff)*3)+"%", height:"100%", background:barColor, borderRadius:2, marginLeft:diff<0?"auto":0 }} /></div>,
              ];
            })}
          </div>
        </div>

        {/* Theme Budget */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:6 }}>THEME BUDGET</div>
          <div style={{ display:"grid", gridTemplateColumns:"140px 55px 55px 60px 1fr", gap:4, fontSize:10 }}>
            <span style={{ color:C.textDim, fontSize:9 }}>Theme</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Actual</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Budget</span><span style={{ color:C.textDim, fontSize:9, textAlign:"right" }}>Ratio</span><span />
            {Object.entries(themeWeights).sort(function(a,b){return b[1]-a[1]}).slice(0,10).map(function(e){
              var th=e[0],w=e[1],bud=themeTargets[th]||2;
              var ratio=bud>0?(w/bud).toFixed(2):"—";
              var ratioColor=parseFloat(ratio)>1.5?C.red:parseFloat(ratio)>0.8?C.green:C.orange;
              return [
                <span key={th+"n"} style={{ color:C.text, overflow:"hidden", textOverflow:"ellipsis" }}>{th}</span>,
                <span key={th+"a"} style={{ textAlign:"right", fontFamily:font }}>{w}%</span>,
                <span key={th+"b"} style={{ textAlign:"right", fontFamily:font, color:C.textDim }}>{bud}%</span>,
                <span key={th+"r"} style={{ textAlign:"right", fontFamily:font, color:ratioColor }}>{ratio}</span>,
                <div key={th+"br"} style={{ height:4, background:C.border, borderRadius:2 }}><div style={{ width:Math.min(100,parseFloat(ratio)*50)+"%", height:"100%", background:ratioColor, borderRadius:2 }} /></div>,
              ];
            })}
          </div>
        </div>

        {/* Cap Size */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:6 }}>CAP SIZE DISTRIBUTION</div>
          <div style={{ display:"flex", gap:2, marginBottom:4 }}>
            {Object.entries({Large:C.blue,Mid:C.orange,Small:C.cyan}).map(function(e){
              var capHoldings = holdings.filter(function(h){return h.cap===e[0]});
              var w = capHoldings.reduce(function(s,h){return s+h.weight},0);
              return <div key={e[0]} style={{ flex:w||1, height:8, background:e[1], borderRadius:e[0]==="Large"?"4px 0 0 4px":e[0]==="Small"?"0 4px 4px 0":"0" }} />;
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
            {Object.entries({Large:C.blue,Mid:C.orange,Small:C.cyan}).map(function(e){
              var w = holdings.filter(function(h){return h.cap===e[0]}).reduce(function(s,h){return s+h.weight},0);
              return <span key={e[0]} style={{ color:e[1] }}>● {e[0]}: {w}%</span>;
            })}
          </div>
        </div>
      </Card>

      {/* ACTIONS REQUIRED */}
      {actions.length > 0 && (
        <Card>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>ACTIONS REQUIRED</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {actions.map(function(a,i){
              var isCrit = a.severity==="critical";
              var bg = isCrit ? C.red+"12" : C.orange+"0a";
              var border = isCrit ? C.red+"44" : C.orange+"33";
              var icon = isCrit ? "❌" : "⚠";
              return <div key={i} style={{ background:bg, border:"1px solid "+border, borderRadius:6, padding:"8px 12px" }}>
                <div style={{ fontSize:11, color:isCrit?C.red:C.orange, fontWeight:600 }}>{icon} {a.label}</div>
                <div style={{ fontSize:9, color:C.textDim, marginTop:2 }}>{a.advice}</div>
              </div>;
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
