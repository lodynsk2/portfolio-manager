import { useState, useCallback, useEffect } from "react";

/* ─── CHANGE THIS to your Vercel deployment URL ─────────────────── */
var PROXY_URL = "https://portfolio-proxy-ja56.vercel.app/api/market";
var FRED_URL = "https://portfolio-proxy-ja56.vercel.app/api/fred";
var SECTORS_URL = "https://portfolio-proxy-ja56.vercel.app/api/sectors";
var FG_URL = "https://portfolio-proxy-ja56.vercel.app/api/feargreed";

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
  inflation:{ cpi:"2.8", trend:"Stable", truflation:"1.80", spread:"-1.00", note:"Lead indicators point to falling inflation over the next 90 days" },
  liquidity:{ total:"17.4", score:"58", roc13w:"-0.40", roc52w:"-1.8", trend:"Contractionary" },
  credit:{ moveIndex:"108.0", moveSignal:"Elevated", hyDAS:"340", igHyDiff:"65", tightNote:"Tight — Complacency Risk", sloosNote:"Net Tightening", goldCopper:"850", sahmRule:"0.30", ccDelinquency:"3.1" },
  breadth:{ pct50:"38.2", pct200:"54.6", ad5d:"Falling", ad20d:"Falling", sentiment:"BEARISH", note:"Narrow participation — majority of stocks below 50-day MA" },
  fci:{ value:"-2.10", nfci:"-0.38", status:"Loose", fedFunds:"+0.7", t10y:"+1.1", hySpread:"0.8", sp500load:"-2.0", usd:"+0.6" },
  options:{ dexPCR:"1.42", omegaPCR:"1.18", status:"BEARISH", conviction:"42" },
  macroIndic:{ usM2:"$21.8T", usM2Trend:"Rising", usM2Change:"+0.3%", ismPMI:"103.2", ismStatus:"Expanding", ismLabel:"Industrial Production", globalM2:"$17.4T", globalM2Trend:"Falling" },
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
  aiAnalysis:"The macro environment has shifted decisively risk-off. The S&P 500 at 6,408 sits well below both its 50-day (6,615) and 200-day (6,768) moving averages — a bearish alignment not seen since early 2024. The VIX spike to 27.44 (+8.3%) confirms elevated hedging demand, while the CNN Fear & Greed Index at 18 (Extreme Fear) signals broad capitulation sentiment. Fed funds at 4.33% remain restrictive, though market pricing implies one cut by year-end.\n\nSentiment indicators are uniformly bearish. The crypto Fear & Greed Index plunged to 10 — its lowest since the FTX collapse — while Bitcoin tests $70K support. Market breadth is deteriorating with only 38% of S&P 500 stocks above their 50-day MA. The CBOE put/call ratio at 1.42 reflects heavy hedging activity. Despite this, credit spreads remain relatively tight at 340bp HY OAS, suggesting the stress is concentrated in equities rather than credit markets.\n\nSector rotation strongly favors defensives. Utilities (+11.2% 6M), Healthcare (+8.4%), and Consumer Staples (+6.1%) are leading while Technology and Consumer Discretionary lag. The DXY at 99.86 remains weak, providing some support for EM equities and commodities. Tactical positioning: overweight defensives, gold, and cash; underweight high-beta, growth, and crypto until VIX retreats below 20 and breadth recovers above 50%.",
};

