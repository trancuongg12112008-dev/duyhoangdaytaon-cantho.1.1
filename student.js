// Khởi tạo Supabase client
const db = supabase.createClient(
  'https://gojpmogjretoxplydjvg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanBtb2dqcmV0b3hwbHlkanZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Nzg4ODEsImV4cCI6MjA5MzA1NDg4MX0.iLCNd2VRMiZoFp6_KclZlFsOenUNoM041tl1fobHKDA'
);

// Auth guard
if (sessionStorage.getItem('dh_role') !== 'student') location.href = 'index.html';

const currentUser = sessionStorage.getItem('dh_user');
const currentName = sessionStorage.getItem('dh_name') || currentUser;

document.getElementById('studentName').textContent  = currentName;
document.getElementById('welcomeTitle').textContent = `Chào mừng, ${currentName}!`;
document.getElementById('profileName').textContent  = currentName;

let myClass = '';

async function loadMe() {
  const { data } = await db.from('students').select('class_name').eq('username', currentUser).single();
  myClass = data?.class_name || '';
  document.getElementById('profileClass').textContent = myClass ? `Lớp: ${myClass}` : '';
}

document.getElementById('logoutBtn').addEventListener('click', e => { e.preventDefault(); sessionStorage.clear(); location.href = 'index.html'; });
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

// ---- Sidebar nav ----
let currentSection = 'home';
function showPage(pg) {
  currentSection = pg;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
  const map = { home:'Home', lessons:'Lessons', profile:'Profile' };
  const el = document.getElementById('page' + (map[pg] || pg.charAt(0).toUpperCase()+pg.slice(1)));
  if (el) el.classList.add('active');
  document.querySelectorAll(`[data-page="${pg}"]`).forEach(l => l.classList.add('active'));
  if (pg === 'home')    renderHome();
  if (pg === 'lessons') renderLessonList();
}
document.querySelectorAll('.slink[data-page]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); document.getElementById('sidebar').classList.remove('open'); });
});
document.querySelectorAll('[data-goto]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.goto); });
});

// ---- Trang chủ ----
async function renderHome() {
  let query = db.from('lessons').select('id,name,class_name').order('created_at',{ascending:false}).limit(4);
  if (myClass) query = query.or(`class_name.eq.${myClass},class_name.is.null,class_name.eq.`);
  const { data: list } = await query;
  const el = document.getElementById('homeRecentLessons');
  el.innerHTML = '';
  if (!(list||[]).length) { el.innerHTML = '<p class="muted-sm">Chưa có bài học nào.</p>'; return; }
  for (const l of list) {
    const [{ count:vc },{ count:dc }] = await Promise.all([
      db.from('lesson_videos').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
      db.from('lesson_docs').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
    ]);
    const row = document.createElement('div');
    row.className = 'list-row clickable';
    row.innerHTML = `<span class="list-icon">📚</span><div class="list-info"><div class="list-title">${l.name}</div><div class="list-meta">${l.class_name?`<span class="class-tag">${l.class_name}</span>`:''} 🎬 ${vc||0} video • 📄 ${dc||0} tài liệu</div></div>`;
    row.addEventListener('click', () => { showPage('lessons'); openLessonDetail(l.id); });
    el.appendChild(row);
  }
}

// ---- Danh sách bài học ----
async function renderLessonList() {
  document.getElementById('sLessonListView').style.display = '';
  document.getElementById('sLessonDetailView').style.display = 'none';
  let query = db.from('lessons').select('*').order('created_at',{ascending:false});
  if (myClass) query = query.or(`class_name.eq.${myClass},class_name.is.null,class_name.eq.`);
  const { data: list } = await query;
  const el = document.getElementById('sLessonList');
  el.innerHTML = '';
  document.getElementById('sEmptyLessons').style.display = (list||[]).length?'none':'block';
  for (const l of (list||[])) {
    const [{ count:vc },{ count:dc }] = await Promise.all([
      db.from('lesson_videos').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
      db.from('lesson_docs').select('*',{count:'exact',head:true}).eq('lesson_id',l.id),
    ]);
    const row = document.createElement('div');
    row.className = 'content-row clickable';
    row.innerHTML = `<span class="list-icon">📚</span><div class="list-info"><div class="list-title">${l.name}</div><div class="list-meta">${l.class_name?`<span class="class-tag">${l.class_name}</span>`:''} 🎬 ${vc||0} video • 📄 ${dc||0} tài liệu${l.description?` • ${l.description}`:''}</div></div><span class="btn-sm">👁 Xem</span>`;
    row.addEventListener('click', () => openLessonDetail(l.id));
    el.appendChild(row);
  }
}

// ---- Chi tiết bài học ----
async function openLessonDetail(id) {
  const { data:l } = await db.from('lessons').select('*').eq('id',id).single();
  if (!l) return;
  document.getElementById('sLessonListView').style.display = 'none';
  document.getElementById('sLessonDetailView').style.display = '';
  document.getElementById('sLessonDetailTitle').textContent = l.name;
  document.getElementById('sLessonDetailDesc').textContent  = l.description||'';

  const { data:vids } = await db.from('lesson_videos').select('*').eq('lesson_id',id).order('created_at');
  const vGrid = document.getElementById('sLessonVideoGrid');
  vGrid.innerHTML = '';
  document.getElementById('sEmptyLessonVideos').style.display = (vids||[]).length?'none':'block';
  (vids||[]).forEach(v => {
    const url = db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl;
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<div class="video-thumb"><video src="${url}" preload="metadata"></video><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div></div>`;
    card.querySelector('.video-thumb').addEventListener('click', () => openViewer(v.title,url,v.file_name,'video'));
    vGrid.appendChild(card);
  });

  const { data:docs } = await db.from('lesson_docs').select('*').eq('lesson_id',id).order('created_at');
  const dList = document.getElementById('sLessonDocList');
  dList.innerHTML = '';
  document.getElementById('sEmptyLessonDocs').style.display = (docs||[]).length?'none':'block';
  (docs||[]).forEach(d => {
    const url = db.storage.from('lessons').getPublicUrl(d.storage_path).data.publicUrl;
    const row = document.createElement('div');
    row.className = 'content-row clickable';
    row.innerHTML = `<span class="list-icon">📄</span><div class="list-info"><div class="list-title">${d.title}</div></div><span class="btn-sm">👁 Xem</span>`;
    row.addEventListener('click', () => openViewer(d.title,url,d.file_name,d.file_type));
    dList.appendChild(row);
  });
}
document.getElementById('sBackToLessonsBtn').addEventListener('click', renderLessonList);

// ---- Viewer ----
function openViewer(title, url, fileName, fileType) {
  document.getElementById('viewerTitle').textContent = title;
  const body=document.getElementById('viewerBody'), dl=document.getElementById('viewerDownload');
  const isVideo = fileType==='video'||(fileType||'').startsWith('video/');
  dl.style.display = isVideo?'none':'';
  dl.href=url; dl.download=fileName||title;
  if (isVideo)
    body.innerHTML=`<video src="${url}" controls controlsList="nodownload" oncontextmenu="return false" class="viewer-video"></video>`;
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

// ---- Init ----
loadMe().then(() => renderHome());
