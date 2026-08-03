(function(){
  "use strict";

  const ids = [
    "salePrice1","salePrice2","salePrice3","closingDate","countyType","annualTaxes",
    "mortgage1","mortgage2","heloc","otherLiens","payoffFees",
    "totalCompMethod","totalCompPercent","totalCompFlat","equalSplit","listingShare","buyerShare",
    "listingMethod","listingPercent","listingFlat","buyerMethod","buyerPercent","buyerFlat","brokerFee",
    "titleMode","titlePayer","simpleSettlement","settlementFee","wireFee","recordingFees","titleSearch",
    "municipalLien","storageFee","additionalPayoffs","otherTitleFees","manualTitlePremium",
    "concessionPercent","concessionFlat","pastDueHoa","hoaFees","repairs","attorneyFee","otherExpense1","otherExpense2"
  ];
  const el = {};
  ids.forEach(id => el[id] = document.getElementById(id));

  const currency = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
  const money = value => currency.format(Number.isFinite(value) ? value : 0);
  const num = input => {
    const v = parseFloat(input && input.value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const pct = input => num(input) / 100;

  function setDefaultDate(){
    if(el.closingDate.value) return;
    const d = new Date();
    d.setDate(d.getDate()+45);
    el.closingDate.value = [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,"0"),
      String(d.getDate()).padStart(2,"0")
    ].join("-");
  }

  function daysThroughClosing(){
    if(!el.closingDate.value) return 0;
    const close = new Date(el.closingDate.value+"T12:00:00");
    if(Number.isNaN(close.getTime())) return 0;
    const start = new Date(close.getFullYear(),0,1,12,0,0);
    const diff = Math.floor((close-start)/86400000)+1;
    const yearDays = new Date(close.getFullYear(),1,29).getMonth()===1 ? 366 : 365;
    return Math.max(0,Math.min(diff,yearDays));
  }

  function docStamp(salePrice){
    if(salePrice<=0) return 0;
    const units = Math.ceil(salePrice/100);
    if(el.countyType.value==="miamiSingle") return units*0.60;
    if(el.countyType.value==="miamiOther") return units*(0.60+0.45);
    return units*0.70;
  }

  function originalTitlePremium(amount){
    if(amount<=0) return 0;
    let remaining=amount, premium=0;
    const tiers=[
      [100000,5.75],
      [900000,5.00],
      [4000000,2.50],
      [5000000,2.25],
      [Infinity,2.00]
    ];
    for(const [limit,rate] of tiers){
      if(remaining<=0) break;
      const segment=Math.min(remaining,limit);
      // Florida rates are per thousand; fractional thousands are rounded in $100 units.
      const taxableHundreds=Math.ceil(segment/100);
      premium += taxableHundreds*(rate/10);
      remaining -= segment;
    }
    return Math.max(100,premium);
  }

  function titlePremium(salePrice){
    if(el.titlePayer.value==="no") return 0;
    if(el.titlePayer.value==="manual") return num(el.manualTitlePremium);
    return originalTitlePremium(salePrice);
  }

  function settlementCosts(){
    if(el.titleMode.value==="simple") return num(el.simpleSettlement);
    return ["settlementFee","wireFee","recordingFees","titleSearch","municipalLien",
      "storageFee","additionalPayoffs","otherTitleFees"].reduce((sum,id)=>sum+num(el[id]),0);
  }

  function payoffs(){
    return ["mortgage1","mortgage2","heloc","otherLiens","payoffFees"].reduce((sum,id)=>sum+num(el[id]),0);
  }

  function commissionForPrice(salePrice){
    let listing=0,buyer=0,total=0;
    const mode=document.querySelector('input[name="commissionMode"]:checked').value;
    if(mode==="total"){
      total = el.totalCompMethod.value==="flat" ? num(el.totalCompFlat) : salePrice*(parseFloat(el.totalCompPercent.value)||0)/100;
      let listingShare=parseFloat(el.listingShare.value)||0;
      let buyerShare=parseFloat(el.buyerShare.value)||0;
      const shareTotal=listingShare+buyerShare;
      if(shareTotal>0){
        listing=total*(listingShare/shareTotal);
        buyer=total*(buyerShare/shareTotal);
      }else{
        listing=total;
      }
    }else{
      listing = el.listingMethod.value==="flat" ? num(el.listingFlat) : salePrice*pct(el.listingPercent);
      if(el.buyerMethod.value==="percent") buyer=salePrice*pct(el.buyerPercent);
      if(el.buyerMethod.value==="flat") buyer=num(el.buyerFlat);
      total=listing+buyer;
    }
    return {listing,buyer,total};
  }

  function taxProration(){
    const annual=num(el.annualTaxes);
    if(annual<=0) return 0;
    const days=daysThroughClosing();
    const close=new Date(el.closingDate.value+"T12:00:00");
    const yearDays = !Number.isNaN(close.getTime()) && new Date(close.getFullYear(),1,29).getMonth()===1 ? 366 : 365;
    return annual*(days/yearDays);
  }

  function fixedOtherExpenses(){
    return ["pastDueHoa","hoaFees","repairs","attorneyFee","otherExpense1","otherExpense2"].reduce((sum,id)=>sum+num(el[id]),0);
  }

  function scenario(salePrice){
    if(!salePrice || salePrice<=0) return null;
    const commissions=commissionForPrice(salePrice);
    const brokerageTotal=commissions.total+num(el.brokerFee);
    const title=titlePremium(salePrice);
    const closing=docStamp(salePrice)+title+settlementCosts();
    const contribution=salePrice*pct(el.concessionPercent);
    const concessionFlat=num(el.concessionFlat);
    const tax=taxProration();
    const other=fixedOtherExpenses();
    const payoffTotal=payoffs();
    const otherGroup=tax+contribution+concessionFlat+other;
    const expenses=payoffTotal+brokerageTotal+closing+otherGroup;
    const net=salePrice-expenses;
    return {
      salePrice,commissions,brokerageTotal,title,settlement:settlementCosts(),
      docStamp:docStamp(salePrice),closing,contribution,concessionFlat,tax,other,
      otherGroup,payoffs:payoffTotal,expenses,net
    };
  }

  function updateVisibility(){
    const mode=document.querySelector('input[name="commissionMode"]:checked').value;
    document.getElementById("totalCommissionBlock").classList.toggle("sns-hidden",mode!=="total");
    document.getElementById("separateCommissionBlock").classList.toggle("sns-hidden",mode!=="separate");

    const totalFlat=el.totalCompMethod.value==="flat";
    document.getElementById("totalPercentField").classList.toggle("sns-hidden",totalFlat);
    document.getElementById("totalFlatField").classList.toggle("sns-hidden",!totalFlat);

    const listingFlat=el.listingMethod.value==="flat";
    document.getElementById("listingPercentField").classList.toggle("sns-hidden",listingFlat);
    document.getElementById("listingFlatField").classList.toggle("sns-hidden",!listingFlat);

    document.getElementById("buyerPercentField").classList.toggle("sns-hidden",el.buyerMethod.value!=="percent");
    document.getElementById("buyerFlatField").classList.toggle("sns-hidden",el.buyerMethod.value!=="flat");

    document.getElementById("simpleTitleBlock").classList.toggle("sns-hidden",el.titleMode.value!=="simple");
    document.getElementById("itemizedTitleBlock").classList.toggle("sns-hidden",el.titleMode.value!=="itemized");
    document.getElementById("manualTitlePremiumBlock").classList.toggle("sns-hidden",el.titlePayer.value!=="manual");

    el.listingShare.disabled=el.equalSplit.checked;
    el.buyerShare.disabled=el.equalSplit.checked;
    if(el.equalSplit.checked){el.listingShare.value=50;el.buyerShare.value=50;}
  }

  function validateShares(){
    const mode=document.querySelector('input[name="commissionMode"]:checked').value;
    if(mode!=="total" || el.equalSplit.checked) return "";
    const a=parseFloat(el.listingShare.value)||0;
    const b=parseFloat(el.buyerShare.value)||0;
    if(a<0 || b<0) return "Brokerage allocation percentages cannot be negative.";
    if(a+b<=0) return "Enter at least one brokerage allocation percentage.";
    return "";
  }

  function paintAmount(node,value){
    node.textContent=money(value);
    node.classList.toggle("sns-negative",value<0);
    node.classList.toggle("sns-positive",value>0);
  }

  function updateScenarioColumn(index,result){
    const dash="—";
    const fields=["Sale","Payoffs","Broker","Closing","Other","Net"];
    if(!result){
      fields.forEach(f=>document.getElementById("sc"+f+index).textContent=dash);
      return;
    }
    document.getElementById("scSale"+index).textContent=money(result.salePrice);
    document.getElementById("scPayoffs"+index).textContent=money(result.payoffs);
    document.getElementById("scBroker"+index).textContent=money(result.brokerageTotal);
    document.getElementById("scClosing"+index).textContent=money(result.closing);
    document.getElementById("scOther"+index).textContent=money(result.otherGroup);
    const netNode=document.getElementById("scNet"+index);
    netNode.textContent=money(result.net);
    netNode.classList.toggle("sns-negative",result.net<0);
    netNode.classList.toggle("sns-positive",result.net>=0);
  }

  function calculate(){
    updateVisibility();
    const error=validateShares();
    const errorBox=document.getElementById("errorBox");
    errorBox.textContent=error;
    errorBox.style.display=error?"block":"none";

    const primary=scenario(num(el.salePrice1));
    const alt=scenario(num(el.salePrice2));
    const low=scenario(num(el.salePrice3));

    if(!primary){
      paintAmount(document.getElementById("netValue"),0);
      document.getElementById("netPercent").textContent="Enter a primary sale price to calculate";
      ["kpiSalePrice","kpiExpenses","kpiPayoffs","kpiCommission","listingCompResult","buyerCompResult",
       "brokerFeeResult","docStampResult","titlePremiumResult","settlementResult","taxProrationResult",
       "concessionPercentResult","concessionFlatResult","otherExpensesResult","totalExpensesResult"
      ].forEach(id=>document.getElementById(id).textContent="$0.00");
    }else{
      paintAmount(document.getElementById("netValue"),primary.net);
      document.getElementById("netPercent").textContent=(primary.net/primary.salePrice*100).toFixed(1)+"% of the primary sale price";
      document.getElementById("kpiSalePrice").textContent=money(primary.salePrice);
      document.getElementById("kpiExpenses").textContent=money(primary.expenses);
      document.getElementById("kpiPayoffs").textContent=money(primary.payoffs);
      document.getElementById("kpiCommission").textContent=money(primary.commissions.total);
      document.getElementById("listingCompResult").textContent=money(primary.commissions.listing);
      document.getElementById("buyerCompResult").textContent=money(primary.commissions.buyer);
      document.getElementById("brokerFeeResult").textContent=money(num(el.brokerFee));
      document.getElementById("docStampResult").textContent=money(primary.docStamp);
      document.getElementById("titlePremiumResult").textContent=money(primary.title);
      document.getElementById("settlementResult").textContent=money(primary.settlement);
      document.getElementById("taxProrationResult").textContent=money(primary.tax);
      document.getElementById("concessionPercentResult").textContent=money(primary.contribution);
      document.getElementById("concessionFlatResult").textContent=money(primary.concessionFlat);
      document.getElementById("otherExpensesResult").textContent=money(primary.other);
      document.getElementById("totalExpensesResult").textContent=money(primary.expenses);
    }

    document.getElementById("scenarioHead1").textContent=primary?"Primary "+money(primary.salePrice):"Primary";
    document.getElementById("scenarioHead2").textContent=alt?"Alternative "+money(alt.salePrice):"Alternative";
    document.getElementById("scenarioHead3").textContent=low?"Lower "+money(low.salePrice):"Lower Price";
    updateScenarioColumn(1,primary);
    updateScenarioColumn(2,alt);
    updateScenarioColumn(3,low);
  }

  function reset(){
    document.querySelectorAll("input[type=number]").forEach(i=>i.value="");
    document.querySelector('input[name="commissionMode"][value="total"]').checked=true;
    el.totalCompMethod.value="percent";
    el.totalCompPercent.value="";
    el.equalSplit.checked=true;
    el.listingShare.value=50;el.buyerShare.value=50;
    el.listingMethod.value="percent";
    el.buyerMethod.value="none";
    el.titleMode.value="simple";
    el.titlePayer.value="yes";
    el.simpleSettlement.value=650;
    el.countyType.value="standard";
    el.closingDate.value="";
    setDefaultDate();
    calculate();
  }

  function loadExample(){
    reset();
    el.salePrice1.value=612500;
    el.salePrice2.value=580000;
    el.salePrice3.value=550000;
    el.annualTaxes.value=6228.32;
    el.mortgage1.value=570838.45;
    el.totalCompPercent.value=5;
    el.equalSplit.checked=true;
    el.simpleSettlement.value=650;
    calculate();
  }

  document.querySelectorAll(".sns-shell input, .sns-shell select").forEach(node=>{
    node.addEventListener("input",calculate);
    node.addEventListener("change",calculate);
  });
  document.querySelectorAll('input[name="commissionMode"]').forEach(node=>node.addEventListener("change",calculate));
  el.equalSplit.addEventListener("change",calculate);
  document.getElementById("resetBtn").addEventListener("click",reset);
  document.getElementById("sampleBtn").addEventListener("click",loadExample);
  document.getElementById("printBtn").addEventListener("click",()=>window.print());

  // Prevent custom allocation fields from drifting if one side is edited.
  el.listingShare.addEventListener("input",()=>{
    if(!el.equalSplit.checked){
      const a=Math.max(0,Math.min(100,parseFloat(el.listingShare.value)||0));
      el.buyerShare.value=Math.max(0,100-a);
    }
  });
  el.buyerShare.addEventListener("input",()=>{
    if(!el.equalSplit.checked){
      const b=Math.max(0,Math.min(100,parseFloat(el.buyerShare.value)||0));
      el.listingShare.value=Math.max(0,100-b);
    }
  });

  setDefaultDate();
  calculate();
})();