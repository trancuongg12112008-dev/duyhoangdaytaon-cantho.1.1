﻿// Khởi tạo Supabase client (CDN đã load sẵn qua script tag)
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

if (!isTeacher) {
  document.querySelectorAll('[data-page="create-student"]').forEach(el => el.style.display = 'none');
}
document.getElementById('logoutBtn').addEventListener('click', e => { e.preventDefault(); sessionStorage.clear(); location.href='index.html'; });
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
});
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
});

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
  if (name === 'create-student') {
    renderMiniStudents();
    populateCsClassSelect();
    genStudentCode().then(code => {
      document.getElementById('csCode').value = code;
      document.getElementById('csPassword').value = code;
    });
  }
  if (name === 'lessons')        { populateClassFilters(); renderLessons(); }
  if (name === 'lesson-groups')  { populateClassFilters(); renderGroups(); }
  if (name === 'security')       renderAlerts();
  if (name === 'devices')        renderDeviceAlerts();
  if (name === 'access-stats')   renderAccessStats();
  if (name === 'classes')        renderClasses();
}
document.querySelectorAll('.slink[data-page]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('show'); });
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
  ['studentFilterClass','lessonFilterClass','accessFilterClass'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value; el.innerHTML = filterOpts; el.value = cur;
  });
  const lcs = document.getElementById('lClassSelect'); if (lcs) { const cur=lcs.value; lcs.innerHTML=modalOpts; lcs.value=cur; }
  ['addClass','esClass','groupClassSelect'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value; el.innerHTML = modalOpts; el.value = cur;
  });
}
populateClassFilters();

// ---- Populate nhóm bài học vào dropdown ----
async function populateGroupSelect(selectId, currentVal='') {
  const { data: groups } = await db.from('lesson_groups').select('name').order('name');
  const el = document.getElementById(selectId); if (!el) return;
  el.innerHTML = '<option value="">-- Không có nhóm --</option>' + (groups||[]).map(g=>`<option value="${g.name}">${g.name}</option>`).join('');
  el.value = currentVal;
}

