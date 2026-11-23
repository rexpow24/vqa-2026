# Architecture

- `codebook/E.v6.json` (+ byte copy in `frontend/src/lib/codebook/`, registered in `index.ts`): E.v5 cells minus colours, templates without colour.
- `compose.ts` `entityPhrase`: reads a colour only if the current book defines that cell.
- `form.ts` `entityCells` / `entityProblems`: colour cells shown and required only when the book has them.
- Entities route: drops cells the current book does not define before compose and RPC.
- Migration `20261123120000_e_v6_no_colors.sql`: seeds E.v6, adds the E.v6 branch of `validate_video_entity` (car needs dashcam; only cars take dashcam).
- `iaa_round.py`: E.v6 dashcam-only conditional scoring.
