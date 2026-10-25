import test from 'node:test';
import assert from 'node:assert/strict';
import {mountWorkspaceUI,normalizeViewPreferences,parseWorkspaceRoute,workspaceHash,VIEW_STORAGE_KEY} from '../dist/workspace-ui.mjs';

function harness(hash='#forecast'){
  const data=new Map(),listeners=new Map(),scrolls=[],routes=[];
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const root={documentElement:{dataset:{}},querySelectorAll:()=>[],querySelector:()=>null};
  const window={location:{hash},scrollX:0,scrollY:0,addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event),scrollTo:(...args)=>scrolls.push(args)};
  const mount=()=>mountWorkspaceUI({root,window,storage,onRoute:route=>routes.push(route)});
  const visit=hash=>{window.location.hash=hash;listeners.get('hashchange')?.();};
  return {root,window,storage,data,listeners,scrolls,routes,mount,visit};
}
test('legacy routes retain page aliases and last selected task; invalid routes safely recover',()=>{
  const prefs={tabs:{spending:'daily',forecast:'monthly'}};
  assert.deepEqual(parseWorkspaceRoute('#spending',prefs),{page:'spending',tab:'daily',detail:[]});
  assert.equal(parseWorkspaceRoute('#forecast',prefs).tab,'monthly');
  for(const page of ['bills','accounts','transactions','automation'])assert.deepEqual(parseWorkspaceRoute(`#${page}`,prefs),{page,tab:null,detail:[]});
  assert.equal(parseWorkspaceRoute('#%E0%A4%A',prefs).page,'home');
  assert.equal(parseWorkspaceRoute('#not-a-page',prefs).page,'forecast');
});
test('local category and purchase destinations round trip without arbitrary routes',()=>{
  const hash=workspaceHash('spending','categories',['At work','purchase-7']);
  assert.equal(hash,'#spending/categories/At%20work/purchase-7');
  assert.deepEqual(parseWorkspaceRoute(hash),{page:'spending',tab:'categories',detail:['At work','purchase-7']});
  assert.deepEqual(parseWorkspaceRoute('#forecast/compare/unexpected').detail,[]);
  assert.throws(()=>workspaceHash('forecast','bad'),/destination/);
  assert.throws(()=>workspaceHash('spending','daily',['detail']),/destination/);
  assert.throws(()=>workspaceHash('spending','categories',['x'.repeat(201)]),/identifiers/);
});
test('preference normalization permits presentation settings only and rejects malformed stored values',()=>{
  const input={tabs:{forecast:'compare',spending:'bad'},density:'compact',hiddenPanels:['monthly-savings','monthly-savings','../secret',null],plan:{balance:99}};
  assert.deepEqual(normalizeViewPreferences(input),{version:1,tabs:{forecast:'compare',spending:'categories'},density:'compact',hiddenPanels:['monthly-savings']});
  assert.equal(input.plan.balance,99);
  assert.equal(normalizeViewPreferences({tabs:{forecast:'__proto__'}}).tabs.forecast,'overview');
});
test('navigation, browser Back, persisted tabs, density and Reset never store financial state',()=>{
  const h=harness(),ui=h.mount();
  ui.navigate('spending','daily');h.visit(h.window.location.hash);
  ui.setDensity('compact');
  assert.equal(h.root.documentElement.dataset.density,'compact');
  h.visit('#forecast/calendar');h.visit('#spending/daily');
  assert.equal(ui.getRoute().tab,'daily');
  const saved=JSON.parse(h.data.get(VIEW_STORAGE_KEY));
  assert.deepEqual(Object.keys(saved).sort(),['density','hiddenPanels','tabs','version']);
  ui.destroy();assert.equal(h.listeners.size,0);
  h.window.location.hash='#spending';const reloaded=h.mount();assert.equal(reloaded.getRoute().tab,'daily');
  reloaded.resetView();h.visit(h.window.location.hash);assert.equal(reloaded.getRoute().tab,'categories');
  assert.equal(reloaded.getPreferences().density,'comfortable');
});
test('scroll is restored on back rather than reset by ordinary refresh, and snapshots cannot mutate controller',()=>{
  const h=harness(),ui=h.mount();h.window.scrollY=320;
  ui.navigate('forecast','calendar');h.visit(h.window.location.hash);
  h.window.scrollY=70;ui.navigate('forecast','monthly');h.visit(h.window.location.hash);
  h.visit('#forecast/calendar');assert.deepEqual(h.scrolls.at(-1),[0,70]);
  const count=h.scrolls.length;ui.sync();assert.equal(h.scrolls.length,count);
  const route=ui.getRoute();route.detail.push('unsafe');assert.deepEqual(ui.getRoute().detail,[]);
});
test('unavailable or corrupt device storage leaves navigation usable without error',()=>{
  const h=harness();h.data.set(VIEW_STORAGE_KEY,'not JSON');
  const ui=h.mount();assert.equal(ui.getRoute().tab,'overview');
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  ui.destroy();const fallback=mountWorkspaceUI({root:h.root,window:h.window,storage:denied});
  assert.doesNotThrow(()=>fallback.setDensity('compact'));
  assert.throws(()=>fallback.setDensity('dense'),/spacing/);
});
test('panel visibility persists across refreshed nodes, while essential context cannot be hidden',()=>{
  const h=harness('#forecast/monthly');
  const panel=(id,tab,essential=false)=>({id,dataset:{workspacePanel:`forecast:${tab}`,...(essential?{workspaceEssential:''}:{})},querySelector:()=>null,setAttribute(){},hidden:false});
  let panels=[panel('monthly-savings','monthly'),panel('risk-context','monthly',true),panel('calendar-section','calendar')];
  h.root.querySelectorAll=selector=>selector==='[data-workspace-panel]'||selector==='[data-workspace-panel^="forecast:"]'?panels:[];
  const ui=h.mount();assert.equal(panels[0].hidden,false);assert.equal(panels[2].hidden,true);
  assert.equal(ui.setPanelVisible('monthly-savings',false),true);assert.equal(panels[0].hidden,true);
  assert.equal(ui.setPanelVisible('risk-context',false),false);assert.equal(panels[1].hidden,false);
  panels=[panel('monthly-savings','monthly'),panel('risk-context','monthly',true)];ui.sync();
  assert.equal(panels[0].hidden,true);assert.equal(panels[1].hidden,false);
  ui.resetView();h.visit('#forecast/monthly');assert.equal(panels[0].hidden,false);
});

test('Home is the launch destination while existing report links keep their routes',()=>{assert.deepEqual(parseWorkspaceRoute(''),{page:'home',tab:null,detail:[]});assert.equal(workspaceHash('home',null),'#home');assert.equal(parseWorkspaceRoute('#forecast/calendar').tab,'calendar');});
