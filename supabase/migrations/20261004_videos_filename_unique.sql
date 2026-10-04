-- `filename` becomes an identity, not just a label.
--
-- The local pipeline knows a clip only by its filename: pipeline.db and
-- finished/ have never heard of a Supabase UUID or a Drive file id, and
-- neither of those exists until after the row is inserted and the bytes are
-- uploaded. So filename is the one key both sides can agree on before any
-- import happens, which makes it the join key for the bulk CSV flow
-- (videos.csv, then the merged QA + label CSV). A join key has to be unique or
-- the lookup silently picks a row at random, so the constraint is what makes
-- that design safe rather than merely convenient.
--
-- Verified empty of duplicates before adding; the constraint brings its own
-- unique index, which is also what the filename -> video_id lookup needs.

alter table public.videos
  add constraint videos_filename_key unique (filename);

-- Three indexes were answering the same question. video_drafts already has
-- UNIQUE (video_id, qgroup), and Postgres can serve `where video_id = ?` from
-- that index's leading column, so both single-column copies are dead weight:
-- they cost a write on every draft insert and buy nothing. At nine rows per
-- video and ~1400 videos that is ~12600 rows paying twice over.
--
--   video_drafts_video_id_qgroup_key   UNIQUE (video_id, qgroup)  <- keep
--   video_drafts_video_idx             (video_id)                 <- redundant
--   video_drafts_video_count_idx       (video_id)                 <- redundant
drop index if exists public.video_drafts_video_count_idx;
drop index if exists public.video_drafts_video_idx;
