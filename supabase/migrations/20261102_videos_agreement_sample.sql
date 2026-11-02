-- A fixed subset labelled by two annotators, so agreement can be measured
-- without double-labelling the whole dataset. Stored rather than derived so it
-- does not shift when videos are imported later.
--
-- Hash order gives a random-looking, reproducible pick. 15% is a common rule of
-- thumb. The excluded Facebook clip is 114 MB, which Drive answers with its
-- virus-scan page instead of the video, so it could never produce a pair.

alter table public.videos
  add column if not exists agreement_sample boolean not null default false;

update public.videos set agreement_sample = true
 where id in (
   select id from public.videos
    where status = 'active'
      and filename <> 'fb_ca1ee5326f08417c8193d7bab278891a_full_t01.mp4'
    order by md5(drive_file_id)
    limit 224
 );
