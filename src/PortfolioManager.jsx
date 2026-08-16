import { useState, useCallback, useEffect } from "react";

/* ─── CHANGE THIS to your Vercel deployment URL ─────────────────── */
var PROXY_URL = "https://portfolio-proxy-ja56.vercel.app/api/market";
var FRED_URL = "https://portfolio-proxy-ja56.vercel.app/api/fred";
var FG_URL = "https://portfolio-proxy-ja56.vercel.app/api/feargreed";
var OHLC_URL = "https://portfolio-proxy-ja56.vercel.app/api/ohlc";
var LIQ_URL = "https://portfolio-proxy-ja56.vercel.app/api/liquidity-history";
var SECTORS_LIVE_URL = "https://portfolio-proxy-ja56.vercel.app/api/sectors-live";
var PORTFOLIO_URL = "https://portfolio-proxy-ja56.vercel.app/api/portfolio";
var SEC_FINANCIALS_URL = "https://portfolio-proxy-ja56.vercel.app/api/sec-financials";
var EARNINGS_URL = "https://portfolio-proxy-ja56.vercel.app/api/earnings";
var MACRO_CALENDAR_URL = "https://portfolio-proxy-ja56.vercel.app/api/macro-calendar";
var MACRO_EVENT_URL = "https://portfolio-proxy-ja56.vercel.app/api/macro-event";

/* ──────────────────────────────────────────────────────────────────── */

const C = {
  bg:"#08090f",panel:"#0d0e1a",card:"#111220",cardAlt:"#13141f",
  border:"#1c1e30",green:"#00e676",red:"#ff4757",orange:"#ff9f43",
  yellow:"#ffd32a",blue:"#5352ed",blueLight:"#70a1ff",purple:"#7c83fd",
  cyan:"#18dcff",text:"#e8eaf0",textMid:"#a0a8c0",textDim:"#5a6080",gold:"#ffa502",
};
const font = "'DM Mono','Fira Code',monospace";
const sans = "'DM Sans','Segoe UI',system-ui,sans-serif";

// Prevent a slow or stalled proxy route from freezing the entire dashboard.
// Optional feeds are allowed to fail independently so the remaining panels
// can still load and the refresh controls always become usable again.
function fetchWithTimeout(url, options, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs || 12000);
  var requestOptions = { ...(options || {}), signal:controller.signal };
  return fetch(url, requestOptions).finally(function() { clearTimeout(timer); });
}

const REGIME_QUADRANTS = {
  Spring: {
    phase: "Disinflationary Growth", cycle: "Growth ↑ / Inflation Momentum ↓",
    description: "Rules-based quadrant: real growth is rising while year-over-year CPI momentum is falling. This is a descriptive classification of the connected inputs, not a formal business-cycle date or a forecast of asset returns.",
    keyTheme: "Growth rising · Inflation momentum falling · Heuristic model tilt",
    growth: "Rising", inflation: "Falling", bias: "RISK ON",
    overweight: ["Technology","Consumer Cyclical","Financials","Small Cap"],
    underweight: ["Utilities","Consumer Staples","Cash"],
  },
  Summer: {
    phase: "Inflationary Growth", cycle: "Growth ↑ / Inflation Momentum ↑",
    description: "Rules-based quadrant: real growth is rising while year-over-year CPI momentum is also rising. The label summarizes the connected macro inputs and should not be read as an official cycle designation.",
    keyTheme: "Growth rising · Inflation momentum rising · Heuristic model tilt",
    growth: "Rising", inflation: "Rising", bias: "RISK ON",
    overweight: ["Energy","Materials","Industrials","Real Assets","Commodities"],
    underweight: ["Long Duration Bonds","Utilities"],
  },
  Autumn: {
    phase: "Inflationary Slowdown", cycle: "Growth ↓ / Inflation Momentum ↑",
    description: "Rules-based quadrant: real growth momentum is slowing while year-over-year CPI momentum is rising. It is a compact signal framework, not a recession call or an investment recommendation.",
    keyTheme: "Growth slowing · Inflation momentum rising · Heuristic defensive tilt",
    growth: "Slowing", inflation: "Rising", bias: "DEFENSIVE",
    overweight: ["Utilities","Healthcare","Consumer Staples","Gold","Cash"],
    underweight: ["Technology","Consumer Cyclical","High Beta","Crypto"],
  },
  Winter: {
    phase: "Disinflationary Slowdown", cycle: "Growth ↓ / Inflation Momentum ↓",
    description: "Rules-based quadrant: real growth momentum is slowing while year-over-year CPI momentum is falling. The classification is descriptive and does not by itself establish that the economy is in recession.",
    keyTheme: "Growth slowing · Inflation momentum falling · Heuristic defensive tilt",
    growth: "Slowing", inflation: "Falling", bias: "RISK OFF",
    overweight: ["Long Duration Bonds","Gold","Cash","Utilities"],
    underweight: ["Equities","High Yield","Crypto","Cyclicals"],
  },
  Unclassified: {
    phase: "Insufficient Inputs", cycle: "Awaiting comparable growth + inflation data",
    description: "The dashboard does not assign a macro quadrant unless comparable real-growth and year-over-year inflation-momentum inputs are available.",
    keyTheme: "Insufficient inputs · No quadrant tilt",
    growth: "—", inflation: "—", bias: "NO TILT",
    overweight: [], underweight: [],
  },
};

const SC = { Summer:C.gold, Spring:C.green, Autumn:C.orange, Winter:C.blueLight, Unclassified:C.textDim };

const SECTOR_PAIRS = [
  { name:"Cyclical vs Defensive",    e1:"XLY",  e2:"XLP",  sub1:"Consumer Discretionary (XLY)", sub2:"Consumer Staples (XLP)" },
  { name:"Small Cap vs Large Cap",   e1:"IWM",  e2:"SPY",  sub1:"Small Cap (IWM)",               sub2:"Large Cap (SPY)" },
  { name:"Growth vs Value",          e1:"VUG",  e2:"VTV",  sub1:"Growth (VUG)",                  sub2:"Value (VTV)" },
  { name:"Financials vs Utilities",  e1:"XLF",  e2:"XLU",  sub1:"Financials (XLF)",              sub2:"Utilities (XLU)" },
  { name:"High Beta vs Low Vol",     e1:"SPHB", e2:"SPLV", sub1:"High Beta (SPHB)",              sub2:"Low Volatility (SPLV)" },
  { name:"US vs Emerging Markets",   e1:"SPY",  e2:"EEM",  sub1:"Large Cap (SPY)",               sub2:"Emerging Markets (EEM)" },
];

const SEED = {
  // Neutral startup state. The app auto-refreshes on mount; if a connected
  // endpoint fails, the UI stays blank/unavailable instead of displaying stale
  // market observations as though they were current.
  macroRegime:{ season:"Unclassified", phase:"Awaiting connected macro data", riskOn:null, confirmed:false, confidence:0, mediumTerm:"Unclassified", shortTerm:"Refresh connected feeds", description:"Waiting for connected market and FRED data." },
  sp500:{ price:"—", change:"—", sentiment:"—", dma50:null, dma200:null, wkSupport:null, wkResistance:null, moSupport:null, moResistance:null },
  nasdaq:{ price:"—", change:"—", sentiment:"—", dma50:null, dma200:null, wkSupport:null, wkResistance:null, moSupport:null, moResistance:null },
  bitcoin:{ price:"—", change:"—", sentiment:"—", dma50:null, dma200:null, wkSupport:null, wkResistance:null, moSupport:null, moResistance:null },
  vix:{ price:"—", change:"—", changePct:"—", level:"—", note:"Awaiting live volatility feed" },
  dxy:{ price:"—", change:"—", strength:"—", note:"Awaiting connected dollar feed", position:null, sparkline:[] },
  yield:{ spread:"—", status:"—", recessionRisk:"Awaiting live curve", recessionPct:null },
  fg:{ score:null, label:"—", vsPrev:null, cryptoScore:null, cryptoLabel:"—" },
  rates:{ status:"Unknown", current:"—", expected:null, impliedCuts:null },
  inflation:{ cpi:"—", trend:"Awaiting data", breakeven:null, note:"Refresh to load CPI and market inflation expectations." },
  liquidity:{ total:"—", score:null, roc13w:null, roc52w:null, trend:"Balance-sheet proxy" },
  liquidityHistory:null,
  credit:{ moveIndex:null, moveSignal:"Unavailable", hyDAS:null, igHyDiff:null, tightNote:"—", sloosNote:"—", goldCopper:null, sahmRule:null, ccDelinquency:null },
  breadth:{ pct50:null, pct200:null, ad5d:"—", ad20d:"—", sentiment:"—", note:"Awaiting market breadth feed" },
  fci:{ value:null, nfci:null, status:"—", fedFunds:null, t10y:null, hySpread:null, sp500load:null, usd:null },
  options:{ dexPCR:null, omegaPCR:null, status:"Unavailable", conviction:null },
  macroIndic:{ usM2:"—", usM2Trend:"Unknown", usM2Change:null, industrialProduction:null, industrialProductionDate:null, cbBalanceProxy:"—", cbBalanceProxyTrend:"Unknown" },
  sectorRotation:SECTOR_PAIRS.map(function(p){return {...p,w1:"u",w1m:"u",w3m:"u",w6m:"u",bull:null,leadShare:null,winner:null,diffPct:null,note:"Awaiting sector-return feed",coverage:"0/4"};}),
  allocation:{ stocks:{n:"60",a:"—"}, bonds:{n:"10",a:"—"}, cash:{n:"5",a:"—"}, gold:{n:"5",a:"—"}, crypto:{n:"10",a:"—"}, realAssets:{n:"10",a:"—"} },
  topSectors:[],
  sectorAlloc:{season:"—",bias:"—",confidence:"—",overweight:[],neutral:[],underweight:[]},
  scenarioViews:{
    bullish:"Starting template only. Refresh connected market and macro feeds to build the rules-based bullish scenario.",
    neutral:"Starting template only. Refresh connected market and macro feeds to build the rules-based base-case scenario.",
    bearish:"Starting template only. Refresh connected market and macro feeds to build the rules-based bearish scenario."
  }
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
// Internal bull flag means the first, designated risk-on ETF wins the rule-based comparison
function computeSectorRotation(tickers, PAIRS) {
  return PAIRS.map(function(p) {
    var t1 = tickers[p.e1], t2 = tickers[p.e2];
    if (!t1 || !t2 || t1.error || t2.error) {
      // Preserve unavailable state if data is missing
      return { ...p, w1:"u", w1m:"u", w3m:"u", w6m:"u", bull:null, leadShare:null, winner:null, diffPct:null, note:"Data unavailable", coverage:"0/4" };
    }
    // Per-period winner: "g" = first ETF wins, "r" = second ETF wins,
    // "n" = within 0.2%, and "u" = unavailable. Missing data never counts
    // as evidence for either side.
    function period(r1, r2) {
      var a=Number(r1), b=Number(r2);
      if(!isFinite(a)||!isFinite(b)) return "u";
      var diff = a - b;
      if (Math.abs(diff) < 0.2) return "n";
      return diff > 0 ? "g" : "r";
    }
    var w1  = period(t1.r1w,  t2.r1w);
    var w1m = period(t1.r1m,  t2.r1m);
    var w3m = period(t1.r3m,  t2.r3m);
    var w6m = period(t1.r6m,  t2.r6m);
    var windows=[w1,w1m,w3m,w6m];
    function score(w) { return w === "g" ? 1 : w === "r" ? -1 : 0; }
    var available=windows.filter(function(w){return w!=="u";}).length;
    var totalScore = windows.reduce(function(sum,w){return sum+score(w);},0);
    var bull=null, winner=null, leadShare=null;
    if (available>=2 && totalScore >= 2) { bull = true;  winner = p.sub1; }
    else if (available>=2 && totalScore <= -2) { bull = false; winner = p.sub2; }
    // Lead share = fraction of usable windows won by the leading side.
    // It is descriptive agreement across timeframes, not a probability.
    if(available>=2 && winner){
      var firstWins=windows.filter(function(w){return w==="g";}).length;
      var secondWins=windows.filter(function(w){return w==="r";}).length;
      leadShare=Math.round(Math.max(firstWins,secondWins)/available*100);
    }
    var r6a=Number(t1.r6m), r6b=Number(t2.r6m);
    var diffPct=isFinite(r6a)&&isFinite(r6b)?+(r6a-r6b).toFixed(1):null;
    var note;
    if(available<2) note="Insufficient comparable return history";
    else if (bull === true) note = p.sub1.split(" (")[0] + " leading across usable timeframes";
    else if (bull === false) note = p.sub2.split(" (")[0] + " leading across usable timeframes";
    else note = "Mixed/neutral signals across usable timeframes";
    return { ...p, w1, w1m, w3m, w6m, bull, leadShare, winner, diffPct, note, coverage:available+"/4" };
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
      var r6=Number(t&&t.r6m), r3=Number(t&&t.r3m);
      if (!t || t.error || !isFinite(r6) || !isFinite(r3)) return null;
      return {
        name: s.name,
        etf: s.etf,
        r6m: (r6 >= 0 ? "+" : "") + r6.toFixed(1),
        r3m: (r3 >= 0 ? "+" : "") + r3.toFixed(1),
        pos: r3 >= 0,
        r6mNum: r6,
      };
    })
    .filter(function(s) { return s !== null; })
    .sort(function(a, b) { return b.r6mNum - a.r6mNum; })
    .slice(0, 5);
  return sectors;
}

// Compute simple recent OHLC range lows/highs (not technical support/resistance)
// candles: array of {t, h, l, c} — daily OHLC
// Backward-compatible field names hold 5D/22D range lows/highs.
function computeSwingSR(candles) {
  if (!candles || candles.length < 5) return null;

  // Sort ascending by timestamp just in case
  var sorted = candles.slice().sort(function(a, b) { return a.t - b.t; });
  var latest = sorted[sorted.length - 1];
  var currentPrice = latest.c;

  // Weekly = last ~5 trading days, Monthly = last ~22 trading days
  var weekly = sorted.slice(-5);
  var monthly = sorted.slice(-22);

  // Use the observed high/low extremes in each window. These are descriptive
  // ranges and should not be interpreted as validated support/resistance levels.
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
    out.sp500 = { ...out.sp500, price:d.sp500, change:chg, sentiment:chg==="—"?"—":String(chg).startsWith("-")?"DOWN":"UP" };
    if (d.dma50) out.sp500.dma50 = d.dma50;
    if (d.dma200) out.sp500.dma200 = d.dma200;
  }
  // Nasdaq
  if (d.nasdaq) {
    var ndxChg = d.nasdaqChg||"—";
    out.nasdaq = { ...out.nasdaq, price:d.nasdaq, change:ndxChg, sentiment:ndxChg==="—"?"—":String(ndxChg).startsWith("-")?"DOWN":"UP" };
  }
  // Bitcoin
  if (d.bitcoin) {
    var btcChg = d.bitcoinChg||"—";
    out.bitcoin = { ...out.bitcoin, price:d.bitcoin, change:btcChg, sentiment:btcChg==="—"?"—":String(btcChg).startsWith("-")?"DOWN":"UP" };
  }
  // VIX
  var vv = parseFloat(d.vix);
  if (vv) out.vix = { price:d.vix, change:d.vixChg||"—", changePct:d.vixChg||"—", level:vv>35?"EXTREME":vv>25?"HIGH":vv>15?"MODERATE":"LOW", note:vv>35?"Extreme stress":vv>25?"Elevated concern":vv>15?"Moderate concern":"Low vol regime" };
  // DXY
  var dv = parseFloat(d.dxy);
  if (dv) out.dxy = { price:d.dxy, change:d.dxyChg||"—", strength:dv<98?"WEAK":dv>103?"STRONG":"NEUTRAL", note:dv<98?"Below the displayed heuristic range":dv>103?"Above the displayed heuristic range":"Within the displayed heuristic range", position:Math.round(Math.max(5,Math.min(95,((dv-90)/20)*100))), sparkline:[] };
  // Yields
  var t10=parseFloat(d.t10y), t2=parseFloat(d.t2y);
  if (t10&&t2) { var sp=(t10-t2).toFixed(2); var inv=parseFloat(sp)<0; out.yield={spread:(parseFloat(sp)>=0?"+":"")+sp,status:inv?"INVERTED":Math.abs(parseFloat(sp))<0.1?"FLAT":"NORMAL",recessionRisk:inv?"Elevated signal":"No inversion",recessionPct:null}; }
  // Rates
  var fr=parseFloat(d.fed); if(isFinite(fr)) out.rates={status:"Current rate",current:String(d.fed),expected:null,impliedCuts:null};
  var forwardRate=parseFloat(d.forwardRate);
  if(isFinite(forwardRate)) out.rates={...out.rates,expected:forwardRate.toFixed(3),forwardLabel:d.forwardRateLabel||"Front-month Fed Funds futures implied monthly average",pricingSource:"30-Day Fed Funds futures"};
  // Inflation
  if(d.cpi) { var cpiV=parseFloat(d.cpi); out.inflation={...out.inflation,cpi:d.cpi,trend:isFinite(cpiV)?(cpiV<2.5?"Below 2.5%":cpiV>3.5?"Above 3.5%":"2.5–3.5%"):(out.inflation?.trend||"—"),note:"CPI shown as the connected feed's year-over-year rate; direction requires comparable prior YoY data."}; }
  // Fear & Greed
  if(d.fg!=null) out.fg={score:d.fg,label:d.fgLabel||parseFGLabel(d.fg),vsPrev:null,cryptoScore:d.cryptoFG!=null?d.cryptoFG:out.fg.cryptoScore,cryptoLabel:d.cryptoLabel||parseFGLabel(d.cryptoFG)};
  // Credit
  if(d.move) out.credit={...out.credit,moveIndex:d.move,hyDAS:d.hyOAS||out.credit.hyDAS,tightNote:parseInt(d.hyOAS)<350?"Relatively tight spread":parseInt(d.hyOAS)>500?"Relatively wide spread":"Mid-range spread"};
  // Breadth
  var b50=parseFloat(d.b50); if(isFinite(b50)) out.breadth={pct50:String(d.b50),pct200:String(d.b200||out.breadth.pct200),ad5d:"—",ad20d:"—",sentiment:b50<40?"NARROW":b50>=60?"BROAD":"MIXED",sample:d.breadthSample||null,universe:d.breadthUniverse||null,note:"Diversified tracked-ETF breadth; not the full S&P 500 constituent universe."};
  // Options
  var pcrV=parseFloat(d.pcr); if(isFinite(pcrV)&&pcrV>0) out.options={dexPCR:d.pcr,omegaPCR:null,status:pcrV>1.3?"HIGH PUT/CALL":pcrV<0.7?"LOW PUT/CALL":"MID-RANGE",conviction:null};
  // NFCI
  if(d.nfci!=null&&isFinite(parseFloat(d.nfci))) out.fci={...out.fci,nfci:d.nfci,status:parseFloat(d.nfci)<0?"Looser than historical average":parseFloat(d.nfci)>0?"Tighter than historical average":"Near historical average"};
  return out;
}

function buildRuleBasedViews(d) {
  function n(v){var x=parseFloat(String(v==null?"":v).replace(/,/g,""));return isFinite(x)?x:null;}
  function show(v,suffix){return v==null?"unavailable":v+(suffix||"");}
  var sp=d&&d.sp500||{}, vix=n(d&&d.vix&&d.vix.price), curve=n(d&&d.yield&&d.yield.spread);
  var fg=n(d&&d.fg&&d.fg.score), hy=n(d&&d.credit&&d.credit.hyDAS), cpi=n(d&&d.inflation&&d.inflation.cpi);
  var season=d&&d.macroRegime&&d.macroRegime.season||"Unclassified";
  var bias=d&&d.macroRegime&&d.macroRegime.bias||d&&d.macroRegime&&d.macroRegime.mediumTerm||"Mixed";
  var bull=[] , bear=[];
  if(vix!=null){(vix<20?bull:bear).push("VIX "+vix.toFixed(1));}
  if(curve!=null){(curve>0?bull:bear).push("10Y-2Y curve "+(curve>=0?"+":"")+curve.toFixed(2)+"%");}
  if(hy!=null){(hy<400?bull:bear).push("HY spread "+hy.toFixed(0)+" bp");}
  if(fg!=null){(fg<30?bull:fg>70?bear:bull).push("Fear & Greed "+fg.toFixed(0));}
  var bullSignals=bull.length, bearSignals=bear.length;
  var bullish="Bull case: "+(bull.length?bull.join(", ")+" support a constructive risk backdrop.":"The connected feeds do not currently provide enough positive confirmation for a strong bull case.")+" The current four-season regime is "+season+" with a "+bias+" bias. Treat this as a rules-based scenario, not a forecast.";
  var bearish="Bear case: "+(bear.length?bear.join(", ")+" argue for tighter risk controls.":"The connected feeds do not currently show a concentrated cluster of classic stress signals.")+" Inflation is "+show(cpi,"%")+" and the S&P 500 is "+(sp.price||"unavailable")+". A deterioration in volatility, credit or the yield curve would strengthen this case.";
  var neutral="Balanced case: the dashboard currently registers "+bullSignals+" constructive and "+bearSignals+" cautionary signals from the directly connected feeds. Rather than forcing a directional call, use the regime, rates, credit and price trend together and keep unavailable indicators excluded from the conclusion.";
  return {bullish:bullish,neutral:neutral,bearish:bearish,_timestamp:new Date().toISOString(),_method:"rules"};
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
  }).join("\n");
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
  const [ts, setTs] = useState("Waiting for live refresh");
  const [err, setErr] = useState(null);

  const [refreshStatus, setRefreshStatus] = useState("");

  const doRefresh = useCallback(async () => {
    setErr(null); setP1(true); setRefreshStatus("Fetching live data...");
    try {
      var parsed = null;

      // Attempt 1: Vercel proxy (works outside sandbox)
      try {
        setRefreshStatus("Trying Vercel proxy...");
        var proxyRes = await fetchWithTimeout(PROXY_URL);
        var proxyJson = await proxyRes.json();
        var quotes = (proxyJson.quoteResponse && proxyJson.quoteResponse.result) || [];
        if (quotes.length > 0) {
          parsed = {};
          var bySymbol = {};
          quotes.forEach(function(q) { bySymbol[q.symbol] = q; });
          var sp = bySymbol["^GSPC"];
          if (sp && Number.isFinite(Number(sp.regularMarketPrice))) { parsed.sp500 = Number(sp.regularMarketPrice).toFixed(2); var ch=Number(sp.regularMarketChangePercent); parsed.sp500Chg = Number.isFinite(ch)?(ch>=0?"+":"")+ch.toFixed(2):"—"; }
          var ndx = bySymbol["^IXIC"];
          if (ndx && Number.isFinite(Number(ndx.regularMarketPrice))) { parsed.nasdaq = Number(ndx.regularMarketPrice).toFixed(2); var nch=Number(ndx.regularMarketChangePercent); parsed.nasdaqChg = Number.isFinite(nch)?(nch>=0?"+":"")+nch.toFixed(2):"—"; }
          var btc = bySymbol["BTC-USD"];
          if (btc && Number.isFinite(Number(btc.regularMarketPrice))) { parsed.bitcoin = Number(btc.regularMarketPrice).toFixed(2); var bch=Number(btc.regularMarketChangePercent); parsed.bitcoinChg = Number.isFinite(bch)?(bch>=0?"+":"")+bch.toFixed(2):"—"; }
          var vx = bySymbol["^VIX"];
          if (vx && Number.isFinite(Number(vx.regularMarketPrice))) { parsed.vix = Number(vx.regularMarketPrice).toFixed(2); var vch=Number(vx.regularMarketChangePercent); parsed.vixChg = Number.isFinite(vch)?(vch>=0?"+":"")+vch.toFixed(2):"—"; }
          var dx = bySymbol["DX-Y.NYB"];
          if (dx && Number.isFinite(Number(dx.regularMarketPrice))) { parsed.dxy = Number(dx.regularMarketPrice).toFixed(2); var dch=Number(dx.regularMarketChangePercent); parsed.dxyChg = Number.isFinite(dch)?(dch>=0?"+":"")+dch.toFixed(2):"—"; }
          var tn = bySymbol["^TNX"];
          if (tn && Number.isFinite(Number(tn.regularMarketPrice))) { parsed.t10y = Number(tn.regularMarketPrice).toFixed(3); }
          var analytics = proxyJson.analytics || {};
          if (Number.isFinite(Number(analytics.moveIndex))) parsed.move = Number(analytics.moveIndex).toFixed(2);
          if (analytics.breadth) {
            if (Number.isFinite(Number(analytics.breadth.pct50))) parsed.b50 = Number(analytics.breadth.pct50).toFixed(1);
            if (Number.isFinite(Number(analytics.breadth.pct200))) parsed.b200 = Number(analytics.breadth.pct200).toFixed(1);
            parsed.breadthSample = analytics.breadth.sample50;
            parsed.breadthUniverse = analytics.breadth.universeSize;
          }
          if (Number.isFinite(Number(analytics.totalPutCallRatio))) parsed.pcr = Number(analytics.totalPutCallRatio).toFixed(2);
          if (analytics.forwardPolicy && Number.isFinite(Number(analytics.forwardPolicy.impliedRate))) {
            parsed.forwardRate = Number(analytics.forwardPolicy.impliedRate).toFixed(3);
            parsed.forwardRateLabel = analytics.forwardPolicy.label;
          }
          setRefreshStatus("Got " + quotes.length + " quotes from proxy!");
        }
      } catch(proxyErr) {
        setRefreshStatus("Market quote endpoint unavailable");
      }

      // Accuracy-first: do not substitute AI/web-researched prices for the quote feed.
      // If the market proxy cannot return quotes, leave the dashboard clearly unavailable
      // instead of presenting stale seed values as current.
      if (!parsed || !Object.keys(parsed).length) {
        parsed = null;
        setErr("Connected market quote feed is unavailable. Macro/FRED and other independent feeds will still refresh; price-based panels remain unavailable.");
      } else {
        setRefreshStatus("Applying " + Object.keys(parsed).length + " market data points...");
        setData(function(prev) { return applyLiveData(parsed, prev); });
        setTs(new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}));
      }
      // Fetch FRED data
try {
  setRefreshStatus("Fetching FRED data...");
  var fredRes = await fetchWithTimeout(FRED_URL);
  var fredJson = await fredRes.json().catch(function(){return {};});
  if(!fredRes.ok) throw new Error(fredJson.error||("FRED endpoint HTTP "+fredRes.status));
  var fredFieldCount = Object.keys(fredJson).filter(function(k){ return !k.startsWith("_") && !k.endsWith("_DATE"); }).length;
  setRefreshStatus("FRED loaded: " + fredFieldCount + " fields");
  setData(function(prev) {
    var out = { ...prev };
    // Auto-detect Macro Season from live data
if (fredJson.GDP_GROWTH && fredJson.GDP_GROWTH_PREV) {
  var gdpCurrent = parseFloat(fredJson.GDP_GROWTH);
  var gdpPrev = parseFloat(fredJson.GDP_GROWTH_PREV);
  var fedCurrent = parseFloat(fredJson.FEDFUNDS);
  var fedPrev = parseFloat(fredJson.FEDFUNDS_PREV);
  var yieldCurve = parseFloat(fredJson.T10Y2Y);
  var hySpreadVal = parseFloat(fredJson.BAMLH0A0HYM2);
  var sahmVal = parseFloat(fredJson.SAHMREALTIME);

  // This is a coarse, rules-based quadrant — not a claim that the business
  // cycle can be precisely dated from two observations. Growth momentum compares
  // BEA real GDP quarter-over-quarter annualized growth with the prior quarter. Inflation momentum is used only
  // when the FRED proxy provides comparable YoY readings; otherwise the
  // regime is deliberately lower-coverage rather than treating CPI index
  // levels as an inflation acceleration signal.
  var growthExpanding = isFinite(gdpCurrent) && isFinite(gdpPrev) ? gdpCurrent > gdpPrev : null; // true = growth accelerating, false = growth slowing
  var inflationNow = parseFloat(fredJson.CPI_YOY);
  var inflationPrev = parseFloat(fredJson.CPI_YOY_PREV);
  var hasInflationMomentum = isFinite(inflationNow) && isFinite(inflationPrev);
  var inflationRising = hasInflationMomentum ? inflationNow > inflationPrev : null;
  var fedTightening = isFinite(fedCurrent) && isFinite(fedPrev) ? fedCurrent >= fedPrev : null;
  var creditStress = isFinite(hySpreadVal) ? hySpreadVal > 4.0 : false;
  var recessionSignal = isFinite(sahmVal) ? sahmVal > 0.5 : false;

  var detectedSeason = "Unclassified";
  var detectedPhase = "Insufficient comparable growth/inflation inputs";

  // Quadrant classification is driven only by comparable growth and inflation
  // momentum. Credit/Sahm inputs are shown as separate stress indicators rather
  // than changing the quadrant label.
  if (growthExpanding !== null && hasInflationMomentum) {
    if (growthExpanding && !inflationRising) {
      detectedSeason = "Spring";
      detectedPhase = "Growth accelerating / inflation momentum falling";
    } else if (growthExpanding && inflationRising) {
      detectedSeason = "Summer";
      detectedPhase = "Growth accelerating / inflation momentum rising";
    } else if (!growthExpanding && inflationRising) {
      detectedSeason = "Autumn";
      detectedPhase = "Growth slowing / inflation momentum rising";
    } else {
      detectedSeason = "Winter";
      detectedPhase = "Growth slowing / inflation momentum falling";
    }
  }

  // This field is retained for UI compatibility, but it is strictly DATA
  // COVERAGE — not statistical confidence or probability.
  var coverageInputs = [gdpCurrent,gdpPrev,inflationNow,inflationPrev,fedCurrent,yieldCurve,hySpreadVal,sahmVal];
  var detectedConfidence = Math.round(coverageInputs.filter(function(v){return isFinite(v);}).length / coverageInputs.length * 100);

  var spxDisplay = (out.sp500 && out.sp500.price) || (prev.sp500 && prev.sp500.price) || "—";
  var vixDisplay = (out.vix && out.vix.price) || (prev.vix && prev.vix.price) || "—";
  var parts = [
    "Rule-based macro quadrant: " + detectedPhase + ".",
    "S&P 500 " + spxDisplay + "; VIX " + vixDisplay + ".",
    "Real GDP growth " + (growthExpanding === true ? "accelerated" : growthExpanding === false ? "slowed" : "was unavailable") +
      (isFinite(gdpCurrent) && isFinite(gdpPrev) ? " (" + gdpCurrent.toFixed(1) + "% SAAR vs " + gdpPrev.toFixed(1) + "% prior quarter)." : ".")
  ];
  if (hasInflationMomentum) parts.push("CPI YoY " + (inflationRising ? "accelerated" : "decelerated") + " (" + inflationNow.toFixed(2) + "% vs " + inflationPrev.toFixed(2) + "% prior comparable reading)." );
  else parts.push("Comparable CPI YoY momentum was unavailable from the connected FRED feed, so inflation direction did not drive the quadrant classification.");
  if (isFinite(fedCurrent)) parts.push("Fed funds " + fedCurrent.toFixed(2) + "%" + (fedTightening == null ? "." : " (" + (fedTightening ? "not lower than prior reading" : "lower than prior reading") + ")."));
  if (isFinite(yieldCurve)) parts.push("10Y–2Y curve " + (yieldCurve >= 0 ? "+" : "") + yieldCurve.toFixed(2) + " pp.");
  if (isFinite(hySpreadVal)) parts.push("High-yield OAS " + hySpreadVal.toFixed(2) + " pp.");
  if (isFinite(sahmVal)) parts.push("Sahm Rule indicator " + sahmVal.toFixed(2) + ".");

  out.macroRegime = { ...out.macroRegime,
    season: detectedSeason,
    phase: detectedPhase,
    confidence: detectedConfidence,
    riskOn: detectedSeason === "Unclassified" ? null : (detectedSeason === "Spring" || detectedSeason === "Summer"),
    confirmed: detectedSeason !== "Unclassified",
    mediumTerm: detectedSeason === "Unclassified" ? "Unclassified" : (detectedSeason === "Spring" || detectedSeason === "Summer" ? "Model risk-on tilt" : "Model defensive tilt"),
    shortTerm: detectedSeason === "Autumn" ? "Model defensive tilt — slowing growth / firmer inflation" :
               detectedSeason === "Winter" ? "Model defensive tilt — slowing growth / disinflation" :
               detectedSeason === "Summer" ? "Model cyclical tilt — accelerating growth / firmer inflation" :
               detectedSeason === "Spring" ? "Model cyclical tilt — accelerating growth / disinflation" :
               "Insufficient comparable growth/inflation inputs",
    description: parts.join(" ")
  };
}
    if (fredJson.T10Y2Y) {
      var sp = parseFloat(fredJson.T10Y2Y);
      out.yield = { spread:(sp>=0?"+":"")+sp.toFixed(2), status:sp<0?"INVERTED":Math.abs(sp)<0.1?"FLAT":"NORMAL", recessionRisk:sp<0?"Elevated signal":"No inversion", recessionPct:null };
    }
    if (fredJson.BAMLH0A0HYM2) {
      var hy = parseFloat(fredJson.BAMLH0A0HYM2) * 100;
      out.credit = { ...out.credit, hyDAS:Math.round(hy).toString(), tightNote:hy<350?"Tight spread":hy>500?"Wide spread":"Mid-range spread" };
    }
    if (fredJson.FEDFUNDS) {
      var ff = parseFloat(fredJson.FEDFUNDS);
      var ffPrev = parseFloat(fredJson.FEDFUNDS_PREV);
      var rateStatus = isFinite(ffPrev) ? (ff < ffPrev ? "EASING" : ff > ffPrev ? "TIGHTENING" : "UNCHANGED") : "CURRENT RATE";
      out.rates = { ...out.rates, status:rateStatus, current:isFinite(ff)?ff.toFixed(2):"—", impliedCuts:null };
    }
    if (fredJson.NFCI) {
      var nfci = parseFloat(fredJson.NFCI);
      out.fci = { ...out.fci, nfci:fredJson.NFCI, status:nfci<0?"Looser than historical average":nfci>0?"Tighter than historical average":"Near historical average" };
    }
    if (fredJson.SAHMREALTIME) {
      out.credit = { ...out.credit, sahmRule:parseFloat(fredJson.SAHMREALTIME).toFixed(2) };
    }
    if (fredJson.CPI_YOY) {
      var cpiYoY = parseFloat(fredJson.CPI_YOY);
      var cpiYoYPrev = parseFloat(fredJson.CPI_YOY_PREV);
      out.inflation = { ...out.inflation,
        cpi:isFinite(cpiYoY)?cpiYoY.toFixed(2):out.inflation.cpi,
        trend:isFinite(cpiYoY)&&isFinite(cpiYoYPrev)?(cpiYoY>cpiYoYPrev?"Accelerating":cpiYoY<cpiYoYPrev?"Decelerating":"Stable"):"Trend unavailable",
        note:isFinite(cpiYoY)&&isFinite(cpiYoYPrev)?("CPI YoY " + (cpiYoY>cpiYoYPrev?"accelerated":"did not accelerate") + " versus the prior comparable reading."):"CPI YoY prior comparison unavailable."
      };
    }
    if (fredJson.T10YIE) {
      var inf = parseFloat(fredJson.T10YIE);
      out.inflation = { ...out.inflation, breakeven:fredJson.T10YIE };
    }
    // Macro Indicators: US M2, central-bank balance-sheet proxy, and Industrial Production
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
    // Central-bank balance-sheet proxy — NOT global M2. The audited FRED
    // endpoint performs the unit/FX conversion and returns USD trillions.
    if (fredJson.CB_PROXY_USD_T) {
      var cbAssetsTotal = parseFloat(fredJson.CB_PROXY_USD_T);
      var cbAssetsPrev = parseFloat(fredJson.CB_PROXY_USD_T_PREV);
      out.macroIndic = { ...out.macroIndic,
        cbBalanceProxy: isFinite(cbAssetsTotal) ? "$" + cbAssetsTotal.toFixed(2) + "T" : "—",
        cbBalanceProxyTrend: isFinite(cbAssetsTotal)&&isFinite(cbAssetsPrev) ? (cbAssetsTotal>cbAssetsPrev?"Rising":cbAssetsTotal<cbAssetsPrev?"Falling":"Flat") : "Unknown"
      };
      out.liquidity = { ...out.liquidity,
        total:isFinite(cbAssetsTotal)?cbAssetsTotal.toFixed(2):"—",
        score:null,
        trend:"Central-bank balance-sheet proxy",
        fedTotal:fredJson.WALCL? (parseFloat(fredJson.WALCL)/1000000).toFixed(2):null,
        ecbTotal:null,
        bojTotal:null,
        pbocTotal:null
      };
    }
    // Industrial Production — FRED INDPRO transformed to monthly percent change.
    if (fredJson.INDPRO_MOM != null) {
      var indMom = parseFloat(fredJson.INDPRO_MOM);
      out.macroIndic = { ...out.macroIndic,
        industrialProduction:isFinite(indMom)?indMom:null,
        industrialProductionDate:fredJson.INDPRO_DATE||null
      };
    }
return out;
});
  setRefreshStatus("FRED data applied!");
} catch(fredErr) {
  console.warn("FRED fetch failed:", fredErr.message);
}

  // Fear & Greed is an optional external proxy feed. It is deliberately
  // independent of sector data; failure leaves the panel unavailable.
try {
  setRefreshStatus("Fetching Fear & Greed...");
  var fgRes = await fetchWithTimeout(FG_URL);
  var fgJson = await fgRes.json().catch(function(){return {};});
  if(!fgRes.ok) throw new Error(fgJson.error||("F&G endpoint HTTP "+fgRes.status));
  setData(function(prev) {
    var out = { ...prev };
    if (fgJson.cnnScore != null || fgJson.cryptoScore != null) {
      var cnnScore = fgJson.cnnScore != null && isFinite(Number(fgJson.cnnScore)) ? Number(fgJson.cnnScore) : null;
      var cryptoScore = fgJson.cryptoScore != null && isFinite(Number(fgJson.cryptoScore)) ? Number(fgJson.cryptoScore) : null;
      var prevScore = cnnScore != null && prev.fg.score != null ? cnnScore - Number(prev.fg.score) : null;
      out.fg = {
        score: cnnScore,
        label: cnnScore!=null ? (fgJson.cnnLabel || parseFGLabel(cnnScore)) : "—",
        vsPrev: prevScore,
        cryptoScore: cryptoScore,
        cryptoLabel: cryptoScore!=null ? (fgJson.cryptoLabel || parseFGLabel(cryptoScore)) : "—",
        timestamp: fgJson.timestamp || new Date().toISOString(),
      };
    }
    return out;
  });
} catch(fgErr) {
  console.warn("F&G fetch failed:", fgErr.message);
}

// Fetch OHLC history and compute recent 5D / 22D range extremes for 3 indices
try {
  setRefreshStatus("Fetching recent OHLC ranges...");
  var ohlcRes = await fetchWithTimeout(OHLC_URL);
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
    setRefreshStatus("Recent OHLC ranges updated!");
  }
} catch(ohlcErr) {
  console.warn("OHLC fetch failed:", ohlcErr.message);
}

