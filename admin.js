// Khởi tạo Supabase client (CDN đã load sẵn qua script tag)
const db = supabase.createClient(
  'https://gojpmogjretoxplydjvg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanBtb2dqcmV0b3hwbHlkanZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Nzg4ODEsImV4cCI6MjA5MzA1NDg4MX0.iLCNd2VRMiZoFp6_KclZlFsOenUNoM041tl1fobHKDA'
);

// Auth guard
const _role = sessionStorage.getItem('dh_role');
if (_role !== 'teacher' && _role !== 'assistant') location.href = 'index.html';
const isTeacher = _role === 'teacher';

// ---- Helpers ----
function fmtDate(d) { if (!d) return ''; const [y,m,day]=(d||'').split('-'); return `${day}/${m}/${y}`; }
function fmtTime(ts) { return new Date(ts).toLocaleString('vi-VN'); }

const displayName = sessionStorage.getItem('dh_name') || 'Admin';
const displayRole = isTeacher ? 'Admin' : 'Trợ lý';
document.getElementById('teacherName').textContent = displayName;
document.getElementById('profileName').textContent  = displayName;
document.querySelector('.av-role').textContent      = displayRole;

if (isTeacher) {
  document.querySelectorAll('[data-page="create-student"]').forEach(el => el.style.display = 'none');
}
document.getElementById('logoutBtn').addEventListener('click', e => { e.preventDefault(); sessionStorage.clear(); location.href='index.html'; });
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

// ---- Sidebar navigation ----
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
  const key = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase());
  const page = document.getElementById('page' + key);
  if (page) page.classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(l => l.classList.add('active'));
  if (name === 'overview')       renderOverview();
  if (name === 'students')       { populateClassFilters(); renderStudents(); }
  if (name === 'create-student') renderMiniStudents();
  if (name === 'lessons')        { populateClassFilters(); renderLessons(); }
  if (name === 'security')       renderAlerts();
  if (name === 'classes')        renderClasses();
}
document.querySelectorAll('.slink[data-page]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); document.getElementById('sidebar').classList.remove('open'); });
});
document.querySelectorAll('[data-goto]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.goto); });
});

// ---- Class filters ----
async function getClasses() {
  const { data: cls } = await db.from('classes').select('name').order('name');
  const { data: sts } = await db.from('students').select('class_name');
  const fromStudents = (sts||[]).map(s => s.class_name).filter(Boolean);
  const fromClasses  = (cls||[]).map(c => c.name);
  return [...new Set([...fromClasses, ...fromStudents])].sort();
}

async function populateClassFilters() {
  const classes = await getClasses();
  const filterOpts = '<option value="">Tất cả lớp</option>' + classes.map(c=>`<option value="${c}">${c}</option>`).join('');
  const modalOpts  = '<option value="">-- Tất cả lớp --</option>' + classes.map(c=>`<option value="${c}">${c}</option>`).join('');
  ['studentFilterClass','lessonFilterClass'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value; el.innerHTML = filterOpts; el.value = cur;
  });
  const lcs = document.getElementById('lClassSelect'); if (lcs) { const cur=lcs.value; lcs.innerHTML=modalOpts; lcs.value=cur; }
}
populateClassFilters();

// ============================================================
// OVERVIEW
// ============================================================
async function renderOverview() {
  const [{ count: sc }, { data: todayAlerts }, { data: recentLessons }, { data: recentAlerts }, { data: vids }, { data: docs }] = await Promise.all([
    db.from('students').select('*', { count:'exact', head:true }),
    db.from('alerts').select('*').gte('created_at', new Date().toISOString().split('T')[0]),
    db.from('lessons').select('id,name,class_name').order('created_at', { ascending:false }).limit(4),
    db.from('alerts').select('*').order('created_at', { ascending:false }).limit(4),
    db.from('lesson_videos').select('id'),
    db.from('lesson_docs').select('id'),
  ]);
  document.getElementById('statExams').textContent    = (docs||[]).length;
  document.getElementById('statVideos').textContent   = (vids||[]).length;
  document.getElementById('statStudents').textContent = sc || 0;
  document.getElementById('statAlerts').textContent   = (todayAlerts||[]).length;

  const re = document.getElementById('recentExams');
  re.innerHTML = (recentLessons||[]).map(l =>
    `<div class="list-row"><span class="list-icon">📚</span><div class="list-info"><div class="list-title">${l.name}</div><div class="list-meta">${l.class_name?`<span class="class-tag">${l.class_name}</span>`:''}</div></div></div>`
  ).join('') || '<p class="muted-sm">Chưa có bài học.</p>';

  const ra = document.getElementById('recentAlerts');
  ra.innerHTML = (recentAlerts||[]).map(a =>
    `<div class="list-row"><span class="list-icon">🚨</span><div class="list-info"><div class="list-title">${a.student_name}</div><div class="list-meta">${a.reason} • ${fmtTime(a.created_at)}</div></div></div>`
  ).join('') || '<p class="muted-sm">Chưa có cảnh báo.</p>';
}

