// Khởi tạo Supabase client (CDN đã load sẵn qua script tag)
const db = supabase.createClient(
  'https://gojpmogjretoxplydjvg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanBtb2dqcmV0b3hwbHlkanZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Nzg4ODEsImV4cCI6MjA5MzA1NDg4MX0.iLCNd2VRMiZoFp6_KclZlFsOenUNoM041tl1fobHKDA'
);

// ---- Custom confirm popup ----
function showConfirm(message, onOk, { title='Xác nhận xóa', icon='🗑', okText='Xóa' } = {}) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmOkBtn').textContent = okText;
  document.getElementById('confirmModal').classList.add('open');
  const ok = document.getElementById('confirmOkBtn');
  const cancel = document.getElementById('confirmCancelBtn');
  const close = () => {
    document.getElementById('confirmModal').classList.remove('open');
    ok.replaceWith(ok.cloneNode(true));
    cancel.replaceWith(cancel.cloneNode(true));
    // re-bind cancel on new node
    document.getElementById('confirmCancelBtn').addEventListener('click', () => document.getElementById('confirmModal').classList.remove('open'));
  };
  ok.addEventListener('click', () => { close(); onOk(); }, { once: true });
  cancel.addEventListener('click', close, { once: true });
}
document.getElementById('confirmCancelBtn').addEventListener('click', () => document.getElementById('confirmModal').classList.remove('open'));

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
  if (name === 'devices')        renderDeviceAlerts();
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
  ['addClass','esClass'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value; el.innerHTML = modalOpts; el.value = cur;
  });
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

  // Thông báo lớp hết hạn / sắp hết hạn
  const { data: allCls } = await db.from('classes').select('name,end_date');
  const today = new Date(); today.setHours(0,0,0,0);
  const WARN = 7;
  const notices = [];
  (allCls||[]).forEach(c => {
    if (!c.end_date) return;
    const end = new Date(c.end_date); end.setHours(0,0,0,0);
    const days = Math.round((end - today) / 86400000);
    if (days < 0) {
      notices.push(`<div style="background:#fee2e2;border-left:4px solid #ef4444;padding:.75rem 1rem;border-radius:8px;margin-bottom:.5rem;font-size:.88rem">🔴 Lớp <b>${c.name}</b> đã kết thúc vào ngày <b>${fmtDate(c.end_date)}</b>. Học sinh lớp này đã bị khóa tự động.</div>`);
    } else if (days <= WARN) {
      notices.push(`<div style="background:#fff3cd;border-left:4px solid #f59e0b;padding:.75rem 1rem;border-radius:8px;margin-bottom:.5rem;font-size:.88rem">⚠️ Lớp <b>${c.name}</b> sẽ kết thúc vào ngày <b>${fmtDate(c.end_date)}</b> (còn <b>${days} ngày</b>).</div>`);
    }
  });
  document.getElementById('classExpiryNotices').innerHTML = notices.join('');
}

