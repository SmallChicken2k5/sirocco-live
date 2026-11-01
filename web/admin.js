import { $, $$, GROUPS, LANGUAGES, STATUS, VERSION, icon, esc, sourceUrl, time, toast, api, copy, options } from './common.js';
import { CodeforcesSettings } from './codeforces-settings.js';
import { contestControls, candidateContestFields, bindContestControls, updateContestControls } from './contest-ui.js';

export class ControlRoom {
  constructor(root, config, state) {
    this.root = root; this.config = config; this.state = state; this.group = 'nonpro'; this.revision = 0; this.dirty = false; this.saving = false;
    window.addEventListener('beforeunload', event => { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if(this.dirty) this.save(); } });
    this.compactInspector = localStorage.getItem('sirocco.inspector') === 'hidden';
    for(const group of Object.values(this.config.groups))group.codeforces ||= {enabled:false,url:'',asManager:false,refreshSeconds:30,showOnLive:true};
    this.codeforces = new CodeforcesSettings({ onChange: status=>{const button=$('#open-codeforces');if(button)button.dataset.connected=String(status.configured);}, onApply: result=>{const group=this.config.groups[this.group];Object.assign(group.codeforces,{enabled:true,url:result.source,asManager:result.asManager});this.changed(true);this.render();toast('Đã chọn contest cho nhóm. Gắn handle rồi lưu để đưa điểm lên live.');} });
    this.render(true);
  }
  render(animate = false) {
    const c = this.config, id = this.group, g = c.groups[id], members = c.candidates.filter(c => c.group === id);
    this.previewObserver?.disconnect();
    this.root.innerHTML = `<div class="studio-shell studio-v3">
      <header class="topbar"><a class="brand" href="/" aria-label="Sirocco Live, phòng điều khiển"><img class="brand-logo" src="/assets/sirocco-symbol.png" alt="Sirocco Team"><span>SIROCCO <b>LIVE</b><small>BROADCAST STUDIO</small></span></a><div class="topbar-right"><button class="text-button cf-open" id="open-codeforces" aria-label="Kết nối Codeforces">${icon('chart-line')}<span>Codeforces</span></button><span class="local-badge"><i></i> Máy chủ đang chạy</span><button class="icon-button mobile-help" id="show-guide-mobile" aria-label="Hướng dẫn thiết lập">${icon('question')}</button><span class="version">${VERSION}</span></div></header>
      <aside class="sidebar"><div class="nav-caption">NGUỒN PHÁT</div>${Object.keys(GROUPS).map(key => `<button class="nav-group ${id === key ? 'selected' : ''}" data-group="${key}" aria-pressed="${id === key}"><span class="nav-symbol">${icon(key === 'nonpro' ? 'squares-four' : 'columns')}</span><span>${esc(c.groups[key].title)}<small>Kênh ${key === 'nonpro' ? '01' : '02'}</small></span><span class="nav-count">${c.candidates.filter(p => p.group === key && p.enabled).length}</span></button>`).join('')}<div class="sidebar-bottom"><div class="sidebar-note">${icon('broadcast')}<span>Code + Input<small>Đồng bộ từ USACO IDE</small></span></div><button class="text-button" id="show-guide">${icon('question')} Hướng dẫn thiết lập</button><div class="team-credit">A SIROCCO TEAM TOOL</div></div></aside>
      <main class="control-main">
        <div class="page-heading"><div><div class="eyebrow">${esc(c.title)} <span>/</span> PHÒNG ĐIỀU KHIỂN</div><h1>${esc(g.title)}<span>${members.filter(c => c.enabled).length} thí sinh</span></h1><p>Khung phát trực tiếp từ những dòng code.</p></div><div class="heading-actions"><span id="save-state">${this.dirty ? 'Có thay đổi chưa áp dụng' : 'Đã lưu tại máy'}</span><button class="button primary" id="save-config" ${this.dirty ? '' : 'disabled'}>${icon('check')} Lưu & áp dụng</button></div></div>
        <div class="channel-overview">${Object.keys(GROUPS).map(key => `<div class="channel-summary ${id === key ? 'current' : ''}"><span class="channel-glyph">${icon('broadcast')}</span><div><span class="channel-index">NGUỒN ${key === 'nonpro' ? '01' : '02'}</span><strong>${esc(c.groups[key].title)}</strong></div><span class="channel-health" data-health-group="${key}"></span><button class="icon-button copy-group" data-copy-group="${key}" aria-label="Sao chép link nguồn ${esc(c.groups[key].title)}" title="Sao chép link Browser Source">${icon('copy')}</button></div>`).join('')}</div>
        ${c.demo ? '<div class="demo-banner"><span>PHIÊN MINH HOẠ</span> Dữ liệu mẫu để thử bố cục; không phải bài thi thật.<button id="leave-demo">Kết thúc chạy thử</button></div>' : ''}
        <div class="studio-workspace ${this.compactInspector ? 'inspector-hidden' : ''}">
          <section class="preview-section" aria-label="Xem trước nguồn phát"><div class="section-toolbar"><div><span class="signal-dot"></span><strong>Xem trước</strong><span class="preview-state-label">1920 × 1080</span></div><div class="preview-tools"><button class="icon-button" id="toggle-inspector" aria-label="${this.compactInspector ? 'Hiện' : 'Ẩn'} thiết lập khung hình" aria-expanded="${!this.compactInspector}" title="Ẩn hoặc hiện thiết lập">${icon('sliders-horizontal')}</button><a class="icon-button" href="${sourceUrl(id)}" target="_blank" rel="noopener" aria-label="Mở nguồn phát toàn khung" title="Mở nguồn phát toàn khung">${icon('arrows-out')}</a></div></div><div class="preview-frame"><div class="preview-viewport"><iframe title="Xem trước ${esc(g.title)}" src="${sourceUrl(id)}?preview=1" width="1920" height="1080"></iframe></div></div><div class="source-address">${icon('link')}<span>BROWSER SOURCE</span><code>${esc(sourceUrl(id))}</code><button class="tiny-button" id="copy-source">${icon('copy')} Sao chép</button></div><div class="preview-hint"><span id="preview-hint-text">Chỉnh để xem thử. Lưu để áp dụng lên nguồn phát.</span><span class="kbd">Ctrl S</span></div></section>
          <aside class="inspector" aria-label="Thiết lập nguồn phát"><div class="inspector-heading"><span>THIẾT LẬP KHUNG HÌNH</span><span class="inspector-index">${id === 'nonpro' ? '01' : '02'}</span></div>
            <div class="setting-section"><div class="setting-title">Chữ & mật độ</div><div class="density-presets">${[[14,'Tổng quan'],[16,'Cân bằng'],[19,'Chi tiết']].map(([size,label]) => `<button data-font-preset="${size}" class="density-preset ${g.fontSize === size ? 'active' : ''}">${label}<small>${size}px</small></button>`).join('')}</div><div class="font-adjust"><button class="font-step" data-font-step="-1" aria-label="Giảm cỡ chữ">−</button><input id="font-size" aria-label="Cỡ chữ code" type="range" min="10" max="40" value="${g.fontSize}"><output id="font-value">${g.fontSize}px</output><button class="font-step" data-font-step="1" aria-label="Tăng cỡ chữ">+</button></div><label class="check-label"><input id="wrap" type="checkbox" ${g.wrap ? 'checked' : ''}> Tự xuống dòng code dài</label></div>
            <div class="setting-section"><div class="setting-title">Bố cục</div><div class="layout-choices" role="group" aria-label="Bố cục nguồn phát">${[['grid','squares-four','Lưới'],['columns','columns','Cạnh nhau'],['spotlight','sidebar-simple','Nổi bật'],['rotate','arrows-clockwise','Luân phiên']].map(([value,glyph,label])=>`<button class="layout-choice ${g.layout===value?'active':''}" data-layout="${value}" aria-pressed="${g.layout===value}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div><select id="layout" aria-label="Bố cục" class="hidden">${options([['grid','Lưới cân đối'],['columns','Cạnh nhau'],['spotlight','Một người nổi bật'],['rotate','Tự luân phiên']],g.layout)}</select><div class="rotation-row ${g.layout === 'rotate' ? '' : 'hidden'}" id="rotation-row"><label for="rotation">Đổi người sau</label><span><input id="rotation" aria-label="Số giây chuyển thí sinh" type="number" min="8" max="180" value="${g.rotationSeconds}"> giây</span></div><label class="inspector-label" for="follow">Tự theo dõi</label><select id="follow">${options([['edits','Dòng vừa sửa'],['cursor','Con trỏ · dự phòng theo sửa'],['off','Cuộn thủ công']],g.follow)}</select><p class="setting-help">Cuộn thủ công sẽ tạm dừng bám 8 giây.</p></div>
            <div class="setting-section"><div class="setting-title setting-toggle"><label for="show-input">Ô Input</label><label class="switch"><input id="show-input" type="checkbox" aria-label="Hiện ô Input" ${g.showInput !== false ? 'checked' : ''}><span></span></label></div><div id="input-settings" class="${g.showInput === false ? 'hidden' : ''}"><label class="inspector-label" for="input-position">Vị trí trong ô thí sinh</label><select id="input-position">${options([['right','Cạnh phải · giữ chiều cao code'],['bottom','Phía dưới · giữ chiều rộng code']],g.inputPosition || 'right')}</select><p class="setting-help">Input đồng bộ trực tiếp, có thể cuộn riêng.</p></div></div>
            <div class="setting-section setting-last"><label class="check-label"><input id="show-header" type="checkbox" ${g.showHeader ? 'checked' : ''}> Hiện tên cuộc thi trên nguồn</label></div>
          </aside>
        </div>
        ${contestControls(g.codeforces)}
        <section class="participants-section"><div class="section-toolbar"><div>${icon('users')}<strong>Danh sách thí sinh</strong><span class="muted small">${members.length} người</span></div><button class="button" id="add-candidate">${icon('plus')} Thêm thí sinh</button></div><div class="participant-list">${members.length ? members.map((candidate, i) => this.row(candidate,i,g)).join('') : `<div class="empty-list"><img src="/assets/sirocco-symbol.png" class="empty-logo" alt=""><h2>Khung hình đang chờ người viết</h2><p>Thêm link share USACO IDE để nhận code và Input trực tiếp.</p><div><button class="button primary" id="add-first">${icon('plus')} Thêm thí sinh</button>${!c.candidates.length ? '<button class="button" id="load-demo">Thử với 6 thí sinh mẫu</button>' : ''}</div></div>`}</div></section>
        <details class="project-settings"><summary>Tên cuộc thi & quản lý cấu hình<span>Lưu cục bộ trên máy này</span></summary><footer class="control-footer"><label>Tên cuộc thi<input id="contest-title" maxlength="80" value="${esc(c.title)}"></label><label>Tên nhóm<input id="group-title" maxlength="80" value="${esc(g.title)}"></label><div><button class="text-button" id="import-config">Nhập cấu hình</button><a class="text-button" href="/api/export" download>Xuất cấu hình</a><a class="text-button" href="/api/archive" download>Lưu code + input</a></div></footer></details>
        <div class="apply-bar ${this.dirty ? '' : 'hidden'}" id="apply-bar">${icon('sliders-horizontal')}<span><strong>Thay đổi chưa áp dụng</strong><small>Bản xem trước đã cập nhật.</small></span><button class="button" id="discard-changes">Huỷ thay đổi</button><button class="button primary" id="apply-config">${icon('check')} Lưu & áp dụng</button></div><div class="studio-footer"><span>SIROCCO TEAM</span><span>Code rõ. Theo dõi trọn vẹn.</span></div>
      </main>
    </div>${guide()}<input type="file" id="config-file" accept="application/json,.json" hidden>`;
    this.bind(); this.syncFont(); this.updateStatuses();
    this.previewObserver = new ResizeObserver(entries => { for(const e of entries)e.target.style.setProperty('--preview-scale',String(e.contentRect.width/1920)); });
    this.previewObserver.observe($('.preview-viewport'));
    $('iframe').addEventListener('load',() => { this.preview(); $('.preview-frame').classList.add('ready'); });
    if(animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for(const [i,node] of $$('.page-heading,.channel-overview,.studio-workspace,.participants-section').entries())node.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:i*35,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
    }
  }
  row(c,i,g) {
    return `<article class="participant-row" data-id="${c.id}">
      <div class="participant-number">${String(i+1).padStart(2,'0')}</div>
      <div class="participant-fields"><div class="participant-top"><input class="candidate-name" aria-label="Tên thí sinh" maxlength="80" value="${esc(c.name)}"><span class="status-pill" data-status-id="${c.id}"></span></div><input class="candidate-url" type="url" aria-label="Link share USACO IDE của ${esc(c.name)}" placeholder="https://ide.usaco.guide/…" value="${esc(c.url)}" ${this.config.demo ? 'disabled' : ''}><span class="candidate-message muted" data-message-id="${c.id}"></span>${candidateContestFields(c)}</div>
      <div class="participant-options"><select class="candidate-language" aria-label="Ngôn ngữ">${options(Object.entries(LANGUAGES),c.language)}</select><select class="candidate-group" aria-label="Nhóm thí sinh">${options(Object.keys(GROUPS).map(id=>[id,this.config.groups[id].title]),c.group)}</select></div>
      <div class="participant-actions"><label class="check-label"><input class="candidate-enabled" type="checkbox" ${c.enabled ? 'checked' : ''}> Hiện trên live</label><div><button class="tiny-button focus-candidate ${g.focusId === c.id ? 'active' : ''}">${icon('star')} Nổi bật</button><button class="icon-button reconnect-candidate" aria-label="Kết nối lại ${esc(c.name)}" title="Kết nối lại">${icon('arrows-clockwise')}</button><button class="icon-button delete-candidate" aria-label="Xoá ${esc(c.name)}" title="Xoá thí sinh">${icon('trash')}</button></div></div>
    </article>`;
  }
  openCodeforces() { const group=this.config.groups[this.group];this.codeforces.open({groupTitle:group.title,contest:group.codeforces.url,handle:this.config.candidates.find(c=>c.group===this.group&&c.codeforcesHandle)?.codeforcesHandle||'',asManager:group.codeforces.asManager}); }
  preview() { $('iframe')?.contentWindow?.postMessage({type:'sirocco-preview',group:this.group,title:this.config.title,settings:this.config.groups[this.group]},location.origin); }
  changed(preview = false) {
    this.dirty = true; this.revision++;
    $('#save-config').disabled = this.saving; $('#save-state').textContent = 'Có thay đổi chưa áp dụng'; $('#apply-bar').classList.remove('hidden');
    if(preview)this.preview();
  }
  font(value) {
    const g=this.config.groups[this.group], next=Math.max(10,Math.min(40,Math.round(Number(value))));
    if(!Number.isFinite(next)||g.fontSize===next)return;
    g.fontSize=next;this.syncFont();
    this.changed(true);
  }
  syncFont() {
    const size=this.config.groups[this.group].fontSize, range=$('#font-size');
    range.value=size;range.style.setProperty('--range-fill',`${(size-10)/30*100}%`);range.setAttribute('aria-valuetext',`${size} pixel`);$('#font-value').textContent=`${size}px`;
    $$('[data-font-preset]').forEach(button=>{const active=Number(button.dataset.fontPreset)===size;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $$('[data-font-step]').forEach(button=>{button.disabled=Number(button.dataset.fontStep)<0?size<=10:size>=40;});
  }
  async save() {
    if(this.saving)return false;
    this.saving=true;
    const revision=this.revision, sent=structuredClone(this.config);
    $$('#save-config,#apply-config').forEach(b=>{b.disabled=true;b.innerHTML=`${icon('circle-notch')} Đang lưu…`;b.classList.add('is-saving');});
    try {
      const next=await api('/api/config',sent);
      if(revision===this.revision){this.config=next;this.dirty=false;const y=scrollY;this.render();window.scrollTo({top:y});}
      toast('Đã áp dụng vào nguồn live.');return true;
    }catch(e){toast(e.message,true);return false;}
    finally{this.saving=false;$$('#save-config,#apply-config').forEach(b=>{b.disabled=!this.dirty;b.innerHTML=`${icon('check')} Lưu & áp dụng`;b.classList.remove('is-saving');});}
  }
  add() {
    if(this.config.candidates.length>=16)return toast('Tối đa 16 thí sinh trong một phiên.',true);
    this.config.candidates.push({id:crypto.randomUUID(),name:`Thí sinh ${this.config.candidates.length+1}`,url:'',group:this.group,language:'auto',enabled:true});
    this.changed();this.render();const row=$$('.participant-row').at(-1);$('.candidate-name',row)?.focus();$('.candidate-name',row)?.select();
  }
  bind() {
    const g=this.config.groups[this.group];
    $('#open-codeforces').onclick=()=>this.openCodeforces();$('#open-codeforces').dataset.connected=String(this.codeforces.configured===true);
    bindContestControls(this);
    $$('[data-group]').forEach(button=>button.onclick=async()=>{if(this.group===button.dataset.group)return;if(this.dirty&&!await this.save())return;this.group=button.dataset.group;this.render(true);});
    $('#toggle-inspector').onclick=()=>{this.compactInspector=!this.compactInspector;localStorage.setItem('sirocco.inspector',this.compactInspector?'hidden':'visible');$('.studio-workspace').classList.toggle('inspector-hidden',this.compactInspector);$('#toggle-inspector').setAttribute('aria-expanded',String(!this.compactInspector));$('#toggle-inspector').setAttribute('aria-label',`${this.compactInspector?'Hiện':'Ẩn'} thiết lập khung hình`);};
    $$('[data-layout]').forEach(button=>button.onclick=()=>{g.layout=button.dataset.layout;$('#layout').value=g.layout;$('#rotation-row').classList.toggle('hidden',g.layout!=='rotate');$$('[data-layout]').forEach(b=>{const active=b.dataset.layout===g.layout;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});this.changed(true);});
    $('#save-config').onclick=$('#apply-config').onclick=()=>this.save();
    $('#discard-changes').onclick=async()=>{try{this.config=await api('/api/config');this.dirty=false;this.render();}catch(e){toast(e.message,true);}};
    $('#copy-source').onclick=()=>copy(sourceUrl(this.group));
    $$('[data-copy-group]').forEach(b=>b.onclick=()=>copy(sourceUrl(b.dataset.copyGroup)));
    $('#add-candidate').onclick=()=>this.add();if($('#add-first'))$('#add-first').onclick=()=>this.add();
    $('#font-size').oninput=e=>this.font(e.target.value);
    $$('[data-font-preset]').forEach(b=>b.onclick=()=>this.font(b.dataset.fontPreset));
    $$('[data-font-step]').forEach(b=>b.onclick=()=>this.font(g.fontSize+Number(b.dataset.fontStep)));
    for(const [id,key] of [['layout','layout'],['follow','follow'],['input-position','inputPosition']])$(`#${id}`).onchange=e=>{g[key]=e.target.value;$('#rotation-row').classList.toggle('hidden',g.layout!=='rotate');this.changed(true);};
    $('#rotation').onchange=e=>{g.rotationSeconds=Math.max(8,Math.min(180,Number(e.target.value)||25));this.changed(true);};
    for(const [id,key]of [['wrap','wrap'],['show-header','showHeader'],['show-input','showInput']])$(`#${id}`).onchange=e=>{g[key]=e.target.checked;$('#input-settings').classList.toggle('hidden',!g.showInput);this.changed(true);};
    $('#contest-title').oninput=e=>{this.config.title=e.target.value;this.changed(true);};
    $('#group-title').oninput=e=>{g.title=e.target.value;this.changed(true);};
    $('#show-guide').onclick=$('#show-guide-mobile').onclick=()=>{const dialog=$('#guide');dialog.showModal();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,transform:'translateY(8px) scale(.985)'},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});};$('#close-guide').onclick=()=>$('#guide').close();$('#guide').onclick=e=>{if(e.target===$('#guide'))$('#guide').close();};
    if($('#load-demo'))$('#load-demo').onclick=async()=>{try{this.config=await api('/api/demo',{});this.dirty=false;this.render();}catch(e){toast(e.message,true);}};
    if($('#leave-demo'))$('#leave-demo').onclick=async()=>{this.config.demo=false;this.config.candidates=[];this.changed();await this.save();};
    $$('.participant-row').forEach(row=>{
      const candidate=this.config.candidates.find(c=>c.id===row.dataset.id);
      for(const [selector,key]of [['.candidate-name','name'],['.candidate-url','url']])$(selector,row).oninput=e=>{candidate[key]=key==='url'?e.target.value.trim():e.target.value;this.changed();};
      for(const [selector,key]of [['.candidate-language','language'],['.candidate-group','group']])$(selector,row).onchange=e=>{candidate[key]=e.target.value;this.changed();};
      $('.candidate-enabled',row).onchange=e=>{candidate.enabled=e.target.checked;this.changed();};
      $('.delete-candidate',row).onclick=()=>{const index=this.config.candidates.indexOf(candidate);this.config.candidates.splice(index,1);this.changed();this.render();toast(`Đã bỏ ${candidate.name} khỏi danh sách.`,false,{label:'Hoàn tác',run:()=>{if(!this.config.candidates.some(c=>c.id===candidate.id)){this.config.candidates.splice(index,0,candidate);this.changed();this.render();}}});};
      $('.focus-candidate',row).onclick=async()=>{g.focusId=candidate.id;g.layout='spotlight';this.changed(true);await this.save();};
      $('.reconnect-candidate',row).onclick=async()=>{if(this.dirty&&!await this.save())return;try{await api('/api/reconnect',{id:candidate.id});toast('Đang kết nối lại code và input.');}catch(e){toast(e.message,true);}};
    });
    $('#import-config').onclick=()=>$('#config-file').click();
    $('#config-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('File cấu hình quá lớn.');const next=JSON.parse(await file.text());if(!confirm('Thay thế cấu hình hiện tại bằng file này?'))return;this.config=await api('/api/config',next);this.dirty=false;this.render();toast('Đã nhập cấu hình.');}catch(e){toast(e.message,true);}finally{event.target.value='';}};
  }
  update(state) { this.state=state;this.updateStatuses(); }
  updateStatuses() {
    updateContestControls(this);
    $$('[data-status-id]').forEach(node=>{const c=this.config.candidates.find(c=>c.id===node.dataset.statusId);const s=this.state.snapshots[c?.id];const status=c?.enabled===false?'disabled':s?.status||'waiting';node.textContent=STATUS[status]||status;node.dataset.status=status;});
    $$('[data-message-id]').forEach(node=>{const s=this.state.snapshots[node.dataset.messageId];node.textContent=s?`${s.message}${s.updatedAt?` · ${time(s.updatedAt)}`:''}${s.inputStatus==='live'?' · Input đã nối':''}`:'Lưu thay đổi để bắt đầu nhận code và input.';});
    $$('[data-health-group]').forEach(node=>{const candidates=this.config.candidates.filter(c=>c.group===node.dataset.healthGroup&&c.enabled);const live=candidates.filter(c=>['live','demo'].includes(this.state.snapshots[c.id]?.status)).length;node.textContent=`${live}/${candidates.length} đang nhận`;node.dataset.connected=live>0?'true':'false';});
  }
  connection(online) { $('#save-state').textContent=online?(this.dirty?'Có thay đổi chưa áp dụng':'Đã lưu tại máy'):'Mất kết nối với công cụ'; }
}