// ============================================================
// NHÓM BÀI HỌC
// ============================================================
async function renderGroups() {
  const { data: list } = await db.from('lesson_groups').select('*').order('name');
  const container = document.getElementById('groupList');
  container.innerHTML = '';
  document.getElementById('emptyGroups').style.display = (list||[]).length ? 'none' : 'block';
  if (!(list||[]).length) return;

  const { data: allLessons } = await db.from('lessons').select('id,name,class_name,description,group_name').order('created_at', {ascending: false});
  const lessonIds = (allLessons||[]).map(l => l.id);
  const [{ data: allVids }, { data: allDocs }] = lessonIds.length ? await Promise.all([
    db.from('lesson_videos').select('lesson_id').in('lesson_id', lessonIds),
    db.from('lesson_docs').select('lesson_id').in('lesson_id', lessonIds),
  ]) : [{ data: [] }, { data: [] }];
  const vcMap = {}, dcMap = {};
  (allVids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (allDocs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

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
  container.appendChild(grid);

  function buildLessonItem(l, idx, vcMap, dcMap, onOpen, onEdit, onDel) {
    const item = document.createElement('div');
    item.className = 'group-lesson-item';
    const num = document.createElement('div');
    num.className = 'group-lesson-num';
    num.textContent = idx + 1;
    const info = document.createElement('div');
    info.className = 'group-lesson-info';
    const title = document.createElement('div');
    title.className = 'group-lesson-title';
    title.textContent = l.name;
    const stats = document.createElement('div');
    stats.className = 'group-lesson-stats';
    stats.innerHTML = `<span>${vcMap[l.id]||0} video</span><span>${dcMap[l.id]||0} tai lieu</span>${l.class_name ? `<span class="class-tag" style="font-size:.68rem">${l.class_name}</span>` : ''}`;
    info.appendChild(title);
    info.appendChild(stats);
    const acts = document.createElement('div');
    acts.className = 'group-lesson-item-actions';
    const openBtn = document.createElement('button');
    openBtn.className = 'group-lesson-open';
    openBtn.textContent = String.fromCharCode(8594);
    openBtn.addEventListener('click', e => { e.stopPropagation(); onOpen(); });
    acts.appendChild(openBtn);
    if (onEdit) {
      const eb = document.createElement('button'); eb.className = 'btn-sm'; eb.textContent = String.fromCharCode(9999,65039);
      eb.addEventListener('click', e => { e.stopPropagation(); onEdit(); }); acts.appendChild(eb);
    }
    if (onDel) {
      const db2 = document.createElement('button'); db2.className = 'btn-sm btn-danger'; db2.textContent = String.fromCharCode(128465);
      db2.addEventListener('click', e => { e.stopPropagation(); onDel(); }); acts.appendChild(db2);
    }
    item.appendChild(num); item.appendChild(info); item.appendChild(acts);
    item.addEventListener('click', onOpen);
    return item;
  }

  list.forEach((g, gi) => {
    const lessons = (allLessons||[]).filter(l => l.group_name === g.name);
    const count = lessons.length;
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
    const nameEl = document.createElement('div');
    nameEl.className = 'group-card-name';
    nameEl.textContent = g.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'group-card-meta';
    if (g.class_name) { const ct = document.createElement('span'); ct.className = 'class-tag'; ct.textContent = g.class_name; metaEl.appendChild(ct); }
    const countEl = document.createElement('span');
    countEl.className = 'group-card-count';
    countEl.textContent = count + ' bai hoc';
    metaEl.appendChild(countEl);
    bodyEl.appendChild(nameEl);
    bodyEl.appendChild(metaEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'group-card-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-sm';
    editBtn.textContent = String.fromCharCode(9999,65039);
    editBtn.addEventListener('click', e => { e.stopPropagation(); openGroupModal(g); });
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-sm btn-danger';
    delBtn.textContent = String.fromCharCode(128465);
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      showConfirm(`Xoa nhom "${g.name}"?`, async () => {
        await db.from('lessons').update({ group_name: null }).eq('group_name', g.name);
        await db.from('lesson_groups').delete().eq('id', g.id);
        renderGroups();
      });
    });
    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(delBtn);

    const chevron = document.createElement('div');
    chevron.className = 'group-card-chevron';
    chevron.textContent = String.fromCharCode(9660);

    header.appendChild(iconEl);
    header.appendChild(bodyEl);
    header.appendChild(actionsEl);
    header.appendChild(chevron);

    const lessonList = document.createElement('div');
    lessonList.className = 'group-lesson-list';
    const inner = document.createElement('div');
    inner.className = 'group-lesson-list-inner';
    lessonList.appendChild(inner);

    let expanded = false;
    header.addEventListener('click', e => {
      if (e.target.closest('.group-card-actions')) return;
      expanded = !expanded;
      card.classList.toggle('open', expanded);
      lessonList.classList.toggle('open', expanded);
      if (expanded && !inner.dataset.loaded) {
        inner.dataset.loaded = '1';
        if (!lessons.length) {
          const msg = document.createElement('div');
          msg.className = 'group-empty-msg';
          msg.textContent = 'Chua co bai hoc nao.';
          inner.appendChild(msg);
          return;
        }
        lessons.forEach((l, idx) => {
          inner.appendChild(buildLessonItem(l, idx, vcMap, dcMap,
            () => openLessonDetail(l.id),
            () => openLessonModal(l),
            () => showConfirm(`Xoa bai hoc "${l.name}"?`, async () => { await db.from('lessons').delete().eq('id',l.id); renderGroups(); })
          ));
        });
      }
    });

    card.appendChild(header);
    card.appendChild(lessonList);
    grid.appendChild(card);
  });
}

let editingGroupId = null;
function openGroupModal(g=null) {
  editingGroupId = g?g.id:null;
  document.getElementById('groupModalTitle').textContent = g?'Sửa nhóm':'Tạo nhóm';
  document.getElementById('groupNameInput').value = g?g.name:'';
  document.getElementById('groupNameInput').dataset.oldName = g?g.name:'';
  document.getElementById('groupError').textContent = '';
  populateClassFilters().then(() => { document.getElementById('groupClassSelect').value = g?(g.class_name||''):''; });
  document.getElementById('groupModal').classList.add('open');
}
document.getElementById('openAddGroupBtn').addEventListener('click', () => openGroupModal());
document.getElementById('groupCancelBtn').addEventListener('click', () => document.getElementById('groupModal').classList.remove('open'));
document.getElementById('groupSaveBtn').addEventListener('click', async () => {
  const name = document.getElementById('groupNameInput').value.trim();
  const oldName = document.getElementById('groupNameInput').dataset.oldName;
  const cls = document.getElementById('groupClassSelect').value;
  const err = document.getElementById('groupError');
  if (!name) { err.textContent='Vui lòng nhập tên nhóm.'; return; }
  if (editingGroupId) {
    await db.from('lesson_groups').update({name,class_name:cls||null}).eq('id',editingGroupId);
    if (oldName && oldName !== name) await db.from('lessons').update({group_name:name}).eq('group_name',oldName);
  } else {
    const { error } = await db.from('lesson_groups').insert({name,class_name:cls||null});
    if (error) { err.textContent='Tên nhóm đã tồn tại.'; return; }
  }
  document.getElementById('groupModal').classList.remove('open');
  renderGroups();
});

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

async function populateCsClassSelect() {
  const classes = await getClasses();
  const el = document.getElementById('csClassSelect');
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">-- Chon lop --</option>' + classes.map(c=>`<option value="${c}">${c}</option>`).join('');
  el.value = cur;
}

document.getElementById('csGenPwBtn').addEventListener('click', () => {
  document.getElementById('csPassword').value = Math.random().toString(36).slice(2,8).toUpperCase();
});

// Mã học viên = mật khẩu tự động
document.getElementById('csCode').addEventListener('input', () => {
  document.getElementById('csPassword').value = document.getElementById('csCode').value;
});

// Tự động tạo mã học viên 5 ký tự unique
async function genStudentCode() {
  const { data: existing } = await db.from('students').select('student_code');
  const usedCodes = new Set((existing||[]).map(s => s.student_code).filter(Boolean));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code;
  do {
    code = Array.from({length: 5}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (usedCodes.has(code));
  return code;
}

document.getElementById('csSaveBtn').addEventListener('click', async () => {
  const code     = document.getElementById('csCode').value.trim();
  const name     = document.getElementById('csName').value.trim();
  const phone    = document.getElementById('csPhone').value.trim();
  const username = document.getElementById('csUsername').value.trim();
  const password = document.getElementById('csPassword').value.trim();
  const cls      = document.getElementById('csClassSelect').value;
  const expiry   = document.getElementById('csExpiry').value || null;
  const notes    = document.getElementById('csNotes').value.trim() || null;
  const err = document.getElementById('csError');
  const suc = document.getElementById('csSuccess');
  err.textContent = ''; suc.textContent = '';

  if (!name)     { err.textContent = 'Vui long nhap ho va ten.'; return; }
  if (!username) { err.textContent = 'Vui long nhap Gmail.'; return; }
  if (!password) { err.textContent = 'Vui long nhap mat khau.'; return; }

  const { error } = await db.from('students').insert({
    student_code: code || null,
    full_name: name, phone: phone || null,
    username, password,
    class_name: cls || null,
    active: true, expiry_date: expiry, notes
  });

  if (error) { err.textContent = error.message.includes('unique') ? 'Gmail nay da ton tai.' : error.message; return; }

  // Hien modal thong tin tai khoan
  document.getElementById('naName').textContent     = name;
  document.getElementById('naCode').textContent     = code || '—';
  document.getElementById('naUsername').textContent = username;
  document.getElementById('naPassword').textContent = password;
  document.getElementById('naClass').textContent    = cls || '';
  document.getElementById('naPhone').textContent    = phone || '';
  document.getElementById('newAccountModal').classList.add('open');

  // Reset form
  ['csCode','csName','csPhone','csUsername','csPassword'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('csExpiry').value = '';
  document.getElementById('csNotes').value = '';
  document.getElementById('csClassSelect').value = '';
  err.textContent = ''; suc.textContent = '';

  // Tao ma moi cho lan tiep theo
  genStudentCode().then(c => {
    document.getElementById('csCode').value = c;
    document.getElementById('csPassword').value = c;
  });

  await renderMiniStudents();
  await populateClassFilters();
});

document.getElementById('csResetBtn').addEventListener('click', () => {
  ['csCode','csName','csPhone','csUsername','csPassword'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('csExpiry').value = '';
  document.getElementById('csNotes').value = '';
  document.getElementById('csClassSelect').value = '';
  document.getElementById('csError').textContent = '';
  document.getElementById('csSuccess').textContent = '';
});

document.getElementById('goToStudentListBtn').addEventListener('click', () => showPage('students'));

// Modal thong tin tai khoan moi
document.getElementById('naCloseBtn').addEventListener('click', () => {
  document.getElementById('newAccountModal').classList.remove('open');
});
document.getElementById('naCopyBtn').addEventListener('click', () => {
  const name  = document.getElementById('naName').textContent;
  const code  = document.getElementById('naCode').textContent;
  const user  = document.getElementById('naUsername').textContent;
  const pw    = document.getElementById('naPassword').textContent;
  const cls   = document.getElementById('naClass').textContent;
  const phone = document.getElementById('naPhone').textContent;
  const text  = `Ho ten: ${name}\nMa HV: ${code}\nGmail: ${user}\nMat khau: ${pw}\nLop: ${cls}\nSDT: ${phone}`;
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.getElementById('naCopyBtn');
    btn.textContent = '✅ Đã sao chép!';
    setTimeout(() => { btn.textContent = '📋 Sao chép'; }, 2000);
  });
});
let miniPage=1; const miniPerPage=8;
async function renderMiniStudents() {
  const { data: list } = await db.from('students').select('*').order('created_at', { ascending:false });
  const tbody = document.getElementById('miniStudentBody');
  const totalPages = Math.max(1, Math.ceil((list||[]).length/miniPerPage));
  if (miniPage > totalPages) miniPage = totalPages;
  const slice = (list||[]).slice((miniPage-1)*miniPerPage, miniPage*miniPerPage);
  tbody.innerHTML = '';
  slice.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.student_code||''}</td><td>${s.full_name}</td><td>${s.phone||''}</td><td>${s.username}</td><td>${s.class_name||''}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'HD':'Khoa'}</span></td><td><button class="btn-sm" data-action="edit">&#x270F;&#xFE0F;</button></td>`;
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

    // Trạng thái học tập
    let studyStatus = '<span style="color:#22c55e;font-weight:600">✅ Đang học</span>';
    if (!s.active) {
      if (s.expiry_date && new Date(s.expiry_date) < today) {
        studyStatus = '<span style="color:#ef4444;font-weight:600">⏰ Hết hạn</span>';
      } else if (s.class_name && expiredClasses.has(s.class_name)) {
        studyStatus = '<span style="color:#ef4444;font-weight:600">🏫 Lớp kết thúc</span>';
      } else {
        studyStatus = '<span style="color:#f59e0b;font-weight:600">🔒 Đã khóa</span>';
      }
    } else if (s.is_online) {
      studyStatus = '<span style="color:#22c55e;font-weight:600">🟢 Online</span>';
    } else {
      studyStatus = '<span style="color:#94a3b8;font-weight:600">⚫ Offline</span>';
    }

    tr.innerHTML = `<td>${s.student_code||'—'}</td><td>${s.full_name}${s.notes?` <span class="muted" title="${s.notes}" style="cursor:help">📝</span>`:''}</td><td>${s.phone||'—'}</td><td>${s.username}</td><td>${s.class_name||'—'}</td><td>${s.created_at ? fmtDate(s.created_at.split('T')[0]) : '—'}</td><td><span class="status-badge ${s.active?'active':'inactive'}">${s.active?'Hoạt động':'Khóa'}</span></td><td>${studyStatus}</td><td>${actions}</td>`;
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
  // Tự động tiêu đề theo loại
  const isVideoType = fileType==='video'||(fileType||'').startsWith('video/');
  const isLinkType = fileType==='link';
  let displayTitle = title;
  if (isVideoType || isLinkType) displayTitle = 'Video bài học';
  else displayTitle = 'Tài liệu';
  document.getElementById('viewerTitle').textContent = displayTitle;
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
  const fc = document.getElementById('lessonFilterClass').value;
  let query = db.from('lessons').select('*').order('group_name',{ascending:true}).order('created_at',{ascending:false});
  if (fc) query = query.eq('class_name', fc);
  const { data: list } = await query;
  const el = document.getElementById('lessonList');
  el.innerHTML = '';
  document.getElementById('emptyLessons').style.display = (list||[]).length ? 'none' : 'block';
  if (!(list||[]).length) return;

  const ids = list.map(l => l.id);
  const [{ data: allVids }, { data: allDocs }] = await Promise.all([
    db.from('lesson_videos').select('lesson_id').in('lesson_id', ids),
    db.from('lesson_docs').select('lesson_id').in('lesson_id', ids),
  ]);
  const vcMap = {}, dcMap = {};
  (allVids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (allDocs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

  const groups = {};
  list.forEach(l => { const g = l.group_name || 'Chua phan nhom'; if (!groups[g]) groups[g] = []; groups[g].push(l); });

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

    let expanded = false;
    header.addEventListener('click', () => {
      expanded = !expanded;
      card.classList.toggle('open', expanded);
      lessonList.classList.toggle('open', expanded);
      if (expanded && !inner.dataset.loaded) {
        inner.dataset.loaded = '1';
        if (!lessons.length) { inner.innerHTML = '<div class="group-empty-msg">Chua co bai hoc nao.</div>'; return; }
        lessons.forEach((l, idx) => {
          const vc = vcMap[l.id]||0, dc = dcMap[l.id]||0;
          const item = document.createElement('div');
          item.className = 'group-lesson-item';
          const num = document.createElement('div'); num.className = 'group-lesson-num'; num.textContent = idx+1;
          const info = document.createElement('div'); info.className = 'group-lesson-info';
          info.innerHTML = `<div class="group-lesson-title"><span style="margin-right:.35rem">\uD83D\uDCDA</span>${l.name}</div><div class="group-lesson-stats"><span>\uD83C\uDFAC ${vc}</span><span>\uD83D\uDCC4 ${dc}</span>${l.class_name?`<span class="class-tag" style="font-size:.68rem">${l.class_name}</span>`:''}</div>`;
          const acts = document.createElement('div'); acts.className = 'group-lesson-item-actions';
          const openBtn = document.createElement('button'); openBtn.className = 'group-lesson-open'; openBtn.textContent = String.fromCharCode(8594);
          openBtn.addEventListener('click', e => { e.stopPropagation(); openLessonDetail(l.id); });
          const eb = document.createElement('button'); eb.className = 'btn-sm'; eb.textContent = String.fromCharCode(9999,65039);
          eb.addEventListener('click', e => { e.stopPropagation(); openLessonModal(l); });
          const db2 = document.createElement('button'); db2.className = 'btn-sm btn-danger'; db2.textContent = String.fromCharCode(128465);
          db2.addEventListener('click', e => { e.stopPropagation(); showConfirm(`Xoa bai hoc "${l.name}"?`, async () => { await db.from('lessons').delete().eq('id',l.id); renderLessons(); }); });
          acts.appendChild(openBtn); acts.appendChild(eb); acts.appendChild(db2);
          item.appendChild(num); item.appendChild(info); item.appendChild(acts);
          item.addEventListener('click', () => openLessonDetail(l.id));
          inner.appendChild(item);
        });
      }
    });

    card.appendChild(header);
    card.appendChild(lessonList);
    grid.appendChild(card);
  });
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
  populateGroupSelect('lGroupInput', l?(l.group_name||''):'');
  document.getElementById('lessonModal').classList.add('open');
}
document.getElementById('openAddLessonBtn').addEventListener('click', ()=>openLessonModal());
document.getElementById('lCancelBtn').addEventListener('click', ()=>document.getElementById('lessonModal').classList.remove('open'));
document.getElementById('lSaveBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('lNameInput').value.trim(), err=document.getElementById('lError');
  if (!name) { err.textContent='Vui lòng nhập tên bài học.'; return; }
  const cls=document.getElementById('lClassSelect').value;
  const desc=document.getElementById('lDescInput').value.trim();
  const group=document.getElementById('lGroupInput').value||null;
  if (editingLessonId) {
    await db.from('lessons').update({name,class_name:cls,description:desc,group_name:group}).eq('id',editingLessonId);
  } else {
    await db.from('lessons').insert({name,class_name:cls,description:desc,group_name:group});
  }
  document.getElementById('lessonModal').classList.remove('open');
  await renderLessons();
});

