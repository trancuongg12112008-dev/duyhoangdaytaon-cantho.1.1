-- Chạy file này trong Supabase SQL Editor

-- Bảng lớp học
create table if not exists classes (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz default now()
);

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
  created_at   timestamptz default now()
);

-- Bảng bài học
create table if not exists lessons (
  id         bigint generated always as identity primary key,
  name       text not null,
  class_name text,
  description text,
  created_at timestamptz default now()
);

-- Bảng video trong bài học
create table if not exists lesson_videos (
  id         bigint generated always as identity primary key,
  lesson_id  bigint references lessons(id) on delete cascade,
  title      text not null,
  file_name  text,
  storage_path text,
  created_at timestamptz default now()
);

-- Bảng tài liệu trong bài học
create table if not exists lesson_docs (
  id           bigint generated always as identity primary key,
  lesson_id    bigint references lessons(id) on delete cascade,
  title        text not null,
  file_name    text,
  file_type    text,
  storage_path text,
  created_at   timestamptz default now()
);

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
