import { $, api, esc } from './common.js';
import { ControlRoom } from './admin.js';
import { BroadcastView } from './viewer.js';

async function boot() {
  const root=$('#app');
  try {
    let state=await api('/api/state');
    const isViewer=location.pathname.startsWith('/view/');
    const view=isViewer?new BroadcastView(root,state):new ControlRoom(root,await api('/api/config'),state);
    const events=new EventSource('/api/events');
    events.addEventListener('state',event=>{state=JSON.parse(event.data);view.update(state);});
    events.addEventListener('candidate',event=>{const snapshot=JSON.parse(event.data);state.snapshots[snapshot.id]=snapshot;view.update(state);});
    events.addEventListener('contest',event=>{const snapshot=JSON.parse(event.data);state.contests ||= {};state.contests[snapshot.groupId]=snapshot;view.update(state);});
    events.onopen=()=>{document.body.classList.remove('server-offline');view.connection(true);};
    events.onerror=()=>{document.body.classList.add('server-offline');view.connection(false);};
  }catch(error){root.innerHTML=`<div class="boot">Không mở được Sirocco Live<span>${esc(error.message)}</span><button class="button" id="retry-boot">Thử lại</button></div>`;$('#retry-boot').onclick=()=>location.reload();}
}
boot();
