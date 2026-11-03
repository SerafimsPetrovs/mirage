# AI video generation (creator studio)

Page: `/studio/generate` (CREATOR / ADMIN). Status: **mock provider** — the UI, queue, credits and
"add as episode" flow are real; the video itself is a demo clip from `media/demo/`.

## How it works now
- `GenerationJob` (Prisma) stores prompt, style, orientation, duration, seed, cost, status.
- `User.genCredits` — separate from viewer coins. Starter pack: 100 (schema default). Cost: 2 credits per output second (`src/lib/generation.ts`).
- `startGenerationAction` checks the prompt, atomically debits credits (`updateMany … genCredits >= cost`) and creates a job.
- `listGenerationsAction` advances mock jobs by elapsed time (`mockState`: ~3 s queue + 3 s per output second) and sets `resultUrl = demo:<clip>.mp4` on completion. The client polls every 1.2 s while any job is open.
- Preview: `/api/studio/generations/[id]/video` (owner only, Range support).
- `addGenerationToSeriesAction` appends the clip as the next episode of the creator's series.

## Content policy
Generation has no external filter. `checkPrompt` hard-blocks sexual content involving minors
(RU/EN keyword heuristics) — a floor, not full moderation. Published series still go through
admin moderation. Adult (18+) content needs age verification and a payment provider that allows it
before being enabled publicly.

## Plugging in a real model (ComfyUI + Wan 2.x / LTX-Video)
1. Run ComfyUI on a GPU box (local RTX 12–24 GB or rented RunPod/Vast) with a Wan/LTX text-to-video workflow; export the workflow in API format.
2. Add a provider `comfy` alongside `mock`: on start, POST the workflow (prompt/seed/size/frames substituted) to `COMFY_URL/prompt`, store the returned `prompt_id` on the job, `provider = "comfy"`.
3. Replace `syncMockJobs` for comfy jobs with polling `COMFY_URL/history/<prompt_id>`; on success download the output into `storage/videos/gen/<jobId>.mp4` and set `resultUrl = storage:videos/gen/<jobId>.mp4`; on failure set `FAILED` and refund `cost` credits in the same transaction.
4. For production move polling to a worker (queue) instead of request-time sync.

GTX 1070 (8 GB) can only run LTX-Video / Wan 1.3B in reduced precision, very slowly — use a rented GPU for anything beyond experiments.