function parseFGLabel(score) {
  if (score == null) return "—";
  if (score <= 25) return "Extreme Fear";
  if (score <= 44) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
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

      // Attempt 2: Claude API with web_search (works in sandbox)
      if (!parsed) {
        var d = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
        var response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: [{ role: "user", content: "Today is " + d + ". Search for current S&P 500 price, VIX, DXY, 10Y yield. Return ONLY JSON, no other text: {\"sp500\":\"6xxx.xx\",\"sp500Chg\":\"-x.xx\",\"vix\":\"xx.xx\",\"vixChg\":\"+x.xx\",\"dxy\":\"xxx.xx\",\"t10y\":\"x.xx\"}" }]
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
    description: "Auto-detected: GDP " + (growthRising ? "▲" : "▼") + " " + gdpCurrent.toFixed(0) +
      " | CPI " + (inflationRising ? "▲" : "▼") + " " + cpiCurrent.toFixed(1) +
      " | Fed Funds " + fedCurrent.toFixed(2) + "%" +
      " | Yield Curve " + (yieldCurve >= 0 ? "+" : "") + yieldCurve.toFixed(2) +
      " | HY Spread " + hySpreadVal.toFixed(2) + "%" +
      " | Sahm Rule " + sahmVal.toFixed(2)
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
    // Industrial Production (ISM PMI substitute — ISM licensed, not on FRED)
    // INDPRO = index, 2017=100. >100 = above baseline, trend matters more than level.
    if (fredJson.INDPRO) {
      var indVal = parseFloat(fredJson.INDPRO);
      var indPrev = parseFloat(fredJson.INDPRO_PREV);
      var hasIndPrev = !isNaN(indPrev) && indPrev > 0;
      out.macroIndic = { ...out.macroIndic,
        ismPMI: indVal.toFixed(1),
        ismStatus: hasIndPrev ? (indVal > indPrev ? "Expanding" : "Contracting") : "Neutral",
        ismLabel: "Industrial Production"
      };
    } else if (fredJson.MANEMP) {
      // Fallback — manufacturing employment (thousands)
      var manVal = parseFloat(fredJson.MANEMP);
      var manPrev = parseFloat(fredJson.MANEMP_PREV);
      var hasManPrev = !isNaN(manPrev) && manPrev > 0;
      out.macroIndic = { ...out.macroIndic,
        ismPMI: (manVal / 1000).toFixed(1) + "M",
        ismStatus: hasManPrev ? (manVal > manPrev ? "Expanding" : "Contracting") : "Neutral",
        ismLabel: "Mfg Employment"
      };
    }
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
        cryptoLabel: fgJson.cryptoLabel || prev.fg.cryptoLabel
      };
    }
    return out;
  });
  setRefreshStatus("Fear & Greed updated!");
} catch(fgErr) {
  console.warn("F&G fetch failed:", fgErr.message);
}
  }
} catch(secErr) {
  console.warn("Sector fetch failed:", secErr.message);
}
} catch(fredErr) {
  console.warn("FRED fetch failed:", fredErr.message);
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
        {stage!==1 && (
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


function MacroStage({ d }) {
  const sc = SC[d.macroRegime?.season] || C.gold;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ROW 1: Regime */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
        <Card glow={sc}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:10 }}>Macro Regime</div>
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

      {/* ROW 1b: Indices — S&P + Nasdaq + Bitcoin */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="📈" title="S&P 500" />
          <div>
            <div style={{ fontSize:29, fontWeight:700, fontFamily:font, marginBottom:3 }}>{d.sp500?.price}</div>
            <div style={{ fontSize:13, color:String(d.sp500?.change||"").startsWith("-")?C.red:C.green, marginBottom:10, fontFamily:font }}>{d.sp500?.change}%</div>
            <div style={{ marginBottom:8 }}><Badge label={d.sp500?.sentiment} color={d.sp500?.sentiment==="BEARISH"?C.red:d.sp500?.sentiment==="BULLISH"?C.green:C.textMid} /></div>
          </div>
          <Row label="50 DMA" val={d.sp500?.dma50} color={C.red} />
          <Row label="200 DMA" val={d.sp500?.dma200} color={C.red} />
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
          <SecTitle icon="💻" title="Nasdaq" />
          <div>
            <div style={{ fontSize:29, fontWeight:700, fontFamily:font, marginBottom:3 }}>{d.nasdaq?.price}</div>
            <div style={{ fontSize:13, color:String(d.nasdaq?.change||"").startsWith("-")?C.red:C.green, marginBottom:10, fontFamily:font }}>{d.nasdaq?.change}%</div>
            <div style={{ marginBottom:8 }}><Badge label={d.nasdaq?.sentiment} color={d.nasdaq?.sentiment==="BEARISH"?C.red:d.nasdaq?.sentiment==="BULLISH"?C.green:C.textMid} /></div>
          </div>
          <Row label="50 DMA" val={d.nasdaq?.dma50} color={C.red} />
          <Row label="200 DMA" val={d.nasdaq?.dma200} color={C.red} />
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
          <div>
            <div style={{ fontSize:29, fontWeight:700, fontFamily:font, marginBottom:3 }}>{d.bitcoin?.price}</div>
            <div style={{ fontSize:13, color:String(d.bitcoin?.change||"").startsWith("-")?C.red:C.green, marginBottom:10, fontFamily:font }}>{d.bitcoin?.change}%</div>
            <div style={{ marginBottom:8 }}><Badge label={d.bitcoin?.sentiment} color={d.bitcoin?.sentiment==="BEARISH"?C.red:d.bitcoin?.sentiment==="BULLISH"?C.green:C.textMid} /></div>
          </div>
          <Row label="50 DMA" val={d.bitcoin?.dma50} color={C.red} />
          <Row label="200 DMA" val={d.bitcoin?.dma200} color={C.red} />
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
       <Card>
          <SecTitle icon="↘" title="Forward Rates" />
          {false ? <Skel w="80px" h={20} mb={12} /> : (
            <div>
              <div style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>Status</div>
              <div style={{ fontSize:22, fontWeight:700, color:d.rates?.status==="EASING"?C.green:d.rates?.status==="TIGHTENING"?C.red:C.orange, marginBottom:12 }}>{d.rates?.status}</div>
              <p style={{ fontSize:11, color:C.textMid, margin:"0 0 12px", lineHeight:1.4 }}>
                {d.rates?.status==="EASING" 
                  ? "The Fed is cutting rates. Good for stocks, mortgages, and borrowers. Economy might be slowing." 
                  : d.rates?.status==="TIGHTENING" 
                  ? "The Fed is raising rates. Expensive to borrow, bonds more attractive. Fighting inflation."
                  : "The Fed is holding steady. No major changes coming. Market waiting for clarity."}
              </p>
            </div>
          )}
          
          <div style={{ marginBottom:12, paddingBottom:12, borderTop:"1px solid " + C.border, borderBottom:"1px solid " + C.border, paddingTop:12 }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Current Fed Funds Rate</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:font, marginBottom:2 }}>{d.rates?.current}%</div>
            <p style={{ fontSize:10, color:C.textDim, margin:0 }}>What banks charge each other to borrow overnight</p>
          </div>

          <div style={{ marginBottom:12, paddingBottom:12, borderBottom:"1px solid " + C.border }}>
            <div style={{ display:"flex", justifyContent:"center", margin:"8px 0" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:(d.rates?.status==="EASING"?C.green:C.red)+"20", border:"1px solid transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{d.rates?.status==="EASING"?"↘":"↗"}</div>
            </div>
            <p style={{ fontSize:10, color:C.textDim, textAlign:"center", margin:0 }}>
              {d.rates?.status==="EASING" ? "Rates heading DOWN" : d.rates?.status==="TIGHTENING" ? "Rates heading UP" : "Rates STEADY"}
            </p>
          </div>

          <div>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Market expects by year end</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:font, marginBottom:6 }}>{d.rates?.expected}%</div>
            <div style={{ fontSize:10, color:C.textDim, background:C.cardAlt, padding:"6px 8px", borderRadius:4 }}>
              {d.rates?.impliedCuts === "-1" 
                ? "Market prices in about 1 rate cut before December" 
                : d.rates?.impliedCuts === "-2" 
                ? "Market prices in about 2 rate cuts" 
                : "No major cuts or hikes expected"}
            </div>
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

          <div style={{ marginBottom:12, paddingBottom:12, borderBottom:"1px solid " + C.border }}>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:6 }}>What this means</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Short-term (2Y)</div>
                <p style={{ fontSize:11, color:C.textMid, margin:0 }}>What people think will happen soon</p>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Long-term (10Y)</div>
                <p style={{ fontSize:11, color:C.textMid, margin:0 }}>What people expect over 10 years</p>
              </div>
            </div>
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
      </div>

      {/* ROW 3: F&G + VIX + Inflation */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="🎯" title="Fear & Greed Index" />
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

      {/* ROW 4: Liquidity + Credit + Breadth */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Card>
          <SecTitle icon="💧" title="Global Liquidity" badge={d.liquidity?.trend} bc={d.liquidity?.trend==="Contractionary"?C.red:d.liquidity?.trend==="Expansionary"?C.green:C.yellow} />
          <div style={{ fontSize:26, fontWeight:700, fontFamily:font, marginBottom:2 }}>${d.liquidity?.total}T</div>
          <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Score: {d.liquidity?.score}/100</div>
          <div style={{ display:"flex", gap:12, marginBottom:10 }}>
            <div><div style={{ fontSize:10, color:C.textDim }}>13w RoC</div><div style={{ fontSize:13, color:C.red, fontFamily:font }}>▼ {d.liquidity?.roc13w}%</div></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>52w</div><div style={{ fontSize:13, color:C.red, fontFamily:font }}>{d.liquidity?.roc52w}%</div></div>
          </div>
          <div style={{ background:C.cardAlt, borderRadius:4, padding:"6px 6px 0", marginBottom:8 }}>
            <div style={{ fontSize:9, color:C.textDim, marginBottom:4 }}>CB Balance Sheets (USD $T)</div>
         <div style={{ position:"relative" }}>
  <svg width="100%" height="70" viewBox="0 0 240 70" preserveAspectRatio="none" style={{ display:"block" }}>
    {(function() {
      var fedT = parseFloat(d.liquidity?.fedTotal || "6.6");
      var ecbT = parseFloat(d.liquidity?.ecbTotal || "6.2");
      var bojT = parseFloat(d.liquidity?.bojTotal || "4.6");
      var pbocT = parseFloat(d.liquidity?.pbocTotal || "6.0");
      var total = fedT + ecbT + bojT + pbocT;
      var fedH = Math.round((fedT / total) * 65);
      var ecbH = Math.round((ecbT / total) * 65);
      var bojH = Math.round((bojT / total) * 65);
      var pbocH = Math.round((pbocT / total) * 65);
      var y4 = 68;
      var y3 = y4 - pbocH;
      var y2 = y3 - bojH;
      var y1 = y2 - ecbH;
      var y0 = y1 - fedH;
      return (
        <>
          <polygon points={"0," + y0 + " 240," + (y0-2) + " 240,0 0,0"} fill={C.blue} opacity="0.7">
            <title>Fed: ${fedT.toFixed(1)}T</title>
          </polygon>
          <polygon points={"0," + y1 + " 240," + (y1-2) + " 240," + y0 + " 0," + y0} fill={C.orange} opacity="0.7">
            <title>ECB: ${ecbT.toFixed(1)}T</title>
          </polygon>
          <polygon points={"0," + y2 + " 240," + (y2-2) + " 240," + y1 + " 0," + y1} fill={C.red} opacity="0.7">
            <title>BoJ: ${bojT.toFixed(1)}T</title>
          </polygon>
          <polygon points={"0,68 240,68 240," + y2 + " 0," + y2} fill={C.cyan} opacity="0.7">
            <title>PBoC: ${pbocT.toFixed(1)}T</title>
          </polygon>
        </>
      );
    })()}
  </svg>
  <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, display:"flex", flexDirection:"column" }}>
    {(function() {
      var fedT = parseFloat(d.liquidity?.fedTotal || "6.6");
      var ecbT = parseFloat(d.liquidity?.ecbTotal || "6.2");
      var bojT = parseFloat(d.liquidity?.bojTotal || "4.6");
      var pbocT = parseFloat(d.liquidity?.pbocTotal || "6.0");
      var total = fedT + ecbT + bojT + pbocT;
      var banks = [
        { label:"Fed", val:fedT, color:C.blue },
        { label:"ECB", val:ecbT, color:C.orange },
        { label:"BoJ", val:bojT, color:C.red },
        { label:"PBoC", val:pbocT, color:C.cyan },
      ];
      return banks.map(function(b) {
        var h = Math.round((b.val / total) * 70);
        return (
          <div key={b.label} style={{ height:h, width:"100%", cursor:"crosshair", display:"flex", alignItems:"center", justifyContent:"center", opacity:0 , transition:"opacity 0.2s" }}
            onMouseEnter={function(e){ e.currentTarget.style.opacity="1"; }}
            onMouseLeave={function(e){ e.currentTarget.style.opacity="0"; }}
          >
            <div style={{ background:"rgba(0,0,0,0.85)", border:"1px solid " + b.color, borderRadius:4, padding:"2px 8px", fontSize:11, color:b.color, fontFamily:font, fontWeight:700, pointerEvents:"none" }}>
              {b.label}: ${b.val.toFixed(1)}T
            </div>
          </div>
        );
      });
    })()}
  </div>
