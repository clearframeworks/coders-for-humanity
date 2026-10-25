/** One UI refresh timer. The caller supplies all collection/network behavior.
 * Pause stops future timer checks; an already running check may still finish.
 * A skipped callback result never advances the last-success timestamp.
 */
export function createAutoUpdater({check,setTimer=setInterval,clearTimer=clearInterval,onState=()=>{},intervalMs=60000,now=()=>new Date().toISOString()}={}) {
  if(typeof check!=='function'||typeof setTimer!=='function'||typeof clearTimer!=='function'||typeof onState!=='function'||typeof now!=='function')throw Error('Auto update requires valid callbacks.');
  if(!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>86400000)throw Error('Auto update interval must be between one second and 24 hours.');
  const state={enabled:true,checking:false,lastSuccess:null,lastError:null,result:null,deferredReason:null};
  let timer=null,inFlight=null,disposed=false;
  const getState=()=>structuredClone(state);
  const publish=()=>onState(getState());
  function schedule(){if(timer===null)timer=setTimer(()=>{checkNow();},intervalMs);}
  function unschedule(){if(timer!==null){clearTimer(timer);timer=null;}}
  function enable(){
    if(disposed)throw Error('This auto updater has been disposed.');
    state.enabled=true;schedule();publish();return getState();
  }
  function pause(){state.enabled=false;unschedule();if(!disposed)publish();return getState();}
  function checkNow(){
    if(disposed)return Promise.resolve(getState());
    if(inFlight)return inFlight;
    state.checking=true;state.deferredReason=null;
    // Defer the callback until inFlight is assigned, including synchronous
    // failures or a caller that requests another check from its callback.
    inFlight=Promise.resolve().then(check).then(result=>{
      if(disposed)return;
      if(result?.skipped===true){state.deferredReason=typeof result.reason==='string'?result.reason:'Update deferred.';return;}
      const timestamp=now();
      if(typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp)))throw Error('The update time could not be recorded.');
      state.result=result??null;state.lastSuccess=timestamp;state.lastError=null;
    }).catch(error=>{
      if(!disposed){state.lastError=error instanceof Error?error.message:String(error||'Update failed.');state.deferredReason=null;}
    }).then(()=>{
      state.checking=false;inFlight=null;
      if(!disposed)publish();return getState();
    });
    publish();return inFlight;
  }
  function dispose(){disposed=true;state.enabled=false;unschedule();}
  schedule();publish();
  return{enable,pause,checkNow,getState,dispose};
}
