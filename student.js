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
document.getElementById('welcomeTitle').textContent = `Xin chào, ${currentName}! 👋`;
document.getElementById('profileName').textContent  = currentName;

let myClass = '';

async function loadMe() {
  const { data } = await db.from('students').select('class_name, student_code, expiry_date, created_at, username, active').eq('username', currentUser).single();
  myClass = data?.class_name || '';
  sessionStorage.setItem('dh_code', data?.student_code || '');

  const today = new Date(); today.setHours(0,0,0,0);
  const WARN_DAYS = 7;
  const fmt = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  // Điền hồ sơ cơ bản
  const av = document.getElementById('profileAvatar');
  if (av) av.textContent = (currentName||'?')[0].toUpperCase();
  const el = id => document.getElementById(id);
  if (el('profileClass'))    el('profileClass').textContent    = myClass ? `Lớp: ${myClass}` : '';
  if (el('profileCode'))     el('profileCode').textContent     = data?.student_code || '—';
  if (el('profileUsername')) el('profileUsername').textContent = data?.username || '—';
  if (el('profileCreated'))  el('profileCreated').textContent  = data?.created_at ? fmt(data.created_at) : '—';

  // Lấy thông tin lớp học (song song với kiểm tra hết hạn)
  let clsData = null;
  if (myClass) {
    const { data: c } = await db.from('classes').select('start_date, end_date').eq('name', myClass).single();
    clsData = c;
  }

  if (el('profileStartDate')) el('profileStartDate').textContent = clsData?.start_date ? fmt(clsData.start_date) : '—';
  if (el('profileEndDate'))   el('profileEndDate').textContent   = clsData?.end_date   ? fmt(clsData.end_date)   : '—';

  // Kiểm tra hết hạn và tự khóa
  const banner = document.getElementById('expiryBanner');
  let locked = false;

  // Hết hạn tài khoản cá nhân
  if (data?.expiry_date) {
    const exp = new Date(data.expiry_date); exp.setHours(0,0,0,0);
    const daysLeft = Math.round((exp - today) / 86400000);
    if (daysLeft < 0) {
      // Tự khóa
      await db.from('students').update({ active: false }).eq('username', currentUser);
      locked = true;
    } else if (daysLeft <= WARN_DAYS) {
      banner.style.display = 'block';
      banner.innerHTML = `⚠️ Tài khoản sẽ hết hạn vào ngày <b>${exp.toLocaleDateString('vi-VN')}</b> (còn <b>${daysLeft} ngày</b>). Liên hệ trợ lý để gia hạn.`;
    }
  }

  // Hết hạn lớp học
  if (!locked && clsData?.end_date) {
    const end = new Date(clsData.end_date); end.setHours(0,0,0,0);
    const daysLeft = Math.round((end - today) / 86400000);
    if (daysLeft < 0) {
      // Tự khóa vĩnh viễn
      await db.from('students').update({ active: false }).eq('username', currentUser);
      locked = true;
    } else if (daysLeft <= WARN_DAYS) {
      banner.style.display = 'block';
      banner.innerHTML = `⚠️ Khóa học <b>${myClass}</b> kết thúc vào ngày <b>${end.toLocaleDateString('vi-VN')}</b> (còn <b>${daysLeft} ngày</b>). Liên hệ trợ lý để được hỗ trợ.`;
    }
  }

  // Nếu bị khóa → đăng xuất ngay
  if (locked) {
    alert('Khóa học của bạn đã kết thúc. Tài khoản đã bị khóa. Vui lòng liên hệ trợ lý.');
    sessionStorage.clear();
    location.href = 'index.html';
    return;
  }

  // Trạng thái
  if (el('profileStatus')) {
    const endDate = clsData?.end_date ? new Date(clsData.end_date) : null;
    const daysLeft = endDate ? Math.round((endDate - today) / 86400000) : null;
    if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
      el('profileStatus').innerHTML = `<span style="color:var(--warning);font-weight:700">⚠️ Sắp kết thúc (${daysLeft} ngày)</span>`;
    } else {
      el('profileStatus').innerHTML = `<span style="color:var(--success);font-weight:700">✅ Đang hoạt động</span>`;
    }
  }
}

