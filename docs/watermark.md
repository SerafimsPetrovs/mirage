# Video watermarks

Two layers (2026-11-07):

1. **Visible:** a faint `MIRAGE · <viewer tag>` drifting between corners of the player (deters screen recording, easy to crop — not the real protection).
2. **Invisible forensic A/B watermark** (session-based, the approach used by commercial DRM vendors):
   - `prepareWatermark(sourceRef)` (`src/lib/watermark.ts`) encodes the source twice with ffmpeg — variant **A** with `+2.5·sin·sin` luma pattern, **B** with `−2.5·sin·sin` — as HLS with fixed 2-second GOPs, so segment *n* of A and B cover exactly the same frames. Stored in `storage/wm/<hash>/{A,B}/`. One package per source file (`WatermarkAsset`), shared by episodes using the same file.
   - Each signed-in viewer gets a per-asset code 1…65535 (`WatermarkSession`). Payload = 16 code bits + CRC-4, repeated over the episode; bit *k* of segment *n* picks A (0) or B (1) — `variantFor` in `src/lib/watermark-rules.ts`. Guests get code 0 (all A).
   - `/api/hls/[episodeId]` returns the personal playlist; every segment link is `/api/hls/[id]/seg?t=<n.code.uid.exp.hmac>` — HMAC (WATERMARK_SECRET or SESSION_SECRET), bound to the viewer, 6 h. The server picks the variant; the viewer can't.
   - When a package is READY, `/api/stream` refuses the plain mp4 to everyone except the owner/admin (skins still stream as mp4).
   - **Detection** (`/admin/watermark`): upload the leaked file + episode → `detectLeak` grabs one 48×48 grayscale frame per segment from the leak, A and B, correlates `(leak − mid)` with `(B − A)` after brightness/contrast matching, votes the repeated bits and checks the CRC → viewer.
   - Survives re-encoding, downscaling (tested at 360p, CRF 28, +3 % brightness). Needs ≥ 40 s from the start (20 segments). Not robust (yet) to: trimming the start by more than ~1 s, cropping, mirroring, speed change, collusion of 2+ accounts mixing segments. Possible next steps: offset search, more payload repeats + error-correcting code, per-segment pattern variety.

Cost: about 3 CPU minutes per minute of video (two `geq` encodes), double storage. New episodes are encoded in the background (`after()` in studio actions); "Protect the rest" in the admin page backfills. For production move encoding to a worker/GPU box.

Tests: `src/lib/watermark.db.test.ts` (rules, token signing, real-ffmpeg leak → viewer).
