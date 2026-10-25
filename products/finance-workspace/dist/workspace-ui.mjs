// Display state only. No financial inputs or records are stored here.
export const VIEW_STORAGE_KEY = 'finance-workspace-view-v1';
export const WORKSPACE_TABS = Object.freeze({
  forecast: Object.freeze({overview:'Cash flow',calendar:'Upcoming',monthly:'Monthly savings',compare:'What if'}),
  spending: Object.freeze({categories:'Categories',daily:'Daily activity',large:'Large purchases',opportunities:'Ways to save'})
});
const own = (object,key) => Object.hasOwn(object,key);
export function normalizeViewPreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  const tabs = {};
  for (const [page,choices] of Object.entries(WORKSPACE_TABS)) tabs[page] = own(choices,input.tabs?.[page]) ? input.tabs[page] : Object.keys(choices)[0];
  return {version:1,tabs,density:input.density==='compact'?'compact':'comfortable',hiddenPanels:[...new Set(Array.isArray(input.hiddenPanels)?input.hiddenPanels.filter(key=>typeof key==='string'&&/^[\w:-]{1,160}$/.test(key)):[])].slice(0,100)};
}
export function parseWorkspaceRoute(hash,preferences) {
  const prefs=normalizeViewPreferences(preferences);
  let parts;
  try { parts=String(hash||'').replace(/^#/,'').split('/').map(decodeURIComponent); } catch { parts=[]; }
  let page=parts[0]||'home';
  if (!['home','forecast','spending','transactions','bills','accounts','automation'].includes(page)) page='forecast';
  const choices=WORKSPACE_TABS[page];
  if (!choices) return {page,tab:null,detail:[]};
  const tab=own(choices,parts[1])?parts[1]:prefs.tabs[page];
  const detail=page==='spending'&&tab==='categories'&&own(choices,parts[1])?parts.slice(2).filter(Boolean).slice(0,2).filter(part=>part.length<=200):[];
  return {page,tab,detail};
}
export function workspaceHash(page,tab,detail=[]) {
  if (!Array.isArray(detail)||detail.some(part=>typeof part!=='string'||!part||part.length>200)) throw new TypeError('Detail must contain short local identifiers.');
  const route=parseWorkspaceRoute(`#${page}/${tab||''}`);
  if (route.page!==page||(WORKSPACE_TABS[page]&&route.tab!==tab)||detail.length>2||(detail.length&&!(page==='spending'&&tab==='categories'))) throw new TypeError('Unknown workspace destination.');
  return '#'+[page,...(route.tab?[route.tab]:[]),...detail].map(encodeURIComponent).join('/');
}

export function mountWorkspaceUI({root=globalThis.document,window:win=globalThis.window,storage,onRoute=()=>{}}={}) {
  let store=storage;
  if (!store) { try {store=win.localStorage;} catch {} }
  let prefs;
  try {prefs=normalizeViewPreferences(JSON.parse(store?.getItem(VIEW_STORAGE_KEY)||'null'));} catch {prefs=normalizeViewPreferences();}
  let route=parseWorkspaceRoute(win.location.hash,prefs),destroyed=false;
  const positions=new Map(),contexts=new Map();
  const copy=value=>JSON.parse(JSON.stringify(value));
  const key=value=>workspaceHash(value.page,value.tab,value.detail);
  const all=selector=>[...root.querySelectorAll(selector)];
  const save=()=>{try {store?.setItem(VIEW_STORAGE_KEY,JSON.stringify(prefs));} catch { /* In-memory preferences still work when device storage is unavailable. */ }};
  const node=(tag,text)=>{const element=root.createElement?root.createElement(tag):root.ownerDocument.createElement(tag);if(text)element.textContent=text;return element;};
  function panelKey(panel,index){return panel.dataset.workspaceKey||panel.id||`${panel.dataset.workspacePanel.replace(':','-')}:${index}`;}
  function capture(){
    const active=root.activeElement||root.ownerDocument?.activeElement;
    contexts.set(key(route),{details:all('details[id]').filter(el=>el.open).map(el=>el.id),focus:active?.id||null,selection:typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null});
    positions.set(key(route),[win.scrollX||0,win.scrollY||0]);
  }
  function navigate(page,tab,detail=[]){
    const hash=workspaceHash(page,tab||prefs.tabs[page],detail);
    capture();
    if(win.location.hash===hash)sync();else win.location.hash=hash;
  }
  function addToolbar(page,panels){
    const pageRoot=root.querySelector(`#page-${page}`);
    if(!pageRoot||!panels.length)return;
    let toolbar=pageRoot.querySelector('[data-workspace-toolbar]');
    if(toolbar)return;
    toolbar=node('div');toolbar.className='workspace-toolbar';toolbar.dataset.workspaceToolbar=page;
    const list=node('div');list.className='workspace-tabs';list.setAttribute('role','tablist');list.setAttribute('aria-label',page==='forecast'?'Forecast views':'Spending views');
    for(const [tab,label] of Object.entries(WORKSPACE_TABS[page])){
      const button=node('button',label);button.type='button';button.id=`workspace-tab-${page}-${tab}`;button.dataset.workspaceTab=tab;button.setAttribute('role','tab');
      button.addEventListener('click',()=>navigate(page,tab));
      button.addEventListener('keydown',event=>{
        const buttons=[...list.children],index=buttons.indexOf(button);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:null;
        if(next===null)return;event.preventDefault();buttons[next].focus();navigate(page,buttons[next].dataset.workspaceTab);
      });list.append(button);
    }
    toolbar.append(list);
    const options=node('details');options.className='workspace-view-options';options.dataset.workspaceOptions=page;
    options.append(node('summary','View options'));toolbar.append(options);
    pageRoot.querySelector('.page-heading')?.after(toolbar);
    if(!toolbar.isConnected)pageRoot.prepend(toolbar);
  }
  function updateOptions(page,panels){
    const options=root.querySelector(`[data-workspace-options="${page}"]`);if(!options)return;
    const signature=panels.map((panel,index)=>`${panelKey(panel,index)}:${panel.dataset.workspaceEssential!==undefined}:${panel.dataset.workspaceAvailable}:${panel.dataset.workspaceLabel||panel.querySelector('h2,h3')?.textContent||''}`).join('|');
    if(options.dataset.signature===signature)return;
    options.dataset.signature=signature;
    for(const child of [...options.children].slice(1))child.remove();
    const sheet=node('div');sheet.className='view-options-panel';options.append(sheet);
    const densityLabel=node('label','Row spacing '),density=node('select');density.setAttribute('aria-label','Row spacing');
    for(const name of ['comfortable','compact']){const option=node('option',name==='compact'?'Compact':'Comfortable');option.value=name;density.append(option);}density.value=prefs.density;
    density.addEventListener('change',()=>setDensity(density.value));densityLabel.append(density);sheet.append(densityLabel);
    panels.forEach((panel,index)=>{
      if(panel.dataset.workspaceEssential!==undefined||panel.dataset.workspaceAvailable==='false')return;
      const label=node('label'),input=node('input');input.type='checkbox';const id=panelKey(panel,index);input.dataset.workspaceVisibility=id;input.checked=!prefs.hiddenPanels.includes(id);
      input.addEventListener('change',()=>setPanelVisible(id,input.checked));label.append(input,node('span',panel.dataset.workspaceLabel||panel.querySelector('h2,h3')?.textContent||WORKSPACE_TABS[page][panel.dataset.workspacePanel.split(':')[1]]));sheet.append(label);
    });
    const reset=node('button','Reset view');reset.type='button';reset.className='text-button';reset.addEventListener('click',resetView);sheet.append(reset);
    sheet.append(node('p','View options change presentation only. Your records and calculations stay the same.'));
  }
  function sync(){
    if(destroyed)return;
    const previous=route,next=parseWorkspaceRoute(win.location.hash,prefs),changed=key(previous)!==key(next);
    if(changed)capture();
    route=next;
    if(route.tab){prefs.tabs[route.page]=route.tab;save();}
    const surface=root.documentElement||root;surface.dataset.density=prefs.density;
    for(const page of Object.keys(WORKSPACE_TABS)){
      const panels=all(`[data-workspace-panel^="${page}:"]`);
      panels.forEach((panel,index)=>{if(!panel.dataset.workspaceKey)panel.dataset.workspaceKey=panelKey(panel,index);});
      addToolbar(page,panels);updateOptions(page,panels);
      panels.forEach((panel,index)=>{
        const tab=panel.dataset.workspacePanel.split(':')[1];if(!panel.id)panel.id=`workspace-panel-${page}-${index}`;
        panel.hidden=panel.dataset.workspaceAvailable==='false'||route.page!==page||route.tab!==tab||Boolean(route.detail.length)||(panel.dataset.workspaceEssential===undefined&&prefs.hiddenPanels.includes(panelKey(panel,index)));
        panel.setAttribute('aria-labelledby',`workspace-tab-${page}-${tab}`);
      });
      all(`[data-workspace-toolbar="${page}"] [data-workspace-tab]`).forEach(button=>{
        const selected=(route.page===page?route.tab:prefs.tabs[page])===button.dataset.workspaceTab;
        button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
        button.setAttribute('aria-controls',panels.filter(panel=>panel.dataset.workspacePanel===`${page}:${button.dataset.workspaceTab}`).map(panel=>panel.id).join(' '));
      });
    }
    const detail=root.querySelector('#spending-detail-view');if(detail)detail.hidden=!(route.page==='spending'&&route.detail.length);
    all('[data-workspace-visibility]').forEach(input=>{input.checked=!prefs.hiddenPanels.includes(input.dataset.workspaceVisibility);});
    all('[data-workspace-options] select').forEach(select=>{select.value=prefs.density;});
    onRoute(copy(route));
    const context=contexts.get(key(route));
    if(changed&&route.detail.length&&!context&&detail){detail.tabIndex=-1;detail.focus({preventScroll:true});}
    if(context){
      for(const id of context.details){const element=root.getElementById?.(id)||all('details[id]').find(el=>el.id===id);if(element)element.open=true;}
      const active=root.activeElement||root.ownerDocument?.activeElement;
      if(changed||!active||active===root.body){const element=root.getElementById?.(context.focus);if(element&&!element.closest('[hidden]')){element.focus({preventScroll:true});if(context.selection&&element.setSelectionRange)try{element.setSelectionRange(...context.selection);}catch{}}}
    }
    if(changed){const position=positions.get(key(route))||[0,0];win.scrollTo?.(...position);}
    return copy(route);
  }
  function setPanelVisible(id,visible){
    const panel=all('[data-workspace-panel]').find(item=>item.dataset.workspaceKey===id);
    if(!panel||panel.dataset.workspaceEssential!==undefined||panel.dataset.workspaceAvailable==='false')return false;
    prefs.hiddenPanels=prefs.hiddenPanels.filter(value=>value!==id);if(!visible)prefs.hiddenPanels.push(id);save();sync();return true;
  }
  function setDensity(density){if(!['compact','comfortable'].includes(density))throw new TypeError('Unknown row spacing.');prefs.density=density;save();sync();}
  function resetView(){prefs=normalizeViewPreferences();save();const tab=prefs.tabs[route.page];if(tab)navigate(route.page,tab);else sync();}
  const handleHash=()=>sync();win.addEventListener('hashchange',handleHash);
  sync();
  return {navigate,getRoute:()=>copy(route),sync,capture,getPreferences:()=>copy(prefs),setPanelVisible,setDensity,resetView,destroy(){destroyed=true;win.removeEventListener('hashchange',handleHash);}};
}