async function setOffline() {
  await db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
}

document.getElementById('logoutBtn').addEventListener('click', async e => {
  e.preventDefault();
  await setOffline();
  sessionStorage.clear();
  location.href = 'index.html';
});

// Set offline khi đóng tab/thoát
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon && navigator.sendBeacon('', ''); // trigger để chạy sync
  db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
});

// Heartbeat mỗi 15s để giữ trạng thái online
db.from('students').update({ is_online: true, last_seen: new Date().toISOString() }).eq('username', currentUser);
setInterval(() => {
  db.from('students').update({ is_online: true, last_seen: new Date().toISOString() }).eq('username', currentUser);
}, 15000);
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
});
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
});

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
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('show'); });
});
document.querySelectorAll('[data-goto]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.goto); });
});

// ---- Trang chủ ----
async function renderHome() {
  // Avatar + thông tin học viên
  const avatarEl = document.getElementById('homeAvatar');
  const nameEl   = document.getElementById('homeStudentName');
  const classEl  = document.getElementById('homeStudentClass');
  const codeEl   = document.getElementById('homeStudentCode');
  if (avatarEl) avatarEl.textContent = (currentName||'?')[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = currentName;
  if (classEl)  classEl.textContent  = myClass ? `Lớp: ${myClass}` : '';
  const code = sessionStorage.getItem('dh_code');
  if (codeEl)   codeEl.textContent   = code ? `Mã HV: ${code}` : '';

  // Load thông báo + bài học song song
  const [{ data: list }, { data: anns }] = await Promise.all([
    (() => {
      let q = db.from('lessons').select('id,name,class_name').order('created_at',{ascending:false}).limit(4);
      if (myClass) q = q.eq('class_name', myClass);
      return q;
    })(),
    db.from('announcements').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false})
  ]);

  // Thông báo
  const annSection = document.getElementById('announcementSection');
  const annList    = document.getElementById('announcementList');
  if (annSection && annList) {
    const myAnns = (anns||[]).filter(a => !a.class_name || a.class_name === myClass);
    if (myAnns.length) {
      annSection.style.display = '';
      annList.innerHTML = myAnns.map(a => `
        <div style="padding:.65rem .75rem;background:${a.pinned?'#fef9c3':'#fff'};border-radius:10px;border-left:3px solid ${a.pinned?'#f59e0b':'#e2e8f0'}">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${a.pinned?'📌 ':''}${a.title}${a.class_name?` <span class="class-tag">${a.class_name}</span>`:''}</div>
          <div style="font-size:.82rem;color:var(--muted);line-height:1.6">${a.content}</div>
          <div style="font-size:.72rem;color:#94a3b8;margin-top:.25rem">${new Date(a.created_at).toLocaleDateString('vi-VN')}</div>
        </div>`).join('');
    } else {
      annSection.style.display = 'none';
    }
  }

  // Bài học mới nhất
  const el = document.getElementById('homeRecentLessons');
  el.innerHTML = '';
  if (!(list||[]).length) { el.innerHTML = '<p class="muted-sm">Chưa có bài học nào.</p>'; return; }

  const ids = list.map(l=>l.id);
  const [{ data: vids }, { data: docs }] = await Promise.all([
    db.from('lesson_videos').select('lesson_id').in('lesson_id', ids),
    db.from('lesson_docs').select('lesson_id').in('lesson_id', ids),
  ]);
  const vcMap = {}, dcMap = {};
  (vids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (docs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

  list.forEach(l => {
    const row = document.createElement('div');
    row.className = 'list-row clickable';
    row.innerHTML = `<span class="list-icon">📚</span><div class="list-info"><div class="list-title">${l.name}</div><div class="list-meta">${l.class_name?`<span class="class-tag">${l.class_name}</span>`:''} 🎬 ${vcMap[l.id]||0} video • 📄 ${dcMap[l.id]||0} tài liệu</div></div>`;
    row.addEventListener('click', () => { showPage('lessons'); openLessonDetail(l.id); });
    el.appendChild(row);
  });
}

// ---- Danh sách bài học ----
async function renderLessonList() {
  document.getElementById('sLessonListView').style.display = '';
  document.getElementById('sLessonDetailView').style.display = 'none';
  let query = db.from('lessons').select('*').order('group_name',{ascending:true}).order('created_at',{ascending:false});
  if (myClass) query = query.eq('class_name', myClass);
  const { data: list } = await query;
  const el = document.getElementById('sLessonList');
  el.innerHTML = '';

  // Lọc theo search
  const q = (document.getElementById('sLessonSearch')?.value||'').toLowerCase().trim();
  const filtered = q ? (list||[]).filter(l => l.name.toLowerCase().includes(q) || (l.description||'').toLowerCase().includes(q)) : (list||[]);

  document.getElementById('sEmptyLessons').style.display = filtered.length?'none':'block';
  if (!filtered.length) return;

  const lessonIds = filtered.map(l => l.id);
  const [{ data: allVids }, { data: allDocs }] = await Promise.all([
    db.from('lesson_videos').select('lesson_id').in('lesson_id', lessonIds),
    db.from('lesson_docs').select('lesson_id').in('lesson_id', lessonIds),
  ]);
  const vcMap = {}, dcMap = {};
  (allVids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (allDocs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

  const groups = {};
  filtered.forEach(l => { const g = l.group_name || 'Bai hoc'; if (!groups[g]) groups[g] = []; groups[g].push(l); });

  const colors = [
    { gc:'#6366f1', gcLight:'#eef2ff', gcGlow:'rgba(99,102,241,.15)' },
    { gc:'#0ea5e9', gcLight:'#e0f2fe', gcGlow:'rgba(14,165,233,.15)' },
    { gc:'#10b981', gcLight:'#d1fae5', gcGlow:'rgba(16,185,129,.15)' },
    { gc:'#f59e0b', gcLight:'#fef3c7', gcGlow:'rgba(245,158,11,.15)' },
    { gc:'#ec4899', gcLight:'#fce7f3', gcGlow:'rgba(236,72,153,.15)' },
    { gc:'#8b5cf6', gcLight:'#ede9fe', gcGlow:'rgba(139,92,246,.15)' },
  ];

  const grid = document.createElement('div');
  grid.className = 'group-card-grid';
  el.appendChild(grid);

  Object.entries(groups).forEach(([groupName, lessons], gi) => {
    const c = colors[gi % colors.length];
    const card = document.createElement('div');
    card.className = 'group-card';
    card.style.setProperty('--gc', c.gc);
    card.style.setProperty('--gc-light', c.gcLight);
    card.style.setProperty('--gc-glow', c.gcGlow);

    const header = document.createElement('div');
    header.className = 'group-card-header';
    const iconEl = document.createElement('div');
    iconEl.className = 'group-card-icon';
    const groupIcons = ['\uD83D\uDCDA','\uD83C\uDFAF','\uD83D\uDD25','\uD83D\uDCA1','\uD83C\uDF1F','\uD83D\uDE80'];
    iconEl.textContent = groupIcons[gi % groupIcons.length];
    const bodyEl = document.createElement('div');
    bodyEl.className = 'group-card-body';
    bodyEl.innerHTML = `<div class="group-card-name">${groupName}</div><div class="group-card-meta"><span class="group-card-count">${lessons.length} bai hoc</span></div>`;
    const chevron = document.createElement('div');
    chevron.className = 'group-card-chevron';
    chevron.textContent = String.fromCharCode(9660);
    header.appendChild(iconEl);
    header.appendChild(bodyEl);
    header.appendChild(chevron);

    const lessonList = document.createElement('div');
    lessonList.className = 'group-lesson-list';
    const inner = document.createElement('div');
    inner.className = 'group-lesson-list-inner';
    lessonList.appendChild(inner);

    let expanded = !!q;
    if (expanded) {
      card.classList.add('open');
      lessonList.classList.add('open');
    }

    function loadLessons() {
      if (inner.dataset.loaded) return;
      inner.dataset.loaded = '1';
      lessons.forEach((l, idx) => {
        const vc = vcMap[l.id]||0, dc = dcMap[l.id]||0;
        const item = document.createElement('div');
        item.className = 'group-lesson-item';
        const num = document.createElement('div'); num.className = 'group-lesson-num'; num.textContent = idx+1;
        const info = document.createElement('div'); info.className = 'group-lesson-info';
        info.innerHTML = `<div class="group-lesson-title"><span style="margin-right:.35rem">\uD83D\uDCDA</span>${l.name}</div><div class="group-lesson-stats"><span>\uD83C\uDFAC ${vc}</span><span>\uD83D\uDCC4 ${dc}</span></div>`;
        const openBtn = document.createElement('button');
        openBtn.className = 'group-lesson-open';
        openBtn.textContent = String.fromCharCode(8594);
        openBtn.addEventListener('click', e => { e.stopPropagation(); openLessonDetail(l.id); });
        item.appendChild(num); item.appendChild(info); item.appendChild(openBtn);
        item.addEventListener('click', () => openLessonDetail(l.id));
        inner.appendChild(item);
      });
    }

    if (expanded) loadLessons(); // Load ngay khi search

    header.addEventListener('click', () => {
      expanded = !expanded;
      card.classList.toggle('open', expanded);
      lessonList.classList.toggle('open', expanded);
      if (expanded) loadLessons();
    });

    card.appendChild(header);
    card.appendChild(lessonList);
    grid.appendChild(card);
  });
}

function getEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
}

// Helper: lấy link download từ Google Drive
function getDownloadUrl(url) {
  if (!url) return null;
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1]}`;
  return null;
}

// ---- Chi tiết bài học ----
// ---- Ghi log truy cap ----
function logAccess(lessonId, lessonName, contentId, contentTitle, contentType) {
  // Fire-and-forget — không block UI
  db.from('access_logs').insert({
    username: currentUser,
    student_name: currentName,
    class_name: myClass || '',
    lesson_id: lessonId,
    lesson_name: lessonName,
    content_id: contentId,
    content_title: contentTitle,
    content_type: contentType
  }).then(() => {}).catch(() => {});
}
async function openLessonDetail(id) {
  // Hiện view ngay, load song song
  document.getElementById('sLessonListView').style.display = 'none';
  document.getElementById('sLessonDetailView').style.display = '';
  document.getElementById('sLessonDetailTitle').textContent = '...';
  document.getElementById('sLessonDetailDesc').textContent  = '';

  // 3 query song song
  const [{ data:l }, { data:vids }, { data:docs }] = await Promise.all([
    db.from('lessons').select('*').eq('id',id).single(),
    db.from('lesson_videos').select('*').eq('lesson_id',id).order('created_at'),
    db.from('lesson_docs').select('*').eq('lesson_id',id).order('created_at'),
  ]);

  if (!l) return;
  document.getElementById('sLessonDetailTitle').textContent = l.name;
  document.getElementById('sLessonDetailDesc').textContent  = l.description||'';

  // Render video
  const vGrid = document.getElementById('sLessonVideoGrid');
  vGrid.innerHTML = '';
  document.getElementById('sEmptyLessonVideos').style.display = (vids||[]).length?'none':'block';
  (vids||[]).forEach((v, idx) => {
    const isLink = !!v.video_url;
    const url = isLink ? v.video_url : db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl;
    const card = document.createElement('div');
    card.className = 'video-card';
    if (isLink && getEmbedUrl(url)) {
      card.innerHTML = `
        <div class="video-thumb" style="background:linear-gradient(135deg,#1e1b4b,#312e81);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.5rem;position:relative">
          <div style="width:52px;height:52px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;border:2px solid rgba(255,255,255,.3)">▶</div>
          <span style="color:rgba(255,255,255,.8);font-size:.75rem;font-weight:600">Nhấn để xem</span>
          <div style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;padding:.2rem .5rem;border-radius:6px">VIDEO</div>
        </div>
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Bài ${idx+1}</div>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="video-thumb" style="position:relative">
          <video src="${url}" preload="none"></video>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 50%);display:flex;align-items:center;justify-content:center">
            <div style="width:52px;height:52px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:2px solid rgba(255,255,255,.4);backdrop-filter:blur(4px)">▶</div>
          </div>
          <div style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;padding:.2rem .5rem;border-radius:6px">VIDEO</div>
        </div>
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Bài ${idx+1}</div>
        </div>`;
    }
    card.querySelector('.video-thumb').addEventListener('click', () => {
      logAccess(id, l.name, v.id, v.title, 'video');
      openViewer(v.title, url, v.file_name, isLink ? 'link' : 'video');
    });
    vGrid.appendChild(card);
  });

  // Render tài liệu
  const dList = document.getElementById('sLessonDocList');
  dList.innerHTML = '';
  document.getElementById('sEmptyLessonDocs').style.display = (docs||[]).length?'none':'block';
  (docs||[]).forEach(d => {
    const isLink = d.file_type==='link';
    const isHandwritten = d.file_type==='handwritten';
    const url = (isLink||isHandwritten) ? d.doc_url : db.storage.from('lessons').getPublicUrl(d.storage_path).data.publicUrl;

    const icon  = isHandwritten ? '✍️' : isLink ? '🔗' : '📄';
    const color = isHandwritten ? '#8b5cf6' : isLink ? '#0ea5e9' : '#f59e0b';
    const bg    = isHandwritten ? '#ede9fe' : isLink ? '#e0f2fe' : '#fef3c7';
    const label = isHandwritten ? 'Bản viết tay' : isLink ? 'Tài liệu online' : 'File tài liệu';

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:.85rem;padding:.85rem 1rem;background:var(--card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow)`;
    row.innerHTML = `
      <div style="width:42px;height:42px;background:${bg};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.title}</div>
        <div style="font-size:.75rem;color:${color};font-weight:600;margin-top:.15rem">${label}</div>
      </div>
      <div style="background:${bg};color:${color};padding:.35rem .75rem;border-radius:8px;font-size:.78rem;font-weight:700;flex-shrink:0">Xem →</div>
    `;
    row.addEventListener('mouseenter', () => { row.style.borderColor = color; row.style.transform = 'translateX(3px)'; });
    row.addEventListener('mouseleave', () => { row.style.borderColor = 'var(--border)'; row.style.transform = ''; });
    row.addEventListener('click', () => {
      logAccess(id, l.name, d.id, d.title, 'doc');
      openViewer(d.title, url, d.file_name, isHandwritten?'handwritten-link':isLink?'doc-link':d.file_type);
    });
    dList.appendChild(row);
  });
}
document.getElementById('sBackToLessonsBtn').addEventListener('click', renderLessonList);
document.getElementById('sLessonSearch').addEventListener('input', renderLessonList);