// ============================================================
// CREATE STUDENT
// ============================================================
document.getElementById('csSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('csName').value.trim(), username=document.getElementById('csUsername').value.trim();
  const password=document.getElementById('csPassword').value, cls=document.getElementById('csClass').value.trim();
  const err=document.getElementById('csError');
  err.textContent = '';
  if (!name||!username||!password) { err.textContent='Vui lòng điền đầy đủ thông tin.'; return; }
  const { error } = await db.from('students').insert({ full_name:name, username, password, class_name:cls, active:true });
  if (error) { err.textContent = error.message.includes('unique')?'Gmail đã tồn tại.':error.message; return; }
  ['csName','csUsername','csPassword','csClass'].forEach(id => document.getElementById(id).value='');
  renderMiniStudents(); populateClassFilters();
});
document.getElementById('csResetBtn').addEventListener('click', () => {
  ['csName','csUsername','csPassword','csClass'].forEach(id => document.getElementById(id).value='');
  document.getElementById('csError').textContent='';
});

let miniPage=1; const miniPerPage=5;
async function renderMiniStudents() {
  const { data: list } = await db.from('students').select('*').order('created_at', { ascending:false });
  const tbody = document.getElementById('miniStudentBody');
  const totalPages = Math.max(1, Math.ceil((list||[]).length/miniPerPage));
  if (miniPage > totalPages) miniPage = totalPages;
  const slice = (list||[]).slice((miniPage-1)*miniPerPage, miniPage*miniPerPage);
  tbody.innerHTML = '';
  slice.forEach((s,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${(miniPage-1)*miniPerPage+i+1}</td><td>${s.full_name}</td><td>${s.username}</td><td>${s.class_name||'—'}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'Hoạt động':'Khóa'}</span></td><td><button class="btn-sm" data-action="edit">✏️</button></td>`;
    tr.querySelector('[data-action="edit"]').addEventListener('click', () => openEditStudent(s));
    tbody.appendChild(tr);
  });
  const pg = document.getElementById('miniPagination');
  pg.innerHTML = '';
  for (let i=1;i<=totalPages;i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn'+(i===miniPage?' active':'');
    btn.textContent = i;
    btn.addEventListener('click', () => { miniPage=i; renderMiniStudents(); });
    pg.appendChild(btn);
  }
}

// ============================================================
// STUDENTS LIST
// ============================================================
async function renderStudents() {
  const q   = (document.getElementById('studentSearch').value||'').toLowerCase();
  const cls = document.getElementById('studentFilterClass').value;
  let query = db.from('students').select('*').order('full_name');
  if (cls) query = query.eq('class_name', cls);
  const { data: list } = await query;
  const filtered = (list||[]).filter(s => !q || s.full_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  const tbody = document.getElementById('studentBody');
  tbody.innerHTML = '';
  document.getElementById('emptyStudents').style.display = filtered.length?'none':'block';
  filtered.forEach(s => {
    const tr = document.createElement('tr');
    const actions = `<button class="btn-sm" data-action="edit">✏️ Sửa</button> <button class="btn-sm ${s.active?'btn-danger':'btn-success'}" data-action="toggle">${s.active?'🔒 Khóa':'🔓 Mở'}</button> <button class="btn-sm btn-danger" data-action="delete">🗑</button>`;
    tr.innerHTML = `<td>${s.student_code||'—'}</td><td>${s.full_name}</td><td>${s.phone||'—'}</td><td>${s.username}</td><td>${s.class_name||'—'}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'Hoạt động':'Khóa'}</span></td><td>${actions}</td>`;
    tr.querySelector('[data-action="edit"]').addEventListener('click', () => openEditStudent(s));
    tr.querySelector('[data-action="toggle"]').addEventListener('click', async () => { await db.from('students').update({ active:!s.active }).eq('id',s.id); renderStudents(); });
    tr.querySelector('[data-action="delete"]').addEventListener('click', async () => { if(confirm(`Xóa "${s.full_name}"?`)) { await db.from('students').delete().eq('id',s.id); renderStudents(); renderMiniStudents(); populateClassFilters(); } });
    tbody.appendChild(tr);
  });
}
document.getElementById('studentSearch').addEventListener('input', renderStudents);
document.getElementById('studentFilterClass').addEventListener('change', renderStudents);

document.getElementById('openAddStudentBtn').addEventListener('click', () => {
  ['addCode','addName','addPhone','addUsername','addPassword','addClass'].forEach(id => document.getElementById(id).value='');
  document.getElementById('addStudentError').textContent='';
  document.getElementById('addStudentModal').classList.add('open');
});
document.getElementById('addStudentCancelBtn').addEventListener('click', () => document.getElementById('addStudentModal').classList.remove('open'));
document.getElementById('addStudentSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('addName').value.trim(), phone=document.getElementById('addPhone').value.trim();
  const username=document.getElementById('addUsername').value.trim(), password=document.getElementById('addPassword').value.trim();
  const cls=document.getElementById('addClass').value.trim(), code=document.getElementById('addCode').value.trim();
  const err=document.getElementById('addStudentError');
  err.textContent='';
  if (!name||!username||!password) { err.textContent='Vui lòng điền đầy đủ họ tên, Gmail và số báo danh.'; return; }
  const { error } = await db.from('students').insert({ student_code:code, full_name:name, phone, username, password, class_name:cls, active:true });
  if (error) { err.textContent=error.message.includes('unique')?'Gmail đã tồn tại.':error.message; return; }
  document.getElementById('addStudentModal').classList.remove('open');
  renderStudents(); populateClassFilters();
});

let editingStudentId=null;
function openEditStudent(s) {
  editingStudentId=s.id;
  document.getElementById('esCode').value=s.student_code||'';
  document.getElementById('esName').value=s.full_name;
  document.getElementById('esUsername').value=s.username;
  document.getElementById('esPassword').value='';
  document.getElementById('esClass').value=s.class_name||'';
  document.getElementById('esError').textContent='';
  document.getElementById('editStudentModal').classList.add('open');
}
document.getElementById('esCancelBtn').addEventListener('click', () => document.getElementById('editStudentModal').classList.remove('open'));
document.getElementById('esSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('esName').value.trim(), username=document.getElementById('esUsername').value.trim();
  const password=document.getElementById('esPassword').value, cls=document.getElementById('esClass').value.trim();
  const code=document.getElementById('esCode').value.trim(), err=document.getElementById('esError');
  if (!name||!username) { err.textContent='Vui lòng điền đầy đủ.'; return; }
  const updates={ student_code:code, full_name:name, username, class_name:cls };
  if (password) updates.password=password;
  const { error } = await db.from('students').update(updates).eq('id',editingStudentId);
  if (error) { err.textContent=error.message.includes('unique')?'Gmail đã tồn tại.':error.message; return; }
  document.getElementById('editStudentModal').classList.remove('open');
  renderStudents(); renderMiniStudents(); populateClassFilters();
});

// ============================================================
// PROFILE / PASSWORD
// ============================================================
document.getElementById('pwSaveBtn').addEventListener('click', () => {
  const old=document.getElementById('pwOld').value, nw=document.getElementById('pwNew').value, cf=document.getElementById('pwConfirm').value;
  const err=document.getElementById('pwError'), ok=document.getElementById('pwSuccess');
  err.textContent=''; ok.textContent='';
  const t=JSON.parse(localStorage.getItem('dh_teacher'));
  if (old!==t.password) { err.textContent='Mật khẩu hiện tại không đúng.'; return; }
  if (!nw) { err.textContent='Vui lòng nhập mật khẩu mới.'; return; }
  if (nw!==cf) { err.textContent='Mật khẩu xác nhận không khớp.'; return; }
  localStorage.setItem('dh_teacher', JSON.stringify({...t, password:nw}));
  ok.textContent='Đổi mật khẩu thành công!';
  ['pwOld','pwNew','pwConfirm'].forEach(id=>document.getElementById(id).value='');
});

// ============================================================
// VIEWER MODAL
// ============================================================
function openViewer(title, url, fileName, fileType) {
  document.getElementById('viewerTitle').textContent=title;
  const body=document.getElementById('viewerBody'), dl=document.getElementById('viewerDownload');
  dl.href=url; dl.download=fileName||title;
  if (fileType==='video'||(fileType||'').startsWith('video/'))
    body.innerHTML=`<video src="${url}" controls class="viewer-video"></video>`;
  else if (fileType==='application/pdf')
    body.innerHTML=`<iframe src="${url}" class="viewer-iframe"></iframe>`;
  else if ((fileType||'').startsWith('image/'))
    body.innerHTML=`<img src="${url}" class="viewer-img" alt="${title}"/>`;
  else
    body.innerHTML=`<p class="muted-center">⚠️ Không xem trực tiếp được. Vui lòng tải xuống.</p>`;
  document.getElementById('viewerModal').classList.add('open');
}
document.getElementById('closeViewer').addEventListener('click', closeViewer);
document.getElementById('viewerModal').addEventListener('click', e => { if(e.target===document.getElementById('viewerModal')) closeViewer(); });
function closeViewer() { document.getElementById('viewerModal').classList.remove('open'); document.getElementById('viewerBody').innerHTML=''; }

// ============================================================
// LESSONS
// ============================================================
let currentLessonId=null, pendingLessonVideoFile=null, pendingLessonDocFile=null;

async function renderLessons() {
  document.getElementById('lessonListView').style.display='';
  document.getElementById('lessonDetailView').style.display='none';
  const fc=document.getElementById('lessonFilterClass').value;
  let query=db.from('lessons').select('*').order('created_at',{ascending:false});
  if (fc) query=query.eq('class_name',fc);
  const { data: list }=await query;
  const el=document.getElementById('lessonList');
  el.innerHTML='';
  document.getElementById('emptyLessons').style.display=(list||[]).length?'none':'block';
  for (const l of (list||[])) {
    const [{ count:vc },{ count:dc }]=await Promise.all([
      db.from('lesson_videos').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
      db.from('lesson_docs').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
    ]);
    const row=document.createElement('div');
    row.className='content-row clickable';
    row.innerHTML=`<span class="list-icon">📚</span><div class="list-info"><div class="list-title">${l.name}</div><div class="list-meta">${l.class_name?`<span class="class-tag">${l.class_name}</span>`:''} <span>🎬 ${vc||0} video</span> • <span>📄 ${dc||0} tài liệu</span>${l.description?` • ${l.description}`:''}</div></div><div class="row-actions"><button class="btn-sm" data-action="edit">✏️</button><button class="btn-sm btn-danger" data-action="delete">🗑</button></div>`;
    row.addEventListener('click', e=>{ if(!e.target.closest('.row-actions')) openLessonDetail(l.id); });
    row.querySelector('[data-action="edit"]').addEventListener('click', e=>{ e.stopPropagation(); openLessonModal(l); });
    row.querySelector('[data-action="delete"]').addEventListener('click', async e=>{ e.stopPropagation(); if(confirm(`Xóa bài "${l.name}"?`)){ await db.from('lessons').delete().eq('id',l.id); renderLessons(); } });
    el.appendChild(row);
  }
}
document.getElementById('lessonFilterClass').addEventListener('change', renderLessons);

let editingLessonId=null;
function openLessonModal(l=null) {
  editingLessonId=l?l.id:null;
  document.getElementById('lessonModalTitle').textContent=l?'Sửa bài học':'Tạo bài học';
  document.getElementById('lNameInput').value=l?l.name:'';
  document.getElementById('lDescInput').value=l?(l.description||''):'';
  document.getElementById('lError').textContent='';
  populateClassFilters().then(()=>{ document.getElementById('lClassSelect').value=l?(l.class_name||''):''; });
  document.getElementById('lessonModal').classList.add('open');
}
document.getElementById('openAddLessonBtn').addEventListener('click', ()=>openLessonModal());
document.getElementById('lCancelBtn').addEventListener('click', ()=>document.getElementById('lessonModal').classList.remove('open'));
document.getElementById('lSaveBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('lNameInput').value.trim(), err=document.getElementById('lError');
  if (!name) { err.textContent='Vui lòng nhập tên bài học.'; return; }
  const cls=document.getElementById('lClassSelect').value, desc=document.getElementById('lDescInput').value.trim();
  if (editingLessonId) await db.from('lessons').update({name,class_name:cls,description:desc}).eq('id',editingLessonId);
  else await db.from('lessons').insert({name,class_name:cls,description:desc});
  document.getElementById('lessonModal').classList.remove('open');
  await renderLessons();
});

async function openLessonDetail(id) {
  currentLessonId=id;
  const { data:l }=await db.from('lessons').select('*').eq('id',id).single();
  if (!l) return;
  document.getElementById('lessonListView').style.display='none';
  document.getElementById('lessonDetailView').style.display='';
  document.getElementById('lessonDetailTitle').textContent=l.name;
  document.getElementById('lessonDetailDesc').textContent=l.description||'';
  await renderLessonVideos(id);
  await renderLessonDocs(id);
}
document.getElementById('backToLessonsBtn').addEventListener('click', renderLessons);

async function renderLessonVideos(lessonId) {
  const { data:vids }=await db.from('lesson_videos').select('*').eq('lesson_id',lessonId).order('created_at');
  const grid=document.getElementById('lessonVideoGrid');
  grid.innerHTML='';
  document.getElementById('emptyLessonVideos').style.display=(vids||[]).length?'none':'block';
  (vids||[]).forEach(v=>{
    const url=db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl;
    const card=document.createElement('div');
    card.className='video-card';
    card.innerHTML=`<div class="video-thumb"><video src="${url}" preload="metadata"></video><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div><button class="btn-sm btn-danger del-btn">🗑 Xóa</button></div>`;
    card.querySelector('.video-thumb').addEventListener('click',()=>openViewer(v.title,url,v.file_name,'video'));
    card.querySelector('.del-btn').addEventListener('click', async ()=>{ await db.storage.from('lessons').remove([v.storage_path]); await db.from('lesson_videos').delete().eq('id',v.id); renderLessonVideos(lessonId); });
    grid.appendChild(card);
  });
}

async function renderLessonDocs(lessonId) {
  const { data:docs }=await db.from('lesson_docs').select('*').eq('lesson_id',lessonId).order('created_at');
  const el=document.getElementById('lessonDocList');
  el.innerHTML='';
  document.getElementById('emptyLessonDocs').style.display=(docs||[]).length?'none':'block';
  (docs||[]).forEach(d=>{
    const url=db.storage.from('lessons').getPublicUrl(d.storage_path).data.publicUrl;
    const row=document.createElement('div');
    row.className='content-row clickable';
    row.innerHTML=`<span class="list-icon">📄</span><div class="list-info"><div class="list-title">${d.title}</div></div><div class="row-actions"><button class="btn-sm btn-danger">🗑</button></div>`;
    row.addEventListener('click', e=>{ if(!e.target.closest('.row-actions')) openViewer(d.title,url,d.file_name,d.file_type); });
    row.querySelector('.btn-danger').addEventListener('click', async e=>{ e.stopPropagation(); await db.storage.from('lessons').remove([d.storage_path]); await db.from('lesson_docs').delete().eq('id',d.id); renderLessonDocs(lessonId); });
    el.appendChild(row);
  });
}

document.getElementById('lessonVideoInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  pendingLessonVideoFile=f;
  document.getElementById('lessonPreviewVideo').src=URL.createObjectURL(f);
  document.getElementById('lvTitleInput').value=f.name.replace(/\.[^.]+$/,'');
  document.getElementById('lessonVideoModal').classList.add('open');
  e.target.value='';
});
document.getElementById('lvCancelBtn').addEventListener('click',()=>{ document.getElementById('lessonVideoModal').classList.remove('open'); document.getElementById('lessonPreviewVideo').src=''; pendingLessonVideoFile=null; });
document.getElementById('lvSaveBtn').addEventListener('click', async ()=>{
  if (!pendingLessonVideoFile) return;
  const title=document.getElementById('lvTitleInput').value.trim(); if(!title) return;
  const safeName=`${Date.now()}_${pendingLessonVideoFile.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`;
  const path=`videos/${currentLessonId}/${safeName}`;
  const { error:upErr }=await db.storage.from('lessons').upload(path,pendingLessonVideoFile);
  if (upErr) { alert('Lỗi upload: '+upErr.message); return; }
  await db.from('lesson_videos').insert({lesson_id:currentLessonId,title,file_name:pendingLessonVideoFile.name,storage_path:path});
  document.getElementById('lessonVideoModal').classList.remove('open');
  document.getElementById('lessonPreviewVideo').src='';
  pendingLessonVideoFile=null;
  renderLessonVideos(currentLessonId);
});

document.getElementById('lessonDocInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  pendingLessonDocFile=f;
  document.getElementById('lessonDocFileInfo').textContent=`📎 ${f.name}`;
  document.getElementById('ldTitleInput').value=f.name.replace(/\.[^.]+$/,'');
  document.getElementById('lessonDocModal').classList.add('open');
  e.target.value='';
});
document.getElementById('ldCancelBtn').addEventListener('click',()=>{ document.getElementById('lessonDocModal').classList.remove('open'); pendingLessonDocFile=null; });
document.getElementById('ldSaveBtn').addEventListener('click', async ()=>{
  if (!pendingLessonDocFile) return;
  const title=document.getElementById('ldTitleInput').value.trim(); if(!title) return;
  const safeName=`${Date.now()}_${pendingLessonDocFile.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`;
  const path=`docs/${currentLessonId}/${safeName}`;
  const { error:upErr }=await db.storage.from('lessons').upload(path,pendingLessonDocFile);
  if (upErr) { alert('Lỗi upload: '+upErr.message); return; }
  await db.from('lesson_docs').insert({lesson_id:currentLessonId,title,file_name:pendingLessonDocFile.name,file_type:pendingLessonDocFile.type,storage_path:path});
  document.getElementById('lessonDocModal').classList.remove('open');
  pendingLessonDocFile=null;
  renderLessonDocs(currentLessonId);
});

// ============================================================
// CLASSES
// ============================================================
async function renderClasses() {
  document.getElementById('classListView').style.display='';
  document.getElementById('classDetailView').style.display='none';
  const allNames=await getClasses();
  const { data:allStudents }=await db.from('students').select('class_name');
  const grid=document.getElementById('classGrid');
  grid.innerHTML='';
  document.getElementById('emptyClasses').style.display=allNames.length?'none':'block';
  allNames.forEach(cls=>{
    const count=(allStudents||[]).filter(s=>s.class_name===cls).length;
    const card=document.createElement('div');
    card.className='stat-card blue clickable';
    card.style.cursor='pointer';
    card.innerHTML=`<div class="stat-icon">🏫</div><div style="flex:1"><div class="stat-num">${count}</div><div class="stat-label">${cls}</div></div><div style="display:flex;flex-direction:column;gap:.25rem;align-self:flex-start"><button class="btn-sm" data-edit="${cls}">✏️</button><button class="btn-sm btn-danger" data-del="${cls}">🗑</button></div>`;
    card.addEventListener('click', e=>{ if(!e.target.closest('[data-edit],[data-del]')) openClassDetail(cls); });
    card.querySelector('[data-edit]').addEventListener('click', e=>{ e.stopPropagation(); openEditClassModal(cls); });
    card.querySelector('[data-del]').addEventListener('click', async e=>{
      e.stopPropagation();
      if (confirm(`Xóa lớp "${cls}"?`)) {
        await db.from('classes').delete().eq('name',cls);
        await db.from('students').update({class_name:''}).eq('class_name',cls);
        renderClasses(); populateClassFilters();
      }
    });
    grid.appendChild(card);
  });
}

async function openClassDetail(cls) {
  document.getElementById('classListView').style.display='none';
  document.getElementById('classDetailView').style.display='';
  document.getElementById('classDetailTitle').textContent=cls;
  const { data:list }=await db.from('students').select('*').eq('class_name',cls);
  const tbody=document.getElementById('classStudentBody');
  tbody.innerHTML='';
  document.getElementById('emptyClassStudents').style.display=(list||[]).length?'none':'block';
  (list||[]).forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${s.full_name}</td><td>${s.phone||'—'}</td><td>${s.username}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'Hoạt động':'Khóa'}</span></td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById('backToClassesBtn').addEventListener('click', renderClasses);

let editingClassName=null;
function openEditClassModal(cls) {
  editingClassName=cls;
  document.getElementById('editClassName').value=cls;
  document.getElementById('editClassError').textContent='';
  document.getElementById('editClassModal').classList.add('open');
}
document.getElementById('editClassCancelBtn').addEventListener('click',()=>document.getElementById('editClassModal').classList.remove('open'));
document.getElementById('editClassSaveBtn').addEventListener('click', async ()=>{
  const newName=document.getElementById('editClassName').value.trim(), err=document.getElementById('editClassError');
  if (!newName) { err.textContent='Vui lòng nhập tên lớp.'; return; }
  if (newName===editingClassName) { document.getElementById('editClassModal').classList.remove('open'); return; }
  await db.from('classes').upsert({name:newName});
  await db.from('classes').delete().eq('name',editingClassName);
  await db.from('students').update({class_name:newName}).eq('class_name',editingClassName);
  document.getElementById('editClassModal').classList.remove('open');
  renderClasses(); populateClassFilters();
});

document.getElementById('openAddClassBtn').addEventListener('click',()=>{
  document.getElementById('addClassName').value='';
  document.getElementById('addClassError').textContent='';
  document.getElementById('addClassModal').classList.add('open');
});
document.getElementById('addClassCancelBtn').addEventListener('click',()=>document.getElementById('addClassModal').classList.remove('open'));
document.getElementById('addClassSaveBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('addClassName').value.trim(), err=document.getElementById('addClassError');
  if (!name) { err.textContent='Vui lòng nhập tên lớp.'; return; }
  const { error }=await db.from('classes').insert({name});
  if (error) { err.textContent='Tên lớp đã tồn tại.'; return; }
  document.getElementById('addClassModal').classList.remove('open');
  renderClasses(); populateClassFilters();
});

// ============================================================
// SECURITY ALERTS
// ============================================================
async function renderAlerts() {
  const q=(document.getElementById('alertSearch').value||'').toLowerCase();
  const { data:list }=await db.from('alerts').select('*').order('created_at',{ascending:false});
  const filtered=(list||[]).filter(a=>!q||(a.student_name||'').toLowerCase().includes(q));
  const el=document.getElementById('alertList');
  el.innerHTML='';
  document.getElementById('emptyAlerts').style.display=filtered.length?'none':'block';
  filtered.forEach(a=>{
    const row=document.createElement('div');
    row.className='content-row alert-row';
    row.innerHTML=`<span class="list-icon">🚨</span><div class="list-info"><div class="list-title">${a.student_name} <span class="muted" style="font-weight:400">— ${a.username}</span></div><div class="list-meta"><span class="alert-badge">${a.reason}</span>${a.class_name?`<span class="class-tag">${a.class_name}</span>`:''} • ${fmtTime(a.created_at)}</div></div>`;
    el.appendChild(row);
  });
}
document.getElementById('alertSearch').addEventListener('input', renderAlerts);
document.getElementById('clearAlertsBtn').addEventListener('click', async ()=>{
  if (confirm('Xóa toàn bộ nhật ký cảnh báo?')) {
    await db.from('alerts').delete().neq('id',0);
    renderAlerts(); renderOverview();
  }
});

// ---- Init ----
renderOverview();
