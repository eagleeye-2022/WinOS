# Prompt: Replace DSR with "Reporting" (end-of-day report + screen/camera recording + Zoho Cliq)

## Context

We are stopping the separate end-of-day **DSR** (Daily Status Review). The end-of-day check-in becomes
a **Report**: a mostly auto-filled summary of the day plus a **screen recording with the camera on**,
which gets posted to **Zoho Cliq**. The morning **DSM stays exactly as it is.**

Before writing code, read `CLAUDE.md`, `AGENTS.md` (this Next.js version has breaking changes, so check
`node_modules/next/dist/docs/` before using any Next API) and these files:

- DSR today: `src/features/dsr/` (`actions/save-dsr.ts`, `components/dsr-form.tsx`, `queries.ts`,
  `manager/*`), routes `src/app/(dashboard)/dsr/{page,my,manage,member/[userId]}`, models `DsrEntry` and
  its child models in `prisma/schema.prisma`.
- DSM (do not change its behaviour): `src/features/dsm/` (`save-dsm.ts` is the canonical Server Action
  pattern, `queries.ts` already reads `projectTimeLog`, `components/task-audit-history-popover.tsx`,
  `actions/add-task-after-review.ts`, `actions/parking-lot.ts`).
- Project tasks and time: `ProjectTask`, `ProjectTaskActivity`, `ProjectTimeLog`, `ActiveTimer` models;
  `StandupTask.projectTaskId` links DSM tasks to project tasks.
- Zoho: `src/lib/zoho-calendar.ts`, `src/app/api/auth/zoho/login/route.ts` (the OAuth scope today is
  only `ZohoCalendar.calendar.ALL,ZohoCalendar.event.ALL`), `ZohoAccount` model, and the
  `ZOHO_ACCOUNTS_DOMAIN` / `ZOHO_API_DOMAIN` env vars (we are on the `.in` data centre).
- Navigation: `src/constants/routes.ts` and `src/components/shared/app-sidebar.tsx` (lines ~57–70 and
  ~246–257).
- Uploads: `src/app/api/upload/route.ts`, `src/app/api/uploads/*`.

## Requirements from the meeting

### 1. Navigation and naming
- Manager sidebar: **All DSM** and **My DSM** stay. **All DSR → All Reports**, **My DSR → My Report**.
- Team-member sidebar: **DSR → Report**.
- Add `/report`, `/report/my`, `/report/all` and `/report/member/[userId]` (with matching `ROUTES`
  entries). Redirect the old `/dsr*` URLs to the new ones. Keep the `isActive` logic in the sidebar
  correct.
- Do **not** delete the DSR tables or the old data. Old DSR entries must stay readable in history.

### 2. The Report page (member side): auto-filled, not typed again
The report continues from that day's DSM, so the member mostly reviews it instead of retyping it.
- **Today's tasks** come from the DSM, including tasks added after the DSM review (`addedAfterReview`) and
  tasks linked to project tasks. Show the status (done or not done) and, for project-linked tasks, the
  project / phase / task code.
- **Time logs per task**: show the `ProjectTimeLog` minutes logged today next to each task, plus a
  total for the day. Count a running `ActiveTimer` as "running" rather than ignoring it. Tasks that have
  time logged today but are not in the DSM appear as **extra tasks**.
- **"When was it added"**: each task shows when it was added and who added it (DSM vs. after review vs.
  project), using the existing audit/activity data (`StandupTask.createdAt`/`addedById`,
  `ProjectTaskActivity`). Reuse `task-audit-history-popover.tsx`.
- Keep these sections as they work today: **Additional / extra work, resolved blockers, follow-ups
  done, "What will you learn today" (learning items), Parking lot**, and **Outcome of the day**. Since
  the DSM and project data already cover most of this, prefill everything that can be prefilled.
- Keep the current rules: the DSM must be reviewed before the report can be filled in; a REVIEWED report
  cannot be edited by the member; editing after submitting goes back to PENDING_REVIEW (never to DRAFT).
- Keep the current sync of report ticks back onto the DSM tasks, blockers and support needs, but
  match by `projectTaskId`/id where one exists instead of only by text.