// Fetch liquidity history (Fed, ECB, BoJ + S&P 500) for interactive chart
try {
  setRefreshStatus("Fetching liquidity history...");
  var liqRes = await fetchWithTimeout(LIQ_URL);
  if (liqRes.ok) {
    var liqJson = await liqRes.json();
    setData(function(prev) {
      var totalSeries=Array.isArray(liqJson.total)?liqJson.total:[];
      var latestTotal=totalSeries.length?Number(totalSeries[totalSeries.length-1].value):null;
      var r13=Number(liqJson.roc13w), r52=Number(liqJson.roc52w);
      return { ...prev,
        liquidityHistory: liqJson,
        liquidity:{...prev.liquidity,
          total:isFinite(latestTotal)?latestTotal.toFixed(1):prev.liquidity.total,
          roc13w:isFinite(r13)?r13.toFixed(2):null,
          roc52w:isFinite(r52)?r52.toFixed(2):null,
          trend:isFinite(r13)?(r13>0?"Expanding proxy":r13<0?"Contracting proxy":"Flat proxy"):"Balance-sheet proxy"
        }
      };
    });
    setRefreshStatus("Liquidity history loaded!");
  }
} catch(liqErr) {
  console.warn("Liquidity history fetch failed:", liqErr.message);
}

// Fetch live sector ETF returns and compute rotation pairs + top sectors
try {
  setRefreshStatus("Fetching live sector data...");
  var secLiveRes = await fetchWithTimeout(SECTORS_LIVE_URL);
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

// Data that is not backed by a connected deterministic feed is intentionally
// left unavailable. Connected breadth and Cboe options values are retained;
// only genuinely unconnected subfields remain blank.
setData(function(prev) {
  var next={...prev};
  next.macroIndic={...prev.macroIndic};
  next.scenarioViews=buildRuleBasedViews(next);
  return next;
});
setRefreshStatus("Live data refreshed · scenario analysis updated");
setTimeout(function(){setRefreshStatus("");},2500);
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
  var _topTab = useState("Analysis");
  var topTab = _topTab[0], setTopTab = _topTab[1];

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
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:5 }}>Analysis Workflow</div>
          <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
            <div style={{ width:(stage/5)*100 + "%", height:"100%", background:"linear-gradient(90deg," + C.blue + "," + C.purple + ")", borderRadius:2, transition:"width .3s" }} />
          </div>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>Module {stage} of 5</div>
          {stages.map(st => (
            <div key={st.n} onClick={()=>setStage(st.n)} style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 7px", borderRadius:6, marginBottom:3, background:stage===st.n?C.blue+"20":"transparent", border:stage===st.n?"1px solid " + C.blue + "44":"1px solid transparent", cursor:"pointer" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:stage===st.n?C.blue:C.border, fontSize:9, fontWeight:700, flexShrink:0 }}>{st.n}</div>
              <span style={{ fontSize:11, color:stage===st.n?C.text:C.textMid, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{st.label}</span>
              <span style={{ fontSize:9, color:stage===st.n?C.cyan:C.textDim }}>{stage===st.n?"●":""}</span>
            </div>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ padding:"5px 13px", fontSize:9, color:C.textDim, lineHeight:1.4 }}>
          Accuracy-first display · unavailable data stays blank
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, overflow:"auto", padding:"13px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", gap:18 }}>
            {["Analysis","Portfolio","Financials","US Macro Calendar","Comparables"].map(t => (
              <span key={t} onClick={function(){setTopTab(t)}} style={{ fontSize:13, color:t===topTab?C.text:C.textMid, fontWeight:t===topTab?600:400, cursor:"pointer", borderBottom:t===topTab?"2px solid " + C.blue:"none", paddingBottom:3 }}>{t}</span>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {refreshStatus && <span style={{ fontSize:10, color:C.cyan, fontFamily:font, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{refreshStatus}</span>}
            {!refreshStatus && <span style={{ fontSize:10, color:C.green, fontFamily:font }}>● Market refresh: {ts}</span>}
            <button onClick={doRefresh} disabled={p1} style={{ background:p1?C.border:"linear-gradient(135deg," + C.cyan + "dd," + C.blue + ")", border:"none", borderRadius:6, color:p1?C.textMid:C.bg, padding:"6px 13px", fontSize:11, fontWeight:700, cursor:p1?"wait":"pointer", whiteSpace:"nowrap" }}>
              {p1?"Refreshing...":"⚡ Refresh"}
            </button>
            <button onClick={function(){setTopTab("Analysis");setStage(1);}} style={{ background:"linear-gradient(135deg," + C.blue + "," + C.purple + ")", border:"none", borderRadius:6, color:C.text, padding:"6px 13px", fontSize:11, fontWeight:600, cursor:"pointer" }}>▶ Open Analysis</button>
          </div>
        </div>

        {err && <div style={{ background:"#2b0d10", border:"1px solid " + C.red + "44", borderRadius:8, padding:"7px 13px", marginBottom:11, fontSize:12, color:C.red }}>⚠ {err}</div>}

        {topTab==="Analysis" && (
          <div>
            {stage===1 && <MacroStage d={d} />}
            {stage===2 && <PortfolioStage d={d} />}
            {stage===3 && <ScreenerStage d={d} />}
            {stage===4 && <BuilderStage d={d} />}
            {stage===5 && <ExecutionStage d={d} />}
          </div>
        )}
        {topTab==="Portfolio" && <PortfolioTabView d={d} />}
        {topTab==="Financials" && <FinancialsTabView d={d} />}
        {topTab==="US Macro Calendar" && <USMacroCalendarTab />}
        {topTab==="Comparables" && <ComparablesTab />}
        {topTab!=="Analysis" && topTab!=="Portfolio" && topTab!=="Financials" && topTab!=="US Macro Calendar" && topTab!=="Comparables" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:400 }}>
            <div style={{ fontSize:28, opacity:0.2, marginBottom:8 }}>🚧</div>
            <div style={{ color:C.textDim, fontSize:14 }}>{topTab} — coming soon</div>
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

// TradingView's compact quote widget recognizes the SPX and IXIC symbols but
// can withhold cash-index quote fields because of redistribution restrictions.
// Display the connected proxy quote and keep a direct TradingView link so the
// dashboard uses the real index rather than silently substituting an ETF/CFD.
function LiveIndexQuote({ symbol, name, price, change, tradingViewUrl }) {
  var n=parseFloat(String(price==null?"":price).replace(/,/g,""));
  var ch=parseFloat(String(change==null?"":change).replace("%",""));
  var hasPrice=isFinite(n);
  var hasChange=isFinite(ch);
  var color=hasChange?(ch>0?C.green:ch<0?C.red:C.textMid):C.textDim;
  return <div style={{height:140,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"5px 2px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
      <div>
        <div style={{fontSize:15,fontWeight:800,fontFamily:font,color:C.text}}>{symbol}</div>
        <div style={{fontSize:10,color:C.textDim,marginTop:3,textTransform:"uppercase"}}>{name}</div>
      </div>
      <a href={tradingViewUrl} target="_blank" rel="noreferrer" title={"Open "+symbol+" on TradingView"} style={{width:30,height:30,borderRadius:"50%",background:"#2a2b31",color:C.text,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",fontSize:10,fontWeight:800}}>TV↗</a>
    </div>
    <div>
      <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:27,fontWeight:800,fontFamily:font,color:hasPrice?C.text:C.textDim}}>{hasPrice?n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</span>
        <span style={{fontSize:13,fontWeight:700,fontFamily:font,color}}>{hasChange?(ch>=0?"+":"")+ch.toFixed(2)+"%":"Quote unavailable"}</span>
      </div>
      <div style={{fontSize:9,color:C.textDim,marginTop:5}}>Connected index quote · chart link: TradingView</div>
    </div>
  </div>;
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
  const sc = SC[d.macroRegime?.season] || C.textDim;
  const [scenarioView, setAiView] = useState("neutral");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ROW 1: Regime */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
        <Card glow={sc}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Macro Regime</div>
            <Badge
              label={d.macroRegime?.season!=="Unclassified" ? "CONNECTED INPUTS" : "INSUFFICIENT INPUTS"}
              color={d.macroRegime?.season!=="Unclassified" ? C.green : C.textDim}
            />
          </div>
          <div style={{ display:"flex", gap:13 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:sc+"20", border:"1px solid " + sc + "40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {d.macroRegime?.season==="Summer"?"☀️":d.macroRegime?.season==="Spring"?"🌱":d.macroRegime?.season==="Autumn"?"🍂":d.macroRegime?.season==="Winter"?"❄️":"◌"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:21, fontWeight:700, color:sc, marginBottom:7 }}>{d.macroRegime?.season} ({d.macroRegime?.phase})</div>
              <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:7, flexWrap:"wrap" }}>
                <Badge label={d.macroRegime?.riskOn===true?"MODEL RISK-ON TILT":d.macroRegime?.riskOn===false?"MODEL DEFENSIVE TILT":"NO TILT"} color={d.macroRegime?.riskOn===true?C.green:d.macroRegime?.riskOn===false?C.orange:C.textDim} />
                <span style={{ fontSize:11, color:C.textMid }}>{d.macroRegime?.confirmed?"Growth + inflation inputs available":"Quadrant inputs incomplete"}</span>
                <span style={{ fontSize:11, color:C.textMid }}>│</span>
                <span style={{ fontSize:11, color:C.textMid }}>{d.macroRegime?.confidence}% data coverage</span>
              </div>
              <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
                <div style={{ width:(d.macroRegime?.confidence ?? 0) + "%", height:"100%", background:sc, borderRadius:2 }} />
              </div>
              <div style={{ marginBottom:3 }}><span style={{ fontSize:12, color:C.textDim }}>Medium term: </span><span style={{ fontSize:12, color:d.macroRegime?.riskOn===true?C.green:d.macroRegime?.riskOn===false?C.orange:C.textDim }}>{d.macroRegime?.mediumTerm}</span></div>
              <div style={{ marginBottom:8 }}><span style={{ fontSize:12, color:C.textDim }}>Short term: </span><span style={{ fontSize:12, color:C.orange }}>{d.macroRegime?.shortTerm}</span></div>
            <p style={{ fontSize:11, color:C.textMid, lineHeight:1.6, margin:"0 0 10px" }}>
  {REGIME_QUADRANTS[d.macroRegime?.season]?.description || d.macroRegime?.description}
</p>
<div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Growth: </span>
    <span style={{ color:REGIME_QUADRANTS[d.macroRegime?.season]?.growth==="Rising"?C.green:REGIME_QUADRANTS[d.macroRegime?.season]?.growth==="Slowing"?C.red:C.textDim, fontWeight:700 }}>{REGIME_QUADRANTS[d.macroRegime?.season]?.growth} {REGIME_QUADRANTS[d.macroRegime?.season]?.growth==="Rising"?"▲":REGIME_QUADRANTS[d.macroRegime?.season]?.growth==="Slowing"?"▼":""}</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Inflation: </span>
    <span style={{ color:REGIME_QUADRANTS[d.macroRegime?.season]?.inflation==="Rising"?C.red:REGIME_QUADRANTS[d.macroRegime?.season]?.inflation==="Falling"?C.green:C.textDim, fontWeight:700 }}>{REGIME_QUADRANTS[d.macroRegime?.season]?.inflation} {REGIME_QUADRANTS[d.macroRegime?.season]?.inflation==="Rising"?"▲":REGIME_QUADRANTS[d.macroRegime?.season]?.inflation==="Falling"?"▼":""}</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Bias: </span>
    <span style={{ color:sc, fontWeight:700 }}>{REGIME_QUADRANTS[d.macroRegime?.season]?.bias}</span>
  </div>
  <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"3px 8px", fontSize:11 }}>
    <span style={{ color:C.textDim }}>Cycle: </span>
    <span style={{ color:C.text, fontWeight:700 }}>{REGIME_QUADRANTS[d.macroRegime?.season]?.cycle}</span>
  </div>
</div>
<div style={{ background:C.cardAlt, border:"1px solid " + sc + "33", borderRadius:6, padding:"7px 10px", marginBottom:8 }}>
  <div style={{ fontSize:10, color:C.textDim, marginBottom:4, letterSpacing:1 }}>🔑 KEY THEME</div>
  <div style={{ fontSize:11, color:sc }}>{REGIME_QUADRANTS[d.macroRegime?.season]?.keyTheme}</div>
</div>
<div style={{ display:"flex", gap:10 }}>
  <div style={{ flex:1, background:C.cardAlt, border:"1px solid " + C.green + "33", borderRadius:6, padding:"7px 10px" }}>
    <div style={{ fontSize:10, color:C.green, marginBottom:4, letterSpacing:1 }}>↑ MODEL TILT</div>
    {(REGIME_QUADRANTS[d.macroRegime?.season]?.overweight||[]).map(function(s) {
      return <div key={s} style={{ fontSize:11, color:C.textMid, marginBottom:2 }}>• {s}</div>;
    })}
  </div>
  <div style={{ flex:1, background:C.cardAlt, border:"1px solid " + C.red + "33", borderRadius:6, padding:"7px 10px" }}>
    <div style={{ fontSize:10, color:C.red, marginBottom:4, letterSpacing:1 }}>↓ MODEL UNDERWEIGHT</div>
    {(REGIME_QUADRANTS[d.macroRegime?.season]?.underweight||[]).map(function(s) {
      return <div key={s} style={{ fontSize:11, color:C.textMid, marginBottom:2 }}>• {s}</div>;
    })}
  </div>
</div>
<div style={{ marginTop:8, fontSize:10, color:C.textDim, fontFamily:font }}>
  {d.macroRegime?.description}
</div>
<div style={{ marginTop:6, fontSize:9, color:C.textDim }}>
  Framework labels and asset tilts are heuristic model outputs. They are not official NBER cycle dates, statistical probabilities, or investment recommendations.
</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 1b: Indices — S&P + Nasdaq + Bitcoin (TradingView live) */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="📈" title="S&P 500" />
          <LiveIndexQuote symbol="SPX" name="S&P 500 Index" price={d.sp500?.price} change={d.sp500?.change} tradingViewUrl="https://www.tradingview.com/symbols/SPX/" />
          <div style={{ borderTop:"1px solid " + C.border, marginTop:8, paddingTop:8 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>RECENT OHLC RANGE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Low</span><span style={{ color:C.textDim, textAlign:"right" }}>High</span>
              <span style={{ color:C.textMid }}>5D</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.sp500?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.sp500?.wkResistance}</span>
              <span style={{ color:C.textMid }}>22D</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.sp500?.moSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.sp500?.moResistance}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="💻" title="Nasdaq Composite" />
          <LiveIndexQuote symbol="IXIC" name="Nasdaq Composite Index" price={d.nasdaq?.price} change={d.nasdaq?.change} tradingViewUrl="https://www.tradingview.com/symbols/NASDAQ-IXIC/" />
          <div style={{ borderTop:"1px solid " + C.border, marginTop:8, paddingTop:8 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>RECENT OHLC RANGE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Low</span><span style={{ color:C.textDim, textAlign:"right" }}>High</span>
              <span style={{ color:C.textMid }}>5D</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.nasdaq?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.nasdaq?.wkResistance}</span>
              <span style={{ color:C.textMid }}>22D</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.nasdaq?.moSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.nasdaq?.moResistance}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="₿" title="Bitcoin" />
          <TVWidget scriptName="embed-widget-mini-symbol-overview" height={140} config={{
            "symbol": "COINBASE:BTCUSD",
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
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:5 }}>RECENT OHLC RANGE</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"3px 7px", fontSize:11 }}>
              <span /><span style={{ color:C.textDim, textAlign:"right" }}>Low</span><span style={{ color:C.textDim, textAlign:"right" }}>High</span>
              <span style={{ color:C.textMid }}>5D</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.blueLight }}>{d.bitcoin?.wkSupport}</span>
              <span style={{ textAlign:"right", fontFamily:font, color:C.orange }}>{d.bitcoin?.wkResistance}</span>
              <span style={{ color:C.textMid }}>22D</span>
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
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Macro Scenario Analysis</span>
          </div>
          <Badge label={d.scenarioViews?._timestamp ? "RULE-BASED" : "STARTING TEMPLATE"} color={d.scenarioViews?._timestamp ? C.purple : C.textDim} />
        </div>

        {/* Tab switcher */}
        <div style={{ display:"flex", gap:6, marginBottom:14, borderBottom:"1px solid " + C.border, paddingBottom:0, flexWrap:"wrap" }}>
          {[
            { key:"bullish", label:"🐂 Bullish", color:C.green },
            { key:"neutral", label:"⚖ Neutral", color:C.yellow },
            { key:"bearish", label:"🐻 Bearish", color:C.red },
          ].map(function(tab) {
            var active = scenarioView === tab.key;
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
          background: (scenarioView==="bullish"?C.green:scenarioView==="bearish"?C.red:C.yellow) + "08",
          border: "1px solid " + (scenarioView==="bullish"?C.green:scenarioView==="bearish"?C.red:C.yellow) + "22",
          borderRadius: 6,
          padding: "10px 12px",
          maxHeight: 380,
          overflowY: "auto",
        }}>
          {(d.scenarioViews?.[scenarioView] || "Click ⚡ Refresh to build scenario analysis from connected data.").split("\n\n").map(function(para,i) {
            return <p key={i} style={{ margin:"0 0 10px" }}>{para}</p>;
          })}
        </div>

        <div style={{ display:"flex", gap:4, marginTop:10, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>FRAMEWORKS:</span>
          {["four-season regime","liquidity","credit + rates"].map(function(t) {
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
              <div style={{ fontSize:11, color:C.textMid, marginBottom:8, fontFamily:font }}>{d.dxy?.change!=null&&d.dxy?.change!=="—"?d.dxy.change+"%":"—"}</div>
            </div>
          )}
<div style={{ marginBottom:10, fontSize:9, color:C.textDim }}>Historical DXY sparkline is withheld unless a real time-series feed is connected.</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:3 }}><span>Weak</span><span>Neutral</span><span>Strong</span></div>
            <div style={{ position:"relative", height:5, background:"linear-gradient(90deg," + C.red + "," + C.textDim + "," + C.green + ")", borderRadius:3 }}>
              {d.dxy?.position != null && <div style={{ position:"absolute", width:10, height:10, borderRadius:"50%", background:C.blue, border:"2px solid " + C.text, top:-3, left:d.dxy.position + "%", transform:"translateX(-50%)" }} />}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginTop:2 }}><span>90</span><span>100</span><span>110</span></div>
          </div>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <Badge label={d.dxy?.strength&&d.dxy.strength!=="—"?d.dxy.strength:"UNAVAILABLE"} color={d.dxy?.strength==="WEAK"?C.red:d.dxy?.strength==="STRONG"?C.green:d.dxy?.strength==="NEUTRAL"?C.yellow:C.textDim} />
            <span style={{ fontSize:11, color:C.textMid }}>{false?"...":d.dxy?.note}</span>
          </div>
        </Card>

    <Card>
          <SecTitle icon="📊" title="Macro Indicators" badge={(d.macroIndic?.usM2!=="—"||d.macroIndic?.cbBalanceProxy!=="—")?"FRED":"UNAVAILABLE"} bc={(d.macroIndic?.usM2!=="—"||d.macroIndic?.cbBalanceProxy!=="—")?C.cyan:C.textDim} />
          
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            {/* Central-bank balance-sheet proxy */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>Central Bank Balance-Sheet Proxy</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color: d.macroIndic?.cbBalanceProxyTrend==="Rising" ? C.green : d.macroIndic?.cbBalanceProxyTrend==="Falling" ? C.red : C.orange, marginBottom:6 }}>
                {d.macroIndic?.cbBalanceProxyTrend==="Rising" ? "▲ " : d.macroIndic?.cbBalanceProxyTrend==="Falling" ? "▼ " : ""}{d.macroIndic?.cbBalanceProxy || "—"}
              </div>
              <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>
                {d.macroIndic?.cbBalanceProxyTrend==="Rising" 
                  ? "Aggregate tracked central-bank assets increased on the available comparison; this is not global M2."
                  : d.macroIndic?.cbBalanceProxyTrend==="Falling"
                  ? "Aggregate tracked central-bank assets decreased on the available comparison; this is not global M2."
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
                  ? "M2 is higher than the prior connected monthly observation; this is descriptive, not a market-direction signal."
                  : d.macroIndic?.usM2Trend==="Falling"
                  ? "M2 is lower than the prior connected monthly observation; interpretation depends on the broader macro context."
                  : "M2 direction is unavailable from the connected observations."}
              </p>
            </div>

            {/* Industrial Production — official FRED series */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>Industrial Production</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color:d.macroIndic?.industrialProduction==null?C.textDim:d.macroIndic.industrialProduction>0?C.green:d.macroIndic.industrialProduction<0?C.red:C.textMid, marginBottom:2 }}>
                {d.macroIndic?.industrialProduction==null?"—":((d.macroIndic.industrialProduction>0?"+":"")+Number(d.macroIndic.industrialProduction).toFixed(2)+"%")}
              </div>
              <div style={{fontSize:9,color:C.textDim,marginBottom:5}}>{d.macroIndic?.industrialProductionDate?"Observation "+d.macroIndic.industrialProductionDate:"Latest monthly observation unavailable"}</div>
              <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>Monthly percent change in the Federal Reserve Industrial Production Index from FRED. A single monthly move is not treated as a recession or market-timing signal.</p>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background:C.cardAlt, borderRadius:6, padding:10, borderTop:"1px solid " + C.border, marginTop:8, paddingTop:10 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, fontWeight:700 }}>📋 Data Readout</div>
            <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.5 }}>
              This panel separates money supply, central-bank balance sheets and industrial production. These indicators are descriptive macro inputs; none is a standalone equity recommendation or official business-cycle classification.
            </p>
          </div>
        </Card>
      </div>

      {/* ROW 3: F&G + VIX + Inflation */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="🎯" title="Fear & Greed Index" badge={d.fg?.timestamp ? "RETRIEVED" : "UNAVAILABLE"} bc={d.fg?.timestamp ? C.green : C.textDim} />
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
            {d.fg?.score != null && isFinite(Number(d.fg.score)) && <div style={{ position:"absolute", width:7, height:11, background:C.text, top:-3, left:Math.min(100,Math.max(0,Number(d.fg.score))) + "%", transform:"translateX(-50%)", borderRadius:2 }} />}
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
              {d.fg?.cryptoScore != null && <div style={{ position:"absolute", width:7, height:9, background:C.text, top:-2, left:d.fg.cryptoScore + "%", transform:"translateX(-50%)", borderRadius:2 }} />}
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="📉" title="VIX (Volatility)" badge={d.vix?.price!=null&&d.vix?.price!=="—"?"CONNECTED":"UNAVAILABLE"} bc={d.vix?.price!=null&&d.vix?.price!=="—"?C.green:C.textDim} />
          <div>
            <div style={{ fontSize:32, fontWeight:700, fontFamily:font, marginBottom:3, color:d.vix?.price!=null&&d.vix?.price!=="—"?C.text:C.textDim }}>{d.vix?.price||"—"}</div>
            <div style={{ fontSize:12, color:d.vix?.changePct!=null&&d.vix?.changePct!=="—"?(String(d.vix?.changePct).startsWith("-")?C.green:C.red):C.textDim, fontFamily:font, marginBottom:12 }}>{d.vix?.changePct!=null&&d.vix?.changePct!=="—"?((Number(d.vix.changePct)>=0?"+":"")+Number(d.vix.changePct).toFixed(2)+"%") : "Change unavailable"}</div>
          </div>
          {d.vix?.level&&d.vix.level!=="—" ? <div style={{ background:(d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow)+"18", border:"1px solid " + (d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow) + "38", borderRadius:6, padding:"8px 11px", marginBottom:10 }}>
            <span style={{ color:d.vix?.level==="HIGH"||d.vix?.level==="EXTREME"?C.orange:d.vix?.level==="LOW"?C.green:C.yellow, fontWeight:700, fontSize:13 }}>{d.vix?.level}</span>
            <span style={{ color:C.textMid, fontSize:11, marginLeft:10 }}>{d.vix?.note}</span>
          </div> : <div style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:6,padding:"8px 11px",marginBottom:10,color:C.textDim,fontSize:11}}>Volatility feed unavailable.</div>}
 
          <div style={{ fontSize:11, color:C.textDim }}>Fear gauge: &lt;15 low · 15-25 moderate · 25-35 high · &gt;35 extreme</div>
        </Card>

        <Card>
          <SecTitle icon="🌡" title="Inflation" badge={d.inflation?.trend} bc={d.inflation?.trend==="Falling"?C.green:d.inflation?.trend==="Rising"?C.red:C.yellow} />
          {false ? <Skel w="55%" h={29} mb={4} /> : <div style={{ fontSize:29, fontWeight:700, fontFamily:font, marginBottom:2 }}>{d.inflation?.cpi!=null&&d.inflation?.cpi!=="—"?d.inflation.cpi+"%":"—"}</div>}
          <div style={{ fontSize:11, color:C.textDim, marginBottom:10 }}>CPI YoY (official rate)</div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:12, color:C.textMid }}>10Y Breakeven Inflation</span>
            <span style={{ fontSize:12, fontFamily:font }}>{d.inflation?.breakeven != null ? d.inflation.breakeven+"%" : "—"}</span>
          </div>
          <div style={{ background:C.blue+"10", border:"1px solid "+C.blue+"28", borderRadius:4, padding:"5px 8px", marginBottom:9, textAlign:"center" }}>
            <span style={{ fontSize:10, color:C.textMid }}>Breakeven = market-implied average CPI inflation over 10 years; it is not a real-time CPI estimate.</span>
          </div>
          <p style={{ fontSize:11, color:C.orange, margin:"0 0 10px", lineHeight:1.5 }}>{d.inflation?.note}</p>
          <div>
            <div style={{ height:6, background:"linear-gradient(90deg," + C.blue + "," + C.green + "," + C.yellow + "," + C.orange + "," + C.red + ")", borderRadius:3, position:"relative", marginBottom:3 }}>
              {d.inflation?.cpi != null && isFinite(parseFloat(d.inflation.cpi)) && <div style={{ position:"absolute", width:9, height:9, background:C.text, border:"2px solid " + C.card, top:-2, left:Math.min(90,Math.max(5,(parseFloat(d.inflation.cpi)/6)*100)) + "%", transform:"translateX(-50%)", borderRadius:"50%" }} />}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim }}><span>Deflation</span><span>2% target</span><span>High</span></div>
          </div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:8 }}>CPI is official BLS inflation; breakevens reflect Treasury market pricing.</div>
        </Card>
      </div>

      {/* ROW 4a: Global Liquidity — full width interactive chart */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, flexWrap:"wrap", gap:14 }}>
          <div style={{ flex:"1 1 auto", minWidth:0 }}>
            <SecTitle icon="💧" title="Central-Bank Balance-Sheet Proxy" badge="PROXY" bc={C.yellow} />
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:120 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>Total</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:font, lineHeight:1, color:C.text }}>${d.liquidity?.total}T</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Tracked central-bank assets</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:150 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>Coverage</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:font, lineHeight:1.2, color:C.text }}>Fed + ECB + BoJ</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Approx. USD conversion</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:100 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>13-Week</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:font, lineHeight:1, color:d.liquidity?.roc13w==null?C.textDim:String(d.liquidity.roc13w).startsWith("-")?C.red:C.green }}>
                  {d.liquidity?.roc13w==null?"—":(String(d.liquidity.roc13w).startsWith("-")?"▼ ":"▲ ")+String(d.liquidity.roc13w).replace("-","")+"%"}
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Rate of change</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:6, padding:"10px 14px", minWidth:100 }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4, textTransform:"uppercase" }}>52-Week</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:font, lineHeight:1, color:d.liquidity?.roc52w==null?C.textDim:String(d.liquidity.roc52w).startsWith("-")?C.red:C.green }}>
                  {d.liquidity?.roc52w==null?"—":(String(d.liquidity.roc52w).startsWith("-")?"▼ ":"▲ ")+String(d.liquidity.roc52w).replace("-","")+"%"}
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
            <div style={{ fontSize:26, fontWeight:700, fontFamily:font, color:d.yield?.status==="INVERTED"?C.red:d.yield?.status==="NORMAL"?C.green:d.yield?.status==="FLAT"?C.orange:C.textDim, marginBottom:4 }}>
              {d.yield?.spread}
            </div>
            <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>
              {d.yield?.status==="INVERTED"
                ? "INVERTED — the 10Y yield is below the 2Y yield. Historically this has been monitored as a recession-risk indicator, but it is not a timing signal by itself."
                : d.yield?.status==="FLAT"
                ? "FLAT — the 10Y and 2Y yields are close together."
                : d.yield?.status==="NORMAL"
                ? "POSITIVE — the 10Y yield is above the 2Y yield."
                : "Yield-curve data unavailable."}
            </p>
          </div>

          <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"10px 12px", maxWidth:250 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.textDim, marginBottom:6 }}>Curve Signal</div>
            <div style={{ fontSize:12, fontWeight:700, color:d.yield?.status==="INVERTED"?C.orange:d.yield?.status==="NORMAL"?C.green:C.textDim }}>{d.yield?.recessionRisk || "—"}</div>
            <p style={{ fontSize:10, color:C.textMid, margin:"7px 0 0", lineHeight:1.45 }}>
              The 10Y–2Y spread is a recession indicator, not a standalone recession probability. No percentage is shown unless a validated probability model is connected.
            </p>
          </div>
        </Card>

        <Card>
          <SecTitle icon="⚠" title="Credit & Stress" badge={(d.credit?.hyDAS!=null||d.credit?.sahmRule!=null) ? "FRED" : "UNAVAILABLE"} bc={(d.credit?.hyDAS!=null||d.credit?.sahmRule!=null) ? C.green : C.textDim} />
          
          {/* HY Spread — live from FRED */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>HY CREDIT SPREAD (OAS)</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:parseInt(d.credit?.hyDAS)>500?C.red:parseInt(d.credit?.hyDAS)>350?C.orange:C.green, marginBottom:4 }}>
              {d.credit?.hyDAS || "—"}<span style={{ fontSize:12, color:C.textDim, fontWeight:400 }}> bp</span>
            </div>
            {d.credit?.hyDAS != null ? <Bar pct={Math.min(100, parseInt(d.credit.hyDAS) / 8)} color={parseInt(d.credit.hyDAS)>500?C.red:parseInt(d.credit.hyDAS)>350?C.orange:C.green} height={4} /> : <div style={{height:4,background:C.border,borderRadius:2}} />}
            <div style={{ fontSize:10, color:C.textMid, marginTop:4 }}>
              {d.credit?.hyDAS == null ? "Unavailable" : parseInt(d.credit.hyDAS)<300 ? "Relatively tight spread" : parseInt(d.credit.hyDAS)>500 ? "Relatively wide spread" : "Mid-range spread"}
            </div>
          </div>

          {/* MOVE Index — shown only when a connected market-stress feed provides it */}
          <div style={{ marginBottom:12, paddingTop:10, borderTop:"1px solid " + C.border }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>MOVE INDEX (BOND VOLATILITY)</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:d.credit?.moveIndex==null?C.textDim:parseFloat(d.credit.moveIndex)>120?C.red:parseFloat(d.credit.moveIndex)>100?C.orange:C.green, marginBottom:4 }}>
              {d.credit?.moveIndex != null ? d.credit.moveIndex : "—"}
            </div>
            <div style={{ fontSize:10, color:C.textMid }}>
              {d.credit?.moveIndex==null ? "Unavailable — no validated MOVE feed is connected" : parseFloat(d.credit.moveIndex)>120 ? "High bond-volatility reading" : parseFloat(d.credit.moveIndex)>100 ? "Elevated bond-volatility reading" : "Lower bond-volatility reading"}
            </div>
          </div>

          {/* Sahm Rule — live from FRED when available */}
          <div style={{ paddingTop:10, borderTop:"1px solid " + C.border }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:4 }}>SAHM RULE RECESSION INDICATOR</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
              <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:d.credit?.sahmRule==null?C.textDim:parseFloat(d.credit.sahmRule)>=0.5?C.red:parseFloat(d.credit.sahmRule)>=0.3?C.orange:C.green }}>
                {d.credit?.sahmRule != null ? d.credit.sahmRule : "—"}
              </div>
              <Badge label={d.credit?.sahmRule==null?"UNAVAILABLE":parseFloat(d.credit.sahmRule)>=0.5?"TRIGGERED":parseFloat(d.credit.sahmRule)>=0.3?"ELEVATED":"BELOW TRIGGER"} color={d.credit?.sahmRule==null?C.textDim:parseFloat(d.credit.sahmRule)>=0.5?C.red:parseFloat(d.credit.sahmRule)>=0.3?C.orange:C.green} />
            </div>
            <div style={{ fontSize:10, color:C.textMid, lineHeight:1.4 }}>
              {d.credit?.sahmRule==null ? "No Sahm Rule reading is currently loaded." : "The commonly used Sahm Rule trigger is 0.50 percentage points; the displayed value is an indicator, not a guarantee of recession."}
            </div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="📊" title="Market Breadth" badge={d.breadth?.pct50!=null||d.breadth?.pct200!=null ? "CONNECTED" : "UNAVAILABLE"} bc={d.breadth?.pct50!=null||d.breadth?.pct200!=null ? C.green : C.textDim} />
          {d.breadth?.pct50==null && d.breadth?.pct200==null ? (
            <div style={{minHeight:235,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:18,color:C.textDim,fontSize:11,lineHeight:1.6}}>
              Breadth values are withheld because no validated breadth feed is connected. This panel will not infer breadth from index returns or substitute stale values.
            </div>
          ) : <>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                <div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:2 }}>SHORT TERM · % ABOVE 50-DAY MA</div>
                  <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:d.breadth?.pct50==null?C.textDim:parseFloat(d.breadth.pct50)<40?C.red:parseFloat(d.breadth.pct50)<60?C.orange:C.green }}>{d.breadth?.pct50!=null?Number(d.breadth.pct50).toFixed(1)+"%":"—"}</div>
                </div>
                <div style={{ textAlign:"right", fontSize:10, color:C.textMid }}>
                  {d.breadth?.pct50==null?"Unavailable":parseFloat(d.breadth.pct50)<40?"Narrow participation":parseFloat(d.breadth.pct50)<60?"Mixed participation":"Broad participation"}
                </div>
              </div>
              {d.breadth?.pct50!=null && <Bar pct={Number(d.breadth.pct50)} color={parseFloat(d.breadth.pct50)<40?C.red:parseFloat(d.breadth.pct50)<60?C.orange:C.green} height={6} />}
              <div style={{fontSize:9,color:C.textDim,marginTop:5}}>Share of a diversified tracked ETF universe above its 50-day moving average{d.breadth?.sample?" ("+d.breadth.sample+" usable ETFs)":""}.</div>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                <div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:2 }}>LONG TERM · % ABOVE 200-DAY MA</div>
                  <div style={{ fontSize:24, fontWeight:700, fontFamily:font, color:d.breadth?.pct200==null?C.textDim:parseFloat(d.breadth.pct200)<40?C.red:parseFloat(d.breadth.pct200)<60?C.orange:C.green }}>{d.breadth?.pct200!=null?Number(d.breadth.pct200).toFixed(1)+"%":"—"}</div>
                </div>
                <div style={{ textAlign:"right", fontSize:10, color:C.textMid }}>
                  {d.breadth?.pct200==null?"Unavailable":parseFloat(d.breadth.pct200)<40?"Narrow long-term participation":parseFloat(d.breadth.pct200)<60?"Mixed long-term participation":"Broad long-term participation"}
                </div>
              </div>
              {d.breadth?.pct200!=null && <Bar pct={Number(d.breadth.pct200)} color={parseFloat(d.breadth.pct200)<40?C.red:parseFloat(d.breadth.pct200)<60?C.orange:C.green} height={6} />}
              <div style={{fontSize:9,color:C.textDim,marginTop:5}}>Share of a diversified tracked ETF universe above its 200-day moving average. This is a proxy, not full S&P 500 constituent breadth.</div>
            </div>

            <div style={{ background:C.cardAlt, borderRadius:6, padding:"9px 10px", fontSize:10, color:C.textMid, lineHeight:1.5 }}>
              <strong style={{color:C.text}}>Breadth interpretation:</strong> {d.breadth?.sentiment==="NARROW"?"Participation is relatively narrow on the connected measure.":d.breadth?.sentiment==="BROAD"?"Participation is relatively broad on the connected measure.":"The connected measures are mixed."} Breadth is descriptive and is not a standalone market-direction forecast.
            </div>
          </>}
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
            <Badge label={d.options?.dexPCR!=null ? "CONNECTED" : "UNAVAILABLE"} color={d.options?.dexPCR!=null ? C.green : C.textDim} />
            <Badge label={d.options?.status||"UNAVAILABLE"} color={d.options?.dexPCR==null?C.textDim:parseFloat(d.options.dexPCR)>1.3?C.red:parseFloat(d.options.dexPCR)<0.7?C.green:C.textMid} />
          </div>
        </div>

        <div style={{ textAlign:"center", marginBottom:14 }}>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:6 }}>CBOE TOTAL PUT/CALL RATIO</div>
          <div style={{ fontSize:38, fontWeight:700, fontFamily:font, color:parseFloat(d.options?.dexPCR)>1.1?C.red:parseFloat(d.options?.dexPCR)<0.7?C.green:C.orange }}>
            {d.options?.dexPCR || "—"}
          </div>
          <div style={{ fontSize:11, color:C.textMid, marginTop:4 }}>
            {d.options?.dexPCR == null ? "Unavailable" : parseFloat(d.options.dexPCR) > 1.1 ? "High put volume relative to calls" 
              : parseFloat(d.options.dexPCR) < 0.7 ? "Low put volume relative to calls"
              : "Put/call activity near the middle of the displayed range"}
          </div>
        </div>

        <div style={{ height:6, background:"linear-gradient(90deg," + C.green + "," + C.yellow + "," + C.red + ")", borderRadius:3, position:"relative", marginBottom:4 }}>
          {d.options?.dexPCR != null && isFinite(parseFloat(d.options.dexPCR)) && <div style={{ position:"absolute", width:8, height:12, background:C.text, top:-3, left:Math.min(95, Math.max(5, (parseFloat(d.options.dexPCR) - 0.5) / 1.0 * 100)) + "%", transform:"translateX(-50%)", borderRadius:2 }} />}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim, marginBottom:12 }}><span>Lower put/call (0.5)</span><span>1.0</span><span>Higher put/call (1.5)</span></div>

        <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", fontSize:10, color:C.textDim, lineHeight:1.5 }}>
          Put/call ratio compares put-option volume with call-option volume. Higher readings indicate more put activity relative to calls, but interpretation is contextual and is not a standalone market-direction signal.
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
            {d.fci?.nfci != null && isFinite(parseFloat(d.fci.nfci)) && <div style={{ position:"absolute", width:8, height:12, background:C.text, top:-3, left:Math.min(95, Math.max(5, 50 + parseFloat(d.fci.nfci) * 50)) + "%", transform:"translateX(-50%)", borderRadius:2 }} />}
          </div>
        </div>

        <div style={{ fontSize:11, color:C.textMid, lineHeight:1.6, marginBottom:12 }}>
          {d.fci?.nfci == null ? "NFCI unavailable from the connected feed."
            : d.fci?.status==="Loose" 
            ? "The NFCI is below its historical average, indicating comparatively looser financial conditions across the index's component measures."
            : d.fci?.status==="Tight"
            ? "The NFCI is above its historical average, indicating comparatively tighter financial conditions across the index's component measures."
            : "The NFCI is near its historical average."}
        </div>

        <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", fontSize:10, color:C.textDim, lineHeight:1.5 }}>
          The Chicago Fed NFCI summarizes a broad set of money-market, debt, equity, banking and shadow-banking indicators. Negative readings are looser than the historical average; positive readings are tighter. It is not a direct equity-market forecast.
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
                ? "The effective federal funds rate is below the prior connected reading, which the dashboard labels as easing." 
                : d.rates?.status==="TIGHTENING" 
                ? "The effective federal funds rate is above the prior connected reading, which the dashboard labels as tightening."
                : "The effective federal funds rate is unchanged versus the prior connected reading; this does not imply a forecast of the next FOMC decision."}
            </p>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>CURRENT FED FUNDS RATE</div>
            <div style={{ fontSize:30, fontWeight:700, fontFamily:font, marginBottom:6 }}>{d.rates?.current!=null&&d.rates?.current!=="—"?d.rates.current+"%":"—"}</div>
            <p style={{ fontSize:11, color:C.textDim, margin:0, lineHeight:1.5 }}>Effective federal funds rate from the connected macro feed</p>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>DIRECTION</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:(d.rates?.status==="EASING"?C.green:d.rates?.status==="TIGHTENING"?C.red:C.yellow)+"20", border:"1px solid " + (d.rates?.status==="EASING"?C.green:d.rates?.status==="TIGHTENING"?C.red:C.yellow) + "44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{d.rates?.status==="EASING"?"↘":d.rates?.status==="TIGHTENING"?"↗":"→"}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:d.rates?.status==="EASING"?C.green:d.rates?.status==="TIGHTENING"?C.red:C.yellow }}>
                  {d.rates?.status==="EASING" ? "Recent rate lower" : d.rates?.status==="TIGHTENING" ? "Recent rate higher" : d.rates?.status==="UNCHANGED" ? "Unchanged" : "Direction unavailable"}
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Trend</div>
              </div>
            </div>
          </div>

          <div style={{ borderLeft:"1px solid " + C.border, paddingLeft:14 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6, letterSpacing:1 }}>FORWARD POLICY PRICING</div>
            <div style={{ fontSize:30, fontWeight:700, fontFamily:font, marginBottom:8 }}>{d.rates?.expected != null ? d.rates.expected+"%" : "—"}</div>
            <div style={{ fontSize:11, color:C.textMid, background:C.cardAlt, padding:"6px 10px", borderRadius:4, lineHeight:1.4 }}>
              {d.rates?.expected != null ? (d.rates.forwardLabel||"Front-month Fed Funds futures implied monthly average")+". This is not a next-meeting probability." : "Not shown: no validated Fed-funds futures / OIS pricing feed is connected."}
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
              <div style={{ fontSize:10, color:C.textDim }}>Connected ETF return feed · 1W/1M/3M/6M momentum</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {d.sectorTimestamp ? (
              <Badge label="CONNECTED" color={C.green} />
            ) : (
              <Badge label={d.fci?.nfci!=null ? "FRED" : "UNAVAILABLE"} color={d.fci?.nfci!=null ? C.green : C.textDim} />
            )}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7, marginBottom:16 }}>
          {(d.sectorRotation||[]).map(function(pair, i) {
            var bg = pair.bull===true ? C.cyan+"12" : pair.bull===false ? C.purple+"12" : C.cardAlt;
            var border = pair.bull===true ? "1px solid " + C.cyan + "44" : pair.bull===false ? "1px solid " + C.purple + "44" : "1px solid " + C.border;
            var dotColor = pair.bull===true ? C.cyan : pair.bull===false ? C.purple : C.textDim;
            var winnerColor = pair.bull===true ? C.cyan : pair.bull===false ? C.purple : C.textMid;
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
          <span style={{ color:C.textDim }}>Pair leadership:</span>
          <span style={{ color:C.cyan }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===true}).length} first-ETF leads</span>
          <span style={{ color:C.purple }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===false}).length} second-ETF leads</span>
          <span style={{ color:C.textMid }}>{(d.sectorRotation||[]).filter(function(p){return p.bull===null}).length} mixed / insufficient</span>
          <span style={{ fontSize:9, color:C.textDim }}>Relative momentum only — not a market-direction probability.</span>
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
                    return <td key={j} style={{ textAlign:"center", padding:"7px 8px" }}><span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:w==="g"?C.cyan:w==="r"?C.purple:w==="n"?C.textDim:"transparent",border:w==="u"?"1px solid "+C.textDim:"none" }} /></td>;
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
              <span style={{ color:C.purple }}>Second ETF leading</span>
              <span style={{ color:C.cyan }}>First ETF leading</span>
              <span style={{ color:C.textDim, marginLeft:20 }}>LEAD SHARE</span>
            </div>
          </div>
          {(d.sectorRotation||[]).map(function(pair, i) {
            var leadShare = pair.leadShare!=null?Number(pair.leadShare):null;
            var barW = leadShare==null?0:Math.min(48,Math.max(0,Math.round((leadShare-50)*0.96)));
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
                  {pair.bull===true && <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:barW + "%", background:C.cyan, borderRadius:"0 4px 4px 0" }} />}
                  {pair.bull===false && <div style={{ position:"absolute", right:"50%", top:0, bottom:0, width:barW + "%", background:C.purple, borderRadius:"4px 0 0 4px" }} />}
                  {pair.bull===null && <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:6, height:6, borderRadius:"50%", background:C.textDim }} />}
                </div>
                <div style={{ width:55, textAlign:"right", flexShrink:0 }}>
                  <span style={{ fontSize:13, fontFamily:font, fontWeight:700, color:pair.bull===true?C.cyan:pair.bull===false?C.purple:C.textMid }}>{pair.leadShare!=null?pair.leadShare+"%":"—"}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:9,color:C.textDim,marginTop:8}}>Lead share is the percentage of usable 1W/1M/3M/6M windows won by the displayed leading ETF. It is not a forecast, confidence score, or probability.</div>
      </Card>

      {/* TOP SECTORS */}
      <Card>
        <SecTitle icon="📋" title="Top Sectors (6M Price Returns)" badge={d.sectorTimestamp ? "CONNECTED" : "UNAVAILABLE"} bc={d.sectorTimestamp ? C.green : C.textDim} />
        <div style={{ fontSize:11, color:C.textDim, marginBottom:12 }}>Top 5 performing sectors by 6-month price return from the connected ETF feed</div>
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