</div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim, marginTop:2 }}>
              <span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2026</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, fontSize:9, flexWrap:"wrap" }}>
            {["Fed (net)","ECB","BoJ","PBoC","BoE"].map((l,i) => <span key={l} style={{ color:[C.blue,C.orange,C.red,C.cyan,C.purple][i] }}>● {l}</span>)}
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ height:4, background:"linear-gradient(90deg," + C.red + "," + C.yellow + "," + C.green + ")", borderRadius:2 }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim, marginTop:2 }}><span>Tight</span><span>Neutral</span><span>Loose</span></div>
          </div>
        </Card>

        {/* MACRO INDICATORS */}
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

            {/* Industrial Production (ISM substitute) */}
            <div style={{ background:C.cardAlt, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:10, color:C.textDim, marginBottom:4, fontWeight:700 }}>{d.macroIndic?.ismLabel || "Industrial Production"}</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:font, color: d.macroIndic?.ismStatus==="Expanding" ? C.green : d.macroIndic?.ismStatus==="Contracting" ? C.red : C.orange, marginBottom:6 }}>
                {d.macroIndic?.ismStatus==="Expanding" ? "▲ " : d.macroIndic?.ismStatus==="Contracting" ? "▼ " : ""}{d.macroIndic?.ismPMI || "—"}
              </div>
              <p style={{ fontSize:11, color:C.textMid, margin:0, lineHeight:1.4 }}>
                {d.macroIndic?.ismStatus==="Expanding"
                  ? "Production rising vs prior month. Economic strength."
                  : d.macroIndic?.ismStatus==="Contracting"
                  ? "Production falling vs prior month. Economic weakness."
                  : "Rising = economic growth · Falling = contraction"}
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

        <Card>
          <SecTitle icon="⚠" title="Credit & Bond Stress" badge={"MOVE: " + (d.credit?.moveSignal||"—")} bc={C.orange} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
            <div style={{ gridColumn:"1/-1" }}><span style={{ fontSize:9, letterSpacing:1.5, color:C.textDim, textTransform:"uppercase" }}>Bond Volatility</span></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>MOVE Index</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.moveIndex}</div></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>MOVE/VIX Signal</div><div style={{ color:C.orange, fontFamily:font }}>{d.credit?.moveSignal}</div></div>
            <div style={{ gridColumn:"1/-1", borderTop:"1px solid " + C.border, paddingTop:5, marginTop:2 }}><span style={{ fontSize:9, letterSpacing:1.5, color:C.textDim, textTransform:"uppercase" }}>Credit Spreads</span></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>HY DAS (bp)</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.hyDAS}</div></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>IG-HY Diff (bp)</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.igHyDiff}</div></div>
            <div style={{ gridColumn:"1/-1", fontSize:10, color:C.orange }}>{d.credit?.tightNote}</div>
            <div style={{ gridColumn:"1/-1", borderTop:"1px solid " + C.border, paddingTop:5, marginTop:2 }}><span style={{ fontSize:9, letterSpacing:1.5, color:C.textDim, textTransform:"uppercase" }}>Lending Conditions</span></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>SLOOS</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.sloosNote}</div></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>Gold / Copper</div><div style={{ color:C.red, fontFamily:font }}>{d.credit?.goldCopper}</div></div>
            <div style={{ gridColumn:"1/-1", borderTop:"1px solid " + C.border, paddingTop:5, marginTop:2 }}><span style={{ fontSize:9, letterSpacing:1.5, color:C.textDim, textTransform:"uppercase" }}>Consumer Stress</span></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>Sahm Rule</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.sahmRule}</div></div>
            <div><div style={{ fontSize:10, color:C.textDim }}>CC Delinquency</div><div style={{ color:C.text, fontFamily:font }}>{d.credit?.ccDelinquency}%</div></div>
          </div>
        </Card>

        <Card>
          <SecTitle icon="📊" title="Market Breadth" badge={d.breadth?.sentiment} bc={d.breadth?.sentiment==="BEARISH"?C.red:C.green} />
          
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

      {/* OPTIONS SENTIMENT */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13 }}>📡</span>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>Options Sentiment</span>
          </div>
          <Badge label={d.options?.status||"NEUTRAL"} color={d.options?.status==="BULLISH"?C.green:d.options?.status==="BEARISH"?C.red:C.textMid} />
        </div>

        <div style={{ background:C.cardAlt, borderRadius:6, padding:10, marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>
            <strong style={{ color:C.text }}>What this means:</strong> Options traders bet on stock direction. Smart money (institutions) vs dumb money (retail) — who's buying protection or betting on crashes?
          </div>
        </div>

        <div style={{ marginBottom:14, paddingBottom:14, borderTop:"1px solid " + C.border, borderBottom:"1px solid " + C.border, paddingTop:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, color:C.textDim, fontWeight:700, marginBottom:6 }}>🏦 DEX PCR (Institutions)</div>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:C.red }}>{d.options?.dexPCR}</div>
              <p style={{ margin:"6px 0 0", fontSize:10, color:C.textDim }}>Puts-to-Calls</p>
            </div>
            <Badge label={parseFloat(d.options?.dexPCR) > 1.3 ? "BEARISH" : "NEUTRAL"} color={parseFloat(d.options?.dexPCR) > 1.3 ? C.red : C.orange} />
          </div>
          <p style={{ margin:0, fontSize:11, color:C.textMid, lineHeight:1.5 }}>Smart money buying insurance against stocks falling. When > 1.3, fear among pros.</p>
        </div>

        <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"1px solid " + C.border }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, color:C.textDim, fontWeight:700, marginBottom:6 }}>📱 Omega PCR (Retail)</div>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:font, color:C.orange }}>{d.options?.omegaPCR}</div>
              <p style={{ margin:"6px 0 0", fontSize:10, color:C.textDim }}>Puts-to-Calls</p>
            </div>
            <Badge label={parseFloat(d.options?.omegaPCR) > 1.3 ? "BEARISH" : "NEUTRAL"} color={parseFloat(d.options?.omegaPCR) > 1.3 ? C.red : C.orange} />
          </div>
          <p style={{ margin:0, fontSize:11, color:C.textMid, lineHeight:1.5 }}>Retail traders hedging bets. Less nervous than institutions. When > 1.0, they see risk ahead.</p>
        </div>

        <div style={{ background:(d.options?.status==="BEARISH"?C.red:C.green)+"15", border:"1px solid " + (d.options?.status==="BEARISH"?C.red:C.green) + "40", borderRadius:6, padding:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:d.options?.status==="BEARISH"?C.red:C.green }}>Conviction</div>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:font, color:d.options?.status==="BEARISH"?C.red:C.green }}>{d.options?.conviction}%</div>
          </div>
          <p style={{ margin:0, fontSize:11, color:C.textMid, lineHeight:1.5 }}>
            {d.options?.status === "BEARISH" ? "Moderately bearish. Hedging but not panicked. Caution flag." : "Balanced. Mixed signals. Neither bullish nor bearish."}
          </p>
        </div>
      </Card>

      {/* FCI */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase", marginBottom:4 }}>Financial Conditions Index</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              {false ? <Skel w="80px" h={32} mb={0} /> : <span style={{ fontSize:32, fontWeight:700, fontFamily:font, color:d.fci?.status==="Loose"?C.green:d.fci?.status==="Tight"?C.red:C.yellow }}>{d.fci?.nfci||"—"}</span>}
              <span style={{ fontSize:12, color:C.textMid }}>NFCI ({d.fci?.status||"—"})</span>
            </div>
          </div>
          <Badge label={d.fci?.status||"—"} color={d.fci?.status==="Loose"?C.green:d.fci?.status==="Tight"?C.red:C.yellow} />
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textDim, marginBottom:3 }}><span>Looser</span><span>Tighter</span></div>
          <div style={{ height:5, background:C.border, borderRadius:3 }}>
            <div style={{ width:"17%", height:"100%", background:"linear-gradient(90deg," + C.green + "," + C.cyan + ")", borderRadius:3 }} />
          </div>
        </div>
        <div style={{ background:C.cardAlt, borderRadius:6, padding:"10px 10px 6px", marginBottom:12 }}>
          <div style={{ fontSize:9, color:C.textDim, marginBottom:6 }}>FCI History (z-score)</div>
          <svg width="100%" height="100" viewBox="0 0 800 100" preserveAspectRatio="none" style={{ display:"block" }}>
            <rect x="0" y="0" width="800" height="40" fill={C.red} opacity="0.08" />
            <rect x="0" y="60" width="800" height="40" fill={C.green} opacity="0.06" />
            <line x1="0" y1="50" x2="800" y2="50" stroke={C.textDim} strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
            <polyline points="0,30 45,35 90,42 135,38 180,55 220,60 265,62 310,55 355,50 400,45 445,38 490,32 535,28 570,30 600,25 640,20 680,18 720,20 760,19 800,22" fill="none" stroke={C.cyan} strokeWidth="2" />
          </svg>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim, marginTop:2 }}>
            {["2015","2017","2019","2021","2023","2026"].map(y => <span key={y}>{y}</span>)}
          </div>
        </div>
        <div style={{ borderTop:"1px solid " + C.border, paddingTop:10 }}>
          <div style={{ fontSize:10, color:C.textDim, letterSpacing:1, marginBottom:7 }}>Component Loadings</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"4px 12px", fontSize:12 }}>
            {[["Fed Funds Rate","fedFunds"],["10Y Treasury","t10y"],["HY Credit Spre.","hySpread"],["S&P 500 (inv)","sp500load"],["USD Index","usd"]].map(function(pair) {
              var l = pair[0], k = pair[1];
              return (
                <div key={k} style={{ display:"contents" }}>
                  <span style={{ fontSize:11, color:C.textMid }}>{l}</span>
                  <span style={{ fontFamily:font, fontSize:12, color:String(d.fci?.[k]||"").startsWith("-")?C.red:C.green, textAlign:"right" }}>{d.fci?.[k]||"—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* AI ANALYSIS */}
      <Card glow={C.purple}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13 }}>🧠</span>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.textDim, textTransform:"uppercase" }}>AI-Enhanced Macro Analysis</span>
          </div>
          <Badge label={false?"Writing...":"Live · Sonnet"} color={C.purple} />
        </div>
        {false ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <Skel w="100%" h={13} mb={0} /><Skel w="94%" h={13} mb={0} /><Skel w="88%" h={13} mb={8} />
            <Skel w="100%" h={13} mb={0} /><Skel w="91%" h={13} mb={0} /><Skel w="65%" h={13} mb={0} />
          </div>
        ) : (
          <div style={{ fontSize:13, lineHeight:1.85, color:C.textMid }}>
            {(d.aiAnalysis||"Click ⚡ Refresh to load AI analysis.").split("\n\n").map(function(para,i) {
              return <p key={i} style={{ margin:"0 0 12px" }}>{para}</p>;
            })}
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginTop:8 }}>
          {["gmi everything_code","multi framework_model","ray dalio"].map(function(t) {
            return <span key={t} style={{ background:C.cardAlt, border:"1px solid " + C.border, borderRadius:4, padding:"2px 7px", fontSize:11, color:C.textDim }}>{t}</span>;
          })}
        </div>
      </Card>

      {/* SECTOR ROTATION */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:6, background:C.blue+"30", border:"1px solid " + C.blue + "44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🔄</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:1.5, color:C.text }}>SECTOR ROTATION</div>
              <div style={{ fontSize:10, color:C.textDim }}>HMM Regime Detection</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:11, color:C.green }}>✓</span>
            <span style={{ fontSize:11, color:C.textDim }}>OK</span>
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

     {/* SECTOR HEATMAP */}
