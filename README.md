# GeoStudy Atlas — $0 version

A personal/shared geography and GK study atlas.

## What is included

- India map → state → district drill-down
- World country map
- Clickable map polygons
- Add/edit/delete exam facts
- Pin facts using latitude/longitude
- Important flag
- Search saved facts
- Study mode
- Local mode (no account/backend)
- Optional Supabase mode for shared data between you and your friend

## $0 architecture

- Frontend: plain HTML/CSS/JavaScript
- Map UI: Leaflet
- India boundaries: udit-001/india-maps-data GeoJSON
- World boundaries: Natural Earth country GeoJSON
- Shared database/auth: Supabase Free
- Hosting: GitHub Pages or Cloudflare Pages Free

GitHub Pages is available with GitHub Free for public repositories. Cloudflare Pages Free currently allows 500 builds/month and 20,000 files/site; static asset requests are free/unlimited. Supabase Free currently includes a Postgres database, 500 MB database size, 50,000 MAU and 1 GB file storage, but free projects may pause after inactivity. Check provider limits before relying on them long-term.

## Run locally

1. Copy `config.example.js` to `config.js`.
2. Leave config blank for Local mode.
3. Open the folder using a simple local server (recommended):
   - VS Code + Live Server, or
   - `python -m http.server 8080`
4. Open `http://localhost:8080`.

## Enable shared data

1. Create a free Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Enable Email/Password authentication.
4. Copy the project URL and anon key into `config.js`.
5. Deploy the folder to GitHub Pages or Cloudflare Pages.
6. Create accounts for yourself and your friend inside the app.

## Important security note

The Supabase anon key is intended to be used in browser apps. Do not put a Supabase service-role key in this project.

The included RLS policies allow every authenticated atlas user to edit/delete shared notes. That is deliberate for a two-person study notebook. If you later want separate private notebooks or admin-only deletion, tighten the policies.

## Map data notes

India district geometry is third-party geodata and should be treated as study/visualization data, not survey-grade boundaries. Verify exam-critical facts and administrative changes against authoritative sources.

The app loads map geometry from public CDNs rather than storing huge geometry files in this project. If those sources change or disappear, the map loader URLs may need updating.