// ---- Viewer ----
function openViewer(title, url, fileName, fileType) {
  const isVideo = fileType==='video'||(fileType||'').startsWith('video/');
  const isLink = fileType==='link';
  const isDocLink = fileType==='doc-link';
  const isHandwrittenLink = fileType==='handwritten-link';

  // Tự động tiêu đề theo loại
  let displayTitle = title;
  if (isVideo || isLink) displayTitle = 'Video bài học';
  else if (isHandwrittenLink) displayTitle = 'Bản viết tay';
  else if (isDocLink || fileType==='application/pdf' || (fileType||'').startsWith('image/')) displayTitle = 'Tài liệu';

  document.getElementById('viewerTitle').textContent = displayTitle;
  const body=document.getElementById('viewerBody'), dl=document.getElementById('viewerDownload');
  dl.href=url; dl.download=fileName||title;

  if (isDocLink || isHandwrittenLink) {
    const dlUrl = getDownloadUrl(url);
    if (dlUrl) { dl.style.display=''; dl.href=dlUrl; dl.removeAttribute('download'); dl.target='_blank'; }
    else { dl.style.display='none'; }
    const embed = getEmbedUrl(url);
    if (embed) body.innerHTML=`<iframe src="${embed}" style="width:100%;height:400px;border:none;border-radius:8px" allowfullscreen></iframe>`;
    else body.innerHTML=`<iframe src="${url}" style="width:100%;height:500px;border:none;border-radius:8px"></iframe>`;
  } else if (isLink) {
    dl.style.display = 'none';
    const embed = getEmbedUrl(url);
    if (embed) {
      body.innerHTML=`<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:.5rem .85rem;border-radius:8px;margin-bottom:.5rem;font-size:.8rem;color:#92400e">💡 Video bị mờ? Nhấn ⚙️ trong góc video → chọn <b>Chất lượng</b> → tăng lên <b>720p hoặc 1080p</b></div><iframe src="${embed}" style="width:100%;height:400px;border:none;border-radius:8px" allowfullscreen></iframe>`;
    } else {
      body.innerHTML=`<iframe src="${url}" style="width:100%;height:500px;border:none;border-radius:8px"></iframe>`;
    }
  } else if (isVideo) {
    dl.style.display = 'none';
    body.innerHTML=`<video src="${url}" controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture oncontextmenu="return false" style="width:100%;max-height:70vh;background:#000" playsinline></video>`;
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      const tip = document.createElement('div');
      tip.style.cssText = 'background:#fff3cd;color:#856404;padding:.6rem 1rem;border-radius:8px;margin-bottom:.5rem;font-size:.85rem;text-align:center;';
      tip.textContent = '📱 Vui lòng chuyển điện thoại sang ngang để có trải nghiệm học tốt nhất';
      body.insertBefore(tip, body.firstChild);
      const onOrient = () => { if (window.innerWidth > window.innerHeight) { tip.remove(); window.removeEventListener('resize', onOrient); } };
      window.addEventListener('resize', onOrient);
    }
  } else if (fileType==='application/pdf') {
    dl.style.display = '';
    body.innerHTML=`<iframe src="${url}" class="viewer-iframe"></iframe>`;
  } else if ((fileType||'').startsWith('image/')) {
    dl.style.display = '';
    body.innerHTML=`<img src="${url}" class="viewer-img" alt="${title}"/>`;
  } else {
    dl.style.display = '';
    body.innerHTML=`<p class="muted-center">⚠️ Không xem trực tiếp được. Vui lòng tải xuống.</p>`;
  }
  document.getElementById('viewerModal').classList.add('open');
}
document.getElementById('closeViewer').addEventListener('click', closeViewer);
document.getElementById('viewerModal').addEventListener('click', e => { if(e.target===document.getElementById('viewerModal')) closeViewer(); });
function closeViewer() { 
  document.getElementById('viewerModal').classList.remove('open'); 
  document.getElementById('viewerBody').innerHTML='';
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
}

