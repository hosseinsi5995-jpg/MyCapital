// MyCapital - configure Supabase in this file before deployment.
const SUPABASE_URL = "https://wvmlljxybvlqnobkbngd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-miuF2fIqvU4CYY_6F4VNg_r5oTLokO";
const supabaseReady = SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
let mode = "login", currentUser = null, accounts = [], transactions = [], trades = [], chart = null, toastTimer;

// Show the branded intro on every fresh page load, then reveal the sign-in screen.
window.addEventListener("load", () => {
  const splash = $("introSplash");
  if (!splash) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => {
    splash.classList.add("is-leaving");
    window.setTimeout(() => splash.remove(), 1250);
  }, reduced ? 500 : 3900);
});

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200)}
function toman(value){return new Intl.NumberFormat("fa-IR",{maximumFractionDigits:0}).format(Number(value)||0)}
function dateFa(value){try{return new Date(value+"T12:00:00").toLocaleDateString("fa-IR")}catch{return value}}
function setMode(next){mode=next;$("loginTab").classList.toggle("active",mode==="login");$("signupTab").classList.toggle("active",mode==="signup");$("authSubmit").innerHTML=mode==="login"?"ورود به داشبورد <span>↗</span>":"ساخت حساب کاربری <span>↗</span>";$("password").autocomplete=mode==="login"?"current-password":"new-password";$("authMessage").textContent=mode==="login"?"برای ورود، ایمیل و رمز عبورت را وارد کن.":"حساب اختصاصی خودت را بساز؛ اطلاعات کاربران از هم جداست."}
$("loginTab").onclick=()=>setMode("login");$("signupTab").onclick=()=>setMode("signup");