/* ─── MODEL PORTFOLIO HOLDINGS ─── */
var PORTFOLIO_HOLDINGS = [
  { ticker:"AVGO", name:"Broadcom Inc.", sector:"Technology", weight:10, qty:24, sleeve:"Core", cap:null, assetClass:"Equity", themes:["AI Chips","Custom Silicon"], costBasis:208.33 },
  { ticker:"VST",  name:"Vistra Corp.", sector:"Utilities", weight:10, qty:56, sleeve:"Strategic", cap:null, assetClass:"Equity", themes:["Nuclear","AI Power"], costBasis:89.29 },
  { ticker:"MSFT", name:"Microsoft Corp.", sector:"Technology", weight:8, qty:10, sleeve:"Core", cap:null, assetClass:"Equity", themes:["Cloud","AI Infrastructure"], costBasis:400.00 },
  { ticker:"LLY",  name:"Eli Lilly & Co.", sector:"Healthcare", weight:8, qty:5, sleeve:"Core", cap:null, assetClass:"Equity", themes:["GLP-1","Obesity"], costBasis:800.00 },
  { ticker:"AMZN", name:"Amazon.com Inc.", sector:"Consumer Discretionary", weight:7, qty:18, sleeve:"Core", cap:null, assetClass:"Equity", themes:["AWS","E-Commerce"], costBasis:194.44 },
  { ticker:"META", name:"Meta Platforms", sector:"Communication Services", weight:7, qty:6, sleeve:"Core", cap:null, assetClass:"Equity", themes:["Ads","Llama AI"], costBasis:583.33 },
  { ticker:"GOOGL",name:"Alphabet Inc.", sector:"Communication Services", weight:6, qty:18, sleeve:"Core", cap:null, assetClass:"Equity", themes:["Search","Cloud"], costBasis:166.67 },
  { ticker:"CEG",  name:"Constellation Energy", sector:"Utilities", weight:6, qty:13, sleeve:"Strategic", cap:null, assetClass:"Equity", themes:["Nuclear","Data Centers"], costBasis:230.77 },
  { ticker:"GLD",  name:"SPDR Gold Trust", sector:"Commodities", weight:5, qty:10, sleeve:"Strategic", cap:null, assetClass:"Gold", themes:["Gold","Safe Haven"], costBasis:250.00 },
  { ticker:"XOM",  name:"Exxon Mobil Corp.", sector:"Energy", weight:5, qty:22, sleeve:"Strategic", cap:null, assetClass:"Equity", themes:["Oil","Dividends"], costBasis:113.64 },
  { ticker:"UNH",  name:"UnitedHealth Group", sector:"Healthcare", weight:5, qty:5, sleeve:"Core", cap:null, assetClass:"Equity", themes:["Insurance","Optum"], costBasis:500.00 },
  { ticker:"NVDA", name:"Nvidia Corp.", sector:"Technology", weight:5, qty:22, sleeve:"Strategic", cap:null, assetClass:"Equity", themes:["AI GPUs","Data Center"], costBasis:113.64 },
  { ticker:"AU",   name:"AngloGold Ashanti", sector:"Materials", weight:4, qty:69, sleeve:"Speculative", cap:null, assetClass:"Equity", themes:["Gold Mining","EM"], costBasis:28.99 },
  { ticker:"PLTR", name:"Palantir Technologies", sector:"Technology", weight:4, qty:18, sleeve:"Speculative", cap:null, assetClass:"Equity", themes:["Defense AI","Gov Tech"], costBasis:111.11 },
  { ticker:"FCX",  name:"Freeport-McMoRan", sector:"Materials", weight:4, qty:48, sleeve:"Speculative", cap:null, assetClass:"Equity", themes:["Copper","EV Metals"], costBasis:41.67 },
];
var PORTFOLIO_INCEPTION = "2026-04-01";
var PORTFOLIO_CASH = 3000; // 6% cash reserve