### 3. Submit flow: a modal with a recording step
Clicking **Submit Report** opens a modal with these steps, in order:
1. **Record your screen with the camera on.** The member walks through their day on screen while
   their camera is visible. Show the walkthrough prompts on screen while they record:
   1. What did you work on today? Show it on screen.
   2. What technique or approach did you use, and why? (For example: "which SQL / which pattern did you
      use", not just "I fixed it".)
   3. What is blocked or pending, and what do you need?
   4. How was the day? Any feedback or suggestions?
2. **Recording link.** The member pastes the link to the recording (posted in Zoho Cliq). **Submit stays
   disabled until a valid link is pasted.** Validate the URL format and allow-list the domains we accept
   (Zoho Cliq / WorkDrive and any others we confirm).
3. **How was the day? / Feedback or suggestions**: short text fields (this replaces the old
   sentiment/reflection fields; keep the sentiment toggle if it's cheap).
4. **Confirm and submit.**

Recording implementation: build an in-app recorder that captures `getDisplayMedia` (screen) plus
`getUserMedia` (camera and microphone), draws the camera as a picture-in-picture bubble on a canvas and
records it with `MediaRecorder`. Recording with the camera on is required: refuse to start if camera
permission is denied. When recording stops, either (a) upload it through our upload route and use the
returned URL as the link, or (b) let the member download it and post it to Cliq themselves, then paste
the link. Implement (b) first; put (a) behind a flag. Show the elapsed time and a stop button, and keep
the prompts visible while recording.

### 4. Zoho Cliq posting
- On submit, post a message to the team's Zoho Cliq channel with the member's name, date, completed /
  total tasks, total time logged, outcome of the day, the recording link and a link back to
  `/report/member/[userId]?date=...`.
- Use a Cliq **incoming webhook** for the channel (`https://cliq.zoho.in/api/v2/channelsbyname/<channel>/message?zapikey=...`),
  configured through env vars (`ZOHO_CLIQ_WEBHOOK_URL`, `ZOHO_CLIQ_CHANNEL`). Do not add Cliq scopes to the
  per-user calendar OAuth unless the webhook approach turns out to be impossible.
- Put this in `src/lib/zoho-cliq.ts`. Posting must be best-effort: if it fails, the report is still
  saved. Store `cliqPostedAt` / `cliqError` so a manager can see and retry it.
- When `ZOHO_CLIQ_WEBHOOK_URL` is unset, log the payload to the server console (same pattern as OTP
  without SMTP) so local development works.

### 5. Cut-off time
- The report cut-off is **6:00 PM IST**. Make it a single constant/env value (`REPORT_CUTOFF_HHMM`).
- After the cut-off a report can still be submitted, but it is marked **Late** and shown as Late in the
  manager views and in the Cliq message.
- Add a reminder on the existing send-reminders mechanism (`src/features/dsm/manager/components/send-reminders-button.tsx`)
  for members who have not submitted by about 5:30 PM.

### 6. Manager side: All Reports and member review
- **All Reports** (`/report/all`) replaces All DSR and works like All DSM: team columns, stats,
  submitted / pending / late / reviewed.
- Each member card shows a compact summary: outcome of the day, completed / total tasks, time logged,
  extra tasks, external work and meetings, and a recording badge (link present / missing).
- **View More opens the full report in a new tab** (`/report/member/[userId]?date=...`, with
  `target="_blank"`). Do not expand it inline in this tab. Add the same **View More → new tab** behaviour to
  the All DSM cards.
- On the member report page, the recording link is shown prominently ("Watch recording"). The manager
  can add a review comment and mark the report Reviewed (reuse the `review-dsr.ts` logic). Reviews happen
  in the evening or the next morning, so the page must work for previous dates.
- Add a "recordings to review" filter (submitted, has a recording, not yet reviewed).

### 7. Data model
- Prefer **extending `DsrEntry`** over creating a parallel model, so history and the existing
  child tables keep working. Add: `recordingUrl String?`, `dayFeedback String?`, `suggestions String?`,
  `isLate Boolean @default(false)`, `cliqPostedAt DateTime?`, `cliqError String?`,
  `totalLoggedMinutes Int @default(0)`. Rename only in the UI ("Report"), not in the database.
- Follow the project's conventions: `const d = db as any`, re-query the `User` row before writing, and
  delete-then-recreate child rows. Wrap the new report save in `db.$transaction` if you can do it without
  touching unrelated code.
- Use `npx prisma db push && npx prisma generate` (the project uses `db push`, not migrations).

### 8. Permissions
- Members see only their own report. Managers (`role === "MANAGER"`) see All Reports. If the
  `PermissionModule` matrix (`src/features/users/permission-config.ts`) has a DSR module, add or rename
  a "Reporting" module with the same actions and keep both role systems consistent.

## Non-goals
- No changes to how the DSM is filled in, reviewed or stored.
- No video hosting/transcoding pipeline. We store a link, not the video.
- No AI summarisation of the recording (for now).

## Done when
- `npm run lint`, `npm run test` and `npm run build` pass.
- Unit tests cover: the report prefill query (DSM tasks + after-review tasks + time logs + extra tasks),
  the cut-off/late calculation in IST, Cliq payload building (with the webhook mocked), and "submit is
  rejected without a valid recording link".
- Manually verified locally: a member fills in the DSM, gets it reviewed, logs time on a project task,
  opens Report (everything is prefilled), records with the camera on, pastes the link and submits (the
  Cliq payload appears in the console). The manager sees the report in All Reports, View More opens a new
  tab, and the manager reviews it.
- The old `/dsr` URLs redirect, and old DSR entries are still visible in history.

## Open questions (use the default unless told otherwise, and list them in the PR)
1. Where does the recording live: recorded in-app and uploaded to us, or recorded with Cliq's own
   recorder and the link pasted? **Default: in-app recorder + manual Cliq post + pasted link.**
2. Is the recording mandatory every day, or can a manager waive it (leave, half-day)? **Default:
   mandatory; manager can mark "recording waived".**
3. Which Cliq channel: one shared channel or one per team (`Team` model)? **Default: one channel, with
   an optional per-team override.**
4. Cut-off: is 6:00 PM a hard block or just a Late flag? **Default: Late flag only.**