<Card>
  <SecTitle icon="🌡" title="Sector Heatmap" badge="LIVE" bc={C.green} />
  <TVWidget scriptName="embed-widget-stock-heatmap" height={500} config={{
    "exchanges": [],
    "dataSource": "SPX500",
    "grouping": "sector",
    "blockSize": "market_cap_basic",
    "blockColor": "change",
    "locale": "en",
    "colorTheme": "dark",
    "hasTopBar": false,
    "isDataSetEnabled": false,
    "isZoomEnabled": true,
    "hasSymbolTooltip": true,
    "isMonoSize": false,
    "width": "100%",
    "height": 500
  }} />
</Card>
      {/* ASSET ALLOCATION */}
      <Card>
        <SecTitle icon="⚖" title="Asset Allocation" />
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>
          Neutral vs <span style={{ color:SC[d.macroRegime?.season]||C.gold, fontWeight:700 }}>{d.macroRegime?.season?.toUpperCase()}</span> adjusted
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"138px 1fr 72px 72px 52px", gap:"8px 12px", alignItems:"center" }}>
          <div style={{ fontSize:10, color:C.textDim }}>ASSET CLASS</div>
          <div />
          <div style={{ fontSize:10, color:C.textDim, textAlign:"right" }}>NEUTRAL</div>
          <div style={{ fontSize:10, color:C.textDim, textAlign:"right" }}>ADJUSTED</div>
          <div style={{ fontSize:10, color:C.textDim, textAlign:"right" }}>CHANGE</div>
          {Object.entries(d.allocation||{}).map(function([key,val]) {
            var cols = {stocks:C.blueLight,bonds:C.green,cash:C.textDim,gold:C.gold,crypto:C.purple,realAssets:C.orange};
            var labs = {stocks:"Stocks",bonds:"Bonds",cash:"Cash",gold:"Gold",crypto:"Crypto",realAssets:"Real Assets"};
            var diff = +val.a - +val.n;
            return [
              <div key={key+"l"} style={{ display:"flex", alignItems:"center", gap:6 }}><Dot c={cols[key]}/><span style={{ fontSize:13 }}>{labs[key]}</span></div>,
              <div key={key+"b"} style={{ height:4, background:C.border, borderRadius:2 }}><div style={{ width:val.a + "%", height:"100%", background:cols[key], borderRadius:2, opacity:0.7 }}/></div>,
              <span key={key+"n"} style={{ textAlign:"right", fontFamily:font, fontSize:13 }}>{val.n}%</span>,
              <span key={key+"a"} style={{ textAlign:"right", fontFamily:font, fontSize:13, fontWeight:700 }}>{val.a}%</span>,
              <span key={key+"c"} style={{ textAlign:"right", fontFamily:font, fontSize:12, color:diff>0?C.green:diff<0?C.red:C.textMid }}>{diff>0?"+":""}{diff}%</span>,
            ];
          })}
        </div>
      </Card>

      {/* TOP SECTORS */}
      <Card>
        <SecTitle icon="📋" title="Top Sectors (6M Returns)" />
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
  </div>
  );
}