/* ─── RULE-BASED TECHNICAL SETUP / EXTENSION CLASSIFICATION ─── */
function detectPattern(h) {
  if (!h.ma50 || !h.ma200 || !h.price) return "—";
  var abv50 = h.price > h.ma50, abv200 = h.price > h.ma200;
  if (abv50 && abv200 && h.zScore > 1.5 && h.rsi > 65) return "Extended Uptrend";
  if (!abv50 && !abv200 && h.zScore < -1.5 && h.rsi < 35) return "Oversold Downtrend";
  if (!abv50 && abv200 && h.rsi > 40 && h.rsi < 55) return "Pullback >200D";
  if (abv50 && !abv200 && h.maDev > 0) return "Recovery Attempt";
  return "No Setup";
}
function detectExtensionState(h) {
  // Simple price-extension classifier only; no bubble/crash model is implied.
  if (h.zScore == null) return "—";
  if (h.zScore > 2.5) return "Very Extended";
  if (h.zScore > 2.0) return "Extended";
  if (h.zScore < -2.0) return "Deeply Depressed";
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
function PortfolioStage({ d }) {
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
  var _sig = useState(null);
  var signalHolding = _sig[0], setSignalHolding = _sig[1];
  var _sdx = useState({});
  var signalData = _sdx[0], setSignalData = _sdx[1];
  var _st = useState(null);
  var selectedTicker = _st[0], setSelectedTicker = _st[1];
  var chartRef = useState(null);

  var regime = d?.macroRegime?.season || "Unclassified";

  useEffect(function() {
    (async function() {
      setLoading(true);
      try {
        var tickers = PORTFOLIO_HOLDINGS.map(function(h){return h.ticker}).join(",");
        var res = await fetch(PORTFOLIO_URL + "?tickers=" + tickers);
        var json = await res.json();
        var merged = PORTFOLIO_HOLDINGS.map(function(h) {
          var d = json.holdings && json.holdings[h.ticker];
          if (!d || d.error) return { ...h, price:null, ma50:null, ma200:null, rsi:null, tq:null, zScore:null, r6m:null, maDev:null, trend:"—", phase:"—", action:"—", pattern:"—", extension:"—", value:null };
          var merged = { ...h, ...d };
          var marketCapForBucket=Number(d.marketCap);
          merged.cap=Number.isFinite(marketCapForBucket)&&marketCapForBucket>0?(marketCapForBucket>=1e10?"Large":marketCapForBucket>=2e9?"Mid":"Small"):null;
          merged.pattern = detectPattern(merged);
          merged.extension = detectExtensionState(merged);
          merged.value = d.price != null ? d.price * h.qty : null;
          merged.pnl = d.price != null ? (d.price - h.costBasis) * h.qty : null;
          merged.pnlPct = d.price != null && h.costBasis ? ((d.price / h.costBasis - 1) * 100) : null;
          return merged;
        });
        setHoldings(merged);
      } catch(e) {
        setError(e.message);
        setHoldings(PORTFOLIO_HOLDINGS.map(function(h){return { ...h, price:null, trend:"—", phase:"—", action:"—", pattern:"—", extension:"—", value:null, pnl:null, pnlPct:null }}));
      }
      setLoading(false);
    })();
  }, []);

  // Deterministic technical bull/bear summary. This avoids presenting generated
  // unverified web research as company fundamentals and does not require AI API credits.
  function buildSignalSummary(ticker) {
    if (signalData[ticker]) { setSignalHolding(ticker); return; }
    setSignalHolding(ticker);
    var h=holdings.find(function(x){return x.ticker===ticker});
    if(!h)return;
    var positives=[]; var risks=[]; var score=5;
    if(h.trend==="Bullish"){positives.push("bullish trend");score+=1;} else if(h.trend==="Bearish"){risks.push("bearish trend");score-=1;}
    if(h.r6m!=null){if(h.r6m>15){positives.push("strong 6M momentum ("+Number(h.r6m).toFixed(1)+"%)");score+=1;}else if(h.r6m<0){risks.push("negative 6M momentum ("+Number(h.r6m).toFixed(1)+"%)");score-=1;}}
    if(h.rsi!=null){if(h.rsi>=70){risks.push("overbought RSI "+Number(h.rsi).toFixed(0));score-=1;}else if(h.rsi>=45&&h.rsi<=65){positives.push("balanced RSI "+Number(h.rsi).toFixed(0));}}
    if(h.price&&h.ma200){if(h.price>h.ma200)positives.push("price above 200-day MA");else risks.push("price below 200-day MA");}
    score=Math.max(1,Math.min(10,score));
    var parsed={
      bull: positives.length ? "Technical positives: "+positives.join(", ")+". These signals support the position if the trend persists; they do not incorporate unverified fundamental claims." : "No strong technical bull cluster is currently confirmed by the connected indicators.",
      bear: risks.length ? "Technical risks: "+risks.join(", ")+". A break in trend or further momentum deterioration would increase downside risk." : "No major technical risk cluster is currently confirmed by the connected indicators.",
      score:score,
      method:"rule-based"
    };
    setSignalData(function(prev){var n={...prev};n[ticker]=parsed;return n;});
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
  var connectedHoldings = holdings.filter(function(h){return h.price!=null&&h.value!=null;});
  var totalValue = connectedHoldings.reduce(function(s,h){return s+Number(h.value||0)},0) + PORTFOLIO_CASH;
  var totalPnL = connectedHoldings.reduce(function(s,h){return s+Number(h.pnl||0)},0);
  var totalCostBasis = connectedHoldings.reduce(function(s,h){return s+Number(h.costBasis||0)*Number(h.qty||0)},0);
  var totalPnLPct = totalCostBasis > 0 ? totalPnL / totalCostBasis * 100 : null;
  var priceCoverage = holdings.length ? Math.round(connectedHoldings.length/holdings.length*100) : 0;
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
  var capCoverageWeight=capWeights.Large+capWeights.Mid+capWeights.Small;

  var trendColor = function(t) { return t==="Bullish"?C.green:t==="Bearish"?C.red:C.textMid; };
  var actionColor = function(a) { return a==="Hold"?C.green:a==="Scale Out"?C.orange:a==="Close"?C.red:C.textDim; };
  var actionBg = function(a) { return a==="Hold"?C.green+"22":a==="Scale Out"?C.orange+"22":a==="Close"?C.red+"22":C.cardAlt; };
  var actionLabel = function(a) { return a==="Hold"?"Maintain":a==="Scale Out"?"Review Reduce":a==="Close"?"Review Exit":a||"—"; };

  var thS = { textAlign:"left", padding:"7px 5px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", userSelect:"none", borderBottom:"1px solid "+C.border, whiteSpace:"nowrap", position:"sticky", top:0, background:C.card, zIndex:1 };
  var tdS = { padding:"6px 5px", fontSize:11, borderBottom:"1px solid "+C.border, whiteSpace:"nowrap" };
  var rightCols = ["price","ma50","ma200","rsi","tq","zScore","r6m","weight","maDev","qty","pnlPct"];

  var cols = [
    {key:"ticker",label:"TICKER",w:60},{key:"name",label:"ASSET",w:120},{key:"sector",label:"SECTOR",w:80},
    {key:"themes",label:"THEMES",w:130},
    {key:"maDev",label:"MA DEV",w:60},{key:"qty",label:"QTY",w:40},{key:"price",label:"PRICE",w:68},
    {key:"ma50",label:"50 DMA",w:62},{key:"ma200",label:"200 DMA",w:62},{key:"trend",label:"TREND",w:65},
    {key:"phase",label:"PHASE",w:85},{key:"action",label:"MODEL FLAG",w:75},{key:"rsi",label:"RSI",w:38},
    {key:"tq",label:"TQ (FEED)",w:58},{key:"zScore",label:"PRICE Z",w:55},{key:"r6m",label:"6M",w:48},
    {key:"pnlPct",label:"P&L",w:50},
    {key:"pattern",label:"SETUP",w:92},{key:"extension",label:"EXTENSION",w:78},
    {key:"sig",label:"SIG",w:30},
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{fontSize:10,color:C.textDim}}>Illustrative model portfolio · fixed sample holdings, quantities and cost bases · connected prices update market value and rule-based technical signals.</div>

      {/* SUMMARY ROW */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:10 }}>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>CONNECTED VALUE</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font }}>${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{priceCoverage}% connected-price coverage · sample portfolio</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>CONNECTED P&L</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:totalCostBasis>0?(totalPnL>=0?C.green:C.red):C.textDim }}>{totalCostBasis>0?((totalPnL>=0?"+":"")+"$"+Math.abs(totalPnL).toLocaleString(undefined,{maximumFractionDigits:0})):"—"}</div>
          <div style={{ fontSize:10, color:totalPnLPct==null?C.textDim:(totalPnLPct>=0?C.green:C.red), marginTop:2 }}>{totalPnLPct==null?"—":(totalPnLPct>=0?"+":"")+totalPnLPct.toFixed(2)+"% since cost basis"}</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>CASH RESERVE</div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:font }}>${PORTFOLIO_CASH.toLocaleString()}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{totalValue>0?(PORTFOLIO_CASH/totalValue*100).toFixed(1)+"% of connected value":"—"}</div>
        </Card>
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.2, marginBottom:4 }}>SIGNALS</div>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.green }}>{holdCount}</span><div style={{ fontSize:9, color:C.textDim }}>Maintain</div></div>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.orange }}>{scaleCount}</span><div style={{ fontSize:9, color:C.textDim }}>Review reduce</div></div>
            <div><span style={{ fontSize:18, fontWeight:700, color:C.red }}>{closeCount}</span><div style={{ fontSize:9, color:C.textDim }}>Review exit</div></div>
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
          <div style={{ fontSize:10, color:C.textMid }}>{holdings.length} positions · Click row for chart · Signal column for rules-based analysis · TQ is an upstream feed field and is not used as a fundamental-quality score</div>
        </div>
        <div style={{ overflowX:"auto", maxHeight:520, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1500 }}>
            <thead>
              <tr>
                {cols.map(function(col) {
                  var isRight = rightCols.indexOf(col.key) >= 0;
                  return <th key={col.key} onClick={function(){if(col.key!=="sig"&&col.key!=="themes")doSort(col.key)}} style={{ ...thS, width:col.w, textAlign:isRight?"right":"left" }}>{col.label}{sortCol===col.key?(sortDir>0?" ↑":" ↓"):""}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length} style={{ padding:40, textAlign:"center", color:C.textDim }}><Spinner size={16} /> Loading portfolio data...</td></tr>
              ) : sorted.map(function(h, i) {
                var mc = h.maDev==null?C.textDim:h.maDev>0?C.green:C.red;
                var patColor = h.pattern==="Pullback >200D"||h.pattern==="Recovery Attempt"?C.green:h.pattern==="Extended Uptrend"?C.orange:h.pattern==="Oversold Downtrend"?C.red:C.textDim;
                var lpColor = h.extension==="Very Extended"?C.red:h.extension==="Extended"?C.orange:h.extension==="Deeply Depressed"?C.cyan:C.textDim;
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
                    <td style={tdS}><span style={{ background:actionBg(h.action), color:actionColor(h.action), padding:"2px 6px", borderRadius:3, fontSize:9, fontWeight:700 }}>{actionLabel(h.action)}</span></td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.rsi!=null&&(h.rsi>70||h.rsi<30)?C.orange:C.text }}>{h.rsi||"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textMid }}>{h.tq!=null?h.tq.toFixed(1):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.zScore!=null&&Math.abs(h.zScore)>2?C.orange:C.textMid }}>{h.zScore!=null?(h.zScore>0?"+":"")+h.zScore.toFixed(2):"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.r6m>0?C.green:C.red }}>{h.r6m!=null?(h.r6m>0?"+":"")+h.r6m+"%":"—"}</td>
                    <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.pnlPct>0?C.green:h.pnlPct<0?C.red:C.textMid }}>{h.pnlPct!=null?(h.pnlPct>0?"+":"")+h.pnlPct.toFixed(1)+"%":"—"}</td>
                    <td style={{ ...tdS, fontSize:9, fontWeight:600, color:patColor }}>{h.pattern}</td>
                    <td style={{ ...tdS, fontSize:9, color:lpColor }}>{h.extension}</td>
                    <td style={tdS}>
                      <button onClick={function(){buildSignalSummary(h.ticker)}} style={{ background:signalData[h.ticker]?C.purple+"33":C.cardAlt, border:"1px solid "+(signalData[h.ticker]?C.purple:C.border), borderRadius:3, color:signalData[h.ticker]?C.purple:C.textDim, fontSize:9, padding:"2px 5px", cursor:"pointer", fontWeight:700 }}>SIG</button>
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

      {/* RULE-BASED SIGNAL ANALYSIS */}
      {signalHolding && (
        <Card style={{ border:"1px solid "+C.purple+"44" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.purple }}>🧭 Signal Analysis: {signalHolding}</div>
            <button onClick={function(){setSignalHolding(null)}} style={{ background:"transparent", border:"1px solid "+C.border, borderRadius:4, color:C.textDim, padding:"2px 8px", cursor:"pointer", fontSize:10 }}>✕ Close</button>
          </div>
          {signalData[signalHolding] ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:C.green+"10", border:"1px solid "+C.green+"30", borderRadius:6, padding:10 }}>
                <div style={{ fontSize:10, color:C.green, fontWeight:700, marginBottom:6 }}>🐂 BULL CASE</div>
                <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>{signalData[signalHolding].bull}</div>
              </div>
              <div style={{ background:C.red+"10", border:"1px solid "+C.red+"30", borderRadius:6, padding:10 }}>
                <div style={{ fontSize:10, color:C.red, fontWeight:700, marginBottom:6 }}>🐻 BEAR CASE</div>
                <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>{signalData[signalHolding].bear}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:20, color:C.textDim }}><Spinner size={14} /> Building signal analysis for {signalHolding}...</div>
          )}
        </Card>
      )}

      {/* PORTFOLIO BALANCE */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
            <span>📊</span> Model Allocation Policy
            <Badge label={regime.toUpperCase()} color={SC[regime]||C.gold} />
            {closeCount>0 && <Badge label={closeCount+" Issues"} color={C.red} />}
          </div>
        </div>

        {/* Sleeve Allocation */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>MODEL SLEEVE WEIGHTS</div>
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
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>Lower-turnover model sleeve intended for larger, more established positions. Classification is illustrative.</div>
            </div>
            <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", borderTop:"2px solid "+C.orange }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.orange }}>Strategic</span>
                <span style={{ fontFamily:font, fontSize:14, fontWeight:700 }}>{sleeveWeights.Strategic}%</span>
              </div>
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>Model sleeve for thematic or cycle-sensitive positions. Classification is illustrative.</div>
            </div>
            <div style={{ background:C.cardAlt, borderRadius:6, padding:"8px 10px", borderTop:"2px solid "+C.red }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.red }}>Speculative</span>
                <span style={{ fontFamily:font, fontSize:14, fontWeight:700 }}>{sleeveWeights.Speculative}%</span>
              </div>
              <div style={{ fontSize:9, color:C.textDim, lineHeight:1.4 }}>Higher-risk model sleeve used to separate speculative exposure from core positions. Classification is illustrative.</div>
            </div>
          </div>
        </div>

        {/* Asset Class Weights */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>MODEL ASSET-CLASS WEIGHTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 45px 45px 55px", gap:"5px 8px", alignItems:"center" }}>
            <div style={{ fontSize:9, color:C.textDim }}>Class</div><div /><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Model Wt</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Demo Policy</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Dev</div>
            {[{name:"Equity",target:88},{name:"Gold",target:5},{name:"Commodities",target:5}].map(function(ac) {
              var current = assetClassWeights[ac.name]||0;
              var dev = current - ac.target;
              return [
                <div key={ac.name+"l"} style={{ fontSize:11, color:C.text }}>{ac.name}</div>,
                <div key={ac.name+"b"} style={{ height:5, background:C.border, borderRadius:3 }}><div style={{ width:current+"%", height:"100%", background:Math.abs(dev)>5?C.orange:C.green, borderRadius:3, opacity:0.7 }} /></div>,
                <span key={ac.name+"c"} style={{ textAlign:"right", fontFamily:font, fontSize:11, fontWeight:700 }}>{current}%</span>,
                <span key={ac.name+"t"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>{ac.target}%</span>,
                <span key={ac.name+"d"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:Math.abs(dev)>5?C.red:Math.abs(dev)>2?C.orange:C.textMid }}>{dev>0?"+":""}{dev}pp</span>,
              ];
            })}
          </div>
        </div>

        {/* Sector Weights */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>MODEL SECTOR WEIGHTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 45px 45px 55px", gap:"5px 8px", alignItems:"center" }}>
            <div style={{ fontSize:9, color:C.textDim }}>Sector</div><div /><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Model Wt</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Demo Policy</div><div style={{ fontSize:9, color:C.textDim, textAlign:"right" }}>Dev</div>
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
                <span key={s+"d"} style={{ textAlign:"right", fontFamily:font, fontSize:10, color:Math.abs(diff)>5?C.red:Math.abs(diff)>2?C.orange:C.textMid }}>{diff>0?"+":""}{diff}pp</span>,
              ];
            })}
          </div>
        </div>

        {/* Cap Size Distribution — only from connected market-cap fields */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>CONNECTED MARKET-CAP BUCKETS</div>
          {capCoverageWeight>0 ? <>
            <div style={{ display:"flex", gap:4, marginBottom:6 }}>
              <div style={{ flex:capWeights.Large||0.001, height:8, background:C.blue, borderRadius:"4px 0 0 4px" }} />
              <div style={{ flex:capWeights.Mid||0.001, height:8, background:C.orange }} />
              <div style={{ flex:capWeights.Small||0.001, height:8, background:C.cyan, borderRadius:"0 4px 4px 0" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
              <span style={{ color:C.blue }}>● Large: {capWeights.Large}%</span>
              <span style={{ color:C.orange }}>● Mid: {capWeights.Mid}%</span>
              <span style={{ color:C.cyan }}>● Small: {capWeights.Small}%</span>
            </div>
            <div style={{fontSize:8,color:C.textDim,marginTop:5}}>Connected market-cap coverage represents {capCoverageWeight}% of the fixed model weight; uncategorized holdings are excluded rather than guessed.</div>
          </> : <div style={{fontSize:9,color:C.textDim}}>Market-cap buckets are withheld because the connected technical feed did not supply market capitalization for these holdings.</div>}
          <div style={{fontSize:8,color:C.textDim,marginTop:6}}>Buckets use ≥$10B large, $2B–$10B mid, and &lt;$2B small only when a connected market-cap value is available.</div>
        </div>

        <div style={{fontSize:9,color:C.textDim,lineHeight:1.5,marginBottom:12,padding:"8px 10px",background:C.cardAlt,border:"1px solid "+C.border,borderRadius:6}}>Allocation weights and policy targets on this card are fixed demonstration inputs from the sample portfolio; they are not market-value weights, optimized allocations, or investment recommendations.</div>

        {/* Model signal review flags */}
        {(closeCount>0||scaleCount>0) && (
          <div style={{ borderTop:"1px solid "+C.border, paddingTop:12 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:8 }}>MODEL SIGNAL FLAGS</div>
            {holdings.filter(function(h){return h.action==="Close"}).map(function(h) {
              return <div key={h.ticker} style={{ background:C.red+"12", border:"1px solid "+C.red+"30", borderRadius:6, padding:"8px 12px", marginBottom:6 }}>
                <span style={{ color:C.red, fontWeight:700, fontSize:12 }}>✕ {h.ticker}</span>
                <span style={{ color:C.textMid, fontSize:11, marginLeft:8 }}>{h.phase} — {h.trend} trend, below key MAs. Rule-based exit-review flag.</span>
              </div>;
            })}
            {holdings.filter(function(h){return h.action==="Scale Out"}).map(function(h) {
              return <div key={h.ticker} style={{ background:C.orange+"12", border:"1px solid "+C.orange+"30", borderRadius:6, padding:"8px 12px", marginBottom:6 }}>
                <span style={{ color:C.orange, fontWeight:700, fontSize:12 }}>△ {h.ticker}</span>
                <span style={{ color:C.textMid, fontSize:11, marginLeft:8 }}>Price Z {h.zScore!=null?((h.zScore>0?"+":"")+Number(h.zScore).toFixed(2)):"—"} · RSI {h.rsi!=null?Number(h.rsi).toFixed(0):"—"}. Rule-based reduction-review flag.</span>
              </div>;
            })}
          </div>
        )}
      </Card>

      {/* HOLDING SIMILARITY MATRIX */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <span>🔗</span> Holding Similarity Matrix
          <span style={{ fontSize:10, color:C.textDim, fontWeight:400 }}>Heuristic similarity from sector, sleeve, trend and 6M momentum — not statistical return correlation</span>
        </div>
        {(function(){
          // Compute a transparent heuristic similarity score from available cross-sectional features. This is NOT return correlation.
          var tickers = holdings.filter(function(h){return h.price}).slice().sort(function(a,b){return Number(b.weight||0)-Number(a.weight||0);}).slice(0,10); // Top 10 model weights with connected prices
          if (tickers.length < 2) return <div style={{ color:C.textDim, fontSize:11 }}>Need at least 2 holdings with data</div>;
          var cellSize = 38;
          return (
            <div style={{ overflowX:"auto" }}>
              <div style={{ display:"inline-grid", gridTemplateColumns:(cellSize+60)+"px repeat("+tickers.length+", "+cellSize+"px)", gap:1 }}>
                <div />
                {tickers.map(function(h){return <div key={h.ticker+"h"} style={{ fontSize:8, color:C.cyan, fontFamily:font, textAlign:"center", padding:"4px 0", fontWeight:700 }}>{h.ticker}</div>})}
                {tickers.map(function(row, ri){
                  return [
                    <div key={row.ticker+"r"} style={{ fontSize:8, color:C.cyan, fontFamily:font, display:"flex", alignItems:"center", paddingRight:6, fontWeight:700 }}>{row.ticker}</div>,
                    tickers.map(function(col, ci){
                      if (ri === ci) return <div key={ri+"-"+ci} style={{ width:cellSize, height:cellSize, background:C.blue+"44", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontFamily:font, color:C.text }}>100</div>;
                      // Heuristic similarity score (0–100). No covariance/return-history inference is made.
                      var sameSector = row.sector === col.sector ? 0.4 : 0;
                      var sameSleeve = row.sleeve === col.sleeve ? 0.15 : 0;
                      var sameTrend = row.trend && col.trend && row.trend === col.trend ? 0.2 : 0;
                      var r6mSim = row.r6m!=null && col.r6m!=null ? Math.max(0, 1 - Math.abs(row.r6m - col.r6m) / 100) * 0.25 : 0;
                      var similarity = Math.max(0, Math.min(1, sameSector + sameSleeve + sameTrend + r6mSim));
                      var bg = similarity > 0.6 ? C.red+"55" : similarity > 0.3 ? C.orange+"44" : C.green+"22";
                      return <div key={ri+"-"+ci} style={{ width:cellSize, height:cellSize, background:bg, borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontFamily:font, color:similarity>0.6?C.red:similarity>0.3?C.orange:C.green }}>{(similarity*100).toFixed(0)}</div>;
                    })
                  ];
                })}
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8, fontSize:9, color:C.textDim }}>
                <span><span style={{ display:"inline-block", width:10, height:10, background:C.red+"55", borderRadius:2, marginRight:3 }} />High (&gt;60)</span>
                <span><span style={{ display:"inline-block", width:10, height:10, background:C.orange+"44", borderRadius:2, marginRight:3 }} />Medium (30–60)</span>
                <span><span style={{ display:"inline-block", width:10, height:10, background:C.green+"22", borderRadius:2, marginRight:3 }} />Low (&lt;30)</span>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* RISK HEATMAP */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <span>🌡</span> Rule-Based Risk Flags
          <span style={{ fontSize:10, color:C.textDim, fontWeight:400 }}>Heuristic technical/position flags — not a statistical risk model</span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
              {["TICKER","PRICE DEVIATION","MOMENTUM","TREND FLAG","CONCENTRATION","MA DISTANCE","COMPOSITE"].map(function(h){
                return <th key={h} style={{ textAlign:h==="TICKER"?"left":"center", padding:"6px 8px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>;
              })}
            </tr></thead>
            <tbody>
              {holdings.filter(function(h){return h.price}).map(function(h){
                var volRisk = h.zScore!=null ? Math.min(1, Math.abs(Number(h.zScore)) / 3) : null;
                var momRisk = h.r6m!=null ? (h.r6m > 50 ? 0.8 : h.r6m > 20 ? 0.4 : h.r6m < -10 ? 0.9 : 0.2) : null;
                var trendRisk = h.trend==="Bearish"?0.9:h.trend==="Neutral"?0.5:h.trend==="Bullish"?(h.rsi!=null&&h.rsi>75?0.6:0.2):null;
                var concRisk = h.weight!=null ? (h.weight > 8 ? 0.8 : h.weight > 6 ? 0.5 : 0.2) : null;
                var ddRisk = h.maDev!=null ? (h.maDev < -10 ? 0.9 : h.maDev < -5 ? 0.6 : h.maDev < 0 ? 0.4 : 0.2) : null;
                var validRisk=[volRisk,momRisk,trendRisk,concRisk,ddRisk].filter(function(v){return v!=null&&isFinite(v)});
                var overall = validRisk.length ? validRisk.reduce(function(a,b){return a+b},0)/validRisk.length : null;
                function riskCell(val) {
                  if(val==null||!isFinite(val)) return <td style={{ textAlign:"center", padding:"6px 4px", borderBottom:"1px solid "+C.border }}><span style={{fontSize:9,color:C.textDim}}>—</span></td>;
                  var bg = val>0.7?C.red:val>0.4?C.orange:C.green;
                  var label = val>0.7?"HIGH":val>0.4?"MED":"LOW";
                  return <td style={{ textAlign:"center", padding:"6px 4px", borderBottom:"1px solid "+C.border }}>
                    <div style={{ background:bg+"22", border:"1px solid "+bg+"44", borderRadius:4, padding:"3px 6px", fontSize:9, color:bg, fontWeight:700, display:"inline-block" }}>{label}</div>
                  </td>;
                }
                return <tr key={h.ticker}>
                  <td style={{ padding:"6px 8px", fontWeight:700, color:C.cyan, fontFamily:font, fontSize:11, borderBottom:"1px solid "+C.border }}>{h.ticker}</td>
                  {riskCell(volRisk)}
                  {riskCell(momRisk)}
                  {riskCell(trendRisk)}
                  {riskCell(concRisk)}
                  {riskCell(ddRisk)}
                  <td style={{ textAlign:"center", padding:"6px 4px", borderBottom:"1px solid "+C.border }}>
                    {overall==null?<span style={{color:C.textDim,fontSize:9}}>—</span>:<div style={{ background:(overall>0.6?C.red:overall>0.35?C.orange:C.green)+"22", border:"1px solid "+(overall>0.6?C.red:overall>0.35?C.orange:C.green)+"44", borderRadius:4, padding:"3px 8px", fontSize:10, color:overall>0.6?C.red:overall>0.35?C.orange:C.green, fontWeight:700, display:"inline-block" }}>{(overall*100).toFixed(0)}</div>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:9, color:C.textDim, marginTop:6 }}>
          Price deviation: connected Z-score magnitude | Momentum: 6M extension | Trend: MA/RSI flag | Concentration: model weight | MA distance: connected moving-average deviation. Composite is a heuristic score, not VaR or realized volatility.
        </div>
      </Card>

      {/* TECHNICAL DISTANCE MONITOR */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <span>📉</span> Technical Distance Monitor
          <span style={{ fontSize:10, color:C.textDim, fontWeight:400 }}>Connected moving-average deviation only — not historical max drawdown</span>
        </div>
        {(function(){
          var rows = holdings.filter(function(h){return h.price&&h.maDev!=null&&isFinite(Number(h.maDev));}).map(function(h){
            return { ticker:h.ticker, dev:Number(h.maDev), weight:Number(h.weight)||0 };
          });
          var weighted = rows.length ? rows.reduce(function(sum,h){return sum+h.dev*h.weight/100},0) : null;
          var worst = rows.slice().sort(function(a,b){return a.dev-b.dev})[0]||null;
          return <div>
            <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" }}>
              <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"10px 16px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>WEIGHTED MA-DEVIATION PROXY</div>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:weighted==null?C.textDim:weighted<-10?C.red:weighted<-5?C.orange:C.text }}>{weighted==null?"—":weighted.toFixed(1)+"%"}</div>
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"10px 16px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>LOWEST CONNECTED READING</div>
                {worst?<div><span style={{ fontSize:14, fontWeight:700, fontFamily:font, color:worst.dev<-10?C.red:C.orange }}>{worst.dev.toFixed(1)}%</span><span style={{ fontSize:10, color:C.cyan, marginLeft:6 }}>{worst.ticker}</span></div>:<div style={{color:C.textDim}}>—</div>}
              </div>
              <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"10px 16px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>BELOW −5%</div>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:C.orange }}>{rows.filter(function(h){return h.dev<-5}).length}/{rows.length}</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {rows.slice().sort(function(a,b){return a.dev-b.dev}).map(function(h){
                var barWidth=Math.min(100,Math.abs(h.dev)*3);
                var color=h.dev<-15?C.red:h.dev<-5?C.orange:h.dev<0?C.yellow:C.green;
                return <div key={h.ticker} style={{display:"grid",gridTemplateColumns:"55px 1fr 55px",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.cyan,fontFamily:font}}>{h.ticker}</span>
                  <div style={{height:6,background:C.border,borderRadius:3}}><div style={{width:barWidth+"%",height:"100%",background:color,borderRadius:3}}/></div>
                  <span style={{fontSize:10,fontFamily:font,color:color,textAlign:"right"}}>{h.dev.toFixed(1)}%</span>
                </div>;
              })}
            </div>
            <div style={{fontSize:9,color:C.textDim,marginTop:8,lineHeight:1.5}}>This section intentionally does not report max drawdown because no validated historical portfolio equity curve is connected. The displayed percentage is the technical moving-average deviation supplied by the portfolio data endpoint.</div>
          </div>;
        })()}
      </Card>

      {error && <div style={{ background:"#2b0d10", border:"1px solid "+C.red+"44", borderRadius:8, padding:"7px 13px", fontSize:12, color:C.red }}>⚠ {error}</div>}
    </div>
  );
}

/* ─── ASSET SCREENER (Stage 3) ─────────────────────────────────── */

/* ─── ASSET SCREENER (Stage 3) — Enhanced ──────────────────────── */
var SCREENER_CURATED_SHARES = [
  {ticker:"POWL",name:"Powell Industries",sector:"Industrials",type:"share",theme:"AI Power"},
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
  {ticker:"UNFI",name:"United Natural Foods",sector:"Consumer Staples",type:"share",theme:"Food Distribution"},
  {ticker:"PLPC",name:"Preformed Line Products",sector:"Industrials",type:"share",theme:""},
  {ticker:"LXU",name:"LSB Industries",sector:"Materials",type:"share",theme:""},
  {ticker:"CNR",name:"Core Natural Resources",sector:"Energy",type:"share",theme:"Metallurgical & Thermal Coal"},
  {ticker:"CLF",name:"Cleveland-Cliffs",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"BTU",name:"Peabody Energy",sector:"Energy",type:"share",theme:""},
  {ticker:"AMR",name:"Alpha Metallurgical Resources",sector:"Energy",type:"share",theme:"Metallurgical Coal"},
  {ticker:"NUE",name:"Nucor Corp.",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"STLD",name:"Steel Dynamics",sector:"Materials",type:"share",theme:"Steel"},
  {ticker:"HAL",name:"Halliburton",sector:"Energy",type:"share",theme:"Oil & Gas"},
  {ticker:"SLB",name:"SLB",sector:"Energy",type:"share",theme:"Oilfield Services"},
];
var SCREENER_CURATED_ETFS = [
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
  if (!d || !d.price) return { score:0, quality:0, momentum:0, pattern:0, sentiment:0 };
  // Transparent technical heuristic. The upstream TQ field is shown separately
  // but is intentionally NOT used in this score because its vendor scale is not
  // defined by this frontend.
  var structureChecks=[];
  if(d.ma50!=null) structureChecks.push(d.price>d.ma50?1:0);
  if(d.ma200!=null) structureChecks.push(d.price>d.ma200?1:0);
  if(d.ma50!=null&&d.ma200!=null) structureChecks.push(d.ma50>d.ma200?1:0);
  var quality=structureChecks.length?structureChecks.reduce(function(a,b){return a+b;},0)/structureChecks.length:0;
  // 6M momentum is capped into a 0-1 display score; this is a ranking convention,
  // not a forecast or probability.
  var momentum = d.r6m != null ? Math.min(1, Math.max(0, Number(d.r6m) / 60)) : 0;
  var setup = 0;
  if (d.pattern && d.pattern !== "—" && d.pattern !== "No Setup") setup = 0.62;
  var rsiSetup = 0;
  if (d.rsi!=null && d.rsi > 30 && d.rsi < 70) rsiSetup = 0.5;
  else if (d.rsi!=null && d.rsi >= 70) rsiSetup = 0.3;
  else if (d.rsi!=null && d.rsi <= 30) rsiSetup = 0.7;
  var w = { quality:0.30, momentum:0.40, pattern:0.15, sentiment:0.15 };
  var composite = quality*w.quality + momentum*w.momentum + setup*w.pattern + rsiSetup*w.sentiment;
  var score = Math.round(composite * 100);
  return { score:score, quality:quality, momentum:momentum, pattern:setup, sentiment:rsiSetup, composite:composite };
}

function computeRR(d) {
  if (!d || !d.price || !d.ma200) return "—";
  var support = d.ma200;
  if (d.ma50 && d.ma50 < d.price) support = Math.max(support, d.ma50 * 0.97);
  var priceBuffer = d.price * 0.02;
  var referenceFloor = support - priceBuffer;
  var risk = d.price - referenceFloor;
  var target = d.price * (1 + (d.zScore ? Math.max(0.03, Math.abs(d.zScore) * 0.04) : 0.06));
  var reward = target - d.price;
  if (risk <= 0 || reward <= 0) return "—";
  return (reward / risk).toFixed(1) + ":1";
}

function detectScreenerPattern(d) {
  if (!d || !d.ma50 || !d.ma200 || !d.price) return "—";
  var abv50 = d.price > d.ma50, abv200 = d.price > d.ma200;
  if (abv50 && abv200 && d.zScore > 2.0 && d.rsi > 70) return "Very Extended";
  if (!abv50 && !abv200 && d.zScore < -1.5 && d.rsi < 35) return "Oversold";
  if (!abv50 && abv200 && d.rsi > 40 && d.rsi < 60) return "Pullback >200D";
  if (abv50 && abv200 && d.zScore > 1.5 && d.rsi > 60) return "Strong Trend";
  if (abv50 && d.maDev > 0 && d.maDev < 5 && d.rsi > 45) return "50D Retest";
  if (abv50 && abv200 && d.ma50 > d.ma200) return "Bullish MA Stack";
  return "No Setup";
}

function ScreenerStage({ d }) {
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

  var regime = d?.macroRegime?.season || "Unclassified";

  function runScreener() {
    (async function() {
      setLoading(true); setErr(null);
      setStatus("Loading curated candidate universe...");
      try {
        // Candidate membership is explicit and reviewable. Ranking is computed from
        // the live technical endpoint rather than generated by an LLM.
        var tickerList = SCREENER_CURATED_SHARES.concat(SCREENER_CURATED_ETFS);

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
          var mc=Number(d.marketCap); var capClass=Number.isFinite(mc)&&mc>0?(mc>=1e10?"Large":mc>=2e9?"Mid":"Small"):"—";
          return { ...item, ...d, cap:capClass, pattern:pat, rr:rr, score:scoreData.score, scoreData:scoreData };
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

  // Candidate Queue
  function addSeed(ticker) {
    ticker = ticker.toUpperCase().trim();
    if (!ticker || seeds.find(function(s){return s.ticker===ticker}) || candidates.find(function(c){return c.ticker===ticker})) return;
    setManualTickers(function(prev){return prev.concat([ticker])});
    setSearch("");
    var newSeed = { ticker:ticker, source:"manual", techScore:null, strategy:"—", rsi:null, technicalQuality:null, trendAlignment:null, dataCoverage:"—", trend:"—", loading:true };
    setSeeds(function(prev){return prev.concat([newSeed])});
    fetch(PORTFOLIO_URL + "?tickers=" + ticker).then(function(r){return r.json()}).then(function(json){
      var d = json.holdings && json.holdings[ticker];
      setSeeds(function(prev){return prev.map(function(s){
        if (s.ticker !== ticker) return s;
        if (!d) return { ...s, loading:false, techScore:0, dataCoverage:"0%", trendAlignment:"Unavailable", technicalQuality:"—" };
        var pat=detectScreenerPattern(d);
        var scoreData=computeScreenerScore({...d,pattern:pat});
        var strat=d.r6m>20?"Momentum":d.r6m>0?"Positive momentum":"Weak momentum";
        var available=[d.price,d.ma50,d.ma200,d.rsi,d.r6m,d.tq,d.zScore].filter(function(v){return v!=null&&isFinite(Number(v));}).length;
        var coverage=Math.round(available/7*100);
        var trendAlignment=d.trend==="Bullish"&&d.r6m>0?"Bullish + positive momentum":d.trend==="Bearish"?"Bearish":"Mixed";
        return { ...s, loading:false, techScore:scoreData.score, strategy:strat, rsi:d.rsi, technicalQuality:d.tq!=null?Number(d.tq).toFixed(2):"—", trendAlignment:trendAlignment, dataCoverage:coverage+"%", trend:d.trend||"—", _techData:d };
      })});
    }).catch(function(){ setSeeds(function(prev){return prev.map(function(s){ return s.ticker!==ticker?s:{...s,loading:false,techScore:0,dataCoverage:"0%",trendAlignment:"Unavailable",technicalQuality:"—"}; })}); });
    fetch(SEC_FINANCIALS_URL+"?ticker="+encodeURIComponent(ticker)).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"SEC lookup failed");return j;});}).then(function(info){
      setSeeds(function(prev){return prev.map(function(s){return s.ticker!==ticker?s:{...s,name:info.name||ticker,sector:info.industry||info.sector||"—",theme:"Manual candidate"};});});
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
        var mc=d?Number(d.marketCap):null; var capClass=Number.isFinite(mc)&&mc>0?(mc>=1e10?"Large":mc>=2e9?"Mid":"Small"):"—"; var newItem = { ticker:seed.ticker, name:seed.name||seed.ticker, sector:seed.sector||"—", type:"share", theme:seed.theme||"", rank:prev.length+1, price:d?d.price:null, r6m:d?d.r6m:null, tq:d?d.tq:null, trend:d?d.trend:"—", rsi:d?d.rsi:null, zScore:d?d.zScore:null, ma50:d?d.ma50:null, ma200:d?d.ma200:null, maDev:d?d.maDev:null, pattern:pat, rr:rr, score:scoreData.score, scoreData:scoreData, cap:capClass };
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
            <div style={{ fontSize:11, color:C.textMid }}>{candidates.length} candidates screened and ranked across {sharesCount>0&&etfCount>0?"2":"1"} asset categories from a fixed curated universe using connected technical data.</div>
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

        {/* Candidate Queue */}
        {seeds.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>🧩 Candidate Queue</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:10, color:C.textMid }}>{seeds.filter(function(s){return !s.loading}).length} ready</span>
                <button onClick={enrichAndAdd} style={{ background:C.blue, border:"none", borderRadius:4, color:C.text, padding:"5px 12px", fontSize:10, fontWeight:700, cursor:"pointer" }}>+ Analyze & Add ({seeds.length})</button>
              </div>
            </div>
            <div style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
                  {["TICKER","SOURCE","TECH SCORE","STYLE","RSI","TREND QUALITY","TREND ALIGNMENT","DATA COVERAGE"].map(function(h){ return <th key={h} style={{ textAlign:["TECH SCORE","RSI","TREND QUALITY","TREND ALIGNMENT"].indexOf(h)>=0?"center":"left", padding:"6px 8px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>; })}
                </tr></thead>
                <tbody>
                  {seeds.map(function(seed) {
                    var pc=seed.techScore>=25?C.green:seed.techScore>=15?C.orange:C.red;
                    var cc=parseInt(seed.dataCoverage)>=85?C.green:parseInt(seed.dataCoverage)>=60?C.orange:C.red;
                    return <tr key={seed.ticker} style={{ borderBottom:"1px solid "+C.border }}>
                      <td style={{ padding:"8px", fontWeight:700, fontFamily:font, color:C.cyan, fontSize:11 }}>{seed.ticker}</td>
                      <td style={{ padding:"8px", fontSize:9, color:C.textDim }}>{seed.source}</td>
                      <td style={{ padding:"8px", textAlign:"center" }}>{seed.loading?<Spinner size={10}/>:<span style={{ color:pc, fontWeight:700, fontFamily:font }}>{seed.techScore}</span>}</td>
                      <td style={{ padding:"8px", fontSize:10, color:C.textMid }}>{seed.strategy}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.rsi||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.technicalQuality||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontFamily:font, fontSize:10 }}>{seed.trendAlignment||"—"}</td>
                      <td style={{ padding:"8px", textAlign:"center" }}>{seed.loading?<Spinner size={10}/>:<span style={{ background:cc+"22", color:cc, padding:"1px 6px", borderRadius:3, fontSize:8, fontWeight:700 }}>{seed.dataCoverage}</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize:8, color:C.textDim, marginTop:3 }}>Manual candidates are pre-screened with technical rules. “Analyze & Add” applies the full screener score and merges them into the tables above.</div>
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
        Default order: transparent technical composite score (MA trend structure + 6M momentum + rule-based setup + RSI setup). Click column headers to sort. Cap labels are derived from the connected market-cap field when available and are not used as a screening gate. TQ = trend-quality field from the connected technical feed. Scenario R:R = heuristic reward-to-risk reference using moving-average support plus a fixed 2% price buffer; it is not ATR and is not a forecast. Setup = rule-based MA/RSI/Z-score classification; it does not claim to detect classical chart formations. Z-Score = price deviation from the 63-day mean (&gt;+2 extended, &lt;-2 depressed).
      </div>

      {/* RESULTS TABLE */}
      <Card style={{ padding:"10px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>📈 Curated Technical {tab==="shares"?"Shares":"ETFs"}</div>
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
                  {key:"rr",label:"R:R",w:45},{key:"rsi",label:"RSI",w:38},{key:"pattern",label:"SETUP",w:95},
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
                var pc=c.pattern==="Pullback >200D"||c.pattern==="50D Retest"||c.pattern==="Bullish MA Stack"?C.green:c.pattern==="Very Extended"||c.pattern==="Strong Trend"?C.orange:c.pattern==="Oversold"?C.cyan:C.textDim;
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
          {id:"A",name:"Market / Technical Data",pass:c.price!=null,detail:c.price!=null?"Price, RSI, MAs, trend quality, Z-score":"No data",threshold:"Connected feed available"},
          {id:"B",name:"Quote Availability",pass:c.price!=null,detail:c.price!=null?"$"+(c.price).toFixed(2):"N/A",threshold:"Connected quote available"},
          {id:"D",name:"History Fetch",pass:c.ma200!=null,detail:c.ma200!=null?"200+ trading days":"Insufficient",threshold:""},
          {id:"D2",name:"6M Momentum Check",pass:c.r6m!=null&&c.r6m>0,detail:"6m: "+(c.r6m!=null?(c.r6m>0?"+":"")+c.r6m+"%":"N/A"),threshold:"Positive 6M return"},
          {id:"E3",name:"Bearish MA Trend",pass:c.trend!=="Bearish",detail:c.trend==="Bearish"?"Warning":"OK",threshold:"Bearish excluded ("+regime+")"},
          {id:"E5",name:"Trend Quality Available",pass:c.tq!=null,detail:"TQ: "+(c.tq!=null?c.tq.toFixed(2):"N/A"),threshold:"Informational — no unverified scale cutoff"},
          {id:"E6",name:"Phase Feed",pass:true,detail:c.phase||"—",threshold:"Informational only — upstream phase methodology not audited here"},
          {id:"E7",name:"Price Deviation Check",pass:c.zScore==null||c.zScore>-2,detail:"Z="+(c.zScore!=null?c.zScore.toFixed(2):"N/A"),threshold:"Flag below -2σ vs 63-day mean",warning:c.zScore!=null&&c.zScore<-2?"Price is more than 2σ below its 63-day mean":null},
          {id:"G",name:"Scenario R:R",pass:true,detail:c.rr||"N/A",threshold:"Heuristic reference only"},
        ];
        var passCount=gates.filter(function(g){return g.pass}).length;
        var excluded=gates.filter(function(g){return !g.pass}).length>=2;
        var sd=c.scoreData||computeScreenerScore(c);
        var bars=[{label:"MA Trend Structure",raw:sd.quality||0,w:0.30,color:C.blue},{label:"6M Momentum",raw:sd.momentum||0,w:0.40,color:C.green},{label:"Rule Setup",raw:sd.pattern||0,w:0.15,color:C.orange},{label:"RSI Setup",raw:sd.sentiment||0,w:0.15,color:C.purple}];
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
function BuilderStage({ d }) {
  var _h=useState([]); var holdings=_h[0],setHoldings=_h[1];
  var _l=useState(true); var loading=_l[0],setLoading=_l[1];
  var _ts=useState(null); var lastRefresh=_ts[0],setLastRefresh=_ts[1];
  var regime=d?.macroRegime?.season||"Unclassified";
  var modelCashReserve=3000;

  useEffect(function(){
    (async function(){
      setLoading(true);
      try{
        var tickers=PORTFOLIO_HOLDINGS.map(function(h){return h.ticker}).join(",");
        var res=await fetch(PORTFOLIO_URL+"?tickers="+tickers);
        if(!res.ok)throw new Error("Portfolio data HTTP "+res.status);
        var json=await res.json();
        var merged=PORTFOLIO_HOLDINGS.map(function(h){
          var x=json.holdings&&json.holdings[h.ticker];
          if(!x||x.error)return {...h,price:null,ma50:null,ma200:null,rsi:null,tq:null,zScore:null,r6m:null,trend:"—",phase:"—",action:"—",value:null,scenarioFloor:null,scenarioRR:null};
          var value=x.price*x.qty;
          var floor=x.ma200&&x.price?Math.min(x.price*0.92,x.ma200*0.97):x.price?x.price*0.92:null;
          var risk=floor!=null?Math.max(0,x.price-floor):null;
          var target=x.price?x.price*(1+Math.max(0.05,Math.abs(x.zScore||1)*0.04)):null;
          var reward=target!=null?Math.max(0,target-x.price):null;
          var rr=risk>0&&reward!=null?(reward/risk):null;
          return {...h,...x,value:value,scenarioFloor:floor,scenarioRR:rr};
        });
        setHoldings(merged);
        setLastRefresh(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}));
      }catch(e){
        setHoldings(PORTFOLIO_HOLDINGS.map(function(h){return {...h,price:null,trend:"—",phase:"—",action:"—",value:null,scenarioFloor:null,scenarioRR:null};}));
      }
      setLoading(false);
    })();
  },[]);

  var pricedHoldings=holdings.filter(function(h){return h.price!=null&&isFinite(Number(h.price))&&h.value!=null&&isFinite(Number(h.value));});
  var priceCoverage=holdings.length?Math.round(pricedHoldings.length/holdings.length*100):0;
  var investedAssets=pricedHoldings.reduce(function(s,h){return s+Number(h.value||0)},0);
  var totalValue=investedAssets+modelCashReserve;
  var investedPct=totalValue>0?investedAssets/totalValue*100:null;
  var speculativeExposure=holdings.filter(function(h){return h.sleeve==="Speculative"}).reduce(function(s,h){return s+(h.value||0)},0);
  var scenarioDownside=holdings.reduce(function(s,h){if(!h.price||!h.scenarioFloor)return s;return s+Math.max(0,h.price-h.scenarioFloor)*h.qty;},0);
  var rrVals=holdings.map(function(h){return h.scenarioRR}).filter(function(x){return x!=null&&isFinite(x)});
  var avgScenarioRR=rrVals.length?rrVals.reduce(function(a,b){return a+b},0)/rrVals.length:null;
  var flags=holdings.filter(function(h){return h.action==="Scale Out"||h.action==="Close"||h.trend==="Bearish"});

  var sleeveWeights={Core:0,Strategic:0,Speculative:0};
  var sectorWeights={};
  holdings.forEach(function(h){
    sleeveWeights[h.sleeve]=(sleeveWeights[h.sleeve]||0)+h.weight;
    sectorWeights[h.sector]=(sectorWeights[h.sector]||0)+h.weight;
  });
  var sleeveTargets={Core:50,Strategic:30,Speculative:12};
  var policyFlags=Object.keys(sleeveTargets).map(function(k){var actual=sleeveWeights[k]||0;var target=sleeveTargets[k];return {label:k,actual:actual,target:target,diff:actual-target};}).filter(function(x){return Math.abs(x.diff)>=5;});
  var tdS={padding:"7px 6px",fontSize:10,borderBottom:"1px solid "+C.border,whiteSpace:"nowrap"};

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
      <div>
        <div style={{fontSize:18,fontWeight:800}}>🧩 Portfolio Builder</div>
        <div style={{fontSize:10,color:C.textDim,marginTop:3}}>Illustrative allocation diagnostics using fixed sample holdings · live-price gaps remain blank · no orders are generated</div>
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center"}}><Badge label={(regime||"MODEL").toUpperCase()} color={SC[regime]||C.gold}/>{lastRefresh&&<span style={{fontSize:9,color:C.textDim}}>Updated {lastRefresh}</span>}</div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:9}}>
      {[
        {label:"CONNECTED MODEL VALUE",value:"$"+totalValue.toLocaleString(undefined,{maximumFractionDigits:0}),sub:priceCoverage+"% live-price coverage",color:C.text},
        {label:"CONNECTED INVESTED ASSETS",value:"$"+investedAssets.toLocaleString(undefined,{maximumFractionDigits:0}),sub:investedPct==null?"—":investedPct.toFixed(1)+"% of connected model value",color:C.cyan},
        {label:"CASH RESERVE",value:"$"+modelCashReserve.toLocaleString(),sub:totalValue?((modelCashReserve/totalValue)*100).toFixed(1)+"% of model":"—",color:C.green},
        {label:"SPECULATIVE EXPOSURE",value:"$"+speculativeExposure.toLocaleString(undefined,{maximumFractionDigits:0}),sub:totalValue?((speculativeExposure/totalValue)*100).toFixed(1)+"% of model":"—",color:C.orange},
        {label:"SCENARIO DOWNSIDE",value:"$"+scenarioDownside.toLocaleString(undefined,{maximumFractionDigits:0}),sub:"to technical reference floors",color:C.red},
        {label:"AVG SCENARIO R:R",value:avgScenarioRR==null?"—":avgScenarioRR.toFixed(1)+":1",sub:"heuristic, not forecast",color:C.purple}
      ].map(function(x){return <Card key={x.label} style={{padding:"11px 12px"}}><div style={{fontSize:8,color:C.textDim,letterSpacing:1}}>{x.label}</div><div style={{fontSize:18,fontWeight:800,fontFamily:font,color:x.color,marginTop:5}}>{x.value}</div><div style={{fontSize:8,color:C.textDim,marginTop:3}}>{x.sub}</div></Card>;})}
    </div>

    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><div><div style={{fontSize:13,fontWeight:800}}>📋 Position Diagnostics</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>Scenario floor = 97% of 200-day MA or 8% below price, whichever is lower. It is an analytical reference, not a stop order.</div></div>{loading&&<Spinner size={12}/>}</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:940}}><thead><tr>{["TICKER","SLEEVE","PRICE","MARKET VALUE","WEIGHT","TREND","SCENARIO FLOOR","SCENARIO R:R","MODEL FLAG"].map(function(h){return <th key={h} style={{textAlign:"left",padding:"7px 6px",fontSize:8,color:C.textDim,borderBottom:"1px solid "+C.border,letterSpacing:1}}>{h}</th>;})}</tr></thead><tbody>
        {holdings.map(function(h){var rawFlag=h.action&&h.action!=="—"?h.action:null;var flag=rawFlag==="Close"?"Review Exit":rawFlag==="Scale Out"?"Review Reduce":rawFlag==="Hold"?"Maintain":(h.trend==="Bearish"?"Review":"Maintain");var fc=flag==="Review Exit"?C.red:flag==="Review Reduce"||flag==="Review"?C.orange:C.green;return <tr key={h.ticker}>
          <td style={{...tdS,fontFamily:font,fontWeight:800,color:C.cyan}}>{h.ticker}</td><td style={tdS}>{h.sleeve}</td><td style={{...tdS,fontFamily:font}}>{h.price!=null?"$"+Number(h.price).toFixed(2):"—"}</td><td style={{...tdS,fontFamily:font}}>{h.value!=null?"$"+Number(h.value).toLocaleString(undefined,{maximumFractionDigits:0}):"—"}</td><td style={{...tdS,fontFamily:font}}>{h.weight}%</td><td style={{...tdS,color:h.trend==="Bullish"?C.green:h.trend==="Bearish"?C.red:C.textMid}}>{h.trend}</td><td style={{...tdS,fontFamily:font}}>{h.scenarioFloor!=null?"$"+Number(h.scenarioFloor).toFixed(2):"—"}</td><td style={{...tdS,fontFamily:font}}>{h.scenarioRR!=null?Number(h.scenarioRR).toFixed(1)+":1":"—"}</td><td style={tdS}><span style={{fontSize:9,fontWeight:700,color:fc,background:fc+"18",border:"1px solid "+fc+"44",padding:"2px 6px",borderRadius:4}}>{flag}</span></td>
        </tr>;})}
      </tbody></table></div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Card><div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Model Sleeve Weights</div>{Object.keys(sleeveWeights).map(function(k){var v=sleeveWeights[k]||0;var target=sleeveTargets[k]||0;var col=k==="Core"?C.blue:k==="Strategic"?C.orange:C.red;return <div key={k} style={{display:"grid",gridTemplateColumns:"90px 1fr 55px 70px",gap:8,alignItems:"center",marginBottom:7}}><span style={{fontSize:10,color:col,fontWeight:700}}>{k}</span><div style={{height:6,background:C.border,borderRadius:3}}><div style={{width:Math.min(100,v)+"%",height:"100%",background:col,borderRadius:3}}/></div><span style={{fontSize:10,fontFamily:font,textAlign:"right"}}>{v.toFixed(1)}%</span><span style={{fontSize:9,color:C.textDim,textAlign:"right"}}>policy {target}%</span></div>;})}<div style={{fontSize:8,color:C.textDim,marginTop:6}}>Model weights and policy targets are fixed demo assumptions; they are not market-value weights or optimized allocations.</div></Card>
      <Card><div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Model Sector Weights</div>{Object.entries(sectorWeights).sort(function(a,b){return b[1]-a[1]}).map(function(e){return <div key={e[0]} style={{display:"grid",gridTemplateColumns:"120px 1fr 45px",gap:8,alignItems:"center",marginBottom:6}}><span style={{fontSize:10}}>{e[0]}</span><div style={{height:6,background:C.border,borderRadius:3}}><div style={{width:Math.min(100,e[1])+"%",height:"100%",background:C.purple,borderRadius:3}}/></div><span style={{fontSize:10,fontFamily:font,textAlign:"right"}}>{e[1].toFixed(1)}%</span></div>;})}</Card>
    </div>

    {(flags.length>0||policyFlags.length>0)&&<Card><div style={{fontSize:12,fontWeight:800,marginBottom:4}}>⚠ Model Review Flags</div><div style={{fontSize:9,color:C.textDim,marginBottom:9}}>Descriptive rule outputs only. Confirm any decision with fundamentals, risk limits and current portfolio objectives.</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{flags.slice(0,8).map(function(h){return <div key={h.ticker} style={{fontSize:10,padding:"7px 9px",background:C.orange+"0a",border:"1px solid "+C.orange+"22",borderRadius:5}}><b style={{color:C.cyan}}>{h.ticker}</b> — {h.action&&h.action!=="—"?"model flag: "+(h.action==="Close"?"Review Exit":h.action==="Scale Out"?"Review Reduce":h.action==="Hold"?"Maintain":h.action):"bearish technical trend"}.</div>;})}{policyFlags.map(function(x){return <div key={x.label} style={{fontSize:10,padding:"7px 9px",background:C.cardAlt,border:"1px solid "+C.border,borderRadius:5}}><b>{x.label}</b>: {x.actual.toFixed(1)}% vs illustrative {x.target}% policy ({x.diff>0?"+":""}{x.diff.toFixed(1)} pts).</div>;})}</div></Card>}
  </div>;
}

/* ─── REBALANCING SIMULATION (Stage 5) ─────────────────────────── */
function ExecutionStage({ d }) {
  var _h=useState([]); var holdings=_h[0],setHoldings=_h[1];
  var _l=useState(true); var loading=_l[0],setLoading=_l[1];
  var regime=d?.macroRegime?.season||"Unclassified";

  useEffect(function(){
    (async function(){
      setLoading(true);
      try{
        var tickers=PORTFOLIO_HOLDINGS.map(function(h){return h.ticker}).join(",");
        var r=await fetch(PORTFOLIO_URL+"?tickers="+tickers);
        if(!r.ok)throw new Error("Portfolio data HTTP "+r.status);
        var j=await r.json();
        setHoldings(PORTFOLIO_HOLDINGS.map(function(h){var x=j.holdings&&j.holdings[h.ticker];return x&&!x.error?{...h,...x,value:x.price*h.qty}:{...h,price:null,trend:"—",action:"—",value:null};}));
      }catch(e){setHoldings(PORTFOLIO_HOLDINGS.map(function(h){return {...h,price:null,trend:"—",action:"—",value:null};}));}
      setLoading(false);
    })();
  },[]);

  function n(v){var x=Number(v);return isFinite(x)?x:null;}
  var fg=n(d?.fg?.score); var vix=n(d?.vix?.price); var pcr=n(d?.options?.dexPCR); var breadth=n(d?.breadth?.pct50);
  var review=holdings.filter(function(h){return h.action==="Close"||h.action==="Scale Out"||h.trend==="Bearish";});
  var maintain=holdings.filter(function(h){return review.indexOf(h)<0;});
  var td={padding:"7px 6px",fontSize:10,borderBottom:"1px solid "+C.border,whiteSpace:"nowrap"};

  function contextCard(label,value,detail,color){return <Card style={{padding:"11px 12px"}}><div style={{fontSize:8,color:C.textDim,letterSpacing:1}}>{label}</div><div style={{fontSize:18,fontFamily:font,fontWeight:800,color:color||C.text,marginTop:5}}>{value}</div><div style={{fontSize:8,color:C.textDim,marginTop:3}}>{detail}</div></Card>;}
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:18,fontWeight:800}}>🧪 Rebalancing Simulation</div><div style={{fontSize:10,color:C.textDim,marginTop:3}}>Rule-based model flags only · no broker connection · no orders are transmitted</div></div><Badge label={(regime||"MODEL").toUpperCase()} color={SC[regime]||C.gold}/></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:9}}>
      {contextCard("FEAR & GREED",fg==null?"—":fg.toFixed(0),fg==null?"feed unavailable":"context indicator",fg==null?C.textDim:fg<25?C.red:fg>75?C.green:C.orange)}
      {contextCard("VIX",vix==null?"—":vix.toFixed(2),vix==null?"feed unavailable":"equity implied-volatility index",vix==null?C.textDim:vix>30?C.red:vix>20?C.orange:C.green)}
      {contextCard("PUT / CALL",pcr==null?"—":pcr.toFixed(2),pcr==null?"direct feed unavailable":pcr>1.1?"higher put activity":pcr<0.7?"lower put activity":"middle range",C.purple)}
      {contextCard("BREADTH > 50D",breadth==null?"—":breadth.toFixed(1)+"%",breadth==null?"direct feed unavailable":"share of tracked universe above 50D MA",C.cyan)}
    </div>

    <Card><div style={{fontSize:12,fontWeight:800,marginBottom:5}}>Market Context</div><div style={{fontSize:10,color:C.textMid,lineHeight:1.6}}>These indicators describe the connected market environment. They are intentionally not collapsed into a “buy,” “sell,” or timing recommendation. Missing feeds remain unavailable rather than being replaced with default values.</div></Card>

    <Card style={{borderLeft:"3px solid "+C.orange}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:800,color:C.orange}}>Reduce / Review Flags</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>Positions where the upstream technical model reports a reduction/exit review state or a bearish trend. Review does not imply an order.</div></div><Badge label={review.length+" flags"} color={C.orange}/></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr>{["TICKER","CURRENT VALUE","TREND","MODEL FLAG","RSI","6M RETURN","REVIEW NOTE"].map(function(x){return <th key={x} style={{textAlign:"left",padding:"7px 6px",fontSize:8,color:C.textDim,borderBottom:"1px solid "+C.border}}>{x}</th>;})}</tr></thead><tbody>{review.length?review.map(function(h){var flag=h.action==="Close"?"Review Exit":h.action==="Scale Out"?"Review Reduce":h.action==="Hold"?"Maintain":"Review";return <tr key={h.ticker}><td style={{...td,color:C.cyan,fontWeight:800,fontFamily:font}}>{h.ticker}</td><td style={{...td,fontFamily:font}}>{h.value!=null?"$"+Number(h.value).toLocaleString(undefined,{maximumFractionDigits:0}):"—"}</td><td style={{...td,color:h.trend==="Bearish"?C.red:C.textMid}}>{h.trend}</td><td style={{...td,color:C.orange,fontWeight:700}}>{flag}</td><td style={{...td,fontFamily:font}}>{h.rsi!=null?Number(h.rsi).toFixed(0):"—"}</td><td style={{...td,fontFamily:font,color:h.r6m>0?C.green:h.r6m<0?C.red:C.text}}>{h.r6m!=null?Number(h.r6m).toFixed(1)+"%":"—"}</td><td style={{...td,color:C.textMid}}>Confirm against fundamentals and portfolio policy.</td></tr>; }):<tr><td colSpan={7} style={{padding:14,color:C.textDim,fontSize:10}}>No reduce/review flags from the connected technical model.</td></tr>}</tbody></table></div>
    </Card>

    <Card style={{borderLeft:"3px solid "+C.green}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:800,color:C.green}}>Maintain Flags</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>Positions without a current reduce/review flag. “Maintain” is a model state, not a recommendation to buy.</div></div><Badge label={maintain.length+" positions"} color={C.green}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{maintain.map(function(h){return <div key={h.ticker} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:6,padding:"9px 10px"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:font,fontWeight:800,color:C.cyan}}>{h.ticker}</span><span style={{fontSize:9,color:h.trend==="Bullish"?C.green:C.textMid}}>{h.trend}</span></div><div style={{fontSize:9,color:C.textDim,marginTop:5}}>{h.sleeve} · {h.sector}</div></div>;})}</div>
    </Card>

    <Card><div style={{fontSize:12,fontWeight:800,marginBottom:6}}>Simulation Notes</div><div style={{fontSize:9,color:C.textDim,lineHeight:1.7}}>• The model portfolio is illustrative and uses fixed sample quantities/cost bases.<br/>• Technical flags can change as prices and indicators update.<br/>• No slippage, tax, liquidity, transaction-cost, suitability or investor-specific constraints are modeled.<br/>• This page is a portfolio-analysis demonstration, not a brokerage execution system.</div></Card>
    {loading&&<div style={{fontSize:10,color:C.cyan}}>Loading connected technical data…</div>}
  </div>;
}

/* ─── PORTFOLIO TAB VIEW ─────────────────────────────────────── */


/* ─── US MACRO CALENDAR TAB ─────────────────────────────────────── */
function USMacroCalendarTab() {
  var today=new Date();
  var _view=useState(new Date(today.getFullYear(),today.getMonth(),1));
  var view=_view[0],setView=_view[1];
  var _events=useState([]); var events=_events[0],setEvents=_events[1];
  var _loading=useState(true); var loading=_loading[0],setLoading=_loading[1];
  var _error=useState(""); var error=_error[0],setError=_error[1];
  var _selected=useState(null); var selected=_selected[0],setSelected=_selected[1];
  var _filter=useState("All"); var filter=_filter[0],setFilter=_filter[1];
  var _warnings=useState([]); var warnings=_warnings[0],setWarnings=_warnings[1];
  var _selectedLoading=useState(false); var selectedLoading=_selectedLoading[0],setSelectedLoading=_selectedLoading[1];
  var _selectedError=useState(""); var selectedError=_selectedError[0],setSelectedError=_selectedError[1];
  var _retry=useState(0); var retryToken=_retry[0],setRetryToken=_retry[1];

  var year=view.getFullYear(), month=view.getMonth()+1;
  var monthName=view.toLocaleDateString("en-US",{month:"long",year:"numeric"});

  useEffect(function(){
    var cancelled=false;
    var cacheKey="pm_macro_calendar_"+year+"_"+month;
    var url=MACRO_CALENDAR_URL+"?year="+year+"&month="+month;
    setLoading(true); setError(""); setSelected(null); setSelectedError("");

    function readResponse(r){
      return r.json().catch(function(){return {};}).then(function(j){
        if(!r.ok) throw new Error(j.error||("Macro calendar HTTP "+r.status));
        return j;
      });
    }
    function request(){return fetch(url,{cache:"no-store"}).then(readResponse);}
    function apply(j){
      if(cancelled)return;
      var ev=Array.isArray(j.events)?j.events:[];
      setEvents(ev); setWarnings(Array.isArray(j.warnings)?j.warnings:[]); setLoading(false); setError("");
      try{localStorage.setItem(cacheKey,JSON.stringify({events:ev,warnings:Array.isArray(j.warnings)?j.warnings:[],savedAt:Date.now()}));}catch(e){}
    }

    request().catch(function(){
      return new Promise(function(resolve){setTimeout(resolve,650);}).then(request);
    }).then(apply).catch(function(e){
      if(cancelled)return;
      try{
        var cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
        if(cached&&Array.isArray(cached.events)&&cached.events.length){
          setEvents(cached.events); setWarnings(cached.warnings||[]); setLoading(false); setError("");
          return;
        }
      }catch(cacheErr){}
      setError(e.message||"Macro calendar unavailable"); setEvents([]); setLoading(false);
    });
    return function(){cancelled=true;};
  },[year,month,retryToken]);

  function moveMonth(delta){setView(new Date(year,view.getMonth()+delta,1));}
  function goToday(){setView(new Date(today.getFullYear(),today.getMonth(),1));}
  function dateKey(y,m,d){return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
  function categoryColor(cat){
    if(cat==="Inflation")return C.orange;
    if(cat==="Labor")return C.cyan;
    if(cat==="Growth")return C.purple;
    if(cat==="Fed")return C.green;
    if(cat==="Survey")return C.yellow;
    return C.blueLight;
  }
  function categoryIcon(cat){
    if(cat==="Inflation")return "◉";
    if(cat==="Labor")return "●";
    if(cat==="Growth")return "◆";
    if(cat==="Fed")return "▣";
    if(cat==="Survey")return "◇";
    return "•";
  }
  function impactColor(impact){return impact==="High"?C.red:impact==="Medium"?C.orange:C.blueLight;}
  function isTodayDate(y,m,d){return today.getFullYear()===y&&today.getMonth()+1===m&&today.getDate()===d;}

  function openMacroEvent(ev){
    setSelected(ev); setSelectedError("");
    if(!ev||!ev.releaseId){setSelectedLoading(false);return;}
    setSelectedLoading(true);
    fetch(MACRO_EVENT_URL+"?releaseId="+encodeURIComponent(ev.releaseId)+"&date="+encodeURIComponent(ev.date),{cache:"no-store"})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error(j.error||("Macro event HTTP "+r.status));return j;});})
      .then(function(j){
        setSelected(function(prev){return prev&&prev.id===ev.id?{...prev,...j}:prev;});
        setSelectedLoading(false);
        if(j&&j.warning)setSelectedError(j.warning);
      })
      .catch(function(e){setSelectedLoading(false);setSelectedError(e.message||"Release values unavailable");});
  }

  var categories=["All","Inflation","Labor","Growth","Fed"];
  var filtered=events.filter(function(e){return filter==="All"||e.category===filter;});
  var byDate={};
  filtered.forEach(function(e){if(!byDate[e.date])byDate[e.date]=[];byDate[e.date].push(e);});

  var first=new Date(year,month-1,1);
  var daysInMonth=new Date(year,month,0).getDate();
  var prevMonthDays=new Date(year,month-1,0).getDate();
  var mondayIndex=(first.getDay()+6)%7;
  var cells=[];
  for(var i=0;i<42;i++){
    var raw=i-mondayIndex+1;
    var cellYear=year,cellMonth=month,day=raw,inMonth=true;
    if(raw<1){
      var pm=new Date(year,month-2,1);cellYear=pm.getFullYear();cellMonth=pm.getMonth()+1;day=prevMonthDays+raw;inMonth=false;
    }else if(raw>daysInMonth){
      var nm=new Date(year,month,1);cellYear=nm.getFullYear();cellMonth=nm.getMonth()+1;day=raw-daysInMonth;inMonth=false;
    }
    cells.push({year:cellYear,month:cellMonth,day:day,inMonth:inMonth,key:dateKey(cellYear,cellMonth,day)});
  }

  var highCount=events.filter(function(e){return e.impact==="High";}).length;
  var nextHigh=events.filter(function(e){return e.impact==="High"&&Date.parse(e.date+"T23:59:59")>=Date.now();})[0]||null;

  if(error){
    return <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><div style={{fontSize:20,fontWeight:800}}>US Macro Calendar</div><div style={{fontSize:10,color:C.textDim,marginTop:3}}>Curated U.S. economic-release schedule · Eastern Time</div></div>
        <Badge label="SCHEDULE UNAVAILABLE" color={C.orange}/>
      </div>
      <Card>
        <div style={{fontSize:12,fontWeight:800,marginBottom:5}}>Official schedule could not be loaded</div>
        <div style={{fontSize:10,color:C.textMid,lineHeight:1.6,marginBottom:10}}>The dashboard is intentionally not substituting a broad third-party calendar because it may include events outside the curated U.S. macro set. Error: {error}</div>
        <button onClick={function(){setRetryToken(function(x){return x+1})}} style={{background:C.blue,border:"none",borderRadius:6,color:C.text,padding:"7px 12px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Retry official schedule</button>
      </Card>
    </div>;
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{fontSize:20,fontWeight:800}}>US Macro Calendar</div>
          <Badge label="OFFICIAL SCHEDULES" color={C.green}/>
        </div>
        <div style={{fontSize:10,color:C.textDim,marginTop:4}}>FRED release calendar + Federal Reserve FOMC schedule · Times shown in Eastern Time</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:7,padding:"7px 10px",minWidth:92}}>
          <div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Events</div>
          <div style={{fontFamily:font,fontSize:15,fontWeight:700,marginTop:2}}>{events.length}</div>
        </div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:7,padding:"7px 10px",minWidth:92}}>
          <div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>High Impact</div>
          <div style={{fontFamily:font,fontSize:15,fontWeight:700,color:C.red,marginTop:2}}>{highCount}</div>
        </div>
        {nextHigh&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:7,padding:"7px 10px",minWidth:155}}>
          <div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Next High Impact</div>
          <div style={{fontSize:10,fontWeight:700,color:C.text,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nextHigh.title}</div>
        </div>}
      </div>
    </div>

    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:15,fontWeight:800}}>{monthName}</div>
          {loading&&<span style={{fontSize:9,color:C.cyan,fontFamily:font}}>Loading official dates…</span>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={function(){moveMonth(-1)}} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"6px 9px",cursor:"pointer"}}>‹</button>
          <button onClick={goToday} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"6px 10px",fontSize:10,cursor:"pointer"}}>Today</button>
          <button onClick={function(){moveMonth(1)}} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"6px 9px",cursor:"pointer"}}>›</button>
          <div style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,padding:"6px 10px",fontSize:10,color:C.textMid}}>▣ Monthly</div>
          <select value={filter} onChange={function(e){setFilter(e.target.value)}} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"6px 10px",fontSize:10,outline:"none"}}>
            {categories.map(function(c){return <option key={c} value={c}>{c==="All"?"Type: All":c}</option>;})}
          </select>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",border:"1px solid "+C.border,borderRadius:10,overflow:"hidden",position:"relative"}}>
        {["Mon","Tues","Wed","Thurs","Fri","Sat","Sun"].map(function(d){return <div key={d} style={{padding:"8px 10px",fontSize:9,color:C.textDim,textAlign:"center",borderBottom:"1px solid "+C.border,background:C.cardAlt}}>{d}</div>;})}
        {cells.map(function(cell,idx){
          var dayEvents=byDate[cell.key]||[];
          var visible=dayEvents.slice(0,3);
          return <div key={cell.key+"-"+idx} style={{minHeight:112,padding:"8px 7px",borderRight:((idx+1)%7!==0?"1px solid "+C.border:"none"),borderBottom:(idx<35?"1px solid "+C.border:"none"),background:cell.inMonth?C.panel:C.bg,opacity:cell.inMonth?1:0.38,position:"relative"}}>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:6}}>
              <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:isTodayDate(cell.year,cell.month,cell.day)?C.red:"transparent",color:isTodayDate(cell.year,cell.month,cell.day)?"#fff":C.text}}>{cell.day}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {visible.map(function(ev){var col=categoryColor(ev.category);return <div key={ev.id} onClick={function(){openMacroEvent(ev)}} title={ev.fullTitle} style={{display:"flex",alignItems:"center",gap:5,borderLeft:"3px solid "+col,background:col+"10",borderRadius:4,padding:"4px 5px",cursor:"pointer",minWidth:0}}>
                <span style={{color:col,fontSize:9}}>{categoryIcon(ev.category)}</span>
                <span style={{fontSize:9,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{ev.title}</span>
                <span style={{fontSize:8,color:C.textDim,whiteSpace:"nowrap"}}>{ev.time}</span>
              </div>;})}
              {dayEvents.length>3&&<div style={{fontSize:8,color:C.textDim,paddingLeft:6}}>+{dayEvents.length-3} more</div>}
            </div>
          </div>;
        })}

        {selected&&(()=>{
          var releaseDate=new Date(selected.date+"T12:00:00");
          var periodLabel=releaseDate.toLocaleDateString("en-US",{month:"short",year:"numeric"})+" • Macro";
          var releaseLabel=releaseDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})+" • "+selected.time+" ET";
          var nowTs=Date.now();
          var reported=Date.parse(selected.date+"T23:59:59")<nowTs;
          var actual=selected.actual!=null?selected.actual:"—";
          var forecast=selected.forecast!=null?selected.forecast:"—";
          var surprise=selected.surprisePct!=null?((selected.surprisePct>0?"+":"")+selected.surprisePct+"%"):"—";
          var previous=selected.previous!=null?selected.previous:"—";
          var previousSurprise=selected.previousSurprisePct!=null?((selected.previousSurprisePct>0?"+":"")+selected.previousSurprisePct+"%"):"—";
          var surpriseColor=selected.surprisePct==null?C.text:(selected.surprisePct>0?C.green:(selected.surprisePct<0?C.red:C.text));
          var previousSurpriseColor=selected.previousSurprisePct==null?C.text:(selected.previousSurprisePct>0?C.green:(selected.previousSurprisePct<0?C.red:C.text));
          return <div style={{position:"absolute",zIndex:30,left:110,top:72,width:404,maxWidth:"calc(100% - 24px)",background:"#242534",border:"1px solid #3a3c4f",borderRadius:14,boxShadow:"0 18px 50px #000b",overflow:"hidden"}}>
            <div style={{padding:"18px 16px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:22,fontWeight:800,lineHeight:1.15,color:C.text}}>{selected.title}</div>
                  <div style={{fontSize:12,color:C.textDim,marginTop:6}}>{periodLabel}</div>
                  {selectedLoading&&<div style={{fontSize:10,color:C.cyan,marginTop:7,fontFamily:font}}>Loading release values…</div>}
                  {!selectedLoading&&selectedError&&<div style={{fontSize:9,color:C.orange,marginTop:7,lineHeight:1.4}}>Some values unavailable: {selectedError}</div>}
                </div>
                <button onClick={function(){setSelected(null);setSelectedLoading(false);setSelectedError("")}} style={{background:"transparent",border:"none",color:C.textDim,fontSize:16,cursor:"pointer",padding:0,lineHeight:1}}>✕</button>
              </div>

              <div style={{height:1,background:"#3a3c4f",margin:"18px 0"}}/>

              <div style={{display:"grid",rowGap:11,fontSize:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>◷</span>
                  <span style={{fontWeight:600}}>{releaseLabel}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>▥</span>
                  <span style={{color:C.textDim}}>Actual:</span>
                  <span style={{fontWeight:700}}>{actual}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>▥</span>
                  <span style={{color:C.textDim}}>{selected.forecastType==="model"?"Model Forecast:":"Forecast:"}</span>
                  <span style={{fontWeight:700}}>{forecast}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>↘</span>
                  <span style={{color:C.textDim}}>{selected.forecastType==="model"?"Vs. Model Forecast:":"Relative Surprise:"}</span>
                  <span style={{fontWeight:700,color:surpriseColor}}>{surprise}</span>
                </div>
              </div>

              <div style={{height:1,background:"#3a3c4f",margin:"18px 0"}}/>

              <div style={{display:"grid",rowGap:11,fontSize:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>◫</span>
                  <span style={{color:C.textDim}}>Previous:</span>
                  <span style={{fontWeight:700}}>{previous}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,color:C.text}}>
                  <span style={{width:14,textAlign:"center",color:C.textDim}}>↘</span>
                  <span style={{color:C.textDim}}>Previous Rel. Surprise:</span>
                  <span style={{fontWeight:700,color:previousSurpriseColor}}>{previousSurprise}</span>
                </div>
                {(selected.consensusSource||selected.valueSource)&&<div style={{fontSize:9,color:C.textDim,lineHeight:1.4,paddingLeft:24}}>Actual/previous: {selected.valueSource||"—"}{selected.consensusSource?" · Forecast: "+selected.consensusSource:" · Forecast unavailable"}. Relative surprise is a dashboard calculation, not an official agency statistic.</div>}
              </div>
            </div>

            <div style={{padding:"14px 16px",background:"rgba(255,255,255,0.035)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:reported?"#b9ff56":C.green,display:"flex",alignItems:"center",gap:8}}><span style={{width:6,height:6,borderRadius:"50%",background:reported?"#b9ff56":C.green,display:"inline-block"}}/>{reported?"Reported":"Scheduled"}</span>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {selected.fredUrl&&<a href={selected.fredUrl} target="_blank" rel="noreferrer" style={{textDecoration:"none",fontSize:10,color:C.textMid,border:"1px solid #3a3c4f",padding:"7px 10px",borderRadius:8}}>FRED</a>}
                {selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{textDecoration:"none",fontSize:10,color:C.text,border:"1px solid #3a3c4f",padding:"7px 10px",borderRadius:8}}>Official source ↗</a>}
              </div>
            </div>
          </div>;
        })()}
      </div>

      {warnings.length>0&&<div style={{marginTop:8,fontSize:8,color:C.textDim}}>Some release feeds were unavailable: {warnings.slice(0,2).join(" · ")}{warnings.length>2?" · +"+(warnings.length-2)+" more":""}</div>}
      <div style={{display:"flex",gap:12,alignItems:"center",marginTop:9,fontSize:9,color:C.textDim}}>
        {["Inflation","Labor","Growth","Fed"].map(function(c){return <span key={c} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:categoryColor(c)}}/>{c}</span>;})}
        <span style={{marginLeft:"auto"}}>Curated high-value U.S. releases only — company earnings excluded</span>
      </div>
    </Card>
  </div>;
}


