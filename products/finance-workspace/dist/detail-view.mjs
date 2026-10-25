import {estimateSpending} from './spending-plan.mjs';
import {currentLedgerDate} from './projection.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export const groupSlug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function purchaseKey(row){
  const text=String(row.id||JSON.stringify([row.date,row.description,row.amount]));let a=2166136261,b=5381;
  for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}
  return (a>>>0).toString(36)+'-'+(b>>>0).toString(36);
}
export function getCategoryDetail(state,slug){
  const analysis=estimateSpending(state.transactions,state.plan,{ledgerAsOf:currentLedgerDate()});
  const group=analysis?.groups.find(g=>groupSlug(g.name)===slug);
  if(!group)return null;
  const purchases=analysis.purchases.filter(p=>p.group===group.name).sort((a,b)=>b.date.localeCompare(a.date));
  return {group,purchases,analysis};
}
export function mountSpendingDetails({getState,navigate}){
  function render(route){
    const page=document.querySelector('#page-spending');
    if(!document.querySelector('#spending-detail-view'))page.insertAdjacentHTML('beforeend','<section id="spending-detail-view" class="detail-screen" tabindex="-1" hidden></section>');
    const panel=document.querySelector('#spending-detail-view'),content=document.querySelector('#spending-content');
    const active=route?.page==='spending'&&route.detail?.length>0;panel.hidden=!active;content.hidden=!!active;
    if(!active)return;
    const [slug,key]=route.detail,detail=getCategoryDetail(getState(),slug);
    const back=()=>navigate('spending','categories',key?[slug]:[]);
    if(!detail){panel.innerHTML='<button class="text-button" id="detail-back">← Back to categories</button><h2>This category is no longer available in this view.</h2>';panel.querySelector('button').onclick=back;return;}
    const {group,purchases,analysis}=detail,purchase=key?purchases.find(p=>purchaseKey(p)===key):null;
    const crumbs=`<div class="detail-breadcrumb"><button class="text-button" data-detail-home>Spending</button><span>/</span><button class="text-button" data-detail-category>${esc(group.name)}</button>${key?'<span>/</span><span>Purchase</span>':''}</div>`;
    if(key&&purchase){
      const source=getState().transactions.find(p=>p.id===purchase.id),provider=({'cashapp':'Cash App statement','cashapp-email':'Cash App email receipt','fifththird':'Fifth Third statement'})[source?.source]||'Imported history';
      panel.innerHTML=`${crumbs}<button class="text-button" id="detail-back">← Back to ${esc(group.name)}</button><div class="detail-heading"><div><p class="eyebrow">RECORDED PURCHASE</p><h2>${esc(purchase.description)}</h2><p>${esc(purchase.date)} · ${esc(group.name)}</p></div><strong>${money(purchase.amount)}</strong></div><dl class="purchase-facts"><div><dt>Recorded date</dt><dd>${esc(purchase.date)}</dd></div><div><dt>Your category</dt><dd>${esc(source?.category||group.name)}</dd></div><div><dt>Imported from</dt><dd>${esc(provider)}</dd></div><div><dt>Included in this report</dt><dd>${esc(analysis.start)} – ${esc(analysis.end)}</dd></div></dl><p class="quiet-note">${source?.source==='cashapp-email'?'The date uses email delivery time. Verify the receipt against statement history.':'The date and amount come from imported history.'} This view does not change your balance or classify the purchase again.</p>`;
    }else if(key){panel.innerHTML=`${crumbs}<button class="text-button" id="detail-back">← Back to ${esc(group.name)}</button><h2>This purchase is outside the current report.</h2>`;}
    else{
      panel.innerHTML=`${crumbs}<button class="text-button" id="detail-back">← Back to categories</button><div class="detail-heading"><div><p class="eyebrow">CATEGORY DETAIL</p><h2>${esc(group.name)}</h2><p>${purchases.length} purchases · ${esc(analysis.start)} – ${esc(analysis.end)}</p></div><strong>${money(group.total)}</strong></div><p class="quiet-note">These are the exact purchases behind this report total. Select one to inspect its source details.</p><div class="report-detail-list">${purchases.map(p=>`<button type="button" id="purchase-${purchaseKey(p)}" data-purchase="${purchaseKey(p)}"><span><strong>${esc(p.description)}</strong><small>${esc(p.date)}</small></span><span>${money(p.amount)} <span aria-hidden="true">›</span></span></button>`).join('')}</div>`;
      panel.querySelectorAll('[data-purchase]').forEach(button=>button.onclick=()=>navigate('spending','categories',[slug,button.dataset.purchase]));
    }
    panel.querySelector('#detail-back').onclick=back;
    panel.querySelector('[data-detail-home]').onclick=()=>navigate('spending','categories',[]);
    panel.querySelector('[data-detail-category]').onclick=()=>navigate('spending','categories',[slug]);
  }
  return {render};
}
