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
  const { data } = await db.from('students').select('class_name, student_code, expiry_date').eq('username', currentUser).single();
  myClass = data?.class_name || '';
  document.getElementById('profileClass').textContent = myClass ? `Lớp: ${myClass}` : '';
  sessionStorage.setItem('dh_code', data?.student_code || '');

  const banner = document.getElementById('expiryBanner');
  const today = new Date(); today.setHours(0,0,0,0);
  const WARN_DAYS = 7;

  // Kiểm tra hết hạn tài khoản cá nhân
  if (data?.expiry_date) {
    const exp = new Date(data.expiry_date); exp.setHours(0,0,0,0);
    const daysLeft = Math.round((exp - today) / 86400000);
    if (daysLeft >= 0 && daysLeft <= WARN_DAYS) {
      banner.style.display = 'block';
      banner.innerHTML = `⚠️ Tài khoản của bạn sẽ hết hạn vào ngày <b>${exp.toLocaleDateString('vi-VN')}</b> (còn <b>${daysLeft} ngày</b>). Vui lòng liên hệ trợ lý để gia hạn.`;
      return;
    }
  }

  // Kiểm tra ngày kết thúc lớp học
  if (myClass) {
    const { data: cls } = await db.from('classes').select('end_date').eq('name', myClass).single();
    if (cls?.end_date) {
      const end = new Date(cls.end_date); end.setHours(0,0,0,0);
      const daysLeft = Math.round((end - today) / 86400000);
      if (daysLeft >= 0 && daysLeft <= WARN_DAYS) {
        banner.style.display = 'block';
        banner.innerHTML = `⚠️ Khóa học <b>${myClass}</b> sẽ kết thúc vào ngày <b>${end.toLocaleDateString('vi-VN')}</b> (còn <b>${daysLeft} ngày</b>). Vui lòng liên hệ trợ lý để được hỗ trợ.`;
      }
    }
  }
}

document.getElementById('logoutBtn').addEventListener('click', e => { e.preventDefault(); sessionStorage.clear(); location.href = 'index.html'; });
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

// ---- Sidebar nav ----
let currentSection = 'home';
function showPage(pg) {
  currentSection = pg;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
  const map = { home:'Home', lessons:'Lessons', profile:'Profile', guide:'Guide' };
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
  if (myClass) query = query.eq('class_name', myClass);
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
  if (myClass) query = query.eq('class_name', myClass);
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

// Helper: chuyển link thường thành embed URL
function getEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
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
    const isLink = !!v.video_url;
    const url = isLink ? v.video_url : db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl;
    const card = document.createElement('div');
    card.className = 'video-card';
    if (isLink && getEmbedUrl(url)) {
      card.innerHTML = `<div class="video-thumb" style="background:#111;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.25rem"><span style="font-size:2rem">▶️</span><span style="color:#fff;font-size:.75rem">Nhấn để xem</span></div><div class="video-info"><div class="video-title">${v.title}</div></div>`;
    } else {
      card.innerHTML = `<div class="video-thumb"><video src="${url}" preload="metadata"></video><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div></div>`;
    }
    card.querySelector('.video-thumb').addEventListener('click', () => openViewer(v.title, url, v.file_name, isLink ? 'link' : 'video'));
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
  dl.href=url; dl.download=fileName||title;
  const isVideo = fileType==='video'||(fileType||'').startsWith('video/');
  const isLink = fileType==='link';

  // Ẩn nút tải với video và link
  dl.style.display = (isVideo || isLink) ? 'none' : '';

  if (isLink) {
    const embed = getEmbedUrl(url);
    if (embed) {
      body.innerHTML=`<iframe src="${embed}" style="width:100%;height:400px;border:none;border-radius:8px" allowfullscreen></iframe>`;
    } else {
      // Link MP4 trực tiếp hoặc link khác
      body.innerHTML=`<video src="${url}" controls controlsList="nodownload" oncontextmenu="return false" class="viewer-video"></video>`;
    }
  } else if (isVideo) {
    body.innerHTML=`<video src="${url}" controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture oncontextmenu="return false" class="viewer-video"></video>`;
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      const tip = document.createElement('div');
      tip.style.cssText = 'background:#fff3cd;color:#856404;padding:.6rem 1rem;border-radius:8px;margin-bottom:.5rem;font-size:.85rem;text-align:center;';
      tip.textContent = '📱 Vui lòng chuyển điện thoại sang ngang để có trải nghiệm học tốt nhất';
      body.insertBefore(tip, body.firstChild);
      const onOrient = () => { if (window.innerWidth > window.innerHeight) { tip.remove(); window.removeEventListener('resize', onOrient); } };
      window.addEventListener('resize', onOrient);
    }
  } else if (fileType==='application/pdf')
    body.innerHTML=`<iframe src="${url}" class="viewer-iframe"></iframe>`;
  else if ((fileType||'').startsWith('image/'))
    body.innerHTML=`<img src="${url}" class="viewer-img" alt="${title}"/>`;
  else
    body.innerHTML=`<p class="muted-center">⚠️ Không xem trực tiếp được. Vui lòng tải xuống.</p>`;
  document.getElementById('viewerModal').classList.add('open');
}
document.getElementById('closeViewer').addEventListener('click', closeViewer);
document.getElementById('viewerModal').addEventListener('click', e => { if(e.target===document.getElementById('viewerModal')) closeViewer(); });
function closeViewer() { 
  document.getElementById('viewerModal').classList.remove('open'); 
  document.getElementById('viewerBody').innerHTML='';
  document.querySelector('.viewer-modal').classList.remove('fullscreen');
  document.getElementById('fullscreenViewer').textContent = '⛶';
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  if (screen.orientation?.unlock) screen.orientation.unlock();
}

// ---- Init ----
loadMe().then(() => renderHome());

// Kiểm tra session token mỗi 30 giây
setInterval(async () => {
  const token = sessionStorage.getItem('dh_token');
  if (!token) return;
  const { data } = await db.from('students').select('session_token').eq('username', currentUser).single();
  if (data && data.session_token !== token) {
    alert('Tài khoản của bạn đã đăng nhập ở thiết bị khác. Bạn sẽ bị đăng xuất.');
    sessionStorage.clear();
    location.href = 'index.html';
  }
}, 30000);