/* ─── COMPARABLE COMPANY ANALYSIS ───────────────────────────────── */
function ComparablesTab() {
  const PEER_PRESETS = {
    AAPL:["MSFT","GOOGL","AMZN","META","NVDA"],
    MSFT:["AAPL","GOOGL","AMZN","ORCL","CRM"],
    NVDA:["AMD","AVGO","INTC","QCOM","MU"],
    AMD:["NVDA","AVGO","INTC","QCOM","MU"],
    GOOGL:["META","AMZN","MSFT","NFLX","AAPL"],
    GOOG:["META","AMZN","MSFT","NFLX","AAPL"],
    META:["GOOGL","AMZN","NFLX","MSFT","AAPL"],
    AMZN:["WMT","COST","GOOGL","MSFT","META"],
    TSLA:["GM","F","RIVN","LCID","CARG"],
    HOOD:["SCHW","IBKR","COIN","GS","MS"],
    JPM:["BAC","WFC","C","GS","MS"],
    BAC:["JPM","WFC","C","GS","MS"],
    GS:["MS","JPM","BAC","C","SCHW"],
    XOM:["CVX","COP","EOG","OXY","SLB"],
    CVX:["XOM","COP","EOG","OXY","SLB"],
    WMT:["COST","TGT","AMZN","KR","DG"],
    COST:["WMT","TGT","AMZN","KR","BJ"],
    HD:["LOW","WMT","TGT","COST","TSCO"],
    LOW:["HD","WMT","TGT","COST","TSCO"],
    CRM:["ORCL","MSFT","NOW","ADBE","INTU"],
    ORCL:["MSFT","CRM","IBM","ADBE","NOW"],
    NFLX:["DIS","WBD","FOXA","GOOGL","META"]
  };

  const [ticker,setTicker]=useState("MSFT");
  const [inputTicker,setInputTicker]=useState("MSFT");
  const [peerInput,setPeerInput]=useState((PEER_PRESETS.MSFT||[]).join(", "));
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [loadedAsOf,setLoadedAsOf]=useState(null);

  function fmtMoney(v){
    if(v==null||!isFinite(Number(v)))return "—";
    var n=Number(v),a=Math.abs(n),sign=n<0?"-":"";
    if(a>=1e12)return sign+"$"+(a/1e12).toFixed(2)+"T";
    if(a>=1e9)return sign+"$"+(a/1e9).toFixed(2)+"B";
    if(a>=1e6)return sign+"$"+(a/1e6).toFixed(1)+"M";
    return sign+"$"+a.toLocaleString(undefined,{maximumFractionDigits:0});
  }
  function fmtPct(v){return v==null||!isFinite(Number(v))?"—":Number(v).toFixed(1)+"%";}
  function fmtMult(v){return v==null||!isFinite(Number(v))||Number(v)<=0?"—":Number(v).toFixed(1)+"x";}
  function median(vals){
    var a=(vals||[]).filter(function(v){return v!=null&&isFinite(Number(v));}).map(Number).sort(function(x,y){return x-y;});
    if(!a.length)return null; var m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }
  function pctDiff(a,b){return a!=null&&b!=null&&Number(b)!==0?(Number(a)/Number(b)-1)*100:null;}
  function parsePeers(s,target){
    var clean=String(s||"").toUpperCase().split(/[,\s]+/).map(function(x){return x.trim();}).filter(Boolean);
    var seen={}; var out=[];
    clean.forEach(function(x){if(x!==target&&!seen[x]){seen[x]=true;out.push(x);}});
    return out.slice(0,6);
  }
  function presetsFor(t){return PEER_PRESETS[t]||[];}

  async function fetchSec(t){
    var r=await fetch(SEC_FINANCIALS_URL+"?ticker="+encodeURIComponent(t));
    var j=await r.json().catch(function(){return {};});
    if(!r.ok)throw new Error(j.error||("SEC HTTP "+r.status));
    return j;
  }

  function buildRow(t,sec,q,isTarget){
    var hist=(sec&&sec.historical)||[];
    hist=hist.slice().sort(function(a,b){return String(a.periodEnd||a.year).localeCompare(String(b.periodEnd||b.year));});
    var latest=hist.length?hist[hist.length-1]:{};
    var prior=hist.length>1?hist[hist.length-2]:null;
    var ratios=(sec&&sec.ratios)||{};
    var price=q&&Number(q.price);
    if(!isFinite(price)||price<=0)price=null;
    var marketCap=q&&Number(q.marketCap);
    if(!isFinite(marketCap)||marketCap<=0){
      var shares=Number(sec&&sec.shares);
      if(sec&&sec.marketCapDerivationAllowed===true&&price&&isFinite(shares)&&shares>0)marketCap=price*shares; else marketCap=null;
    }
    var cash=sec&&sec.cash!=null?Number(sec.cash):null;
    var debt=sec&&sec.debt!=null?Number(sec.debt):null;
    var ev=sec&&sec.evMetricsMeaningful===false?null:(marketCap!=null&&cash!=null&&debt!=null?marketCap+debt-cash:null);
    var ebitda=latest&&latest.ebitda!=null?Number(latest.ebitda):null;
    var trailingPE=q&&Number(q.trailingPE);
    if(!isFinite(trailingPE)||trailingPE<=0)trailingPE=null;
    var revGrowth=prior&&prior.revenue&&latest&&latest.revenue!=null?(Number(latest.revenue)/Number(prior.revenue)-1)*100:null;
    var grossMargin=ratios.grossMargin!=null?Number(ratios.grossMargin):(latest.revenue&&latest.grossProfit!=null?Number(latest.grossProfit)/Number(latest.revenue)*100:null);
    var operatingMargin=ratios.operatingMargin!=null?Number(ratios.operatingMargin):(latest.revenue&&latest.operatingIncome!=null?Number(latest.operatingIncome)/Number(latest.revenue)*100:null);
    var netMargin=ratios.netMargin!=null?Number(ratios.netMargin):(latest.revenue&&latest.netIncome!=null?Number(latest.netIncome)/Number(latest.revenue)*100:null);
    var evEbitda=ev!=null&&ebitda!=null&&ebitda>0?ev/ebitda:null;
    return {
      ticker:t,name:(sec&&sec.name)||t,industry:(sec&&sec.industry)||"",isTarget:isTarget,
      price:price,marketCap:marketCap,revenueGrowth:revGrowth,grossMargin:grossMargin,operatingMargin:operatingMargin,netMargin:netMargin,
      roe:ratios.roe!=null?Number(ratios.roe):null,roic:ratios.roic!=null?Number(ratios.roic):null,pe:trailingPE,evEbitda:evEbitda,
      freeCashFlow:latest&&latest.freeCashFlow!=null?Number(latest.freeCashFlow):null,
      fcfMargin:latest&&latest.revenue&&latest.freeCashFlow!=null?Number(latest.freeCashFlow)/Number(latest.revenue)*100:null,
      debtToEquity:ratios.debtToEquity!=null?Number(ratios.debtToEquity):null,
      latestFY:latest&&latest.periodLabel||null,verifiedAsOf:sec&&sec.verifiedAsOf||null
    };
  }

  async function analyze(raw){
    var t=String(raw||inputTicker||"").trim().toUpperCase();
    if(!t)return;
    var peers=parsePeers(peerInput,t);
    if(!peers.length){peers=presetsFor(t);setPeerInput(peers.join(", "));}
    var symbols=[t].concat(peers).slice(0,7);
    setTicker(t);setInputTicker(t);setLoading(true);setError("");setRows([]);
    try{
      var quotePromise=fetch(PORTFOLIO_URL+"?tickers="+encodeURIComponent(symbols.join(","))).then(function(r){return r.json();}).catch(function(){return {};});
      var secResults=await Promise.all(symbols.map(function(sym,i){return new Promise(function(resolve){setTimeout(resolve,i*120);}).then(function(){return fetchSec(sym).then(function(j){return {ticker:sym,data:j};}).catch(function(e){return {ticker:sym,error:e.message};});});}));
      var qj=await quotePromise;
      var holdings=(qj&&qj.holdings)||{};
      var built=[]; var failures=[];
      secResults.forEach(function(x){
        if(x.error){failures.push(x.ticker+": "+x.error);return;}
        built.push(buildRow(x.ticker,x.data,holdings[x.ticker]||null,x.ticker===t));
      });
      built.sort(function(a,b){return a.isTarget?-1:b.isTarget?1:0;});
      if(!built.some(function(r){return r.isTarget;}))throw new Error("Target company data could not be loaded");
      setRows(built);setLoadedAsOf(new Date());
      if(failures.length)setError("Some peers were unavailable: "+failures.slice(0,2).join(" · ")+(failures.length>2?" · +"+(failures.length-2)+" more":""));
    }catch(e){setError(e.message||"Comparable-company analysis failed");}
    setLoading(false);
  }

  useEffect(function(){analyze("MSFT");},[]);

  var target=rows.find(function(r){return r.isTarget;})||null;
  var peers=rows.filter(function(r){return !r.isTarget;});
  var peerMedians={
    revenueGrowth:median(peers.map(function(r){return r.revenueGrowth;})),
    grossMargin:median(peers.map(function(r){return r.grossMargin;})),
    operatingMargin:median(peers.map(function(r){return r.operatingMargin;})),
    netMargin:median(peers.map(function(r){return r.netMargin;})),
    roe:median(peers.map(function(r){return r.roe;})),
    roic:median(peers.map(function(r){return r.roic;})),
    pe:median(peers.map(function(r){return r.pe;})),
    evEbitda:median(peers.map(function(r){return r.evEbitda;})),
    freeCashFlow:median(peers.map(function(r){return r.freeCashFlow;})),
    fcfMargin:median(peers.map(function(r){return r.fcfMargin;})),
    debtToEquity:median(peers.map(function(r){return r.debtToEquity;})),
    marketCap:median(peers.map(function(r){return r.marketCap;}))
  };
  var pePremium=target?pctDiff(target.pe,peerMedians.pe):null;
  var evPremium=target?pctDiff(target.evEbitda,peerMedians.evEbitda):null;
  var opDelta=target&&peerMedians.operatingMargin!=null&&target.operatingMargin!=null?target.operatingMargin-peerMedians.operatingMargin:null;
  var growthDelta=target&&peerMedians.revenueGrowth!=null&&target.revenueGrowth!=null?target.revenueGrowth-peerMedians.revenueGrowth:null;
  var valuationText=target?(pePremium==null&&evPremium==null?"Insufficient comparable valuation data":((pePremium!=null?"P/E "+(pePremium>=0?"premium ":"discount ")+Math.abs(pePremium).toFixed(1)+"%":"P/E unavailable")+(evPremium!=null?" · simplified EV/derived EBITDA "+(evPremium>=0?"premium ":"discount ")+Math.abs(evPremium).toFixed(1)+"%":""))):"—";
  var operatingText=target?((growthDelta!=null?(growthDelta>=0?"Growth above peers":"Growth below peers"):"Growth comparison unavailable")+(opDelta!=null?" · Operating margin "+(opDelta>=0?"+":"")+opDelta.toFixed(1)+" pts vs median":"")):"—";

  var metricRows=[
    {key:"marketCap",label:"Market Cap",format:fmtMoney,higher:true},
    {key:"revenueGrowth",label:"Revenue Growth (YoY)",format:fmtPct,higher:true},
    {key:"grossMargin",label:"Gross Margin",format:fmtPct,higher:true},
    {key:"operatingMargin",label:"Operating Margin",format:fmtPct,higher:true},
    {key:"netMargin",label:"Net Margin",format:fmtPct,higher:true},
    {key:"roe",label:"ROE",format:fmtPct,higher:true},
    {key:"roic",label:"ROIC",format:fmtPct,higher:true},
    {key:"pe",label:"P/E (TTM)",format:fmtMult,higher:false},
    {key:"evEbitda",label:"Simplified EV / Derived EBITDA*",format:fmtMult,higher:false},
    {key:"freeCashFlow",label:"Free Cash Flow",format:fmtMoney,higher:true},
    {key:"fcfMargin",label:"FCF Margin",format:fmtPct,higher:true},
    {key:"debtToEquity",label:"Debt / Equity",format:fmtMult,higher:false}
  ];

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,marginBottom:12}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{fontSize:20,fontWeight:800}}>🏢 Comparable Company Analysis</div>
          <Badge label="SEC + QUOTE FEED" color={C.green}/>
        </div>
        <div style={{fontSize:10,color:C.textDim,marginTop:4}}>Benchmark valuation, growth, profitability and cash flow against a selected peer set.</div>
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
        <input value={inputTicker} onChange={function(e){setInputTicker(e.target.value.toUpperCase())}} onKeyDown={function(e){if(e.key==="Enter")analyze(inputTicker)}} style={{width:92,background:C.card,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"8px 10px",fontFamily:font,fontSize:11}} placeholder="Ticker"/>
        <button onClick={function(){var p=presetsFor(String(inputTicker||"").toUpperCase());if(p.length)setPeerInput(p.join(", "));}} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:7,color:C.textMid,padding:"8px 10px",fontSize:10,cursor:"pointer"}}>Auto Peers</button>
        <button onClick={function(){analyze(inputTicker)}} disabled={loading} style={{background:"linear-gradient(135deg,"+C.cyan+","+C.blue+")",border:"none",borderRadius:7,color:C.bg,padding:"8px 13px",fontSize:10,fontWeight:800,cursor:loading?"wait":"pointer"}}>{loading?"Loading…":"Analyze"}</button>
      </div>
    </div>

    <Card>
      <div style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:10,alignItems:"center"}}>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Peer Set</div>
        <input value={peerInput} onChange={function(e){setPeerInput(e.target.value.toUpperCase())}} style={{width:"100%",background:C.bg,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"8px 10px",fontFamily:font,fontSize:10}} placeholder="AAPL, GOOGL, AMZN, ORCL, CRM"/>
      </div>
      <div style={{fontSize:8,color:C.textDim,marginTop:6}}>Up to 6 peers. Auto Peers uses a curated suggested set; edit it before analysis because peer selection is judgment-based, not an authoritative industry classification.</div>
      <div style={{fontSize:8,color:C.textDim,marginTop:4}}>* EBITDA is a filing-derived proxy (operating income + D&amp;A when available), not company-reported adjusted EBITDA. Simplified EV uses market cap + the SEC debt proxy − filed cash. EV/EBITDA is suppressed for financial institutions.</div>
    </Card>

    {error&&<div style={{marginTop:10,background:C.red+"10",border:"1px solid "+C.red+"44",borderRadius:8,padding:"8px 10px",fontSize:10,color:C.red}}>{error}</div>}

    {target&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:10}}>
        <Card><div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Target Company</div><div style={{fontSize:17,fontWeight:800,marginTop:5}}><span style={{color:C.cyan,fontFamily:font}}>{target.ticker}</span> {target.name}</div><div style={{fontSize:9,color:C.textDim,marginTop:3}}>{target.latestFY||"Latest FY"}</div></Card>
        <Card><div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Peer Median P/E</div><div style={{fontFamily:font,fontSize:20,fontWeight:800,color:C.purple,marginTop:5}}>{fmtMult(peerMedians.pe)}</div><div style={{fontSize:9,color:C.textDim,marginTop:3}}>{peers.length} loaded peers</div></Card>
        <Card><div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Valuation vs Peers</div><div style={{fontSize:12,fontWeight:700,color:pePremium==null?C.text:pePremium>0?C.orange:C.green,marginTop:7,lineHeight:1.4}}>{valuationText}</div></Card>
        <Card><div style={{fontSize:8,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Operating Position</div><div style={{fontSize:12,fontWeight:700,color:C.text,marginTop:7,lineHeight:1.4}}>{operatingText}</div></Card>
      </div>

      <Card style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div><div style={{fontSize:13,fontWeight:800}}>📊 Peer Benchmark</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>Target highlighted in blue · median excludes target</div></div>
          {loadedAsOf&&<div style={{fontSize:8,color:C.textDim,fontFamily:font}}>Loaded {loadedAsOf.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:880,fontSize:10}}>
            <thead><tr>
              <th style={{textAlign:"left",padding:"9px 10px",color:C.textDim,borderBottom:"1px solid "+C.border,minWidth:160}}>Metric</th>
              {rows.map(function(r){return <th key={r.ticker} style={{textAlign:"right",padding:"9px 10px",color:r.isTarget?C.cyan:C.text,borderBottom:"1px solid "+C.border,background:r.isTarget?C.cyan+"08":"transparent",minWidth:105}}><div style={{fontFamily:font,fontSize:11}}>{r.ticker}</div><div style={{fontSize:7,color:C.textDim,fontWeight:400,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100,marginLeft:"auto"}}>{r.name}</div></th>;})}
              <th style={{textAlign:"right",padding:"9px 10px",color:C.orange,borderBottom:"1px solid "+C.border,minWidth:105}}>Peer Median</th>
            </tr></thead>
            <tbody>
              {metricRows.map(function(m,idx){return <tr key={m.key} style={{background:idx%2?C.bg+"66":"transparent"}}>
                <td style={{padding:"9px 10px",borderBottom:"1px solid "+C.border,color:C.textMid,fontWeight:600}}>{m.label}</td>
                {rows.map(function(r){return <td key={r.ticker+"-"+m.key} style={{padding:"9px 10px",borderBottom:"1px solid "+C.border,textAlign:"right",fontFamily:font,fontWeight:r.isTarget?800:600,color:r.isTarget?C.cyan:C.text,background:r.isTarget?C.cyan+"08":"transparent"}}>{m.format(r[m.key])}</td>;})}
                <td style={{padding:"9px 10px",borderBottom:"1px solid "+C.border,textAlign:"right",fontFamily:font,fontWeight:800,color:C.orange}}>{m.format(peerMedians[m.key])}</td>
              </tr>;})}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
        <Card>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>🏆 Relative Strengths</div>
          {[
            {label:"Revenue growth",v:growthDelta,unit:" pts",good:function(x){return x>=0;}},
            {label:"Operating margin",v:opDelta,unit:" pts",good:function(x){return x>=0;}},
            {label:"Net margin",v:target.netMargin!=null&&peerMedians.netMargin!=null?target.netMargin-peerMedians.netMargin:null,unit:" pts",good:function(x){return x>=0;}},
            {label:"FCF margin",v:target.fcfMargin!=null&&peerMedians.fcfMargin!=null?target.fcfMargin-peerMedians.fcfMargin:null,unit:" pts",good:function(x){return x>=0;}}
          ].map(function(x){return <div key={x.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid "+C.border}}><span style={{fontSize:10,color:C.textMid}}>{x.label}</span><span style={{fontFamily:font,fontSize:10,fontWeight:800,color:x.v==null?C.textDim:x.good(x.v)?C.green:C.red}}>{x.v==null?"—":(x.v>=0?"+":"")+x.v.toFixed(1)+x.unit}</span></div>;})}
        </Card>
        <Card>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>💡 Valuation Takeaway</div>
          <div style={{fontSize:11,color:C.textMid,lineHeight:1.65}}>
            <span style={{color:C.cyan,fontWeight:800}}>{target.ticker}</span> {pePremium!=null?("trades at a "+Math.abs(pePremium).toFixed(1)+"% "+(pePremium>=0?"premium":"discount")+" to the peer median on trailing P/E"):"does not have enough trailing P/E data for a peer valuation comparison"}.
            {opDelta!=null?(" Its operating margin is "+Math.abs(opDelta).toFixed(1)+" percentage points "+(opDelta>=0?"above":"below")+" the peer median."):""}
            {growthDelta!=null?(" Latest annual revenue growth is "+Math.abs(growthDelta).toFixed(1)+" percentage points "+(growthDelta>=0?"above":"below")+" peers."):""}
          </div>
          <div style={{fontSize:8,color:C.textDim,marginTop:10,lineHeight:1.5}}>This is a relative-comparison summary, not an investment recommendation. SEC-derived accounting metrics may be blank when the filing taxonomy does not support a clean comparison.</div>
        </Card>
      </div>
    </>}
  </div>;
}

/* ─── FINANCIALS TAB ─────────────────────────────────────────────── */
function FinancialsTabView({ d }) {
  const [ticker, setTicker] = useState("MSFT");
  const [inputTicker, setInputTicker] = useState("MSFT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState(null);
  const [subTab, setSubTab] = useState("Overview");
  const [quoteAsOf, setQuoteAsOf] = useState(null);
  const [quoteWarning, setQuoteWarning] = useState("");
  const [verifyStage, setVerifyStage] = useState("");
  const [earningsData, setEarningsData] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState("");
  const [scenario, setScenario] = useState("Base");
  const [assumptions, setAssumptions] = useState({
    Bear:{ revGrowth:3, ebitdaMargin:24, taxRate:24, daPct:4, capexPct:5, nwcPct:8, wacc:10.5, terminalGrowth:2.0 },
    Base:{ revGrowth:7, ebitdaMargin:28, taxRate:24, daPct:4, capexPct:5, nwcPct:8, wacc:9.0, terminalGrowth:2.5 },
    Bull:{ revGrowth:11, ebitdaMargin:31, taxRate:24, daPct:4, capexPct:5, nwcPct:8, wacc:8.0, terminalGrowth:3.0 },
  });

  function fmtMoney(v, curr) {
    if (v == null || isNaN(v)) return "—";
    var c = curr || (company && company.currency) || "USD";
    var symbols={USD:"$",EUR:"€",GBP:"£",JPY:"¥",TWD:"NT$",CAD:"C$",AUD:"A$",CNY:"CN¥",KRW:"₩",CHF:"CHF ",HKD:"HK$"};
    var sym=symbols[c]||((c&&c!=="USD")?c+" ":"$");
    var a = Math.abs(Number(v)), sign = Number(v) < 0 ? "-" : "";
    if (a >= 1e12) return sign+sym + (a/1e12).toFixed(2) + "T";
    if (a >= 1e9) return sign+sym + (a/1e9).toFixed(2) + "B";
    if (a >= 1e6) return sign+sym + (a/1e6).toFixed(1) + "M";
    return sign+sym + a.toLocaleString(undefined,{maximumFractionDigits:0});
  }
  function fmtPct(v) { return v==null||isNaN(v)?"—":Number(v).toFixed(1)+"%"; }
  function pctChange(a,b){ return a!=null&&b!=null&&Number(b)!==0 ? (Number(a)/Number(b)-1)*100 : null; }
  function cagr(first,last,years){ return first>0&&last>0&&years>0 ? (Math.pow(last/first,1/years)-1)*100 : null; }

  function normalizeFinancialData(parsed) {
    if(!parsed||!parsed.historical||!parsed.historical.length) throw new Error("No usable financial data returned");
    var moneyScale = Number(parsed.financialValuesScale || parsed.moneyScale || 1);
    var sharesScale = Number(parsed.shareValuesScale || parsed.sharesScale || 1);
    if(!isFinite(moneyScale)||moneyScale<=0) moneyScale=1;
    if(!isFinite(sharesScale)||sharesScale<=0) sharesScale=1;
    function scaleMoney(v){ return v==null||v===""?null:Number(v)*moneyScale; }
    function scaleShares(v){ return v==null||v===""?null:Number(v)*sharesScale; }
    function scalePeriod(x){
      if(!x) return x;
      return {...x,
        revenue:scaleMoney(x.revenue),grossProfit:scaleMoney(x.grossProfit),ebitda:scaleMoney(x.ebitda),operatingIncome:scaleMoney(x.operatingIncome),netIncome:scaleMoney(x.netIncome),
        freeCashFlow:scaleMoney(x.freeCashFlow),operatingCashFlow:scaleMoney(x.operatingCashFlow),capex:scaleMoney(x.capex),assets:scaleMoney(x.assets),equity:scaleMoney(x.equity),interestExpense:scaleMoney(x.interestExpense),
        dilutedWeightedShares:scaleShares(x.dilutedWeightedShares)
      };
    }
    parsed.historical=parsed.historical.filter(function(x){return x&&(x.periodType==null||x.periodType==="FY")&&(x.revenue!=null||x.netIncome!=null);}).map(scalePeriod)
      .sort(function(a,b){return String(a.periodEnd||a.year).localeCompare(String(b.periodEnd||b.year));}).slice(-5)
      .map(function(x){var fy=x.fiscalYear||x.year;return {...x,year:fy,fiscalYear:fy,periodType:"FY",periodLabel:x.periodLabel||("FY "+fy)};});
    if(parsed.currentPeriod){
      parsed.currentPeriod=scalePeriod(parsed.currentPeriod);
      parsed.currentPeriod={...parsed.currentPeriod,periodType:parsed.currentPeriod.periodType||"YTD",periodLabel:parsed.currentPeriod.periodLabel||"Latest interim"};
    }
    ["cash","marketableSecurities","liquidAssets","debt"].forEach(function(k){if(parsed[k]!=null)parsed[k]=scaleMoney(parsed[k]);});
    if(parsed.shares!=null) parsed.shares=scaleShares(parsed.shares);
    parsed.financialValuesScale=1; parsed.shareValuesScale=1;
    var latest=parsed.historical[parsed.historical.length-1]||{}; parsed.ratios=parsed.ratios||{};
    if(latest.revenue){
      if(latest.grossProfit!=null)parsed.ratios.grossMargin=latest.grossProfit/latest.revenue*100;
      if(latest.operatingIncome!=null)parsed.ratios.operatingMargin=latest.operatingIncome/latest.revenue*100;
      if(latest.ebitda!=null&&parsed.profile!=="financial")parsed.ratios.ebitdaMargin=latest.ebitda/latest.revenue*100;
      if(latest.netIncome!=null)parsed.ratios.netMargin=latest.netIncome/latest.revenue*100;
    }
    parsed.currentPrice=null; parsed.marketCap=null; parsed.enterpriseValue=null; parsed.pe=null; parsed.evEbitda=null;
    return parsed;
  }

  function loadLiveQuote(t) {
    setQuoteAsOf(null); setQuoteWarning("");
    fetch(PORTFOLIO_URL + "?tickers=" + encodeURIComponent(t))
      .then(function(r){ if(!r.ok) throw new Error("Quote HTTP "+r.status); return r.json(); })
      .then(function(qj){
        var q = qj && qj.holdings ? qj.holdings[t] : null;
        var livePrice = q && Number(q.price);
        if (!livePrice || isNaN(livePrice)) throw new Error("No connected quote returned");
        setCompany(function(prev){
          if(!prev || (prev.ticker||t).toUpperCase()!==t) return prev;
          var next={...prev,currentPrice:livePrice};
          if(q.exchange||q.fullExchangeName) next.exchange=q.exchange||q.fullExchangeName;
          var vendorCap=Number(q.marketCap);
          var shares=Number(next.shares)||0;
          if(isFinite(vendorCap)&&vendorCap>0){
            next.marketCap=vendorCap; next.marketCapSource="Connected quote provider"; next.marketCapEstimated=false;
            if(next.marketCapDerivationAllowed&&shares>0){
              var derived=livePrice*shares, gap=Math.abs(vendorCap-derived)/vendorCap;
              next.marketCapCrossCheck={derived:derived,differencePct:gap*100,status:gap<=0.10?"PASS":"WARN"};
            }
          } else if(next.marketCapDerivationAllowed===true&&shares>0){
            next.marketCap=livePrice*shares; next.marketCapSource=(next.sharesBasis||"SEC shares outstanding")+(next.sharesAsOf?" · as of "+next.sharesAsOf:""); next.marketCapEstimated=false;
          } else {
            next.marketCap=null; next.marketCapSource=next.multipleShareClasses?"Withheld: multiple listed share classes":next.sharesApproximate?"Withheld: only approximate diluted-share count available":"Connected quote provider did not return market cap";
          }
          var debt=next.debt!=null?Number(next.debt):null, cash=next.cash!=null?Number(next.cash):null;
          if(next.marketCap!=null&&debt!=null&&cash!=null&&next.currency==="USD"&&next.evMetricsMeaningful!==false){
            next.enterpriseValue=next.marketCap+debt-cash; next.enterpriseValueSource="Simplified EV = market cap + filed interest-bearing debt proxy − filed cash proxy";
          } else { next.enterpriseValue=null; }
          var trailingPE=Number(q.trailingPE), trailingEPS=Number(q.trailingEps!=null?q.trailingEps:q.epsTrailingTwelveMonths);
          next.pe=isFinite(trailingPE)&&trailingPE>0?trailingPE:null; next.trailingEps=isFinite(trailingEPS)&&trailingEPS>0?trailingEPS:null;
          var dy=Number(q.trailingAnnualDividendYield);
          if(isFinite(dy)&&dy>=0) next.dividendYield=dy<=1?dy*100:dy;
          var latestHist=next.historical&&next.historical.length?next.historical[next.historical.length-1]:null;
          next.priceToLatestFYEps=(latestHist&&Number(latestHist.eps)>0)?livePrice/Number(latestHist.eps):null;
          next.evToLatestFYEBITDA=(next.evMetricsMeaningful!==false&&next.enterpriseValue!=null&&latestHist&&Number(latestHist.ebitda)>0)?next.enterpriseValue/Number(latestHist.ebitda):null;
          return next;
        });
        setQuoteAsOf(new Date());
      })
      .catch(function(){setQuoteWarning("Connected quote unavailable — price-based valuation metrics are withheld rather than showing stale data.");});
  }

  function loadEarningsData(t) {
    setEarningsLoading(true); setEarningsError(""); setEarningsData(null);
    fetch(EARNINGS_URL + "?ticker=" + encodeURIComponent(t))
      .then(function(r){
        return r.json().catch(function(){return {};}).then(function(j){
          if(!r.ok) throw new Error(j.error || ("Earnings endpoint HTTP "+r.status));
          return j;
        });
      })
      .then(function(parsed){
        if(!parsed || !Array.isArray(parsed.quarters)) throw new Error("No usable earnings history returned");
        // Defensive final sort: historical rows oldest -> newest; upcoming estimate last.
        var reported=parsed.quarters.filter(function(q){return q&&q.reported!==false&&q.actual!=null;})
          .sort(function(a,b){return (Date.parse(a.date)||0)-(Date.parse(b.date)||0);});
        var upcoming=parsed.quarters.filter(function(q){return q&&q.reported===false;})
          .sort(function(a,b){return (Date.parse(a.date)||9e15)-(Date.parse(b.date)||9e15);});
        parsed.quarters=reported.concat(upcoming.slice(0,1));
        setEarningsData(parsed); setEarningsLoading(false);
      })
      .catch(function(e){setEarningsError(e.message||"Earnings history unavailable");setEarningsLoading(false);});
  }

  function validateSecDataset(data) {
    var hist=(data&&data.historical)||[];
    if(!hist.length)return {ok:false,reason:"No annual SEC financials returned"};
    if(hist.length<3)return {ok:false,reason:"Fewer than three completed fiscal years were available from SEC XBRL"};
    var ends=hist.map(function(h){return h.periodEnd;}).filter(Boolean).sort();
    for(var i=1;i<ends.length;i++){if(ends[i]===ends[i-1])return {ok:false,reason:"Duplicate fiscal-year periods returned"};}
    var latestEnd=ends.length?ends[ends.length-1]:null;
    if(latestEnd){var age=(Date.now()-Date.parse(latestEnd))/86400000;if(isFinite(age)&&age>550)return {ok:false,reason:"SEC annual history appears stale (latest period ended "+latestEnd+")"};}
    if(data.currentPeriod&&latestEnd&&data.currentPeriod.periodEnd&&data.currentPeriod.periodEnd<=latestEnd)return {ok:false,reason:"Interim period is not newer than the latest completed fiscal year"};
    return {ok:true,latestEnd:latestEnd,warnings:(data.validation&&data.validation.warnings)||[]};
  }

  function loadCompany(rawTicker) {
    var t = String(rawTicker||"").trim().toUpperCase();
    if (!t) return;
    setTicker(t); setInputTicker(t); setLoading(true); setError(""); setCompany(null); setSubTab("Overview");
    setEarningsData(null); setEarningsError("");
    setVerifyStage("Loading SEC XBRL company facts…");

    // Primary path: deterministic SEC Company Facts extraction from our Vercel proxy.
    // This avoids asking an LLM to decide which fiscal years or statement values to use.
    fetch(SEC_FINANCIALS_URL + "?ticker=" + encodeURIComponent(t))
      .then(function(r){
        if(!r.ok) return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.error||("SEC financials HTTP "+r.status));});
        return r.json();
      })
      .then(function(secData){
        var parsed=normalizeFinancialData(secData);
        var quality=validateSecDataset(parsed);
        if(!quality.ok) throw new Error(quality.reason);
        parsed.verification={
          status:(parsed.validation&&parsed.validation.status==="PASS")?"SEC XBRL · PASS":"SEC XBRL · WARNINGS",
          checkedValues:(parsed.validation&&parsed.validation.checkedValues)||0,
          correctedValues:0,
          notes:(parsed.dataMethod||"SEC Company Facts deterministic extraction")+". "+(parsed.metricNotes||"Unavailable or structurally ambiguous metrics are left blank."),
          latestOfficialPeriod:(parsed.currentPeriod&&parsed.currentPeriod.periodLabel)||((parsed.historical||[]).slice(-1)[0]||{}).periodLabel||"",
          warnings:(parsed.validation&&parsed.validation.warnings)||[],
          sources:parsed.sources||[]
        };
        setCompany(parsed);
        setVerifyStage("SEC filing data loaded");
        loadLiveQuote(t);

        var latest=parsed.historical[parsed.historical.length-1]||{};
        var hist=parsed.historical;
        var prior=hist.length>1?hist[hist.length-2]:null;
        var revGrowth=prior&&prior.revenue?((latest.revenue/prior.revenue)-1)*100:7;
        var ebitdaMargin=latest.revenue&&latest.ebitda!=null?(latest.ebitda/latest.revenue)*100:(parsed.profile==="financial"?null:28);
        setAssumptions(function(prev){
          var n={...prev};
          n.Base={...n.Base,revGrowth:+Math.max(-20,Math.min(30,revGrowth)).toFixed(1),ebitdaMargin:ebitdaMargin==null?n.Base.ebitdaMargin:+Math.max(1,Math.min(60,ebitdaMargin)).toFixed(1)};
          n.Bear={...n.Bear,revGrowth:+(n.Base.revGrowth-4).toFixed(1),ebitdaMargin:+Math.max(1,n.Base.ebitdaMargin-4).toFixed(1)};
          n.Bull={...n.Bull,revGrowth:+(n.Base.revGrowth+4).toFixed(1),ebitdaMargin:+Math.min(70,n.Base.ebitdaMargin+4).toFixed(1)};
          return n;
        });
        setLoading(false);
      })
      .catch(function(secErr){
        // Accuracy-first behavior: never replace failed SEC XBRL with AI-generated
        // financial statements. A missing value is safer than a plausible but
        // stale/misclassified number.
        setCompany(null);
        setError("SEC filing data could not be loaded for "+t+". No financial-statement fallback was shown, because this dashboard only displays filed statement values when the SEC XBRL path succeeds. "+(secErr&&secErr.message?secErr.message:""));
        setVerifyStage("");
        setLoading(false);
      });
  }

  useEffect(function(){ loadCompany("MSFT"); }, []);

  function Metric({label,value,sub,color,icon}){
    return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"13px 14px",minHeight:82,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",right:0,top:0,width:34,height:34,background:(color||C.cyan)+"0D",borderRadius:"0 0 0 34px"}}/>
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:C.textDim,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>{icon&&<span style={{fontSize:11}}>{icon}</span>}{label}</div>
      <div style={{fontFamily:font,fontSize:20,fontWeight:700,color:color||C.text}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:C.textDim,marginTop:5}}>{sub}</div>}
    </div>
  }

  function TrendChart({title,metric,format,color}){
    var hist=company&&company.historical?company.historical:[];
    var usable=hist.map(function(h){return {h:h,v:Number(h[metric])};}).filter(function(x){return Number.isFinite(x.v);});
    var vals=usable.map(function(x){return x.v;});
    if(vals.length<2) return <Card><div style={{fontSize:12,fontWeight:700}}>{title}</div><div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.textDim}}>Not enough filed data</div></Card>;
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals), range=max-min||1;
    var W=360,H=105,pad=10;
    var pts=usable.map(function(x,i){var v=x.v;var px=pad+(i/(Math.max(1,usable.length-1)))*(W-pad*2);var y=H-pad-((v-min)/range)*(H-pad*2);return {x:px,y:y,v:v,label:x.h.periodLabel||x.h.year,year:x.h.year};});
    var path=pts.map(function(p,i){return (i?"L":"M")+p.x+","+p.y}).join(" ");
    var latest=pts[pts.length-1], prev=pts[pts.length-2], change=prev&&prev.v>0&&latest.v>=0?pctChange(latest.v,prev.v):null;
    return <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div><div style={{fontSize:11,fontWeight:700}}>{title}</div><div style={{fontFamily:font,fontSize:18,fontWeight:700,marginTop:4}}>{format?format(latest.v):fmtMoney(latest.v)}</div></div>
        {change!=null&&<Badge label={(change>=0?"+":"")+change.toFixed(1)+"% YoY"} color={change>=0?C.green:C.red}/>} 
      </div>
      <svg viewBox={"0 0 "+W+" "+H} width="100%" height="105" preserveAspectRatio="none" style={{display:"block",marginTop:4}}>
        <defs><linearGradient id={"grad-"+metric} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color||C.cyan} stopOpacity="0.24"/><stop offset="100%" stopColor={color||C.cyan} stopOpacity="0"/></linearGradient></defs>
        <path d={path+" L"+latest.x+","+(H-pad)+" L"+pts[0].x+","+(H-pad)+" Z"} fill={"url(#grad-"+metric+")"}/>
        <path d={path} fill="none" stroke={color||C.cyan} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        {pts.map(function(p,i){return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color||C.cyan}/>})}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:C.textDim}}>{pts.map(function(p){return <span key={p.label}>{String(p.year||p.label).slice(-2)}</span>})}</div>
    </Card>
  }

  function tvSymbolFor(c) {
    var ex=String((c&&c.exchange)||"").toUpperCase();
    if(ex.indexOf("NASDAQ")>=0||ex==="NMS"||ex==="NGM"||ex==="NCM") return "NASDAQ:"+ticker;
    if(ex.indexOf("NYSE")>=0||ex==="NYQ") return "NYSE:"+ticker;
    if(ex.indexOf("AMEX")>=0||ex==="ASE") return "AMEX:"+ticker;
    return ticker;
  }

  function TradingViewAdvanced({symbol}) {
    const ref = useState(function(){return "tv-"+Math.random().toString(36).slice(2);})[0];
    useEffect(function(){
      var host=document.getElementById(ref);
      if(!host) return;
      host.innerHTML='<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
      var script=document.createElement("script");
      script.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.type="text/javascript"; script.async=true;
      script.innerHTML=JSON.stringify({autosize:true,symbol:symbol,interval:"D",timezone:"exchange",theme:"dark",style:"1",locale:"en",backgroundColor:"rgba(8,9,15,1)",gridColor:"rgba(28,30,48,0.55)",allow_symbol_change:true,calendar:false,hide_side_toolbar:false,withdateranges:true,save_image:false,details:true,hotlist:false,support_host:"https://www.tradingview.com"});
      host.appendChild(script);
      return function(){if(host) host.innerHTML="";};
    },[symbol,ref]);
    return <div style={{height:390,borderRadius:8,overflow:"hidden",border:"1px solid "+C.border,background:C.card}}><div id={ref} className="tradingview-widget-container" style={{height:"100%",width:"100%"}}/></div>;
  }

  function EarningsChart() {
    var qs=(earningsData&&earningsData.quarters)||[];
    if(earningsLoading) return <Card><div style={{height:260,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:C.textDim,fontSize:11}}><Spinner/> Loading earnings history & consensus…</div></Card>;
    if(!qs.length) return <Card><div style={{fontSize:13,fontWeight:700,marginBottom:6}}>🟢 Earnings & Estimates</div><div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontSize:10,color:C.textDim,lineHeight:1.6}}>{earningsError||"Consensus EPS history is unavailable for this symbol."}<br/>SEC financial statements remain available in the other tabs.</div></Card>;
    var nums=[]; qs.forEach(function(q){if(q.actual!=null)nums.push(Number(q.actual));if(q.estimate!=null)nums.push(Number(q.estimate));});
    var min=Math.min.apply(null,nums),max=Math.max.apply(null,nums); if(!isFinite(min)||!isFinite(max)){min=0;max=1;} if(min===max){min-=0.2;max+=0.2;}
    var pad=(max-min)*0.18; min-=pad;max+=pad;
    var W=620,H=245,pL=44,pR=18,pT=18,pB=42,chartW=W-pL-pR,chartH=H-pT-pB;
    function xx(i){return pL+(qs.length===1?chartW/2:(i/(qs.length-1))*chartW)}
    function yy(v){return pT+chartH-((Number(v)-min)/(max-min))*chartH}
    var ticks=[0,1,2,3,4].map(function(i){var v=min+(max-min)*(i/4);return {v:v,y:yy(v)}});
    var reported=qs.filter(function(q){return q.reported!==false&&q.actual!=null});
    var latestR=reported.length?reported[reported.length-1]:null;
    var surprise=latestR&&latestR.estimate!=null&&Number(latestR.estimate)!==0?((Number(latestR.actual)-Number(latestR.estimate))/Math.abs(Number(latestR.estimate))*100):null;
    return <Card>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <div><div style={{fontSize:13,fontWeight:800}}>🟢 Earnings & Estimates</div><div style={{fontSize:9,color:C.textDim,marginTop:3}}>{(earningsData&&earningsData.basis)||"Reported EPS vs consensus"} · oldest → newest · {(earningsData&&earningsData.verificationStatus)||"source check pending"}</div></div>
        {earningsData&&earningsData.nextEarningsDate&&<div style={{textAlign:"right"}}><div style={{fontSize:8,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>Next earnings {earningsData.nextEarningsConfirmed===true?"· CONFIRMED":""}</div><div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.cyan}}>{earningsData.nextEarningsDate}</div>{earningsData.nextEstimate!=null&&<div style={{fontSize:9,color:C.textMid}}>Consensus EPS ${Number(earningsData.nextEstimate).toFixed(2)}</div>}</div>}
      </div>
      {latestR&&<div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}><Badge label={latestR.period+" actual $"+Number(latestR.actual).toFixed(2)} color={C.text}/>{latestR.estimate!=null&&<Badge label={"estimate $"+Number(latestR.estimate).toFixed(2)} color={C.textDim}/>} {surprise!=null&&<Badge label={(surprise>=0?"Beat +":"Miss ")+surprise.toFixed(1)+"%"} color={surprise>=0?C.green:C.red}/>}</div>}
      <svg viewBox={"0 0 "+W+" "+H} width="100%" height="245" preserveAspectRatio="none" style={{display:"block"}}>
        {ticks.map(function(t,i){return <g key={i}><line x1={pL} x2={W-pR} y1={t.y} y2={t.y} stroke={C.border} strokeWidth="1"/><text x={pL-7} y={t.y+3} fill={C.textDim} fontSize="8" textAnchor="end">{t.v.toFixed(2)}</text></g>})}
        {qs.map(function(q,i){var x=xx(i);var beat=q.actual!=null&&q.estimate!=null?Number(q.actual)>=Number(q.estimate):true;return <g key={q.period+"-"+i}>{q.estimate!=null&&<circle cx={x} cy={yy(q.estimate)} r="6" fill={C.card} stroke={C.textDim} strokeWidth="1.5"/>}{q.actual!=null&&<circle cx={x} cy={yy(q.actual)} r="7" fill={beat?C.green:C.red} stroke={beat?C.green:C.red} strokeWidth="1"/>}<text x={x} y={H-15} fill={q.reported===false?C.orange:C.textDim} fontSize="8" textAnchor="middle">{q.period}</text></g>})}
      </svg>
      <div style={{display:"flex",gap:14,alignItems:"center",fontSize:9,color:C.textDim,marginTop:-4}}><span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:C.green,marginRight:5}}/>Actual / beat</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:C.red,marginRight:5}}/>Actual / miss</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",border:"1px solid "+C.textDim,marginRight:5}}/>Consensus estimate</span></div>
      {(earningsData.sources||[]).length>0&&<div style={{marginTop:9,paddingTop:8,borderTop:"1px solid "+C.border,display:"flex",gap:10,flexWrap:"wrap"}}>{earningsData.sources.slice(0,4).map(function(src,i){return <a key={i} href={src.url} target="_blank" rel="noreferrer" style={{fontSize:8,color:C.cyan,textDecoration:"none"}}>↗ {src.label||"Earnings source"}</a>})}</div>}
    </Card>;
  }

  if(!company&&!loading&&!error) return null;
  var hist=company&&company.historical?company.historical:[];
  var latest=hist.length?hist[hist.length-1]:{};
  var prior=hist.length>1?hist[hist.length-2]:{};
  var first=hist.length?hist[0]:{};
  var histDisplay=company ? hist.concat(company.currentPeriod?[company.currentPeriod]:[]) : [];
  var a=assumptions[scenario];
  var forecast=[];
  var forecastEnabled=!!(company&&company.dcfComparableToQuote!==false&&company.profile!=="financial"&&company.currency==="USD"&&latest&&Number(latest.revenue)>0);
  var dcfBridgeReady=!!(forecastEnabled&&company.cash!=null&&isFinite(Number(company.cash))&&company.debt!=null&&isFinite(Number(company.debt))&&Number(company.shares)>0);
  var dcfEnabled=forecastEnabled&&dcfBridgeReady;
  if(forecastEnabled){
    var revenue=Number(latest.revenue), prevNwc=revenue*(a.nwcPct/100);
    var baseFY=Number(latest.fiscalYear||latest.year||String(latest.periodEnd||"").slice(0,4));
    for(var y=1;y<=5;y++){
      revenue=revenue*(1+a.revGrowth/100);
      var ebitda=revenue*a.ebitdaMargin/100;
      var da=revenue*a.daPct/100;
      var ebit=ebitda-da;
      var taxes=Math.max(0,ebit*a.taxRate/100);
      var nopat=ebit-taxes;
      var capex=revenue*a.capexPct/100;
      var nwc=revenue*a.nwcPct/100;
      var deltaNwc=nwc-prevNwc;
      var ufcf=nopat+da-capex-deltaNwc;
      forecast.push({year:isFinite(baseFY)?baseFY+y:"FY+"+y,revenue:revenue,ebitda:ebitda,ebit:ebit,taxes:taxes,nopat:nopat,da:da,capex:capex,deltaNwc:deltaNwc,ufcf:ufcf});
      prevNwc=nwc;
    }
  }
  var WACC=a.wacc/100,G=a.terminalGrowth/100,pvFcf=null,terminalValue=null,pvTerminal=null,enterpriseValue=null,equityValue=null,impliedPrice=null,upside=null;
  if(dcfEnabled&&forecast.length&&WACC>G){
    pvFcf=0;
    forecast.forEach(function(f,i){pvFcf+=f.ufcf/Math.pow(1+WACC,i+1)});
    terminalValue=forecast[forecast.length-1].ufcf*(1+G)/(WACC-G);
    pvTerminal=terminalValue/Math.pow(1+WACC,forecast.length);
    enterpriseValue=pvFcf+pvTerminal;
    equityValue=enterpriseValue-Number(company.debt)+Number(company.cash);
    impliedPrice=equityValue/Number(company.shares);
    if(isFinite(impliedPrice)&&Number(company.currentPrice)>0) upside=(impliedPrice/Number(company.currentPrice)-1)*100;
  }

  var revYoY=pctChange(latest.revenue,prior.revenue);
  var niYoY=Number(prior.netIncome)>0&&Number(latest.netIncome)>=0?pctChange(latest.netIncome,prior.netIncome):null;
  var revCagr=hist.length>1?cagr(Number(first.revenue),Number(latest.revenue),hist.length-1):null;
  var fcfMargin=latest.revenue&&latest.freeCashFlow!=null?latest.freeCashFlow/latest.revenue*100:null;
  var netCash=(company&&company.cash!=null&&company.debt!=null)?Number(company.cash)-Number(company.debt):null;
  var verification=company&&company.verification?company.verification:{};
  var verifyColor=(String(verification.status||"").indexOf("SEC XBRL · PASS")===0&&!(verification.warnings||[]).length)?C.green:C.orange;
  var statementRows=[["Revenue","revenue"],["Gross Profit","grossProfit"],["EBITDA (derived proxy)","ebitda"],["Operating Income","operatingIncome"],["Net Income","netIncome"],["Free Cash Flow","freeCashFlow"]];
  var ratioKeys=["grossMargin","operatingMargin","ebitdaMargin","netMargin","roe","roa","roic","currentRatio","debtToEquity","interestCoverage"];

  function NumInput({label,k}){return <label style={{display:"block"}}><div style={{fontSize:9,color:C.textDim,marginBottom:4}}>{label}</div><div style={{display:"flex",alignItems:"center",background:C.cardAlt,border:"1px solid "+C.border,borderRadius:6,padding:"0 8px"}}><input type="number" step="0.1" value={a[k]} onChange={function(e){var v=Number(e.target.value);setAssumptions(function(prev){var n={...prev};n[scenario]={...n[scenario],[k]:v};return n})}} style={{width:"100%",background:"transparent",border:0,color:C.text,fontFamily:font,fontSize:11,padding:"8px 0",outline:"none"}}/><span style={{fontSize:9,color:C.textDim}}>%</span></div></label>}

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>💼</span><div style={{fontSize:18,fontWeight:800}}>Company Financial Analysis</div>{company&&<Badge label={verification.status||"PRIMARY SOURCES"} color={verifyColor}/>}</div>
        <div style={{fontSize:9,color:C.textDim,marginTop:4}}>SEC XBRL filings · Connected quote feed · Illustrative forecasting · DCF sensitivity analysis</div>
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center"}}>
        <input value={inputTicker} onChange={function(e){setInputTicker(e.target.value.toUpperCase())}} onKeyDown={function(e){if(e.key==="Enter")loadCompany(inputTicker)}} placeholder="Ticker" style={{width:110,background:C.card,border:"1px solid "+C.border,borderRadius:7,color:C.text,fontFamily:font,fontSize:11,padding:"9px 10px",outline:"none"}}/>
        <button onClick={function(){loadCompany(inputTicker)}} disabled={loading} style={{background:"linear-gradient(135deg,"+C.cyan+","+C.blue+")",border:0,borderRadius:7,color:"#061018",fontWeight:800,fontSize:10,padding:"10px 16px",cursor:loading?"default":"pointer",opacity:loading?.65:1}}>{loading?"Loading…":"Analyze"}</button>
      </div>
    </div>

    {loading&&<Card><div style={{display:"flex",alignItems:"center",gap:10}}><Spinner/><div><div style={{fontSize:11,fontWeight:700}}>Loading {ticker}</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>{verifyStage||"Loading SEC filings…"}</div></div></div></Card>}
    {error&&<div style={{background:C.red+"12",border:"1px solid "+C.red+"55",borderRadius:8,padding:"10px 12px",color:C.red,fontSize:10}}>{error}</div>}

    {company&&<>
      <Card style={{padding:"14px 16px",background:"linear-gradient(135deg,"+C.card+","+C.panel+")"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}><span style={{fontFamily:font,fontSize:16,fontWeight:800,color:C.cyan}}>{company.ticker||ticker}</span><span style={{fontSize:15,fontWeight:800}}>{company.name}</span></div>
            <div style={{fontSize:9,color:C.textDim,marginTop:5}}>{company.sector||"—"} · {company.industry||"—"}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <Badge label={(verification.checkedValues||0)+" SEC values loaded"} color={verifyColor}/>
            {company.verifiedAsOf&&<span style={{fontSize:9,color:C.textDim}}>Retrieved {company.verifiedAsOf}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>{["Overview","Statements","Earnings","Forecast","Valuation"].map(function(t){return <button key={t} onClick={function(){setSubTab(t);if(t==="Earnings"&&!earningsData&&!earningsLoading)loadEarningsData(ticker)}} style={{background:subTab===t?C.blue+"22":"transparent",border:"1px solid "+(subTab===t?C.blue+"66":C.border),borderRadius:5,color:subTab===t?C.text:C.textDim,padding:"5px 10px",fontSize:9,cursor:"pointer"}}>{t}</button>})}</div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:9}}>
        <Metric icon="●" label="Price" value={company.currentPrice?"$"+Number(company.currentPrice).toFixed(2):"—"} color={C.cyan} sub={quoteAsOf?"Quote retrieved · "+quoteAsOf.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"Quote pending"}/>
        <Metric icon="◫" label="Market Cap" value={fmtMoney(company.marketCap)} color={C.blue} sub={company.marketCap!=null?(company.marketCapSource||"Quote/derived"):(company.marketCapSource||"Requires quote-provider market cap or safe filed-share fallback")}/>
        <Metric icon="◇" label="Simplified Enterprise Value" value={fmtMoney(company.enterpriseValue)} color={C.purple} sub={company.profile==="financial"?"Not emphasized for financial institutions":company.currency!=="USD"?"Withheld across currency mismatch":company.enterpriseValue!=null?(company.enterpriseValueSource||"Simplified EV"):"Requires market cap + cash + debt"}/>
        <Metric icon="×" label="P / E (TTM)" value={company.pe!=null?Number(company.pe).toFixed(1)+"x":"—"} sub={company.pe!=null?"Connected quote-provider trailing P/E":"TTM P/E unavailable"}/>
        <Metric icon="×" label="Simplified EV / Derived FY EBITDA*" value={company.evToLatestFYEBITDA!=null?Number(company.evToLatestFYEBITDA).toFixed(1)+"x":"—"} sub={company.evMetricsMeaningful===false?"Not meaningful for this industry":"EV ÷ filing-derived FY EBITDA proxy"}/>
        <Metric icon="%" label="Trailing Dividend Yield" value={company.dividendYield!=null?fmtPct(company.dividendYield):"—"} sub={company.dividendYield!=null?"Connected quote provider":"Unavailable"}/>
      </div>
      {quoteWarning&&<div style={{fontSize:9,color:C.orange,background:C.orange+"0D",border:"1px solid "+C.orange+"33",borderRadius:6,padding:"7px 9px"}}>{quoteWarning}</div>}
      {company.marketCapCrossCheck&&company.marketCapCrossCheck.status==="WARN"&&<div style={{fontSize:9,color:C.orange,background:C.orange+"0D",border:"1px solid "+C.orange+"33",borderRadius:6,padding:"7px 9px"}}>Market-cap cross-check warning: the connected provider value differs from price × the latest usable SEC share count by {company.marketCapCrossCheck.differencePct.toFixed(1)}%. The provider market cap remains displayed, and the discrepancy is disclosed rather than silently reconciled.</div>}

      {subTab==="Overview"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:9}}>
          <Metric label="Revenue Growth" value={revYoY!=null?(revYoY>=0?"+":"")+revYoY.toFixed(1)+"%":"—"} color={revYoY!=null?(revYoY>=0?C.green:C.red):C.textDim} sub={(latest.periodLabel||latest.year)+" vs prior FY"}/>
          <Metric label="Revenue CAGR" value={fmtPct(revCagr)} color={C.cyan} sub={hist.length+" fiscal-year trend"}/>
          <Metric label="Net Margin" value={fmtPct(company.ratios&&company.ratios.netMargin)} color={C.green} sub={niYoY!=null?"Net income "+(niYoY>=0?"+":"")+niYoY.toFixed(1)+"% YoY":"Latest completed FY"}/>
          <Metric label="Net Cash / (Debt)" value={fmtMoney(netCash)} color={netCash==null?C.textDim:(netCash>=0?C.green:C.red)} sub={fcfMargin!=null?"FCF margin "+fcfMargin.toFixed(1)+"%":"Requires filed cash + debt"}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>
          <TrendChart title="Revenue" metric="revenue" color={C.cyan}/>
          <TrendChart title="Net Income" metric="netIncome" color={C.green}/>
          <TrendChart title="Free Cash Flow" metric="freeCashFlow" color={C.purple}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><div style={{fontSize:12,fontWeight:700}}>📈 Financial Performance</div><span style={{fontSize:8,color:C.textDim}}>Completed FYs {company.currentPeriod?"+ latest YTD":""}</span></div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}><thead><tr><th style={{textAlign:"left",padding:7,color:C.textDim}}>Metric</th>{histDisplay.map(function(h){return <th key={h.periodLabel||h.year} style={{textAlign:"right",padding:7,color:h.periodType==="YTD"?C.orange:C.textDim}}>{h.periodLabel||h.year}</th>})}</tr></thead><tbody>{statementRows.map(function(r){return <tr key={r[1]}><td style={{padding:7,borderTop:"1px solid "+C.border,color:C.textMid}}>{r[0]}</td>{histDisplay.map(function(h){return <td key={h.periodLabel||h.year} style={{padding:7,borderTop:"1px solid "+C.border,textAlign:"right",fontFamily:font,color:h.periodType==="YTD"?C.orange:C.text}}>{fmtMoney(h[r[1]])}</td>})}</tr>})}<tr><td style={{padding:7,borderTop:"1px solid "+C.border,color:C.textMid}}>Diluted EPS (SEC)</td>{histDisplay.map(function(h){return <td key={h.periodLabel||h.year} style={{padding:7,borderTop:"1px solid "+C.border,textAlign:"right",fontFamily:font,color:h.periodType==="YTD"?C.orange:C.text}}>{h.eps!=null?"$"+Number(h.eps).toFixed(2):"—"}</td>})}</tr></tbody></table></div>
          </Card>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card><div style={{fontSize:12,fontWeight:700,marginBottom:9}}>🧾 Key Ratios</div>{ratioKeys.map(function(k){var v=company.ratios?company.ratios[k]:null;var label=k==="ebitdaMargin"?"EBITDA Margin (derived proxy)":k.replace(/([A-Z])/g," $1").replace(/^./,function(s){return s.toUpperCase()});var isMult=["currentRatio","debtToEquity","interestCoverage"].includes(k);return <Row key={k} label={label} val={v==null?"—":isMult?Number(v).toFixed(2)+"x":fmtPct(v)}/>})}</Card>
            <Card><div style={{fontSize:12,fontWeight:700,marginBottom:8}}>✅ Data Integrity</div><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}><Badge label={verification.status||"PARTIAL"} color={verifyColor}/><span style={{fontSize:9,color:C.textDim}}>{verification.latestOfficialPeriod||latest.periodLabel||"Latest official filing"}</span></div><div style={{fontSize:9,color:C.textMid,lineHeight:1.55,marginBottom:8}}>{verification.notes||"Statement values are restricted to deterministic SEC Company Facts extraction. Unsupported or ambiguous values remain blank."}</div>{(company.sources||verification.sources||[]).slice(0,4).map(function(src,i){return <a key={i} href={src.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:9,color:C.cyan,textDecoration:"none",marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>↗ {src.label||src.type||"Official source"}</a>})}{(verification.warnings||[]).slice(0,3).map(function(w,i){return <div key={"warn"+i} style={{fontSize:8,color:C.orange,lineHeight:1.45,marginTop:5}}>⚠ {w}</div>})}<div style={{marginTop:9,paddingTop:8,borderTop:"1px solid "+C.border}}><Row label="Filed cash proxy" val={fmtMoney(company.cash)}/><Row label="Cash basis" val={company.cashBasis||"—"}/><Row label="Debt" val={fmtMoney(company.debt)}/></div></Card>
          </div>
        </div>
      </>}

      {subTab==="Statements"&&<>
        <Card><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{fontSize:14,fontWeight:700}}>📚 SEC Filed Financial Statements</div><Badge label={verification.status||"PARTIAL"} color={verifyColor}/></div><div style={{fontSize:9,color:C.textDim,marginBottom:12}}>Annual values are completed fiscal years only. For supported U.S. domestic issuers, the newest structured 10-Q interim period is shown separately and is never annualized.</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr><th style={{textAlign:"left",padding:8,color:C.textDim}}>Metric</th>{histDisplay.map(function(h){return <th key={h.periodLabel||h.year} style={{textAlign:"right",padding:8,color:h.periodType==="YTD"?C.orange:C.textDim}}><div>{h.periodLabel||h.year}</div>{h.periodEnd&&<div style={{fontSize:7,fontWeight:400,marginTop:2}}>{h.periodEnd}</div>}</th>})}</tr></thead><tbody>{statementRows.concat([["Diluted EPS (SEC)","eps"]]).map(function(r){return <tr key={r[1]}><td style={{padding:8,borderTop:"1px solid "+C.border,color:C.textMid,fontWeight:600}}>{r[0]}</td>{histDisplay.map(function(h){var v=h[r[1]];return <td key={h.periodLabel||h.year} style={{padding:8,borderTop:"1px solid "+C.border,textAlign:"right",fontFamily:font,color:h.periodType==="YTD"?C.orange:C.text}}>{r[1]==="eps"?(v!=null?"$"+Number(v).toFixed(2):"—"):fmtMoney(v)}</td>})}</tr>})}</tbody></table></div></Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Card><div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Balance Sheet Snapshot</div><Row label="Filed cash proxy" val={fmtMoney(company.cash)}/><Row label="Cash basis" val={company.cashBasis||"—"}/><Row label="Total debt" val={fmtMoney(company.debt)}/><Row label="Net cash / (debt)" val={fmtMoney(netCash)} color={netCash==null?C.textDim:(netCash>=0?C.green:C.red)}/><Row label="Filed shares" val={company.shares?Number(company.shares).toLocaleString():"—"}/><Row label="Share basis" val={company.sharesBasis||"—"}/></Card><Card><div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Verification Summary</div><Row label="SEC values loaded" val={verification.checkedValues||"—"}/><Row label="Retrieved as of" val={company.retrievedAsOf?String(company.retrievedAsOf).slice(0,10):(company.verifiedAsOf||"—")}/><div style={{fontSize:9,color:C.textDim,lineHeight:1.5,marginTop:8}}>If a figure cannot be extracted consistently from SEC XBRL, the dashboard leaves it blank rather than estimating it. EBITDA, when shown, is a derived proxy from operating income plus D&A; it is not adjusted EBITDA. Historical per-share values may reflect the presentation basis in the underlying filing. The DCF per-share bridge uses the SEC share count returned by the endpoint, not a separately forecast diluted-share schedule.</div></Card></div>
      </>}

      {subTab==="Earnings"&&<>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,0.9fr) minmax(0,1.1fr)",gap:12,alignItems:"stretch"}}>
          <EarningsChart/>
          <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><div><div style={{fontSize:13,fontWeight:800}}>📈 TradingView Advanced Chart</div><div style={{fontSize:9,color:C.textDim,marginTop:2}}>Interactive price chart, indicators and drawing tools · data provided by TradingView</div></div><Badge label="TRADINGVIEW" color={C.blueLight}/></div><TradingViewAdvanced symbol={tvSymbolFor(company)}/></div>
        </div>
        <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9}}>
          <Metric label="Next Earnings" value={(earningsData&&earningsData.nextEarningsDate)||"—"} color={C.cyan} sub={earningsData&&earningsData.nextEarningsConfirmed===true?"Company-confirmed date":"Unconfirmed / unavailable"} icon="◷"/>
          <Metric label="Consensus EPS" value={earningsData&&earningsData.nextEstimate!=null?"$"+Number(earningsData.nextEstimate).toFixed(2):"—"} color={C.purple} sub={earningsData&&earningsData.provider?("Provider-defined EPS basis · "+earningsData.provider):"Analyst consensus unavailable"} icon="◎"/>
          <Metric label="Data As Of" value={(earningsData&&earningsData.dataAsOf)||"—"} color={C.text} sub="Earnings provider retrieval date" icon="✓"/>
        </div>
        <div style={{fontSize:9,color:C.textDim,lineHeight:1.55,marginTop:10,padding:"9px 11px",border:"1px solid "+C.border,borderRadius:7,background:C.cardAlt}}>SEC XBRL remains the source of truth for filed financial statements. Analyst EPS estimates are not SEC-reported figures and can vary by provider. The dashboard only plots estimate values returned with a cited market-data source; unavailable estimates remain blank. TradingView widget data may be real-time, delayed, or end-of-day depending on the market and instrument.</div>
      </>}

      {subTab==="Forecast"&&(!forecastEnabled?<Card><div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Forecast / DCF intentionally disabled</div><div style={{fontSize:10,color:C.textMid,lineHeight:1.6}}>This issuer uses a financial-institution profile, an unsupported share/currency structure, or lacks a usable SEC revenue base. The dashboard will not manufacture an operating forecast from incompatible inputs. Filed statements remain available in Overview and Statements.</div></Card>:<div style={{display:"grid",gridTemplateColumns:"330px 1fr",gap:12}}>
        <Card><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:700}}>⚙ Forecast Assumptions</div><div style={{display:"flex",gap:4}}>{["Bear","Base","Bull"].map(function(s){var cc=s==="Bear"?C.red:s==="Bull"?C.green:C.blue;return <button key={s} onClick={function(){setScenario(s)}} style={{background:scenario===s?cc+"22":"transparent",border:"1px solid "+(scenario===s?cc+"66":C.border),borderRadius:4,color:scenario===s?cc:C.textDim,padding:"4px 7px",fontSize:9,cursor:"pointer"}}>{s}</button>})}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><NumInput label="Revenue Growth" k="revGrowth"/><NumInput label="EBITDA Margin" k="ebitdaMargin"/><NumInput label="Tax Rate" k="taxRate"/><NumInput label="D&A / Revenue" k="daPct"/><NumInput label="CapEx / Revenue" k="capexPct"/><NumInput label="NWC / Revenue" k="nwcPct"/><NumInput label="WACC" k="wacc"/><NumInput label="Terminal Growth" k="terminalGrowth"/></div><div style={{fontSize:9,color:C.textDim,lineHeight:1.5,marginTop:12}}>Forecasts are illustrative model assumptions anchored to the latest SEC-loaded fiscal year when the needed driver is available. Otherwise the displayed default assumption is used. They are not reported company guidance or analyst consensus.</div></Card>
        <Card><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><div style={{fontSize:13,fontWeight:700}}>📊 5-Year Operating Forecast</div><Badge label={scenario+" Case"} color={scenario==="Bear"?C.red:scenario==="Bull"?C.green:C.blue}/></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}><thead><tr>{["Year","Revenue","EBITDA","EBIT","Taxes","NOPAT","D&A","CapEx","ΔNWC","UFCF"].map(function(h){return <th key={h} style={{textAlign:h==="Year"?"left":"right",padding:6,color:C.textDim}}>{h}</th>})}</tr></thead><tbody>{forecast.map(function(f){return <tr key={f.year}>{[f.year,f.revenue,f.ebitda,f.ebit,f.taxes,f.nopat,f.da,f.capex,f.deltaNwc,f.ufcf].map(function(v,i){return <td key={i} style={{padding:7,borderTop:"1px solid "+C.border,textAlign:i===0?"left":"right",fontFamily:font,color:i===9?C.green:C.text}}>{i===0?v:fmtMoney(v)}</td>})}</tr>})}</tbody></table></div></Card>
      </div>)}

      {subTab==="Valuation"&&(!dcfEnabled?<Card><div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Valuation bridge unavailable</div><div style={{fontSize:10,color:C.textMid,lineHeight:1.6}}>A per-share DCF is withheld unless the issuer has a supported non-financial USD profile plus filed cash, an interest-bearing-debt proxy, and a usable SEC share count. Missing bridge inputs are not treated as zero.</div></Card>:<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:9}}><Metric label="PV of 5Y FCF" value={fmtMoney(pvFcf)} color={C.cyan}/><Metric label="PV Terminal Value" value={fmtMoney(pvTerminal)} color={C.blue}/><Metric label="Simplified Enterprise Value" value={fmtMoney(enterpriseValue)} color={C.purple}/><Metric label="Equity Value" value={fmtMoney(equityValue)} color={C.green}/><Metric label="Implied Share Price" value={impliedPrice?"$"+impliedPrice.toFixed(2):"—"} color={upside!=null?(upside>=0?C.green:C.red):C.text} sub={upside!=null?((upside>=0?"+":"")+upside.toFixed(1)+"% vs connected quote"):"Requires connected quote + shares"}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card><div style={{fontSize:13,fontWeight:700,marginBottom:10}}>💰 Illustrative DCF Bridge</div><Row label="PV of Forecast UFCF" val={fmtMoney(pvFcf)}/><Row label="Terminal Value" val={fmtMoney(terminalValue)}/><Row label="PV of Terminal Value" val={fmtMoney(pvTerminal)}/><div style={{borderTop:"1px solid "+C.border,margin:"8px 0"}}/><Row label="Simplified Enterprise Value" val={fmtMoney(enterpriseValue)}/><Row label="Less: Debt" val={fmtMoney(company.debt)}/><Row label="Add: Filed cash proxy" val={fmtMoney(company.cash)}/><Row label="Equity Value" val={fmtMoney(equityValue)}/><Row label="SEC Shares Outstanding" val={company.shares?Number(company.shares).toLocaleString():"—"}/><div style={{borderTop:"1px solid "+C.border,margin:"8px 0"}}/><Row label="Current Price" val={company.currentPrice?"$"+Number(company.currentPrice).toFixed(2):"—"}/><Row label="DCF Implied Price" val={impliedPrice?"$"+impliedPrice.toFixed(2):"—"}/><Row label="Upside / Downside" val={upside!=null?(upside>=0?"+":"")+upside.toFixed(1)+"%":"—"} color={upside!=null?(upside>=0?C.green:C.red):C.text}/></Card>
          <Card><div style={{fontSize:13,fontWeight:700,marginBottom:4}}>🧮 Illustrative WACC × Terminal Growth</div><div style={{fontSize:9,color:C.textDim,marginBottom:10}}>Illustrative implied-price sensitivity; highlighted cell is the active model assumption. This is not a price target.</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:4,fontSize:10}}><thead><tr><th style={{padding:6,color:C.textDim}}>WACC \ g</th>{[-0.5,0,0.5].map(function(x){return <th key={x} style={{padding:6,color:C.textDim,textAlign:"right"}}>{(a.terminalGrowth+x).toFixed(1)}%</th>})}</tr></thead><tbody>{[-1,0,1].map(function(wx){var ww=a.wacc+wx;return <tr key={wx}><td style={{padding:7,fontFamily:font,color:C.textDim}}>{ww.toFixed(1)}%</td>{[-0.5,0,0.5].map(function(gx){var w=ww/100,g=(a.terminalGrowth+gx)/100,pt=null;if(forecast.length&&w>g&&company.shares){var pv=0;forecast.forEach(function(f,i){pv+=f.ufcf/Math.pow(1+w,i+1)});var tv=forecast[4].ufcf*(1+g)/(w-g);var ev=pv+tv/Math.pow(1+w,5);var eq=ev-(Number(company.debt)||0)+(Number(company.cash)||0);pt=eq/Number(company.shares);}var base=wx===0&&gx===0;return <td key={gx} style={{padding:10,border:"1px solid "+(base?C.blue+"77":C.border),borderRadius:5,textAlign:"right",fontFamily:font,background:base?C.blue+"18":C.cardAlt,color:base?C.cyan:C.text}}>{pt?"$"+pt.toFixed(2):"—"}</td>})}</tr>})}</tbody></table></div></Card>
        </div>
      </>)}
    </>}
  </div>;
}