function guide() {
  return `<dialog id="guide"><div class="dialog-heading"><h2>Đưa khung code vào livestream</h2><button class="icon-button" id="close-guide" aria-label="Đóng hướng dẫn">×</button></div><ol><li>Nhập link share của từng bạn. File cần cho người có link quyền <b>Can view</b>.</li><li>Chọn cỡ chữ, bố cục và vị trí Input. Bản xem trước đổi ngay; bấm <b>Lưu & áp dụng</b> để đưa lên live.</li><li>Trong Streamlabs/OBS, thêm <b>Browser Source</b>, dán link nguồn của nhóm. Đặt Width/Height bằng canvas (ví dụ 1920 × 1080), FPS 30.</li><li>Tắt <b>Shutdown source when not visible</b> và <b>Refresh browser when scene becomes active</b>. Không cần giữ cửa sổ nguồn phía trước.</li><li>Phát hai nhóm với hai nội dung ngang độc lập bằng hai bộ phát riêng, ví dụ Streamlabs + OBS.</li></ol><p class="muted">Input là dữ liệu nhập thực trên USACO IDE, đồng bộ riêng với code. Công cụ không chạy bài, không nộp bài và không thay đổi nội dung. Kết quả Run/stdout chưa được đồng bộ.</p><p class="muted">Cuộn code thủ công sẽ tạm dừng bám 8 giây. Có thể cuộn ô Input độc lập. Khi thí sinh đổi file, cần cập nhật link. “Lưu code + input” tải ảnh chụp JSON hiện tại; ghi video bằng Streamlabs/OBS.</p></dialog>`;
}
