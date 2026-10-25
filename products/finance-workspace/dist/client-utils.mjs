// Record IDs are identifiers, never passwords or session credentials.
export function recordId(source=globalThis.crypto){
  if(typeof source?.randomUUID==='function')return source.randomUUID();
  if(typeof source?.getRandomValues==='function'){const b=source.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0'));return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;}
  return `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
