# המתכננת שלי · Personal Life Planner

A Hebrew (RTL), mobile-first Progressive Web App for planning a whole life by the hour: calendar, daily planner, university, tasks, goals and dreams. It runs fully offline and stores everything on the device.

## Features

- **Dashboard**: today's date (Gregorian and Hebrew), a rotating motivational line, progress ring, now/next block, smart alerts, priorities, tasks, countdowns, deadlines, habit tracker, weekly planned-vs-actual hours and goal rings.
- **Month view**: Sunday-first grid with no end date, Hebrew dates, colored category dots, deadline flags and internal targets. Tap a day to open it; swipe or use the month/year pickers to move around.
- **Week view**: an hourly timetable. Drag blocks to move them (long-press on touch), including between days. Drag the bottom handle to resize, or use Alt+↑/↓ (Shift to resize). Each week has its own work pattern: regular (Mon–Wed), Zoom-Monday (Tue–Thu) or custom.
- **Day view**: timeline or list, a checklist, 3 priorities, notes and reflection, and estimated vs actual time. Also "work ran late" and "move unfinished" actions.
- **Blocks**: add, edit, complete (with actual minutes), duplicate, split, merge, move to tomorrow or delete. Recurring series can be edited or deleted for *this occurrence*, *from here on* or *all*.
- **Smart weekly planner**: fills deep-focus slots by deadline urgency. It schedules material catch-up first, then long uninterrupted assignment sittings, then weighted course and exam study. Career slots rotate topics. Every change is previewed for approval, and blocks you edited by hand are never overwritten.
- **Alerts**: overlaps, blocks past bedtime, insufficient sleep window, deadlines at risk (planned vs remaining hours), crowded deadlines, and days with too many tasks for the free time.
- **University**: courses, lecture progress, weekly hours, assignments with statuses (submitted / partial / extended / skipped, with a warning), internal targets, grades and exams.
- **Tasks**: unlimited tasks with subtasks, priorities, estimates, deadlines, notes and recurrence (daily, weekly, every N weeks, monthly, by day type). One tap schedules a task into the first free slot.
- **Goals and dreams**: outcome, why, ordered action steps, dated milestones, progress, linked calendar categories, weekly hours and a driving-lesson tracker. Long-term dreams are kept out of the daily grid.
- **Export as image**: "הורדת הלוח של מחר" renders a designed 1080×1920 PNG on Canvas. It includes the date, Hebrew date, quote, schedule, priorities, tasks and deadlines. Long days split into several images. You can share through the iPhone share sheet (Save Image / WhatsApp), copy or download. Any day can be exported.
- **Settings**: daily rhythm (wake, sleep, work, commute and exercise, synced into the templates), week patterns, editable templates per day type, categories and colors, weekly target hours, planner weights, habits, personal quotes, light/dark theme and JSON backup/restore.

## Tech

Plain HTML, CSS and ES modules with no build step and no dependencies.

- Data is one JSON document in **IndexedDB**, with a localStorage fallback. Changes are debounced and flushed on page hide.
- A **service worker** precaches the app shell for offline use and caches Google Fonts at runtime.
- **Dates** are wall-clock `YYYY-MM-DD` / `HH:MM` strings. "Today" and "now" are computed in `Asia/Jerusalem` via `Intl`, and date arithmetic uses UTC midnights, so daylight-saving changes never shift a block.

```
index.html, manifest.webmanifest, sw.js, icons/, css/app.css
js/main.js        shell, router, boot
js/store.js       state, undo, persistence     js/db.js     IndexedDB
js/engine.js      recurrence, conflicts, alerts, planner, rescheduling
js/editors.js     sheets and dialogs           js/timegrid.js  drag/resize grid
js/export.js      Canvas PNG export            js/views/*   screens
js/seed.js        neutral starter data
```

## Personal data

The public repo ships with neutral starter data only. Your own data lives in a backup JSON file that is **not** committed: `private/` and `js/seed-personal.js` are git-ignored. To load it, open the app, go to **הגדרות → ייבוא גיבוי** and pick the file.

Data stays on each device and does **not** sync between devices. To move it, export a backup on one device and import it on the other. Real sync would need a backend. Everything is a single JSON document with an `updatedAt` stamp, so a future Supabase table with Row Level Security and email login would be straightforward. Never put secret keys (service-role keys, Claude or Gemini API keys) in this frontend.

## Run locally

```bash
python -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

A service worker needs `http://localhost` or HTTPS; it won't work from `file://`.

## Deploy (GitHub Pages)

Live: **https://shirabarshalom.github.io/life-planner/**

Deployment is automatic: every push to `main` runs `.github/workflows/pages.yml`, which publishes the site. Pages Source must be set to *GitHub Actions* in the repo settings. All paths are relative, so the app works from the `/life-planner/` subfolder.

When you change files, bump `VERSION` in `sw.js` so installed apps pick up the update. The app shows a "גרסה חדשה זמינה" toast.

## Install on iPhone

1. Open the site URL in **Safari**.
2. Tap Share (□↑) → **הוספה למסך הבית** → **הוסף**.
3. Launch it from the Home Screen icon. It runs full-screen and works offline.
4. First time only: send yourself the backup file (email, WhatsApp or iCloud Drive) and save it to Files. Then in the app go to **הגדרות → ייבוא גיבוי** and choose it.

Export a backup now and then (Settings → ייצוא גיבוי) to keep a copy of your data.

Regenerate the icons with `python tools/make_icons.py` (needs Pillow).