$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!db){$("authMessage").textContent="ابتدا آدرس پروژه و کلید عمومی Supabase را در فایل app.js تنظیم کن. راهنما در README است.";return}
 const email=$("email").value.trim(),password=$("password").value;
 $("authSubmit").disabled=true;
 const result=mode==="signup"?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
 $("authSubmit").disabled=false;
 if(result.error){$("authMessage").textContent=result.error.message;return}
 if(mode==="signup"&&!result.data.session){$("authMessage").textContent="ثبت‌نام انجام شد. اگر تأیید ایمیل فعال است، ایمیلت را تأیید کن و سپس وارد شو.";return}
 currentUser=result.data.user;await showApp();
});
async function showApp(){
 $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("userEmail").textContent=currentUser.email;$("avatar").textContent=(currentUser.email||"U")[0].toUpperCase();
 $("todayDate").textContent=new Date().toLocaleDateString("fa-IR",{weekday:"short",day:"numeric",month:"long"});
 await loadData();await loadMarket();
}
async function loadData(){
 const [a,t,tr]=await Promise.all([
  db.from("accounts").select("*").order("created_at",{ascending:false}),
  db.from("transactions").select("*, accounts(name)").order("transaction_date",{ascending:false}).limit(100),
  db.from("futures_trades").select("*").order("entry_at",{ascending:false}).limit(300)
 ]);
 if(a.error||t.error){toast("خطا در دریافت اطلاعات؛ SQL راهنما و دسترسی‌ها را بررسی کن.");console.error(a.error,t.error);return}
 accounts=a.data||[];transactions=t.data||[];trades=tr.data||[];
 if(tr.error){trades=[];console.warn("Trades table is not ready yet:",tr.error);}
 renderAll();renderTrades();
}
function renderAll(){
 const total=accounts.reduce((s,a)=>s+Number(a.balance||0),0);
 $("totalBalance").textContent=toman(total);$("accountCount").textContent=toman(accounts.length);
 const now=new Date(),month=now.getMonth(),year=now.getFullYear();
 const monthTx=transactions.filter(t=>{const d=new Date(t.transaction_date+"T12:00:00");return d.getMonth()===month&&d.getFullYear()===year});
 $("incomeTotal").textContent=toman(monthTx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0));
 $("expenseTotal").textContent=toman(monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0));
 $("accountsList").innerHTML=accounts.length?accounts.map(a=>`<article class="record-card glass"><div class="stat-head"><span>${escapeHtml(a.account_type||"حساب")}</span><b class="stat-icon green">▣</b></div><h4>${escapeHtml(a.name)}</h4><strong>${toman(a.balance)} <small>تومان</small></strong></article>`).join(""):'<div class="empty-state">هنوز حسابی اضافه نکرده‌ای.</div>';
 $("txAccount").innerHTML=accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
 $("transactionsTable").innerHTML=transactions.length?transactions.map(t=>`<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.accounts?.name||"—")}</td><td class="${t.type==="income"?"green":"red"}">${t.type==="income"?"واریز":"برداشت"}</td><td>${dateFa(t.transaction_date)}</td><td class="${t.type==="income"?"green":"red"}">${t.type==="income"?"+":"−"} ${toman(t.amount)} تومان</td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">تراکنشی وجود ندارد.</td></tr>';
 $("txCount").textContent=toman(transactions.length)+" مورد";
 $("recentTransactions").innerHTML=transactions.slice(0,4).map(t=>`<div class="activity-row"><div class="activity-icon">${t.type==="income"?"↙":"↗"}</div><div><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.accounts?.name||"حساب")} · ${dateFa(t.transaction_date)}</small></div><span class="activity-amount ${t.type==="income"?"green":"red"}">${t.type==="income"?"+":"−"}${toman(t.amount)}</span></div>`).join("")||'<div class="empty-state">هنوز تراکنشی ثبت نشده است.</div>';
 renderChart();
}
function renderChart(){
 const canvas=$("portfolioChart"),empty=$("chartEmpty");
 if(chart){chart.destroy();chart=null}
 if(!accounts.length){empty.classList.remove("hidden");return}
 empty.classList.add("hidden");
 chart=new Chart(canvas,{type:"doughnut",data:{labels:accounts.map(a=>a.name),datasets:[{data:accounts.map(a=>Number(a.balance)||0),backgroundColor:["#39e6a0","#62a8ff","#e8b85c","#b58cff","#ff647c","#4dd0e1"],borderWidth:0,hoverOffset:7}]},options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{position:"bottom",labels:{color:"#9aa9bd",font:{family:"Vazirmatn",size:10},boxWidth:8,padding:14}}}}});
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function loadMarket(){
 $("marketUpdated").textContent="در حال دریافت قیمت‌ها…";
 try{
  const response=await fetch("https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json",{cache:"no-store"});
  if(!response.ok)throw new Error("Market API unavailable");
  const payload=await response.json();
  const rows=Array.isArray(payload)?payload:(payload.data||payload.items||payload.prices||[]);
  const find=(symbol)=>rows.find(x=>x.symbol===symbol)||null;
  const usd=find("USD_IRR_FREE"),gold=find("GOLD_18K_IRR"),btc=find("BTC_USD");
  const price=(obj)=>obj?.price??obj?.value??obj?.close??null;
  const set=(id,obj,currency)=>{const p=price(obj);$(id).textContent=p==null?"ناموجود":toman(p);};
  set("usdPrice",usd);set("goldPrice",gold);const bp=price(btc);$("btcPrice").textContent=bp==null?"ناموجود":"$"+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(bp);
  const change=(obj,id)=>{const n=Number(obj?.change_pct??obj?.changePct??obj?.change??0);$(id).textContent=obj?`${n>0?"+":""}${new Intl.NumberFormat("fa-IR",{maximumFractionDigits:2}).format(n)}٪ تغییر`:"تغییرات در دسترس نیست";$(id).style.color=n>0?"var(--green)":n<0?"var(--red)":"var(--muted)"};
  change(usd,"usdChange");change(gold,"goldChange");change(btc,"btcChange");
  const stamp=payload.meta?.published_at||usd?.timestamp_tehran||usd?.timestamp||null;
  $("marketUpdated").textContent=stamp?"آخرین داده: "+new Date(stamp).toLocaleString("fa-IR"):"قیمت‌ها از منبع عمومی بازار";
 }catch(err){$("marketUpdated").textContent="دریافت قیمت ناموفق بود؛ بعداً دوباره تلاش کن.";console.warn(err)}
}
$("refreshMarket").onclick=loadMarket;
setInterval(loadMarket,5*60*1000);

document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.page)));
document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.open)));
function openPage(page){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$(page+"Page").classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));$("pageTitle").textContent=({dashboard:"نمای کلی",accounts:"حساب‌ها و دارایی‌ها",transactions:"تراکنش‌ها",trading:"معاملات"})[page]||"نمای کلی";window.scrollTo({top:0,behavior:"smooth"})}
$("addAccountBtn").onclick=()=>$("accountForm").classList.toggle("hidden");$("cancelAccount").onclick=()=>$("accountForm").classList.add("hidden");
$("accountForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("accounts").insert({user_id:currentUser.id,name:$("accountName").value.trim(),account_type:$("accountType").value,balance:Number($("accountBalance").value)});if(error){toast("ذخیره حساب ناموفق بود.");console.error(error);return}e.target.reset();e.target.classList.add("hidden");toast("حساب با موفقیت ثبت شد.");await loadData()});
$("addTransactionBtn").onclick=()=>{$("transactionForm").classList.toggle("hidden");$("txDate").value=new Date().toISOString().slice(0,10)};
$("cancelTransaction").onclick=()=>$("transactionForm").classList.add("hidden");
$("transactionForm").addEventListener("submit",async e=>{
 e.preventDefault();const accountId=$("txAccount").value,amount=Number($("txAmount").value),type=$("txType").value;
 if(!accountId){toast("ابتدا یک حساب ایجاد کن.");return}
 const {error}=await db.from("transactions").insert({user_id:currentUser.id,account_id:accountId,type,amount,title:$("txTitle").value.trim(),transaction_date:$("txDate").value});
 if(error){toast("ثبت تراکنش ناموفق بود.");console.error(error);return}
 const account=accounts.find(a=>a.id===accountId);const newBalance=Number(account.balance)+(type==="income"?amount:-amount);
 const update=await db.from("accounts").update({balance:newBalance}).eq("id",accountId);
 if(update.error){toast("تراکنش ثبت شد اما به‌روزرسانی موجودی حساب خطا داشت.");console.error(update.error)}else toast("تراکنش با موفقیت ثبت شد.");
 e.target.reset();e.target.classList.add("hidden");await loadData();
});
// Futures trade journal: all prices and timestamps are entered manually by the user.
function tradePnl(t){
 if(t.exit_price===null||t.exit_price===undefined||t.exit_price==="")return null;
 const diff=t.side==="long"?Number(t.exit_price)-Number(t.entry_price):Number(t.entry_price)-Number(t.exit_price);
 return diff*Number(t.quantity);
}
function compactNumber(value){return new Intl.NumberFormat("en-US",{maximumFractionDigits:8}).format(Number(value)||0)}
function tradeDate(value){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"})}
function renderTrades(){
 const open=trades.filter(t=>t.status==="open");
 const closed=trades.filter(t=>!open.includes(t));
 const realized=closed.reduce((sum,t)=>sum+(tradePnl(t)||0),0);
 $("tradeCount").textContent=toman(trades.length);$("openTradeCount").textContent=toman(open.length);$("closedTradeCount").textContent=toman(closed.length);
 $("realizedPnl").textContent=compactNumber(realized)+" USDT";$("realizedPnl").style.color=realized>0?"var(--green)":realized<0?"var(--red)":"var(--text)";
 $("tradeListCount").textContent=toman(trades.length)+" مورد";
 $("tradesTable").innerHTML=trades.length?trades.map(t=>{
  const pnl=tradePnl(t),isOpen=pnl===null;
  return `<tr><td><b>${escapeHtml(t.symbol)}</b></td><td class="${t.side==="long"?"green":"red"}">${t.side==="long"?"LONG":"SHORT"}</td><td>${compactNumber(t.entry_price)}</td><td>${isOpen?"—":compactNumber(t.exit_price)}</td><td>${compactNumber(t.stop_loss)}</td><td>${compactNumber(t.take_profit)}</td><td>${t.leverage}×</td><td>${tradeDate(t.entry_at)}</td><td>${tradeDate(t.exit_at)}</td><td><span class="trade-status ${isOpen?"open":"closed"}">${isOpen?"باز":"بسته"}</span></td><td class="${pnl>0?"green":pnl<0?"red":""}">${isOpen?"—":compactNumber(pnl)+" USDT"}</td></tr>`;
 }).join(""):'<tr><td colspan="11" class="empty-state">هنوز معامله‌ای ثبت نشده است.</td></tr>';
}
$("addTradeBtn").onclick=()=>{$("tradeForm").classList.remove("hidden");if(!$ ("tradeEntryTime").value)$ ("tradeEntryTime").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)};
$("cancelTradeBtn").onclick=()=>{$("tradeForm").classList.add("hidden");$("tradeForm").reset();$("tradeLeverage").value="1"};
$("tradeForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!db||!currentUser){toast("ابتدا وارد حساب کاربری شو.");return}
 const exitRaw=$("tradeExit").value.trim(),exitTimeRaw=$("tradeExitTime").value.trim();
 if(Boolean(exitRaw)!==Boolean(exitTimeRaw)){toast("برای بستن معامله، هم قیمت خروج و هم زمان خروج را وارد کن.");return}
 const entry=Number($("tradeEntry").value),stop=Number($("tradeStop").value),target=Number($("tradeTarget").value),side=$("tradeSide").value;
 if((side==="long"&&(stop>=entry||target<=entry))||(side==="short"&&(stop<=entry||target>=entry))){toast("حد ضرر و تارگت با جهت معامله هم‌خوانی ندارند.");return}
 const payload={user_id:currentUser.id,symbol:$("tradeSymbol").value.trim().toUpperCase(),side,entry_price:entry,exit_price:exitRaw?Number(exitRaw):null,stop_loss:stop,take_profit:target,quantity:Number($("tradeQty").value),leverage:Number($("tradeLeverage").value),entry_at:new Date($("tradeEntryTime").value).toISOString(),exit_at:exitTimeRaw?new Date($("tradeExitTime").value).toISOString():null,status:exitRaw?"closed":"open"};
 if(payload.exit_price!==null&&payload.exit_price<=0){toast("قیمت خروج باید بیشتر از صفر باشد.");return}
 if(payload.exit_at&&new Date(payload.exit_at)<new Date(payload.entry_at)){toast("زمان خروج نمی‌تواند قبل از زمان ورود باشد.");return}
 const btn=$("saveTradeBtn");btn.disabled=true;
 const {error}=await db.from("futures_trades").insert(payload);btn.disabled=false;
 if(error){toast("ذخیره معامله ناموفق بود؛ مطمئن شو SQL بخش معاملات را در Supabase اجرا کرده‌ای.");console.error(error);return}
 e.target.reset();$("tradeLeverage").value="1";e.target.classList.add("hidden");toast("معامله با موفقیت ذخیره شد.");await loadData();
});

$("logoutBtn").onclick=async()=>{if(db)await db.auth.signOut();currentUser=null;$("appView").classList.add("hidden");$("authView").classList.remove("hidden")};

(async()=>{if(!db){$("authMessage").textContent="برای فعال‌سازی ورود و ذخیره آنلاین، تنظیمات Supabase را طبق README وارد کن.";return}const {data}=await db.auth.getSession();if(data.session){currentUser=data.session.user;await showApp()}})();