// ---- Init ----
loadMe().then(() => renderHome());

// Realtime: lắng nghe thay đổi active của tài khoản này
db.channel('student-lock-' + currentUser)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'students',
    filter: `username=eq.${currentUser}`
  }, async (payload) => {
    const s = payload.new;
    if (!s.active) {
      document.body.innerHTML = `
        <div style="position:fixed;inset:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;text-align:center;padding:2rem;z-index:99999">
          <div style="font-size:3.5rem">🔒</div>
          <div style="color:#ef4444;font-size:1.3rem;font-weight:800">Tài khoản đã bị khóa</div>
          <div style="color:rgba(255,255,255,.75);font-size:.95rem;max-width:320px;line-height:1.7">
            Tài khoản của bạn vừa bị khóa bởi quản trị viên.<br/>
            Vui lòng liên hệ <b style="color:#fff">Trợ lý Trần Cường</b> để được hỗ trợ.
          </div>
          <button onclick="sessionStorage.clear();location.href='index.html'" style="margin-top:.5rem;background:#6366f1;color:#fff;border:none;padding:.75rem 2rem;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer">
            Về trang đăng nhập
          </button>
        </div>`;
      await setOffline();
      sessionStorage.clear();
    }
  })
  .subscribe();

// Realtime: lắng nghe thông báo mới từ admin
db.channel('announcements-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'announcements'
  }, () => {
    // Reload thông báo nếu đang ở trang chủ
    if (document.getElementById('pageHome')?.classList.contains('active')) {
      renderHome();
    }
    // Hiện toast thông báo mới
    showAnnouncementToast();
  })
  .subscribe();

