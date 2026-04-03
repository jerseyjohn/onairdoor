# TODO

## Near Term

- Improve current-show emphasis on `/display`
  - make the live slot stand out more clearly in the schedule
  - refine the `Up Next` area for better distance readability
- Polish off-air mode
  - make automation state look intentionally different from live programming
  - remove any remaining live-language confusion during automation
- Add display font selectors in `/admin`
  - separate headline and body font controls
  - keep choices constrained to safe hosted-page font stacks
- Improve events board styling
  - continue simplifying the hallway-display treatment
  - tune featured-vs-secondary event hierarchy
- Refine website callout presentation
  - consider shorter display text vs full URL
  - add optional QR code treatment for hallway use

## Admin Workflow

- Add structured events editor improvements
  - drag reordering for events
  - explicit featured-event toggle with clearer affordance
  - optional event location display controls
- Add schedule conflict detection
  - warn on overlapping shows
  - flag gaps that fall back to automation
- Add better calendar editing
  - drag/resize schedule blocks
  - easier overnight-slot handling
- Add display presets in `/admin`
  - hallway monitor
  - stream-focused
  - schedule-focused
  - events-focused

## Display Operations

- Add temporary announcement controls
  - timed override expiration
  - quick preset announcements
- Expand live display controls
  - manual reload stream action
  - blackout / maintenance mode
  - operator-facing display connection status
- Improve stream metadata presentation
  - separate artist and track when available
  - better handling for long titles
- Add better stream failure recovery
  - automatic retry states
  - clearer degraded-mode messaging

## Data And Content

- Add richer event fields
  - optional location on the display
  - optional image/poster
  - optional link or QR destination for supporting use cases
- Add current-show image/promo controls
  - optional current-show poster or artwork
  - careful use so the display stays uncluttered
- Add station notice content
  - evergreen notices for phone, meetings, applications, or station info

## Deployment And Kiosk

- Add stronger Windows kiosk hardening
  - auto-launch
  - watchdog/reload behavior
  - tighter fullscreen handling
- Add deployment health checks
  - API health monitoring
  - display heartbeat or last-refresh status
- Add safer production configuration guidance
  - reverse proxy examples
  - backup/restore notes for SQLite and config-driven schedules