async function openLessonDetail(id) {
  currentLessonId = id;
  document.getElementById('lessonListView').style.display = 'none';
  document.getElementById('lessonDetailView').style.display = '';
  document.getElementById('lessonDetailTitle').textContent = '...';
  document.getElementById('lessonDetailDesc').textContent  = '';

  // Load song song
  const [{ data:l }] = await Promise.all([
    db.from('lessons').select('*').eq('id',id).single(),
  ]);
  if (!l) return;
  document.getElementById('lessonDetailTitle').textContent = l.name;
  document.getElementById('lessonDetailDesc').textContent  = l.description||'';

  // Render video và doc song song
  await Promise.all([renderLessonVideos(id), renderLessonDocs(id)]);
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
      card.innerHTML=`<div class="video-thumb"><video src="${url}" preload="none"></video><span class="play-btn">▶</span></div><div class="video-info"><div class="video-title">${v.title}</div><button class="btn-sm btn-danger del-btn">🗑 Xóa</button></div>`;
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
    row.addEventListener('click', e=>{ if(!e.target.closest('.row-actions')) openViewer(isHandwritten?'Bản viết tay':d.title, url, d.file_name, (isLink||isHandwritten)?'link':d.file_type); });
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
  pendingLessonVideoFile = null;
  document.getElementById('lessonPreviewVideo').src = '';
  document.getElementById('lessonVideoFileInput').value = '';
  document.getElementById('lvLinkInput').value = '';
  document.getElementById('lvLinkPreview').innerHTML = '';
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

// Preview khi nhập link — bỏ qua vì textarea nhiều dòng
document.getElementById('lvLinkInput').addEventListener('input', () => {});

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
  const isLinkTab = document.getElementById('tabVideoLink').classList.contains('active');
  const title = 'Video bài học';
  const btn = document.getElementById('lvSaveBtn');
  btn.textContent = 'Đang lưu...'; btn.disabled = true;

  if (isLinkTab) {
    const raw = document.getElementById('lvLinkInput').value.trim();
    if (!raw) { btn.textContent = 'Lưu'; btn.disabled = false; return; }
    const links = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    for (const url of links) {
      await db.from('lesson_videos').insert({ lesson_id: currentLessonId, title, video_url: url, storage_path: null, file_name: null });
    }
  } else {
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
  const isLinkTab = document.getElementById('tabDocLink').classList.contains('active');
  const isHandwrittenTab = document.getElementById('tabDocHandwritten').classList.contains('active');
  // Tự động tiêu đề theo loại
  const title = isHandwrittenTab ? 'Bản viết tay' : isLinkTab ? 'Tài liệu' : (pendingLessonDocFile?.name.replace(/\.[^.]+$/,'') || 'Tài liệu');
  const btn = document.getElementById('ldSaveBtn');
  btn.textContent='Đang lưu...'; btn.disabled=true;

  if (isHandwrittenTab) {
    // Tab viết tay riêng (không dùng nữa nhưng giữ tương thích)
    const raw = document.getElementById('ldHandwrittenInput').value.trim();
    if (!raw) { btn.textContent='Tải lên'; btn.disabled=false; return; }
    const links = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    for (let i=0; i<links.length; i++) {
      const url = links[i];
      const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      const docUrl = gdMatch ? `https://drive.google.com/file/d/${gdMatch[1]}/preview` : url;
      const t = links.length > 1 ? `Bản viết tay ${i+1}` : 'Bản viết tay';
      await db.from('lesson_docs').insert({lesson_id:currentLessonId, title:t, file_name:null, file_type:'handwritten', storage_path:null, doc_url:docUrl});
    }
  } else if (isLinkTab) {
    // Tab tài liệu: lưu cả tài liệu + viết tay cùng lúc
    const rawDoc = document.getElementById('ldLinkInput').value.trim();
    const rawHw  = document.getElementById('ldHandwrittenInput').value.trim();
    if (!rawDoc && !rawHw) { btn.textContent='Tải lên'; btn.disabled=false; return; }
    const docLinks = rawDoc ? rawDoc.split('\n').map(l=>l.trim()).filter(Boolean) : [];
    for (let i=0; i<docLinks.length; i++) {
      const url = docLinks[i];
      const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      const docUrl = gdMatch ? `https://drive.google.com/file/d/${gdMatch[1]}/preview` : url;
      const t = docLinks.length > 1 ? `Tài liệu ${i+1}` : 'Tài liệu';
      await db.from('lesson_docs').insert({lesson_id:currentLessonId, title:t, file_name:null, file_type:'link', storage_path:null, doc_url:docUrl});
    }
    const hwLinks = rawHw ? rawHw.split('\n').map(l=>l.trim()).filter(Boolean) : [];
    for (let i=0; i<hwLinks.length; i++) {
      const url = hwLinks[i];
      const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      const docUrl = gdMatch ? `https://drive.google.com/file/d/${gdMatch[1]}/preview` : url;
      const t = hwLinks.length > 1 ? `Bản viết tay ${i+1}` : 'Bản viết tay';
      await db.from('lesson_docs').insert({lesson_id:currentLessonId, title:t, file_name:null, file_type:'handwritten', storage_path:null, doc_url:docUrl});
    }
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

// ============================================================
// THỐNG KÊ TRUY CẬP
// ============================================================
async function renderAccessStats() {
  const cls   = document.getElementById('accessFilterClass').value;
  const type  = document.getElementById('accessFilterType').value;
  const search = (document.getElementById('accessSearch').value||'').toLowerCase();

  let query = db.from('access_logs').select('*').order('accessed_at', {ascending: false});
  if (cls)  query = query.eq('class_name', cls);
  if (type) query = query.eq('content_type', type);
  const { data: logs } = await query;
  const all = logs || [];

  // Stat tổng
  const totalViews   = all.length;
  const uniqueUsers  = new Set(all.map(l => l.username)).size;
  const videoViews   = all.filter(l => l.content_type === 'video').length;
  const docViews     = all.filter(l => l.content_type === 'doc').length;

  document.getElementById('accessStatGrid').innerHTML = `
    <div class="stat-card blue"><div class="stat-icon">👁</div><div><div class="stat-num">${totalViews}</div><div class="stat-label">Tổng lượt xem</div></div></div>
    <div class="stat-card green"><div class="stat-icon">👨‍🎓</div><div><div class="stat-num">${uniqueUsers}</div><div class="stat-label">Học sinh đã truy cập</div></div></div>
    <div class="stat-card purple"><div class="stat-icon">🎬</div><div><div class="stat-num">${videoViews}</div><div class="stat-label">Lượt xem video</div></div></div>
  `;

  // Top bài học
  const lessonCount = {};
  all.forEach(l => { lessonCount[l.lesson_name] = (lessonCount[l.lesson_name]||0)+1; });
  const topLessons = Object.entries(lessonCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const tlEl = document.getElementById('topLessons');
  tlEl.innerHTML = topLessons.length ? topLessons.map(([name, cnt], i) => `
    <div class="list-row">
      <span style="width:22px;height:22px;background:var(--primary-light);color:var(--primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex-shrink:0">${i+1}</span>
      <div class="list-info" style="flex:1;min-width:0"><div class="list-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div></div>
      <span class="group-card-count" style="background:var(--primary-light);color:var(--primary);padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:700">${cnt} lượt</span>
    </div>`).join('') : '<p class="muted-sm">Chưa có dữ liệu.</p>';

  // Top học sinh
  const studentCount = {};
  all.forEach(l => { if (!studentCount[l.username]) studentCount[l.username] = { name: l.student_name, cls: l.class_name, cnt: 0 }; studentCount[l.username].cnt++; });
  const topStudents = Object.values(studentCount).sort((a,b)=>b.cnt-a.cnt).slice(0,8);
  const tsEl = document.getElementById('topStudents');
  tsEl.innerHTML = topStudents.length ? topStudents.map((s, i) => `
    <div class="list-row">
      <span style="width:22px;height:22px;background:var(--primary-light);color:var(--primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex-shrink:0">${i+1}</span>
      <div class="list-info" style="flex:1"><div class="list-title">${s.name}</div><div class="list-meta">${s.cls||'—'}</div></div>
      <span class="group-card-count" style="background:var(--success);color:#fff;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:700">${s.cnt} lượt</span>
    </div>`).join('') : '<p class="muted-sm">Chưa có dữ liệu.</p>';

  // Log chi tiết
  const filtered = search ? all.filter(l => (l.student_name||'').toLowerCase().includes(search) || (l.username||'').toLowerCase().includes(search)) : all;
  const logEl = document.getElementById('accessLogList');
  document.getElementById('emptyAccessLog').style.display = filtered.length ? 'none' : 'block';
  logEl.innerHTML = filtered.slice(0, 100).map(l => {
    const icon = l.content_type === 'video' ? '🎬' : '📄';
    const time = new Date(l.accessed_at).toLocaleString('vi-VN');
    return `<div class="list-row">
      <span class="list-icon">${icon}</span>
      <div class="list-info" style="flex:1">
        <div class="list-title">${l.student_name} <span class="muted" style="font-weight:400">— ${l.content_title}</span></div>
        <div class="list-meta">${l.lesson_name||''} ${l.class_name?`• <span class="class-tag">${l.class_name}</span>`:''} • ${time}</div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('accessFilterClass').addEventListener('change', renderAccessStats);
document.getElementById('accessFilterType').addEventListener('change', renderAccessStats);
document.getElementById('accessSearch').addEventListener('input', renderAccessStats);

document.getElementById('exportAccessBtn').addEventListener('click', async () => {
  const { data: logs } = await db.from('access_logs').select('*').order('accessed_at', {ascending: false});
  if (!logs?.length) { alert('Chưa có dữ liệu.'); return; }
  const rows = [['Thời gian','Học sinh','Gmail','Lớp','Bài học','Nội dung','Loại']];
  logs.forEach(l => rows.push([
    new Date(l.accessed_at).toLocaleString('vi-VN'),
    l.student_name||'', l.username||'', l.class_name||'',
    l.lesson_name||'', l.content_title||'', l.content_type||''
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `thong_ke_truy_cap_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
});