function showAnnouncementToast() {
  const existing = document.getElementById('annToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'annToast';
  toast.style.cssText = 'position:fixed;top:70px;right:1rem;z-index:9000;background:#1e1b4b;color:#fff;padding:.75rem 1.1rem;border-radius:12px;font-size:.85rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3);border-left:4px solid #f59e0b;display:flex;align-items:center;gap:.6rem;animation:slideInRight .3s ease;max-width:280px';
  toast.innerHTML = '<span style="font-size:1.1rem">📢</span><span>Có thông báo mới từ giáo viên!</span>';
  toast.addEventListener('click', () => { showPage('home'); toast.remove(); });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity .5s'; setTimeout(() => toast.remove(), 500); }, 5000);
}

// Kiểm tra session token + trạng thái tài khoản mỗi 30 giây
setInterval(async () => {
  const token = sessionStorage.getItem('dh_token');
  if (!token) return;

  const { data } = await db.from('students').select('session_token, active, class_name, expiry_date, manually_unlocked').eq('username', currentUser).single();
  if (!data) return;

  // Bị đăng nhập thiết bị khác — bỏ kiểm tra

  // Tài khoản bị khóa thủ công
  if (!data.active) {
    alert('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ trợ lý.');
    await setOffline();
    sessionStorage.clear();
    location.href = 'index.html';
    return;
  }

  // Hết hạn tài khoản cá nhân
  if (data.expiry_date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(data.expiry_date); exp.setHours(0,0,0,0);
    if (today > exp) {
      await db.from('students').update({ active: false }).eq('username', currentUser);
      alert('Tài khoản của bạn đã hết hạn. Vui lòng liên hệ trợ lý để gia hạn.');
      await setOffline();
      sessionStorage.clear();
      location.href = 'index.html';
      return;
    }
  }

  // Lớp học hết hạn
  if (data.class_name && !data.manually_unlocked) {
    const { data: cls } = await db.from('classes').select('end_date').eq('name', data.class_name).single();
    if (cls?.end_date) {
      const today = new Date(); today.setHours(0,0,0,0);
      const end = new Date(cls.end_date); end.setHours(0,0,0,0);
      if (today > end) {
        await db.from('students').update({ active: false }).eq('username', currentUser);
        alert(`Khóa học "${data.class_name}" đã kết thúc. Tài khoản đã bị khóa.`);
        await setOffline();
        sessionStorage.clear();
        location.href = 'index.html';
        return;
      }
    }
  }
}, 30000);