// ============================================================
// CREATE STUDENT
// ============================================================
document.getElementById('csSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('csName').value.trim(), username=document.getElementById('csUsername').value.trim();
  const password=document.getElementById('csPassword').value, cls=document.getElementById('csClass').value.trim();
  const expiry=document.getElementById('csExpiry').value || null;
  const notes=document.getElementById('csNotes').value.trim() || null;
  const err=document.getElementById('csError');
  err.textContent = '';
  if (!name||!username||!password) { err.textContent='Vui lòng điền đầy đủ thông tin.'; return; }
  const { error } = await db.from('students').insert({ full_name:name, username, password, class_name:cls, active:true, expiry_date:expiry, notes });
  if (error) { err.textContent = error.message.includes('unique')?'Gmail đã tồn tại.':error.message; return; }
  ['csName','csUsername','csPassword','csClass'].forEach(id => document.getElementById(id).value='');
  document.getElementById('csExpiry').value='';
  document.getElementById('csNotes').value='';
  renderMiniStudents(); populateClassFilters();
});
document.getElementById('csResetBtn').addEventListener('click', () => {
  ['csName','csUsername','csPassword','csClass'].forEach(id => document.getElementById(id).value='');
  document.getElementById('csExpiry').value='';
  document.getElementById('csNotes').value='';
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

  // Tự động khóa tài khoản hết hạn (cá nhân + lớp học)
  const today = new Date(); today.setHours(0,0,0,0);
  const { data: allClasses } = await db.from('classes').select('name,end_date');
  const expiredClasses = new Set((allClasses||[]).filter(c => c.end_date && new Date(c.end_date) < today).map(c => c.name));
  const expired = (list||[]).filter(s => s.active && !s.manually_unlocked && (
    (s.expiry_date && new Date(s.expiry_date) < today) ||
    (s.class_name && expiredClasses.has(s.class_name))
  ));
  if (expired.length) {
    await Promise.all(expired.map(s => db.from('students').update({ active: false }).eq('id', s.id)));
    expired.forEach(s => { s.active = false; });
  }

  const filtered = (list||[]).filter(s => !q || s.full_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  const tbody = document.getElementById('studentBody');
  tbody.innerHTML = '';
  document.getElementById('emptyStudents').style.display = filtered.length?'none':'block';
  filtered.forEach(s => {
    const tr = document.createElement('tr');
    const actions = `<button class="btn-sm" data-action="edit" title="${s.notes?'📝 '+s.notes:''}">✏️ Sửa</button> <button class="btn-sm ${s.active?'btn-danger':'btn-success'}" data-action="toggle">${s.active?'🔒 Khóa':'🔓 Mở'}</button> <button class="btn-sm btn-danger" data-action="delete">🗑</button>`;
    tr.innerHTML = `<td>${s.student_code||'—'}</td><td>${s.full_name}${s.notes?` <span class="muted" title="${s.notes}" style="cursor:help">📝</span>`:''}</td><td>${s.phone||'—'}</td><td>${s.username}</td><td>${s.class_name||'—'}</td><td>${s.created_at ? fmtDate(s.created_at.split('T')[0]) : '—'}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'Hoạt động':'Khóa'}</span></td><td>${actions}</td>`;
    tr.querySelector('[data-action="edit"]').addEventListener('click', () => openEditStudent(s));
    tr.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
      const newActive = !s.active;
      // Nếu admin mở lại thủ công → đánh dấu manually_unlocked để bỏ qua kiểm tra lớp
      const updates = { active: newActive };
      if (newActive) updates.manually_unlocked = true;
      else updates.manually_unlocked = false;
      await db.from('students').update(updates).eq('id', s.id);
      renderStudents();
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      showConfirm(`Xóa học sinh "${s.full_name}"?`, async () => {
        await db.from('students').delete().eq('id',s.id); renderStudents(); renderMiniStudents(); populateClassFilters();
      });
    });
    tbody.appendChild(tr);
  });
}
document.getElementById('studentSearch').addEventListener('input', renderStudents);
document.getElementById('studentFilterClass').addEventListener('change', renderStudents);

