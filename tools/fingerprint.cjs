// Usage: node tools/fingerprint.cjs index.html  (run before and after a cleanup: the same hash = the same game)
// Deterministic play over fixed seeds; prints a fingerprint of every number that matters. Same output = same game.
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');const c=h.split('<script id="game">')[1].split('</script>')[0];
const g=new Function(c+`;return {newRun,advanceTick,closeDay,startNextDay,tradeStock,buyOption,writeOption,closeLot,closeStockPart,useTip,
 totalEquity,currentPrice,shopCatalogue,buyShopItem,applyDeckEdit,strikeOffsets};`)();
const lines=[];
for (let seed=1; seed<=6; seed++){
  const run=g.newRun(seed); run.cash=50000; for (const k in run.unlocked) run.unlocked[k]=true; run.leverageTier=2;
  for (let d=0; d<12 && !run.gameOverReason; d++){
    g.useTip(run,'rumour');
    run.phase='trading'; let tick=0;
    while(run.phase==='trading'){
      if(tick===5) g.tradeStock(run, d%2?1:-1, 0.3);
      if(tick===20) g.buyOption(run,'put',g.currentPrice(run.today)*(1+g.strikeOffsets('put')[d%8]),0.2);
      if(tick===40) g.writeOption(run,'call',g.currentPrice(run.today)*1.2,0.1);
      if(tick===60 && run.today.optionLots.length) g.closeLot(run,0,0.5);
      if(tick===75) g.closeStockPart(run,0.5);
      const o=g.advanceTick(run); tick++; if(o.closed) g.closeDay(run);
    }
    lines.push([seed,run.day,run.cash.toFixed(6),g.totalEquity(run).toFixed(6),run.heat.toFixed(3),run.today.shares.toFixed(6),run.today.optionLots.length].join(' '));
    if(run.gameOverReason) break;
    const items=g.shopCatalogue(run); const remove=items.find(i=>i.id==='remove'); g.applyDeckEdit(run,remove,run.ticker,'DOWN');
    g.startNextDay(run);
  }
}
console.log(require('crypto').createHash('sha1').update(lines.join('\n')).digest('hex'), lines.length, 'days'); 
