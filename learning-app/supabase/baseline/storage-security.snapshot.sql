-- PHASE 0A READ-ONLY SNAPSHOT — DO NOT APPLY AS A MIGRATION.
-- Captured from project qtcpjcaoptdunuefwvgc on 2026-08-20.
-- This file represents existing policies; it did not create or change them.

-- Bucket: learning-profile-media
-- private; 5 MiB; image/jpeg, image/png, image/webp
-- Path convention: <auth.uid()>/<avatars|covers>/<uuid>.<extension>

create policy "learning_profile_media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'learning-profile-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "learning_profile_media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-profile-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "learning_profile_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'learning-profile-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'learning-profile-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "learning_profile_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-profile-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Bucket: learning-course-video-covers
-- private; 1 MiB; image/jpeg, image/webp
-- Path convention: <instructor uuid>/<course id>/course-video-cover

create policy "learning_course_video_cover_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'learning-course-video-covers'
    and public.can_read_learning_course_video_cover(name));

create policy "learning_course_video_cover_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-course-video-covers'
    and public.can_manage_learning_course_video_cover(name));

create policy "learning_course_video_cover_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'learning-course-video-covers'
    and public.can_manage_learning_course_video_cover(name))
  with check (bucket_id = 'learning-course-video-covers'
    and public.can_manage_learning_course_video_cover(name));

create policy "learning_course_video_cover_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-course-video-covers'
    and public.can_manage_learning_course_video_cover(name));