document.getElementById('exportStudentsBtn').addEventListener('click', async () => {
  const cls = document.getElementById('studentFilterClass').value;
  let query = db.from('students').select('*').order('full_name');
  if (cls) query = query.eq('class_name', cls);
  const { data: list } = await query;
  if (!list || !list.length) { alert('Chưa có học sinh nào.'); return; }
  const rows = [['Mã HV','Họ tên','SĐT','Gmail','Lớp','Ngày tạo','Trạng thái','Ghi chú']];
  list.forEach(s => rows.push([
    s.student_code||'',
    s.full_name||'',
    s.phone||'',
    s.username||'',
    s.class_name||'',
    s.created_at ? fmtDate(s.created_at.split('T')[0]) : '',
    s.active ? 'Hoạt động' : 'Khóa',
    s.notes||''
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `danh_sach_hoc_sinh${cls?'_'+cls:''}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('openAddStudentBtn').addEventListener('click', () => {
  ['addCode','addName','addPhone','addUsername','addPassword'].forEach(id => document.getElementById(id).value='');
  document.getElementById('addStudentError').textContent='';
  populateClassFilters().then(() => { document.getElementById('addClass').value=''; });
  document.getElementById('addStudentModal').classList.add('open');
});

// Tự động điền mật khẩu = mã học viên
document.getElementById('addCode').addEventListener('input', () => {
  document.getElementById('addPassword').value = document.getElementById('addCode').value;
});
document.getElementById('addStudentCancelBtn').addEventListener('click', () => document.getElementById('addStudentModal').classList.remove('open'));
document.getElementById('addStudentSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('addName').value.trim(), phone=document.getElementById('addPhone').value.trim();
  const username=document.getElementById('addUsername').value.trim(), password=document.getElementById('addPassword').value.trim();
  const cls=document.getElementById('addClass').value.trim(), code=document.getElementById('addCode').value.trim();
  const expiry=document.getElementById('addExpiry').value || null;
  const notes=document.getElementById('addNotes').value.trim() || null;
  const err=document.getElementById('addStudentError');
  err.textContent='';
  if (!name||!username||!password) { err.textContent='Vui lòng điền đầy đủ họ tên, Gmail và số báo danh.'; return; }
  const { error } = await db.from('students').insert({ student_code:code, full_name:name, phone, username, password, class_name:cls, active:true, expiry_date:expiry, notes });
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
  document.getElementById('esExpiry').value=s.expiry_date||'';
  document.getElementById('esNotes').value=s.notes||'';
  document.getElementById('esError').textContent='';
  populateClassFilters().then(() => { document.getElementById('esClass').value=s.class_name||''; });
  document.getElementById('editStudentModal').classList.add('open');
}
document.getElementById('esCancelBtn').addEventListener('click', () => document.getElementById('editStudentModal').classList.remove('open'));
document.getElementById('esSaveBtn').addEventListener('click', async () => {
  const name=document.getElementById('esName').value.trim(), username=document.getElementById('esUsername').value.trim();
  const password=document.getElementById('esPassword').value, cls=document.getElementById('esClass').value.trim();
  const code=document.getElementById('esCode').value.trim(), err=document.getElementById('esError');
  const expiry=document.getElementById('esExpiry').value || null;
  const notes=document.getElementById('esNotes').value.trim() || null;
  if (!name||!username) { err.textContent='Vui lòng điền đầy đủ.'; return; }
  const updates={ student_code:code, full_name:name, username, class_name:cls, expiry_date:expiry, notes };
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
// Helper: chuyển link thường thành embed URL
function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Google Drive
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
}

function openViewer(title, url, fileName, fileType) {
  document.getElementById('viewerTitle').textContent=title;
  const body=document.getElementById('viewerBody'), dl=document.getElementById('viewerDownload');
  dl.href=url; dl.download=fileName||title;
  if (fileType==='link') {
    dl.style.display='none';
    const embed = getEmbedUrl(url);
    if (embed) {
      body.innerHTML=`<iframe src="${embed}" style="width:100%;height:400px;border:none;border-radius:8px" allowfullscreen></iframe>`;
    } else {
      // Link tài liệu hoặc video trực tiếp
      body.innerHTML=`<iframe src="${url}" style="width:100%;height:500px;border:none;border-radius:8px"></iframe>`;
    }
  } else if (fileType==='video'||(fileType||'').startsWith('video/')) {
    dl.style.display='none';
    body.innerHTML=`<video src="${url}" controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture oncontextmenu="return false" class="viewer-video"></video>`;
  } else if (fileType==='application/pdf') {
    dl.style.display='';
    body.innerHTML=`<iframe src="${url}" class="viewer-iframe"></iframe>`;
  } else if ((fileType||'').startsWith('image/')) {
    dl.style.display='';
    body.innerHTML=`<img src="${url}" class="viewer-img" alt="${title}"/>`;
  } else {
    dl.style.display='';
    body.innerHTML=`<p class="muted-center">⚠️ Không xem trực tiếp được. Vui lòng tải xuống.</p>`;
  }
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
    row.querySelector('[data-action="delete"]').addEventListener('click', async e=>{ e.stopPropagation(); showConfirm(`Xóa bài học "${l.name}"?`, async () => { await db.from('lessons').delete().eq('id',l.id); renderLessons(); }); });
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
  console.log('Tạo bài:', name);
  if (!name) { err.textContent='Vui lòng nhập tên bài học.'; return; }
  const cls=document.getElementById('lClassSelect').value, desc=document.getElementById('lDescInput').value.trim();
  console.log('cls:', cls, 'desc:', desc);
  if (editingLessonId) {
    const r = await db.from('lessons').update({name,class_name:cls,description:desc}).eq('id',editingLessonId);
    console.log('update result:', r);
  } else {
    const r = await db.from('lessons').insert({name,class_name:cls,description:desc});
    console.log('insert result:', r);
  }
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
    const isLink = !!v.video_url;
    const url = isLink ? v.video_url : db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl;
    const embed = isLink ? getEmbedUrl(url) : null;
    const card=document.createElement('div');
    card.className='video-card';
    if (embed) {
      card.innerHTML=`<div class="video-thumb" style="background:#000;display:flex;align-items:center;justify-content:center"><span style="font-size:2rem">🔗</span><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div><button class="btn-sm btn-danger del-btn">🗑 Xóa</button></div>`;
    } else {
      card.innerHTML=`<div class="video-thumb"><video src="${url}" preload="metadata"></video><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div><button class="btn-sm btn-danger del-btn">🗑 Xóa</button></div>`;
    }
    card.querySelector('.video-thumb').addEventListener('click',()=>openViewer(v.title, url, v.file_name, isLink ? 'link' : 'video'));
    card.querySelector('.del-btn').addEventListener('click', async ()=>{
      if (!isLink && v.storage_path) await db.storage.from('lessons').remove([v.storage_path]);
      await db.from('lesson_videos').delete().eq('id',v.id);
      renderLessonVideos(lessonId);
    });
    grid.appendChild(card);
  });
}

async function renderLessonDocs(lessonId) {
  const { data:docs }=await db.from('lesson_docs').select('*').eq('lesson_id',lessonId).order('created_at');
  const el=document.getElementById('lessonDocList');
  el.innerHTML='';
  document.getElementById('emptyLessonDocs').style.display=(docs||[]).length?'none':'block';
  (docs||[]).forEach(d=>{
    const isLink = d.file_type==='link';
    const isHandwritten = d.file_type==='handwritten';
    const url = (isLink||isHandwritten) ? d.doc_url : db.storage.from('lessons').getPublicUrl(d.storage_path).data.publicUrl;
    const row=document.createElement('div');
    row.className='content-row clickable';
    const icon = isHandwritten ? '✍️' : isLink ? '🔗' : '📄';
    row.innerHTML=`<span class="list-icon">${icon}</span><div class="list-info"><div class="list-title">${d.title}</div></div><div class="row-actions"><button class="btn-sm btn-danger">🗑</button></div>`;
    row.addEventListener('click', e=>{ if(!e.target.closest('.row-actions')) openViewer(d.title,url,d.file_name, (isLink||isHandwritten)?'link':d.file_type); });
    row.querySelector('.btn-danger').addEventListener('click', async e=>{
      e.stopPropagation();
      if (!isLink && !isHandwritten && d.storage_path) await db.storage.from('lessons').remove([d.storage_path]);
      await db.from('lesson_docs').delete().eq('id',d.id);
      renderLessonDocs(lessonId);
    });
    el.appendChild(row);
  });
}

document.getElementById('openAddVideoBtn').addEventListener('click', () => {
  // Reset modal
  pendingLessonVideoFile = null;
  document.getElementById('lessonPreviewVideo').src = '';
  document.getElementById('lessonVideoFileInput').value = '';
  document.getElementById('lvLinkInput').value = '';
  document.getElementById('lvLinkPreview').innerHTML = '';
  document.getElementById('lvTitleInput').value = '';
  // Default tab: file
  document.getElementById('videoFileSection').style.display = '';
  document.getElementById('videoLinkSection').style.display = 'none';
  document.getElementById('tabVideoFile').classList.add('active');
  document.getElementById('tabVideoLink').classList.remove('active');
  document.getElementById('lessonVideoModal').classList.add('open');
});

document.getElementById('tabVideoFile').addEventListener('click', () => {
  document.getElementById('videoFileSection').style.display = '';
  document.getElementById('videoLinkSection').style.display = 'none';
  document.getElementById('tabVideoFile').classList.add('active');
  document.getElementById('tabVideoLink').classList.remove('active');
});
document.getElementById('tabVideoLink').addEventListener('click', () => {
  document.getElementById('videoFileSection').style.display = 'none';
  document.getElementById('videoLinkSection').style.display = '';
  document.getElementById('tabVideoFile').classList.remove('active');
  document.getElementById('tabVideoLink').classList.add('active');
});

// Preview khi nhập link
document.getElementById('lvLinkInput').addEventListener('input', () => {
  const url = document.getElementById('lvLinkInput').value.trim();
  const preview = document.getElementById('lvLinkPreview');
  if (!url) { preview.innerHTML = ''; return; }
  const embed = getEmbedUrl(url);
  if (embed) {
    preview.innerHTML = `<iframe src="${embed}" style="width:100%;height:200px;border:none;border-radius:8px" allowfullscreen></iframe>`;
  } else if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    preview.innerHTML = `<video src="${url}" controls style="width:100%;border-radius:8px;max-height:200px"></video>`;
  } else {
    preview.innerHTML = `<p class="muted-sm">🔗 Link sẽ được nhúng khi học viên xem.</p>`;
  }
  // Tự điền tiêu đề nếu chưa có
  if (!document.getElementById('lvTitleInput').value) {
    try { document.getElementById('lvTitleInput').value = new URL(url).hostname; } catch(e) {}
  }
});

document.getElementById('lessonVideoFileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  pendingLessonVideoFile = f;
  document.getElementById('lessonPreviewVideo').src = URL.createObjectURL(f);
  document.getElementById('lvTitleInput').value = f.name.replace(/\.[^.]+$/, '');
});

document.getElementById('lvCancelBtn').addEventListener('click', () => {
  document.getElementById('lessonVideoModal').classList.remove('open');
  document.getElementById('lessonPreviewVideo').src = '';
  pendingLessonVideoFile = null;
});

document.getElementById('lvSaveBtn').addEventListener('click', async () => {
  const title = document.getElementById('lvTitleInput').value.trim();
  if (!title) { return; }
  const isLinkTab = document.getElementById('tabVideoLink').classList.contains('active');
  const btn = document.getElementById('lvSaveBtn');
  btn.textContent = 'Đang lưu...'; btn.disabled = true;

  if (isLinkTab) {
    // Lưu link
    const url = document.getElementById('lvLinkInput').value.trim();
    if (!url) { btn.textContent = 'Lưu'; btn.disabled = false; return; }
    await db.from('lesson_videos').insert({ lesson_id: currentLessonId, title, video_url: url, storage_path: null, file_name: null });
  } else {
    // Upload file
    if (!pendingLessonVideoFile) { btn.textContent = 'Lưu'; btn.disabled = false; return; }
    const safeName = `${Date.now()}_${pendingLessonVideoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const path = `videos/${currentLessonId}/${safeName}`;
    const { error: upErr } = await db.storage.from('lessons').upload(path, pendingLessonVideoFile, { cacheControl: '3600', upsert: false });
    if (upErr) { alert('Lỗi upload: ' + upErr.message); btn.textContent = 'Lưu'; btn.disabled = false; return; }
    await db.from('lesson_videos').insert({ lesson_id: currentLessonId, title, file_name: pendingLessonVideoFile.name, storage_path: path, video_url: null });
  }

  btn.textContent = 'Lưu'; btn.disabled = false;
  document.getElementById('lessonVideoModal').classList.remove('open');
  document.getElementById('lessonPreviewVideo').src = '';
  pendingLessonVideoFile = null;
  renderLessonVideos(currentLessonId);
});

document.getElementById('openAddDocBtn').addEventListener('click', () => {
  pendingLessonDocFile = null;
  document.getElementById('lessonDocFileInfo').textContent = '';
  document.getElementById('ldTitleInput').value = '';
  document.getElementById('ldLinkInput').value = '';
  document.getElementById('ldHandwrittenInput').value = '';
  document.getElementById('docFileSection').style.display = '';
  document.getElementById('docLinkSection').style.display = 'none';
  document.getElementById('docHandwrittenSection').style.display = 'none';
  document.getElementById('tabDocFile').classList.add('active');
  document.getElementById('tabDocLink').classList.remove('active');
  document.getElementById('tabDocHandwritten').classList.remove('active');
  document.getElementById('lessonDocModal').classList.add('open');
});

document.getElementById('docUploadDrop').addEventListener('click', () => {
  document.getElementById('lessonDocInput').click();
});

document.getElementById('lessonDocInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  pendingLessonDocFile=f;
  document.getElementById('lessonDocFileInfo').textContent=`📎 ${f.name}`;
  document.getElementById('ldTitleInput').value=f.name.replace(/\.[^.]+$/,'');
  e.target.value='';
});

document.getElementById('tabDocFile').addEventListener('click', () => {
  document.getElementById('docFileSection').style.display='';
  document.getElementById('docLinkSection').style.display='none';
  document.getElementById('docHandwrittenSection').style.display='none';
  document.getElementById('tabDocFile').classList.add('active');
  document.getElementById('tabDocLink').classList.remove('active');
  document.getElementById('tabDocHandwritten').classList.remove('active');
});
document.getElementById('tabDocLink').addEventListener('click', () => {
  document.getElementById('docFileSection').style.display='none';
  document.getElementById('docLinkSection').style.display='';
  document.getElementById('docHandwrittenSection').style.display='none';
  document.getElementById('tabDocFile').classList.remove('active');
  document.getElementById('tabDocLink').classList.add('active');
  document.getElementById('tabDocHandwritten').classList.remove('active');
});
document.getElementById('tabDocHandwritten').addEventListener('click', () => {
  document.getElementById('docFileSection').style.display='none';
  document.getElementById('docLinkSection').style.display='none';
  document.getElementById('docHandwrittenSection').style.display='';
  document.getElementById('tabDocFile').classList.remove('active');
  document.getElementById('tabDocLink').classList.remove('active');
  document.getElementById('tabDocHandwritten').classList.add('active');
});

document.getElementById('ldCancelBtn').addEventListener('click',()=>{ document.getElementById('lessonDocModal').classList.remove('open'); pendingLessonDocFile=null; });
document.getElementById('ldSaveBtn').addEventListener('click', async ()=>{
  const title=document.getElementById('ldTitleInput').value.trim(); if(!title) return;
  const isLinkTab = document.getElementById('tabDocLink').classList.contains('active');
  const isHandwrittenTab = document.getElementById('tabDocHandwritten').classList.contains('active');
  const btn = document.getElementById('ldSaveBtn');
  btn.textContent='Đang lưu...'; btn.disabled=true;

  if (isHandwrittenTab) {
    const url = document.getElementById('ldHandwrittenInput').value.trim();
    if (!url) { btn.textContent='Tải lên'; btn.disabled=false; return; }
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const docUrl = gdMatch ? `https://drive.google.com/file/d/${gdMatch[1]}/preview` : url;
    await db.from('lesson_docs').insert({lesson_id:currentLessonId, title, file_name:null, file_type:'handwritten', storage_path:null, doc_url:docUrl});
  } else if (isLinkTab) {
    const url = document.getElementById('ldLinkInput').value.trim();
    if (!url) { btn.textContent='Tải lên'; btn.disabled=false; return; }
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const docUrl = gdMatch ? `https://drive.google.com/file/d/${gdMatch[1]}/preview` : url;
    await db.from('lesson_docs').insert({lesson_id:currentLessonId, title, file_name:null, file_type:'link', storage_path:null, doc_url:docUrl});
  } else {
    if (!pendingLessonDocFile) { btn.textContent='Tải lên'; btn.disabled=false; return; }
    const safeName=`${Date.now()}_${pendingLessonDocFile.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`;
    const path=`docs/${currentLessonId}/${safeName}`;
    const { error:upErr }=await db.storage.from('lessons').upload(path,pendingLessonDocFile);
    if (upErr) { alert('Lỗi upload: '+upErr.message); btn.textContent='Tải lên'; btn.disabled=false; return; }
    await db.from('lesson_docs').insert({lesson_id:currentLessonId,title,file_name:pendingLessonDocFile.name,file_type:pendingLessonDocFile.type,storage_path:path,doc_url:null});
  }

  btn.textContent='Tải lên'; btn.disabled=false;
  document.getElementById('lessonDocModal').classList.remove('open');
  document.getElementById('ldLinkInput').value='';
  document.getElementById('ldHandwrittenInput').value='';
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
  const { data:clsData }=await db.from('classes').select('name,start_date,end_date');
  const clsMap=Object.fromEntries((clsData||[]).map(c=>[c.name,c]));
  const grid=document.getElementById('classGrid');
  grid.innerHTML='';
  document.getElementById('emptyClasses').style.display=allNames.length?'none':'block';
  allNames.forEach(cls=>{
    const count=(allStudents||[]).filter(s=>s.class_name===cls).length;
    const info=clsMap[cls]||{};
    const dateInfo = (info.start_date||info.end_date)
      ? `<div style="font-size:.75rem;color:#888;margin-top:.25rem">${info.start_date?'📅 '+fmtDate(info.start_date):''}${info.start_date&&info.end_date?' → ':''}${info.end_date?fmtDate(info.end_date):''}</div>`
      : '';
    const card=document.createElement('div');
    card.className='stat-card blue clickable';
    card.style.cursor='pointer';
    card.innerHTML=`<div class="stat-icon">🏫</div><div style="flex:1"><div class="stat-num">${count}</div><div class="stat-label">${cls}</div>${dateInfo}</div><div style="display:flex;flex-direction:column;gap:.25rem;align-self:flex-start"><button class="btn-sm" data-edit="${cls}">✏️</button><button class="btn-sm btn-danger" data-del="${cls}">🗑</button></div>`;
    card.addEventListener('click', e=>{ if(!e.target.closest('[data-edit],[data-del]')) openClassDetail(cls); });
    card.querySelector('[data-edit]').addEventListener('click', e=>{ e.stopPropagation(); openEditClassModal(cls, info); });
    card.querySelector('[data-del]').addEventListener('click', async e=>{
      e.stopPropagation();
      showConfirm(`Xóa lớp "${cls}"? Học sinh trong lớp sẽ không bị xóa.`, async () => {
        await db.from('classes').delete().eq('name',cls);
        await db.from('students').update({class_name:''}).eq('class_name',cls);
        renderClasses(); populateClassFilters();
      });
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
function openEditClassModal(cls, clsData={}) {
  editingClassName=cls;
  document.getElementById('editClassName').value=cls;
  document.getElementById('editClassStart').value=clsData.start_date||'';
  document.getElementById('editClassEnd').value=clsData.end_date||'';
  document.getElementById('editClassError').textContent='';
  document.getElementById('editClassModal').classList.add('open');
}
document.getElementById('editClassCancelBtn').addEventListener('click',()=>document.getElementById('editClassModal').classList.remove('open'));
document.getElementById('editClassSaveBtn').addEventListener('click', async ()=>{
  const newName=document.getElementById('editClassName').value.trim(), err=document.getElementById('editClassError');
  if (!newName) { err.textContent='Vui lòng nhập tên lớp.'; return; }
  const start=document.getElementById('editClassStart').value||null;
  const end=document.getElementById('editClassEnd').value||null;
  if (newName===editingClassName) {
    await db.from('classes').update({start_date:start, end_date:end}).eq('name',editingClassName);
  } else {
    await db.from('classes').upsert({name:newName, start_date:start, end_date:end});
    await db.from('classes').delete().eq('name',editingClassName);
    await db.from('students').update({class_name:newName}).eq('class_name',editingClassName);
  }
  document.getElementById('editClassModal').classList.remove('open');
  renderClasses(); populateClassFilters();
});

document.getElementById('openAddClassBtn').addEventListener('click',()=>{
  document.getElementById('addClassName').value='';
  document.getElementById('addClassStart').value='';
  document.getElementById('addClassEnd').value='';
  document.getElementById('addClassError').textContent='';
  document.getElementById('addClassModal').classList.add('open');
});
document.getElementById('addClassCancelBtn').addEventListener('click',()=>document.getElementById('addClassModal').classList.remove('open'));
document.getElementById('addClassSaveBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('addClassName').value.trim(), err=document.getElementById('addClassError');
  if (!name) { err.textContent='Vui lòng nhập tên lớp.'; return; }
  const start=document.getElementById('addClassStart').value||null;
  const end=document.getElementById('addClassEnd').value||null;
  const { error }=await db.from('classes').insert({name, start_date:start, end_date:end});
  if (error) { err.textContent='Tên lớp đã tồn tại.'; return; }
  document.getElementById('addClassModal').classList.remove('open');
  renderClasses(); populateClassFilters();
});

// ============================================================
// DEVICE ALERTS
// ============================================================
async function renderDeviceAlerts() {
  const q = (document.getElementById('deviceAlertSearch').value || '').toLowerCase();
  const { data: list } = await db.from('alerts').select('*')
    .or(`reason.eq.Đăng nhập thiết bị mới — thiết bị cũ bị đăng xuất,reason.eq.Đăng nhập từ thiết bị khác trong vòng 5 phút,reason.eq.Đăng nhập sai mật khẩu 5 lần liên tiếp,reason.like.%Admin%`)
    .order('created_at', { ascending: false });
  const filtered = (list||[]).filter(a => !q || (a.student_name||'').toLowerCase().includes(q));
  const el = document.getElementById('deviceAlertList');
  el.innerHTML = '';
  document.getElementById('emptyDeviceAlerts').style.display = filtered.length ? 'none' : 'block';
  filtered.forEach(a => {
    const row = document.createElement('div');
    row.className = 'content-row alert-row';
    row.innerHTML = `
      <span class="list-icon">📱</span>
      <div class="list-info">
        <div class="list-title">${a.student_name} <span class="muted" style="font-weight:400">— ${a.username}</span></div>
        <div class="list-meta">
          ${a.class_name ? `<span class="class-tag">${a.class_name}</span>` : ''}
          <span class="alert-badge">Đăng nhập thiết bị mới</span>
          • ${fmtTime(a.created_at)}
        </div>
      </div>`;
    el.appendChild(row);
  });
}
document.getElementById('deviceAlertSearch').addEventListener('input', renderDeviceAlerts);
document.getElementById('clearDeviceAlertsBtn').addEventListener('click', async () => {
  showConfirm('Xóa toàn bộ cảnh báo thiết bị?', async () => {
    await db.from('alerts').delete().in('reason', [
      'Đăng nhập thiết bị mới — thiết bị cũ bị đăng xuất',
      'Đăng nhập từ thiết bị khác trong vòng 5 phút',
      'Đăng nhập sai mật khẩu 5 lần liên tiếp'
    ]);
    renderDeviceAlerts();
  }, { title: 'Xóa cảnh báo', icon: '📱' });
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
document.getElementById('exportAlertsBtn').addEventListener('click', async () => {
  const { data: list } = await db.from('alerts').select('*').order('created_at', { ascending: false });
  if (!list || !list.length) { alert('Chưa có cảnh báo nào.'); return; }
  const rows = [['Họ tên', 'Tên đăng nhập', 'Lớp', 'Lý do', 'Thời gian']];
  list.forEach(a => rows.push([a.student_name||'', a.username||'', a.class_name||'', a.reason||'', fmtTime(a.created_at)]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `canh_bao_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
});
document.getElementById('clearAlertsBtn').addEventListener('click', async ()=>{
  showConfirm('Xóa toàn bộ nhật ký cảnh báo?', async () => {
    await db.from('alerts').delete().neq('id',0);
    renderAlerts(); renderOverview();
  }, { title: 'Xóa nhật ký', icon: '🚨' });
});

// ---- Init ----
renderOverview();
