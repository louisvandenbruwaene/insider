// Usage: node tools/fuzz.cjs index.html [runs]
// Random player: random trades (all kinds, add/close partial), tips, shop buys, deck edits, over many days.
// Checks invariants after every action and tick.
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');const c=h.split('<script id="game">')[1].split('</script>')[0];
const g=new Function(c+`;return {newRun,advanceTick,closeDay,startNextDay,tradeStock,buyOption,writeOption,closeLot,closeStockPart,closeEverything,
 useTip,tipStatus,totalEquity,marginEquity,exposure,currentPrice,shopCatalogue,buyShopItem,applyDeckEdit,deckEditAllowed,switchTicker,optionPrices,
 strikeOffsets,deckSize,serialiseRun,loadRun,CARD_ORDER,TIP_ORDER,TICKS_PER_DAY,hasPositions,maximumLeverage,newExpiryDay};`)();
const seedRandom=(s)=>()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
let problems=0; const fail=(m,run)=>{ if(problems++<15) console.log('PROBLEM day',run.day,'tick',run.today&&run.today.tick,m); };
function check(run,where){
  const t=run.today; if(!Number.isFinite(run.cash)) fail(where+' cash '+run.cash,run);
  const e=g.totalEquity(run); if(!Number.isFinite(e)) fail(where+' equity '+e,run);
  if(!Number.isFinite(t.shares)) fail(where+' shares',run);
  for(const l of t.optionLots){ if(!(l.quantity>0)||!Number.isFinite(l.paid)||!(l.expiryDay>=run.day)) fail(where+' lot '+JSON.stringify(l),run); }
  if(!(g.currentPrice(t)>0)) fail(where+' price '+g.currentPrice(t),run);
  for(const id in run.decks) for(const k of g.CARD_ORDER) if(run.decks[id][k]<0) fail(where+' negative deck count '+id+k,run);
  if(run.heat<0) fail(where+' heat<0',run);
}
let days=0, runs=0, maxEq=0;
for(let seed=1; seed<=(Number(process.argv[3])||40); seed++){
  const R=seedRandom(seed*7919); const run=g.newRun(seed); runs++;
  run.cash*=1+R()*20;
  for(let d=0; d<60 && !run.gameOverReason; d++){
    // preopen: tips, maybe switch ticker
    for(const tip of g.TIP_ORDER) if(R()<0.3) g.useTip(run,tip);
    if(R()<0.1 && run.tickersOwned.length>1) g.switchTicker(run, run.tickersOwned[Math.floor(R()*run.tickersOwned.length)]);
    run.phase='trading';
    while(run.phase==='trading'){
      if(R()<0.08){ const a=Math.floor(R()*7), f=R();
        if(a===0) g.tradeStock(run, R()<0.5?1:-1, f);
        else if(a===1){ const kind=R()<0.5?'call':'put'; const offs=g.strikeOffsets(kind); g.buyOption(run,kind,g.currentPrice(run.today)*(1+offs[Math.floor(R()*offs.length)]),f); }
        else if(a===2){ const kind=R()<0.5?'call':'put'; const offs=g.strikeOffsets(kind); g.writeOption(run,kind,g.currentPrice(run.today)*(1+offs[Math.floor(R()*offs.length)]),f*0.3); }
        else if(a===3 && run.today.optionLots.length) g.closeLot(run, Math.floor(R()*run.today.optionLots.length), R()<0.5?1:f);
        else if(a===4) g.closeStockPart(run, R()<0.5?1:f);
        else if(a===5 && run.today.optionLots.length){ const l=run.today.optionLots[0]; (l.side==='long'?g.buyOption:g.writeOption)(run,l.kind,l.strike,f*0.3,l.expiryDay); }
        else if(a===6 && R()<0.2) g.closeEverything(run);
        check(run,'after action '+a);
      }
      const o=g.advanceTick(run); check(run,'tick');
      if(o.closed) g.closeDay(run);
    }
    days++; maxEq=Math.max(maxEq,g.totalEquity(run));
    // save/load round trip keeps the state
    const copy=g.loadRun(g.serialiseRun(run)); if(Math.abs(g.totalEquity(copy)-g.totalEquity(run))>1e-6*Math.max(1,Math.abs(g.totalEquity(run)))) fail('save/load equity '+g.totalEquity(copy)+' vs '+g.totalEquity(run),run);
    if(run.gameOverReason) break;
    // shop: random purchases and deck edits
    run.phase='shop';
    for(let k=0;k<4;k++){ const items=g.shopCatalogue(run); const it=items[Math.floor(R()*items.length)];
      if(it.picker){ const tick=run.tickersOwned[Math.floor(R()*run.tickersOwned.length)]; const card=it.picker.startsWith('event:')?it.picker.slice(6):g.CARD_ORDER[Math.floor(R()*16)]; g.applyDeckEdit(run,it,tick,card); }
      else g.buyShopItem(run,it); }
    for(const id in run.decks) if(g.deckSize(run.decks[id])<150) fail('deck below minimum '+id,run);
    g.startNextDay(run); check(run,'next day');
  }
}
console.log('runs',runs,'days',days,'problems',problems,'max equity',maxEq.toExponential(2));
