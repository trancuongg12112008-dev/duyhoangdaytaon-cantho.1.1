-- Chạy file này trong Supabase SQL Editor

-- Bảng lớp học
create table if not exists classes (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  start_date date default null,   -- Ngày khai giảng
  end_date   date default null,   -- Ngày kết thúc
  created_at timestamptz default now()
);

-- Chạy lệnh này nếu bảng đã tồn tại (migration):
-- alter table classes add column if not exists start_date date default null;
-- alter table classes add column if not exists end_date date default null;

-- Bảng học sinh
create table if not exists students (
  id           bigint generated always as identity primary key,
  student_code text,
  full_name    text not null,
  phone        text,
  username     text not null unique,
  password     text not null,
  class_name   text,
  active       boolean default true,
  expiry_date  date default null,        -- Ngày hết hạn tài khoản (null = không giới hạn)
  notes        text default null,        -- Ghi chú riêng cho học viên
  manually_unlocked boolean default false, -- Admin mở thủ công, bỏ qua kiểm tra lớp hết hạn
  is_online    boolean default false,       -- Đang online hay không
  last_seen    timestamptz default null,    -- Lần cuối hoạt động
  created_at   timestamptz default now()
);

-- Chạy lệnh này nếu bảng đã tồn tại (migration):
-- alter table students add column if not exists expiry_date date default null;
-- alter table students add column if not exists notes text default null;

-- Bảng nhóm bài học
create table if not exists lesson_groups (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  class_name text,
  created_at timestamptz default now()
);
alter table lesson_groups disable row level security;

-- Bảng bài học
create table if not exists lessons (
  id           bigint generated always as identity primary key,
  name         text not null,
  class_name   text,
  description  text,
  group_name   text default null,
  created_at   timestamptz default now()
);

-- Migration nếu bảng đã tồn tại:
-- alter table lessons add column if not exists group_name text default null;
-- create table if not exists lesson_groups (id bigint generated always as identity primary key, name text not null unique, class_name text, created_at timestamptz default now());
-- alter table lesson_groups disable row level security;

-- Bảng video trong bài học
create table if not exists lesson_videos (
  id         bigint generated always as identity primary key,
  lesson_id  bigint references lessons(id) on delete cascade,
  title      text not null,
  file_name  text,
  storage_path text,
  video_url  text default null,   -- Link video (YouTube, Drive, MP4...)
  created_at timestamptz default now()
);

-- Migration nếu bảng đã tồn tại:
-- alter table lesson_videos add column if not exists video_url text default null;

-- Bảng tài liệu trong bài học
create table if not exists lesson_docs (
  id           bigint generated always as identity primary key,
  lesson_id    bigint references lessons(id) on delete cascade,
  title        text not null,
  file_name    text,
  file_type    text,
  storage_path text,
  doc_url      text default null,   -- Link tài liệu (Google Drive, PDF...)
  created_at   timestamptz default now()
);

-- Migration nếu bảng đã tồn tại:
-- alter table lesson_docs add column if not exists doc_url text default null;

-- Bảng cảnh báo
create table if not exists alerts (
  id           bigint generated always as identity primary key,
  username     text,
  student_name text,
  class_name   text,
  reason       text,
  created_at   timestamptz default now()
);

-- Tắt RLS (dùng anon key trực tiếp từ frontend)
alter table classes      disable row level security;
alter table students     disable row level security;
alter table lessons      disable row level security;
alter table lesson_videos disable row level security;
alter table lesson_docs  disable row level security;
alter table alerts       disable row level security;

-- Tạo storage bucket cho file video và tài liệu
insert into storage.buckets (id, name, public)
values ('lessons', 'lessons', true)
on conflict do nothing;

-- Policy cho phép upload/download public
create policy "Public Access" on storage.objects
  for all using (bucket_id = 'lessons');

-- Bảng nhật ký truy cập tài liệu/video
create table if not exists access_logs (
  id           bigint generated always as identity primary key,
  username     text not null,
  student_name text,
  class_name   text,
  lesson_id    bigint,
  lesson_name  text,
  content_id   bigint,
  content_title text,
  content_type text,   -- 'video' | 'doc'
  accessed_at  timestamptz default now()
);
alter table access_logs disable row level security;
