import { CodePanel } from './editor.js';
import { $, $$, LANGUAGES, STATUS, esc, time } from './common.js';
import { renderTileContest } from './contest-ui.js';

export class BroadcastView {
  constructor(root, state) {
    this.root=root;this.state=state;this.panels=new Map();this.identity='';this.rotationKey='';this.rotateIndex=0;this.online=true;
    const route=location.pathname.split('/').filter(Boolean);
    this.candidateId=route[1]==='candidate'?route[2]:null;this.group=route[1];
    this.previewMode=new URLSearchParams(location.search).get('preview')==='1';
    if(this.previewMode)window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='sirocco-preview'||event.data.group!==this.group)return;
      this.previewSettings=event.data.settings;this.previewTitle=event.data.title;this.render();
    });
    document.body.classList.add('viewer-page');this.render();
    this.clockTimer=setInterval(()=>this.clock(),1000);
  }
  update(state) { this.state=state;this.render(); }
  render() {
    const config=this.state.config;if(!config)return;
    const groupId=this.candidateId?config.candidates.find(c=>c.id===this.candidateId)?.group||'nonpro':this.group;
    const g={...config.groups[groupId],...(this.previewMode?this.previewSettings:{})};
    if(!g.title){this.root.innerHTML='<div class="viewer-empty">Không tìm thấy nhóm.</div>';return;}
    const title=this.previewMode&&this.previewTitle?this.previewTitle:config.title;
    const members=config.candidates.filter(c=>c.enabled&&(this.candidateId?c.id===this.candidateId:c.group===groupId));
    const identity=JSON.stringify(members.map(c=>c.id));
    if(identity!==this.identity||!this.frame){
      const restore=new Map([...this.panels].map(([id,p])=>[id,{scroll:p.editor.view.scrollDOM.scrollTop,manualUntil:p.manualUntil}]));
      this.panels.forEach(p=>p.editor.destroy());this.panels.clear();this.identity=identity;
      this.root.innerHTML=`<main class="broadcast"><header class="broadcast-header"><div><span class="broadcast-mark"><img src="/assets/sirocco-symbol.png" alt="Sirocco Team"></span><strong id="broadcast-title"></strong><span class="broadcast-divider">/</span><span id="broadcast-group"></span></div><div><span class="broadcast-demo hidden">MINH HOẠ</span><span class="broadcast-connection" id="viewer-connection"></span><time id="broadcast-clock"></time></div></header><div class="broadcast-grid">${members.length?members.map((c,i)=>tile(c,i)).join(''):'<div class="viewer-empty"><span class="brand-mark"><img src="/assets/sirocco-symbol.png" alt="Sirocco Team"></span><h1>Chờ thí sinh vào khung hình</h1><p>Thêm link USACO IDE trong phòng điều khiển rồi lưu thay đổi.</p></div>'}</div><div id="connection-warning" class="connection-warning hidden">Mất kết nối với Sirocco Live · đang giữ hình cuối</div></main>`;
      this.frame=$('.broadcast');
      const contestMeta=document.createElement('span');contestMeta.id='broadcast-contest-meta';contestMeta.className='broadcast-contest-meta hidden';$('.broadcast-header>div:last-child').prepend(contestMeta);
      $$('.code-tile').forEach(node=>{
        const parent=$('.code-container',node),previous=restore.get(node.dataset.panelId);
        const editor=new CodePanel(parent,{fontSize:g.fontSize,wrap:g.wrap});
        const panel={node,editor,code:'',offset:null,revision:-1,manualUntil:previous?.manualUntil||0,lastMode:g.follow};this.panels.set(node.dataset.panelId,panel);
        const pause=()=>{panel.manualUntil=Date.now()+8000;panel.editor.followEnabled=false;};
        parent.addEventListener('wheel',pause,{passive:true});parent.addEventListener('touchmove',pause,{passive:true});
        if(previous&&g.follow==='off')requestAnimationFrame(()=>{editor.view.scrollDOM.scrollTop=previous.scroll;});
      });
    }
    this.frame.dataset.layout=this.candidateId?'columns':g.layout;this.frame.dataset.count=members.length;
    this.frame.dataset.showInput=String(g.showInput!==false);this.frame.dataset.inputPosition=g.inputPosition||'right';
    this.frame.style.setProperty('--code-font-size',`${g.fontSize}px`);this.frame.style.setProperty('--input-font-size',`${Math.max(11,Math.min(16,g.fontSize-3))}px`);
    this.frame.classList.toggle('no-header',!g.showHeader);
    $('#broadcast-title').textContent=title;$('#broadcast-group').textContent=g.title;$('.broadcast-demo').classList.toggle('hidden',!config.demo);
    document.title=`${title} — ${g.title}`;
    const contest=this.state.contests?.[groupId], contestVisible=g.codeforces?.enabled&&g.codeforces.showOnLive!==false;
    const meta=$('#broadcast-contest-meta');meta.classList.toggle('hidden',!contestVisible);
    meta.textContent=contestVisible?[contest?.asManager?'QUYỀN QUẢN LÝ':'CODEFORCES',contest?.contest?.frozen?'BXH ĐÓNG BĂNG':contest?.status==='stale'?'ĐIỂM CŨ':contest?.contest?.type||'CHỜ ĐIỂM'].join(' · '):'';
    meta.dataset.status=contest?.status||'waiting';meta.title=contest?.checkedAt?`${contest.contest?.name||''} · ${time(contest.checkedAt)}`:'';
    for(const c of members){this.panel(c,g,this.state.snapshots[c.id]);renderTileContest(this.panels.get(c.id),c,g.codeforces,contest);}
    this.rotation(g,members);this.focus(g,members);this.clock();this.connection(this.online);
  }
  panel(c,g,snapshot) {
    const p=this.panels.get(c.id);if(!p)return;
    const s=snapshot||{status:'waiting',message:'Chờ link chia sẻ…',code:'',input:'',inputStatus:'waiting',language:'cpp',revision:0};
    const code=s.code||'',hasCursor=g.follow==='cursor'&&s.cursorOffset!=null;
    const offset=hasCursor?s.cursorOffset:s.editOffset??s.offset??0;
    const following=g.follow!=='off'&&Date.now()>=p.manualUntil;
    const changed=p.offset!==offset||p.revision!==s.revision||p.hasCursor!==hasCursor||p.lastMode!==g.follow||p.following!==following;
    p.editor.configure({language:s.language,fontSize:g.fontSize,wrap:g.wrap});
    if(p.code!==code||changed)p.editor.update(code,offset,following,hasCursor);
    Object.assign(p,{code,offset,revision:s.revision,hasCursor,lastMode:g.follow,following});
    $('.tile-name',p.node).textContent=c.name;
    const status=$('.tile-status',p.node);status.textContent=STATUS[s.status]||s.status;status.dataset.status=s.status;
    $('.tile-language',p.node).textContent=LANGUAGES[s.language]||'Code';
    const empty=$('.tile-empty',p.node);empty.classList.toggle('hidden',Boolean(code));empty.textContent=s.status==='live'?'File chưa có code':s.message;
    const line=code.slice(0,offset).split('\n').length;
    $('.tile-follow',p.node).textContent=!following&&g.follow!=='off'?'Tạm dừng bám · 8 giây':hasCursor?`Bám con trỏ · dòng ${line}`:g.follow==='off'?'Cuộn thủ công':`Theo dòng sửa · ${line}`;
    $('.tile-update',p.node).textContent=s.updatedAt?time(s.updatedAt):'';
    p.node.classList.toggle('tile-error',s.status==='error');p.node.dataset.status=s.status;
    const input=s.input||'',inputStatus=s.inputStatus||'waiting',pre=$('.tile-input-text',p.node);
    if(p.input!==input){const y=pre.scrollTop;pre.textContent=input;pre.scrollTop=y;p.input=input;}
    $('.input-line-count',p.node).textContent=input?`${input.split('\n').length} dòng`:'';
    const hint=$('.input-empty',p.node);hint.classList.toggle('hidden',Boolean(input));
    hint.textContent=inputStatus==='live'||inputStatus==='demo'?'Chưa có dữ liệu nhập':inputStatus==='error'?'Không nhận được Input':inputStatus==='reconnecting'?'Đang kết nối lại Input…':inputStatus==='waiting'?'Chờ link chia sẻ':'Đang nhận Input…';
    const inputBadge=$('.input-status',p.node);inputBadge.dataset.status=inputStatus;inputBadge.title=s.inputMessage||STATUS[inputStatus]||'';
    $('.input-time',p.node).textContent=s.inputUpdatedAt?time(s.inputUpdatedAt):'';
  }
  rotation(g,members) {
    const key=JSON.stringify([g.layout,g.rotationSeconds,members.map(c=>c.id)]);if(key===this.rotationKey)return;
    this.rotationKey=key;clearInterval(this.rotationTimer);this.rotateIndex=0;
    if(g.layout==='rotate'&&members.length>1)this.rotationTimer=setInterval(()=>{this.rotateIndex=(this.rotateIndex+1)%members.length;this.focus(g,members);},g.rotationSeconds*1000);
  }
  focus(g,members) { const id=g.layout==='rotate'?members[this.rotateIndex%Math.max(1,members.length)]?.id:g.focusId||members[0]?.id;for(const [key,p]of this.panels)p.node.classList.toggle('spotlight',key===id); }
  clock() { const node=$('#broadcast-clock');if(node)node.textContent=time(Date.now()); }
  connection(online) { this.online=online;$('#connection-warning')?.classList.toggle('hidden',online);const node=$('#viewer-connection');if(node)node.textContent=online?'CODE + INPUT · CHỈ ĐỌC':'MẤT KẾT NỐI'; }
}
function tile(c,i) {
  return `<section class="code-tile" data-panel-id="${c.id}">
    <header class="code-tile-header"><div><span class="tile-number">${String(i+1).padStart(2,'0')}</span><h2 class="tile-name">${esc(c.name)}</h2></div><div><span class="tile-language"></span><span class="tile-status"></span></div></header>
    <div class="tile-contest hidden" aria-label="Thành tích Codeforces của ${esc(c.name)}"></div>
    <div class="tile-workspace"><div class="tile-code-area"><div class="code-container"></div><div class="tile-empty"></div></div><aside class="tile-input" aria-label="Input của ${esc(c.name)}"><header><span><i class="input-status"></i>INPUT</span><span class="input-line-count"></span></header><div class="input-content"><pre class="tile-input-text" tabindex="0" aria-label="Nội dung Input của ${esc(c.name)}"></pre><span class="input-empty"></span></div><footer class="input-time"></footer></aside></div>
    <footer class="code-tile-footer"><span class="tile-follow"></span><span class="tile-update"></span></footer>
  </section>`;
}