function PortfolioTabView({ d }) {
  var _portfolios = useState([{id:"model",name:"Model Portfolio",holdings:PORTFOLIO_HOLDINGS,inception:"2026-04-01",cash:3000}]);
  var portfolios = _portfolios[0], setPortfolios = _portfolios[1];
  var _activePf = useState("model");
  var activePf = _activePf[0], setActivePf = _activePf[1];
  var _liveData = useState({});
  var liveData = _liveData[0], setLiveData = _liveData[1];
  var _loading = useState(true);
  var loading = _loading[0], setLoading = _loading[1];
  var _showUpload = useState(false);
  var showUpload = _showUpload[0], setShowUpload = _showUpload[1];
  var _csvText = useState("");
  var csvText = _csvText[0], setCsvText = _csvText[1];
  var _newPfName = useState("");
  var newPfName = _newPfName[0], setNewPfName = _newPfName[1];
  var _showNewPf = useState(false);
  var showNewPf = _showNewPf[0], setShowNewPf = _showNewPf[1];
  var _lastUpdate = useState(null);
  var lastUpdate = _lastUpdate[0], setLastUpdate = _lastUpdate[1];
  var _selTicker = useState(null);
  var selTicker = _selTicker[0], setSelTicker = _selTicker[1];
  var _sectorFilter = useState("all");
  var sectorFilter = _sectorFilter[0], setSectorFilter = _sectorFilter[1];
  var _sleeveFilter = useState("all");
  var sleeveFilter = _sleeveFilter[0], setSleeveFilter = _sleeveFilter[1];

  var pf = portfolios.find(function(p){return p.id===activePf}) || portfolios[0];

  function refreshPrices() {
    setLoading(true);
    var tickers = pf.holdings.map(function(h){return h.ticker}).join(",");
    fetch(PORTFOLIO_URL + "?tickers=" + tickers).then(function(r){return r.json()}).then(function(json){
      setLiveData(json.holdings || {});
      setLastUpdate(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
      setLoading(false);
    }).catch(function(){setLoading(false)});
  }
  useEffect(function(){ refreshPrices(); }, [activePf]);

  // Merge live data
  var merged = pf.holdings.map(function(h) {
    var d = liveData[h.ticker];
    var price = d ? d.price : null;
    var value = price != null && isFinite(Number(price)) ? Number(price) * h.qty : null;
    var costTotal = h.costBasis * h.qty;
    var gainLoss = price != null && h.costBasis!=null ? (price - h.costBasis) * h.qty : null;
    var gainPct = price != null && h.costBasis ? ((price/h.costBasis-1)*100) : null;
    return { ...h, price:price, value:value, costTotal:costTotal, gainLoss:gainLoss, gainPct:gainPct, trend:d?d.trend:"—", rsi:d?d.rsi:null, ma50:d?d.ma50:null, ma200:d?d.ma200:null };
  });

  // Filters
  var filtered = merged.filter(function(h) {
    if (sectorFilter!=="all" && h.sector!==sectorFilter) return false;
    if (sleeveFilter!=="all" && h.sleeve!==sleeveFilter) return false;
    return true;
  });

  // Summary
  var pricedHoldings = merged.filter(function(h){return h.price!=null&&h.value!=null;});
  var totalValue = pricedHoldings.reduce(function(s,h){return s+Number(h.value||0)},0) + (pf.cash||0);
  var gainRows = pricedHoldings.filter(function(h){return h.gainLoss!=null&&h.costBasis!=null&&Number(h.costBasis)>0;});
  var totalGainLoss = gainRows.reduce(function(s,h){return s+Number(h.gainLoss)},0);
  var totalCostBasis = gainRows.reduce(function(s,h){return s+Number(h.costBasis)*Number(h.qty||0)},0);
  var totalGainPct = gainRows.length&&totalCostBasis>0 ? totalGainLoss/totalCostBasis*100 : null;
  var priceCoverage = merged.length ? Math.round(pricedHoldings.length/merged.length*100) : 0;
  var holdingCount = merged.length;
  var coreCount = merged.filter(function(h){return h.sleeve==="Core"}).length;
  var satCount = merged.filter(function(h){return h.sleeve!=="Core"}).length;

  // Sectors for filter
  var sectors = [];
  merged.forEach(function(h){if(h.sector&&sectors.indexOf(h.sector)<0)sectors.push(h.sector)});

  // CSV Import with smart column detection
  function importCSV() {
    if (!csvText.trim()) return;
    var lines = csvText.trim().split("\n").map(function(l){return l.trim()}).filter(Boolean);
    if (lines.length < 1) return;

    // Detect header row
    var firstLine = lines[0].toLowerCase();
    var hasHeader = firstLine.indexOf("ticker")>=0 || firstLine.indexOf("symbol")>=0 || firstLine.indexOf("name")>=0;
    var headerRow = hasHeader ? lines[0].split(",").map(function(h){return h.trim().replace(/"/g,"").toLowerCase()}) : null;
    var dataLines = hasHeader ? lines.slice(1) : lines;

    // Column mapping — auto-detect from header names
    function colIndex(names) {
      if (!headerRow) return -1;
      for (var i = 0; i < names.length; i++) {
        var idx = headerRow.indexOf(names[i]);
        if (idx >= 0) return idx;
      }
      return -1;
    }
    var tickerIdx = headerRow ? colIndex(["ticker","symbol","sym","stock"]) : 0;
    var nameIdx = headerRow ? colIndex(["name","description","company","asset"]) : 1;
    var sectorIdx = headerRow ? colIndex(["sector","industry","category"]) : 2;
    var weightIdx = headerRow ? colIndex(["weight","allocation","pct","percent"]) : 3;
    var qtyIdx = headerRow ? colIndex(["qty","quantity","shares","units","amount"]) : 4;
    var sleeveIdx = headerRow ? colIndex(["sleeve","type","portfolio","bucket"]) : 5;
    var capIdx = headerRow ? colIndex(["cap","marketcap","size","mktcap"]) : 6;
    var assetIdx = headerRow ? colIndex(["assetclass","asset_class","class"]) : 7;
    var themeIdx = headerRow ? colIndex(["themes","theme","tags"]) : 8;
    var costIdx = headerRow ? colIndex(["costbasis","cost","price","avgprice","avg_price","buyprice","cost_basis"]) : 9;

    // Fallback: if no header, assume ticker is first column
    if (tickerIdx < 0) tickerIdx = 0;

    var newHoldings = [];
    dataLines.forEach(function(line) {
      var parts = line.split(",").map(function(p){return p.trim().replace(/"/g,"")});
      if (parts.length < 1 || !parts[tickerIdx]) return;
      var ticker = parts[tickerIdx].toUpperCase();
      if (!ticker || ticker.length > 10) return;
      var qtyVal=qtyIdx>=0?parseFloat(parts[qtyIdx]):NaN;
      var costVal=costIdx>=0?parseFloat(parts[costIdx]):NaN;
      if(!isFinite(qtyVal)||qtyVal<=0||!isFinite(costVal)||costVal<0) return;
      var weightVal=weightIdx>=0?parseFloat(parts[weightIdx]):null;
      newHoldings.push({
        ticker: ticker,
        name: nameIdx>=0 && parts[nameIdx] ? parts[nameIdx] : ticker,
        sector: sectorIdx>=0 && parts[sectorIdx] ? parts[sectorIdx] : "Unknown",
        weight: isFinite(weightVal)?weightVal:0,
        qty: qtyVal,
        sleeve: sleeveIdx>=0 && parts[sleeveIdx] ? parts[sleeveIdx] : "Core",
        cap: capIdx>=0 && parts[capIdx] ? parts[capIdx] : "Unknown",
        assetClass: assetIdx>=0 && parts[assetIdx] ? parts[assetIdx] : "Equity",
        themes: themeIdx>=0 && parts[themeIdx] ? parts[themeIdx].split(";").filter(Boolean) : [],
        costBasis: costVal,
      });
    });
    if (newHoldings.length > 0) {
      setPortfolios(function(prev){return prev.map(function(p){
        if (p.id !== activePf) return p;
        return { ...p, holdings:p.holdings.concat(newHoldings) };
      })});
      setCsvText("");
      setShowUpload(false);
      setTimeout(refreshPrices, 500);
    }
  }

  // New portfolio
  function createPortfolio() {
    if (!newPfName.trim()) return;
    var id = "pf-" + Date.now();
    setPortfolios(function(prev){return prev.concat([{id:id,name:newPfName,holdings:[],inception:new Date().toISOString().slice(0,10),cash:0}])});
    setActivePf(id);
    setNewPfName("");
    setShowNewPf(false);
  }

  // Group by sleeve
  var coreHoldings = filtered.filter(function(h){return h.sleeve==="Core"});
  var strategicHoldings = filtered.filter(function(h){return h.sleeve==="Strategic"});
  var specHoldings = filtered.filter(function(h){return h.sleeve==="Speculative"});
  var sleeveGroups = [{name:"Core Portfolio",holdings:coreHoldings,color:C.blue},{name:"Strategic Portfolio",holdings:strategicHoldings,color:C.orange},{name:"Speculative Portfolio",holdings:specHoldings,color:C.red}];

  var tdS = { padding:"7px 6px", fontSize:11, borderBottom:"1px solid "+C.border, whiteSpace:"nowrap" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* HEADER */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>🏦 Current Portfolio</div>
          <div style={{ fontSize:11, color:C.textMid }}>{holdingCount} holdings tracked</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={function(){setShowUpload(!showUpload)}} style={{ background:C.blue, border:"none", borderRadius:6, color:C.text, padding:"6px 12px", fontSize:10, fontWeight:700, cursor:"pointer" }}>↑ Upload CSV</button>
          <button onClick={refreshPrices} style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, color:C.textMid, padding:"6px 12px", fontSize:10, fontWeight:700, cursor:"pointer" }}>⟳ Refresh Prices</button>
          <button onClick={function(){setShowNewPf(!showNewPf)}} style={{ background:C.green+"22", border:"1px solid "+C.green+"44", borderRadius:6, color:C.green, padding:"6px 12px", fontSize:10, fontWeight:700, cursor:"pointer" }}>🏦 New Portfolio</button>
        </div>
      </div>

      {/* Portfolio selector */}
      {portfolios.length > 1 && (
        <div style={{ display:"flex", gap:6 }}>
          {portfolios.map(function(p){
            return <button key={p.id} onClick={function(){setActivePf(p.id)}} style={{ background:activePf===p.id?C.blue+"22":C.cardAlt, border:"1px solid "+(activePf===p.id?C.blue:C.border), borderRadius:6, color:activePf===p.id?C.blue:C.textMid, padding:"5px 12px", fontSize:10, fontWeight:600, cursor:"pointer" }}>{p.name}</button>;
          })}
        </div>
      )}

      {/* New Portfolio dialog */}
      {showNewPf && (
        <Card>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={newPfName} onChange={function(e){setNewPfName(e.target.value)}} onKeyDown={function(e){if(e.key==="Enter")createPortfolio()}} placeholder="Portfolio name..." style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:"6px 10px", color:C.text, fontSize:11, flex:1, fontFamily:sans }} />
            <button onClick={createPortfolio} style={{ background:C.green, border:"none", borderRadius:6, color:C.bg, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Create</button>
            <button onClick={function(){setShowNewPf(false)}} style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, color:C.textMid, padding:"6px 10px", fontSize:11, cursor:"pointer" }}>Cancel</button>
          </div>
        </Card>
      )}

      {/* CSV Upload */}
      {showUpload && (
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>↑ Upload CSV</div>
          <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>Upload a .csv file or paste CSV data below. A header row is strongly recommended. Required economic fields: ticker, qty, costBasis. Rows missing valid quantity or cost basis are skipped. Optional: name, sector, weight, sleeve, cap, assetClass, themes (semicolon-separated).</div>

          {/* File drop zone */}
          <div
            onDragOver={function(e){e.preventDefault();e.currentTarget.style.borderColor=C.cyan}}
            onDragLeave={function(e){e.currentTarget.style.borderColor=C.border}}
            onDrop={function(e){
              e.preventDefault();
              e.currentTarget.style.borderColor=C.border;
              var file = e.dataTransfer.files[0];
              if(file){var reader=new FileReader();reader.onload=function(ev){setCsvText(ev.target.result)};reader.readAsText(file)}
            }}
            style={{ border:"2px dashed "+C.border, borderRadius:8, padding:"20px", textAlign:"center", marginBottom:10, cursor:"pointer", transition:"border-color 0.2s" }}
            onClick={function(){document.getElementById("csv-file-input").click()}}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.txt"
              style={{ display:"none" }}
              onChange={function(e){
                var file = e.target.files[0];
                if(file){var reader=new FileReader();reader.onload=function(ev){setCsvText(ev.target.result)};reader.readAsText(file)}
              }}
            />
            <div style={{ fontSize:24, marginBottom:6, opacity:0.4 }}>📄</div>
            <div style={{ fontSize:11, color:C.textMid }}>Drag & drop a CSV file here, or click to browse</div>
            <div style={{ fontSize:9, color:C.textDim, marginTop:4 }}>Accepts .csv and .txt files</div>
          </div>

          {/* Paste area */}
          <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Or paste CSV data:</div>
          <textarea value={csvText} onChange={function(e){setCsvText(e.target.value)}} placeholder={"ticker,name,sector,weight,qty,sleeve,cap,assetClass,themes,costBasis\nAAPL,Apple Inc.,Technology,10,50,Core,Large,Equity,AI;Cloud,150.00\nTSLA,Tesla Inc.,Technology,8,20,Strategic,Large,Equity,EV;AI,180.00"} style={{ width:"100%", height:120, background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, padding:8, color:C.text, fontSize:10, fontFamily:font, resize:"vertical" }} />

          {/* Preview */}
          {csvText.trim() && (function(){
            var lines = csvText.trim().split("\n");
            var headers = lines[0].toLowerCase();
            var isHeader = headers.indexOf("ticker")>=0 || headers.indexOf("symbol")>=0;
            var dataLines = isHeader ? lines.slice(1) : lines;
            var previewCount = Math.min(5, dataLines.length);
            return (
              <div style={{ marginTop:8, background:C.cardAlt, borderRadius:6, padding:8, border:"1px solid "+C.border }}>
                <div style={{ fontSize:10, color:C.green, marginBottom:4 }}>✓ {dataLines.length} rows detected {isHeader?"(header row skipped)":""}</div>
                <div style={{ fontSize:9, color:C.textDim }}>
                  Preview: {dataLines.slice(0, previewCount).map(function(l){
                    var parts = l.split(",");
                    return parts[0];
                  }).join(", ")}{dataLines.length > previewCount ? " ... +"+(dataLines.length-previewCount)+" more" : ""}
                </div>
              </div>
            );
          })()}

          <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
            <button onClick={importCSV} disabled={!csvText.trim()} style={{ background:csvText.trim()?C.blue:C.border, border:"none", borderRadius:6, color:csvText.trim()?C.text:C.textDim, padding:"8px 18px", fontSize:11, fontWeight:700, cursor:csvText.trim()?"pointer":"default" }}>Import CSV</button>
            <button onClick={function(){setCsvText("");setShowUpload(false)}} style={{ background:C.cardAlt, border:"1px solid "+C.border, borderRadius:6, color:C.textMid, padding:"8px 14px", fontSize:11, cursor:"pointer" }}>Cancel</button>
            {csvText.trim() && <button onClick={function(){setCsvText("")}} style={{ background:"transparent", border:"none", color:C.red, fontSize:10, cursor:"pointer" }}>Clear</button>}
          </div>

          <div style={{ marginTop:10, background:C.cardAlt, borderRadius:6, padding:8, border:"1px solid "+C.border }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:1, marginBottom:4 }}>SUPPORTED FORMATS</div>
            <div style={{ fontSize:9, color:C.textDim, lineHeight:1.6 }}>
              <div><strong style={{ color:C.text }}>Minimal:</strong> ticker,qty,costBasis</div>
              <div><strong style={{ color:C.text }}>Standard:</strong> ticker,name,sector,weight,qty,sleeve,cap,assetClass,themes,costBasis</div>
              <div><strong style={{ color:C.text }}>Broker export:</strong> Auto-detects columns named: Symbol/Ticker, Quantity/Qty/Shares, Price/Cost/CostBasis, Name/Description, Sector</div>
            </div>
          </div>
        </Card>
      )}

      {/* SUMMARY CARDS */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <Card style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:6 }}>CONNECTED VALUE + CASH</div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:font }}>${totalValue.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          <div style={{fontSize:9,color:C.textDim,marginTop:2}}>{priceCoverage}% connected-price coverage</div>
        </Card>
        <Card style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:6 }}>CONNECTED GAIN/LOSS</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12 }}>📈</span>
            <span style={{ fontSize:26, fontWeight:700, fontFamily:font, color:gainRows.length?(totalGainLoss>=0?C.green:C.red):C.textDim }}>{gainRows.length?((totalGainLoss>=0?"+":"-")+"$"+Math.abs(totalGainLoss).toLocaleString(undefined,{maximumFractionDigits:2})):"—"}</span>
          </div>
          <div style={{ fontSize:11, color:totalGainPct>=0?C.green:C.red, marginTop:2 }}>{totalGainPct==null?"—":(totalGainPct>=0?"+":"")+totalGainPct.toFixed(2)+"% since cost basis"}</div>
        </Card>
        <Card style={{ padding:"14px 16px" }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:6 }}>HOLDINGS</div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:font }}>{holdingCount}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>○ {coreCount} ({merged.filter(function(h){return h.sleeve==="Core"}).reduce(function(s,h){return s+h.weight},0)}%) · ◎ {satCount} ({merged.filter(function(h){return h.sleeve!=="Core"}).reduce(function(s,h){return s+h.weight},0)}%)</div>
          {lastUpdate && <div style={{ fontSize:9, color:C.textDim, marginTop:2 }}>Updated {lastUpdate}</div>}
        </Card>
      </div>

      {/* COST-BASIS SNAPSHOT */}
      <Card>
        {(function(){
          var valid=merged.filter(function(h){return h.price!=null&&h.qty!=null&&h.costBasis!=null;});
          var totalCost=valid.reduce(function(a,h){return a+Number(h.costBasis)*Number(h.qty)},0);
          var currentMV=valid.reduce(function(a,h){return a+Number(h.price)*Number(h.qty)},0);
          var gl=currentMV-totalCost;
          var glPct=totalCost>0?gl/totalCost*100:null;
          var winners=valid.filter(function(h){return Number(h.price)>=Number(h.costBasis)}).length;
          var losers=valid.length-winners;
          var best=valid.slice().sort(function(a,b){return (b.gainPct||0)-(a.gainPct||0)})[0]||null;
          var worst=valid.slice().sort(function(a,b){return (a.gainPct||0)-(b.gainPct||0)})[0]||null;
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12}}><div><div style={{fontSize:13,fontWeight:800}}>🧾 Cost-Basis Snapshot</div><div style={{fontSize:9,color:C.textDim,marginTop:3}}>Current market values compared with the sample holdings' fixed cost bases. This is not a time-period performance series.</div></div><Badge label="COST BASIS" color={C.cyan}/></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:8}}>
              {[
                {l:"INVESTED COST",v:totalCost?"$"+totalCost.toLocaleString(undefined,{maximumFractionDigits:0}):"—",c:C.text},
                {l:"CURRENT MARKET VALUE",v:currentMV?"$"+currentMV.toLocaleString(undefined,{maximumFractionDigits:0}):"—",c:C.cyan},
                {l:"SINCE-COST G/L",v:valid.length?(gl>=0?"+":"-")+"$"+Math.abs(gl).toLocaleString(undefined,{maximumFractionDigits:0}):"—",c:gl>=0?C.green:C.red},
                {l:"SINCE-COST %",v:glPct==null?"—":(glPct>=0?"+":"")+glPct.toFixed(1)+"%",c:glPct>=0?C.green:C.red},
                {l:"WINNERS / LOSERS",v:winners+" / "+losers,c:C.purple},
                {l:"COVERAGE",v:valid.length+" / "+merged.length,c:C.orange}
              ].map(function(x){return <div key={x.l} style={{background:C.cardAlt,border:"1px solid "+C.border,borderRadius:6,padding:"8px 9px"}}><div style={{fontSize:7,color:C.textDim,letterSpacing:1}}>{x.l}</div><div style={{fontFamily:font,fontSize:14,fontWeight:800,color:x.c,marginTop:4}}>{x.v}</div></div>;})}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:9}}><div style={{background:C.green+"08",border:"1px solid "+C.green+"22",borderRadius:6,padding:"8px 10px",fontSize:10}}>Best since cost basis: <b style={{color:C.cyan}}>{best?best.ticker:"—"}</b> {best&&best.gainPct!=null?((best.gainPct>=0?"+":"")+best.gainPct.toFixed(1)+"%"):""}</div><div style={{background:C.red+"08",border:"1px solid "+C.red+"22",borderRadius:6,padding:"8px 10px",fontSize:10}}>Weakest since cost basis: <b style={{color:C.cyan}}>{worst?worst.ticker:"—"}</b> {worst&&worst.gainPct!=null?((worst.gainPct>=0?"+":"")+worst.gainPct.toFixed(1)+"%"):""}</div></div>
            <div style={{fontSize:9,color:C.textDim,lineHeight:1.6,marginTop:9}}>A true 6M/1Y return, Sharpe ratio, Sortino ratio, beta, realized volatility and maximum drawdown require dated historical portfolio valuations/returns. Those metrics are intentionally withheld until a validated portfolio equity-curve feed is connected.</div>
          </div>;
        })()}
      </Card>

      {/* FILTERS */}
      <div style={{ display:"flex", gap:8, fontSize:10 }}>
        <span style={{ color:C.textDim, padding:"4px 0" }}>FILTERS:</span>
        <select value={sectorFilter} onChange={function(e){setSectorFilter(e.target.value)}} style={{ background:C.cardAlt, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 8px", fontSize:10 }}>
          <option value="all">All Sectors</option>
          {sectors.map(function(s){return <option key={s} value={s}>{s}</option>})}
        </select>
        <select value={sleeveFilter} onChange={function(e){setSleeveFilter(e.target.value)}} style={{ background:C.cardAlt, color:C.text, border:"1px solid "+C.border, borderRadius:4, padding:"3px 8px", fontSize:10 }}>
          <option value="all">All Sleeves</option>
          <option value="Core">Core</option>
          <option value="Strategic">Strategic</option>
          <option value="Speculative">Speculative</option>
        </select>
      </div>

      {/* HOLDINGS TABLE grouped by sleeve */}
      {sleeveGroups.filter(function(g){return g.holdings.length>0}).map(function(group){
        var groupPriced = group.holdings.filter(function(h){return h.value!=null;});
        var groupValue = groupPriced.reduce(function(s,h){return s+Number(h.value)},0);
        var groupGLRows = group.holdings.filter(function(h){return h.gainLoss!=null;});
        var groupGL = groupGLRows.reduce(function(s,h){return s+Number(h.gainLoss)},0);
        return (
          <Card key={group.name} style={{ padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:group.color, fontSize:12 }}>◎</span>
                <span style={{ fontSize:13, fontWeight:700, color:group.color }}>{group.name}</span>
                <span style={{ fontSize:10, color:C.textDim }}>{group.holdings.length} holdings</span>
              </div>
              <div style={{ fontSize:10, color:C.textDim }}>
                Value: <span style={{ color:C.text, fontWeight:700, fontFamily:font }}>{groupPriced.length?"$"+groupValue.toLocaleString(undefined,{maximumFractionDigits:2}):"—"}</span>
                <span style={{ marginLeft:8 }}>G/L: <span style={{ color:groupGLRows.length?(groupGL>=0?C.green:C.red):C.textDim, fontWeight:700, fontFamily:font }}>{groupGLRows.length?((groupGL>=0?"+":"-")+"$"+Math.abs(groupGL).toLocaleString(undefined,{maximumFractionDigits:2})):"—"}</span></span>
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1100 }}>
                <thead><tr style={{ borderBottom:"1px solid "+C.border }}>
                  {["#","ASSET NAME","TICKER","QTY","PRICE","BOOK COST","VALUE","GAIN/LOSS","G/L %","THEMES"].map(function(h){
                    return <th key={h} style={{ textAlign:["PRICE","BOOK COST","VALUE","GAIN/LOSS","G/L %","QTY"].indexOf(h)>=0?"right":"left", padding:"6px", color:C.textDim, fontSize:8, fontWeight:700, letterSpacing:1 }}>{h}</th>;
                  })}
                </tr></thead>
                <tbody>
                  {group.holdings.map(function(h,i){
                    return <tr key={h.ticker} onClick={function(){setSelTicker(selTicker===h.ticker?null:h.ticker)}} style={{ borderBottom:"1px solid "+C.border, cursor:"pointer", background:selTicker===h.ticker?C.blue+"18":"transparent" }}>
                      <td style={{ ...tdS, color:C.textDim, fontSize:10 }}>{i+1}</td>
                      <td style={tdS}>
                        <div style={{ fontWeight:600, fontSize:11 }}>{h.name}</div>
                        <div style={{ display:"flex", gap:3, marginTop:2 }}>{(h.themes||[]).slice(0,1).map(function(t){return <span key={t} style={{ background:C.purple+"22", color:C.purple, borderRadius:3, padding:"0 4px", fontSize:7 }}>{t}</span>})}</div>
                      </td>
                      <td style={{ ...tdS, fontWeight:700, color:C.cyan, fontFamily:font, fontSize:11 }}>{h.ticker}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10 }}>{h.qty}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10 }}>{h.price?"$"+h.price.toFixed(2):"—"}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:C.textDim }}>${(h.costTotal||0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, fontWeight:600 }}>{h.value!=null?"$"+Number(h.value).toLocaleString(undefined,{maximumFractionDigits:2}):"—"}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.gainLoss==null?C.textDim:(h.gainLoss>=0?C.green:C.red) }}>{h.gainLoss==null?"—":((h.gainLoss>=0?"+":"-")+"$"+Math.abs(Number(h.gainLoss)).toLocaleString(undefined,{maximumFractionDigits:2}))}</td>
                      <td style={{ ...tdS, textAlign:"right", fontFamily:font, fontSize:10, color:h.gainPct==null?C.textDim:(h.gainPct>=0?C.green:C.red), fontWeight:700 }}>{h.gainPct==null?"—":((h.gainPct>=0?"+":"")+Number(h.gainPct).toFixed(2)+"%")}</td>
                      <td style={{ ...tdS, fontSize:9, color:C.textDim }}>{(h.themes||[]).join(", ")}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {/* TradingView chart */}
      {selTicker && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px 0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12 }}>📈</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.cyan, fontFamily:font }}>{selTicker}</span>
              <Badge label="TradingView" color={C.blue} />
            </div>
            <button onClick={function(){setSelTicker(null)}} style={{ background:"transparent", border:"1px solid "+C.border, borderRadius:4, color:C.textDim, padding:"2px 8px", cursor:"pointer", fontSize:10 }}>✕</button>
          </div>
          <TradingViewChart ticker={selTicker} />
        </Card>
      )}

      {/* Earnings dates intentionally live in Financials → Earnings.
          Keeping them out of this portfolio view prevents stale hard-coded dates. */}
      {/* Cash on account */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>💵 Fiat Cash on Account</div>
          <span style={{ fontSize:10, color:C.textDim }}>${(pf.cash||0).toLocaleString()} total</span>
        </div>
        <div style={{ background:C.green+"15", borderRadius:6, padding:"8px 12px", marginTop:8, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>USD</span>
          <span style={{ fontSize:11, fontFamily:font }}>${(pf.cash||0).toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}
