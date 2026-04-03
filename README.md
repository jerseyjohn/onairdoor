# OnAirDoor
100% vibecoded btw
OnAirDoor is a radio station signage system for a monitor or TV outside the studio. It provides:

- a hosted display page for public signage
- a hosted admin page for schedule and content updates
- an optional lightweight Windows kiosk shell that points at the hosted display
- a SQLite-backed server that can also seed or overwrite the schedule from a checked-in config file

The current stack is:

- Node.js + Express
- SQLite via `better-sqlite3`
- static hosted admin/display pages
- Docker deployment for the server
- WinForms + WebView2 for the Windows display shell

## Current Feature Set

### Display

- HLS stream playback
- single-page signage layout
- current show / off-air status panel
- 12-hour or 24-hour clock
- city/state label under the clock
- website URL callout
- weekly show schedule
- featured event panel with supporting events
- override banner for temporary announcements
- current show poster support
- automatic live refresh when admin changes are saved

### Admin

- first-run admin token creation
- station name, tagline, logo, website URL, and stream URL settings
- status-panel copy editing
- event management with structured event rows
- override title/message controls
- weekly schedule editor with calendar view
- per-show color and poster URL
- dark mode

### Windows Client

- fullscreen kiosk shell for Windows 11
- loads the hosted `/display` page
- `F11` fullscreen toggle
- `F5` reload

The Windows client is optional. The main product is the hosted server app, and it is completely valid to use `/display` directly in Firefox, Chrome, Edge, or another browser.

## Repository Layout

```text
server/
  config/
    schedule.json
  public/
    admin/
    display/
  src/
    auth.js
    db.js
    index.js
    schedule.js
  Dockerfile
  docker-compose.yml

windows-client/
  OnAirDoorDisplay.sln
  OnAirDoorDisplay/
```

## Confirmed Stream Endpoints

The display expects a public playback URL, not an ingest URL.

Confirmed WJTB public endpoints:

- video HLS: `https://wjtbradio.com:8888/stream2/index.m3u8`
- audio fallback: `https://wjtbradio.com:8000/stream1.mp3`

## Local Development

### Server

```bash
cd server
npm install
npm run dev
```

The server runs at:

- admin: [http://localhost:8080/admin](http://localhost:8080/admin)
- display: [http://localhost:8080/display](http://localhost:8080/display)
- API: [http://localhost:8080/api/health](http://localhost:8080/api/health)

### Windows Client

Open [windows-client/OnAirDoorDisplay.sln](/Users/johnnie/IdeaProjects/OnAirDoor/windows-client/OnAirDoorDisplay.sln) in Visual Studio 2022 or newer.

Configure the hosted display URL in:

- [windows-client/OnAirDoorDisplay/appsettings.json](/Users/johnnie/IdeaProjects/OnAirDoor/windows-client/OnAirDoorDisplay/appsettings.json)
- or `ONAIRDOOR_DISPLAY_URL`

You only need this if you want a dedicated Windows kiosk wrapper. If you are already opening `/display` in a browser on the display machine, you do not need the Windows client.

## Deployment

This project is well-suited to a Mac mini acting as the station server.

Recommended workflow:

1. Develop locally.
2. Push changes to GitHub.
3. Pull updates on the Mac mini.
4. Rebuild/restart the server there.

### Deploy With Docker

```bash
cd server
docker compose up -d --build
```

The container publishes port `8080`.

Default endpoints:

- admin: `http://<server>:8080/admin`
- display: `http://<server>:8080/display`
- API: `http://<server>:8080/api`

### Environment Variables

Main server variables:

- `PUBLIC_BASE_URL`
- `DB_PATH`
- `ADMIN_TOKEN`
- `SCHEDULE_CONFIG_PATH`
- `SCHEDULE_CONFIG_MODE`

Example:

```bash
PUBLIC_BASE_URL=http://onairdoor.local:8080
SCHEDULE_CONFIG_MODE=seed
```

### Docker Volumes

The current compose file mounts:

- `./data:/app/data`
- `./config:/app/config:ro`

That means:

- SQLite data persists across container rebuilds
- checked-in schedule config is available inside the container

## First Start Admin Setup

On first start:

1. open `/admin`
2. create the admin token you want to use
3. keep using that token for admin actions in the current browser session

Optional preconfiguration:

- if `ADMIN_TOKEN` is set and admin has not been configured yet, the server uses it as the initial admin token automatically

## Schedule Source Of Truth

There are two schedule-management modes:

### `SCHEDULE_CONFIG_MODE=overwrite`

- the checked-in config file at [server/config/schedule.json](/Users/johnnie/IdeaProjects/OnAirDoor/server/config/schedule.json) becomes authoritative on startup
- restarting the server replaces the database schedule with the config file contents

Use this when you want schedule changes managed in Git.

### `SCHEDULE_CONFIG_MODE=seed`

- config is imported only when the database has no schedule rows yet
- admin edits continue to persist normally afterward

Use this when the station staff will manage the schedule primarily through `/admin`.

## Recommended Setup For A Mac Mini Server

- give the Mac mini a stable local hostname or static/reserved IP
- keep the server repo cloned on the Mac mini
- use GitHub as the source of truth
- use `SCHEDULE_CONFIG_MODE=seed` if admins will edit the schedule live
- point hallway displays and the Windows kiosk client at the Mac mini’s hosted `/display`

Typical update flow on the Mac mini:

```bash
cd /path/to/onairdoor
git pull
cd server
docker compose up -d --build
```

## Security Notes

- do not commit `.env` files, private keys, or admin tokens
- use a strong admin token
- prefer HTTPS if the app is exposed beyond a trusted local network
- put the app behind a reverse proxy if you want cleaner local hostnames or TLS

## Notes About The Checked-In Schedule

The current checked-in config includes:

- known live shows
- Tuesday `General Body Meeting` from `21:00 - 22:00`
- Tuesday, Thursday, and Friday `Variety Hours`
- `Off Air Broadcasting` filler blocks for uncovered time

## Known Operational Behavior

- the display auto-refreshes when admin saves settings or schedule changes
- the Windows client is only an optional shell around the hosted display
- the server is the source of truth for schedule, events, and station settings

## Next Good Improvements

- drag-and-drop schedule editing
- better conflict detection in admin
- stronger off-air/live state distinction
- improved now-playing metadata handling
- more kiosk hardening for the Windows shell
- QR or alternate treatments for the website/event callouts
