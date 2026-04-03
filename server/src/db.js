import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH || path.resolve("data/onairdoor.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
const scheduleConfigPath = process.env.SCHEDULE_CONFIG_PATH || path.resolve("config/schedule.json");
const scheduleConfigMode = process.env.SCHEDULE_CONFIG_MODE || "seed";

db.exec(`
  CREATE TABLE IF NOT EXISTS station_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    station_name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    timezone TEXT NOT NULL,
    clock_format TEXT NOT NULL DEFAULT '24',
    location_label TEXT NOT NULL DEFAULT 'Newark, NJ',
    website_url TEXT NOT NULL DEFAULT 'https://wjtbradio.com',
    events_enabled INTEGER NOT NULL DEFAULT 0,
    events_content TEXT NOT NULL DEFAULT '',
    events_json TEXT NOT NULL DEFAULT '[]',
    override_enabled INTEGER NOT NULL DEFAULT 0,
    override_title TEXT NOT NULL DEFAULT '',
    override_message TEXT NOT NULL DEFAULT '',
    status_section_label TEXT NOT NULL DEFAULT 'Studio Status',
    live_badge_label TEXT NOT NULL DEFAULT 'LIVE',
    off_air_badge_label TEXT NOT NULL DEFAULT 'OFF AIR',
    off_air_title TEXT NOT NULL DEFAULT 'Off Air Broadcasting',
    off_air_line_one TEXT NOT NULL DEFAULT 'Station automation is currently playing.',
    off_air_line_two TEXT NOT NULL DEFAULT 'Tune in for music, promos, and station programming between live shows.',
    status_button_label TEXT NOT NULL DEFAULT 'Now Live',
    hero_message TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    background_color TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    host TEXT NOT NULL,
    description TEXT NOT NULL,
    poster_url TEXT NOT NULL DEFAULT '',
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_live INTEGER NOT NULL DEFAULT 1,
    color TEXT NOT NULL DEFAULT '#f97316',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token_hash TEXT NOT NULL DEFAULT '',
    configured_at TEXT NOT NULL DEFAULT ''
  );
`);

const stationColumns = db.prepare("PRAGMA table_info(station_settings)").all();
const stationColumnNames = new Set(stationColumns.map((column) => column.name));
const scheduleColumns = db.prepare("PRAGMA table_info(schedule_slots)").all();
const scheduleColumnNames = new Set(scheduleColumns.map((column) => column.name));

// These ALTERs keep existing deployments moving forward without requiring a
// manual migration tool for each new settings field.
if (!stationColumnNames.has("clock_format")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN clock_format TEXT NOT NULL DEFAULT '24'");
}

if (!stationColumnNames.has("location_label")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN location_label TEXT NOT NULL DEFAULT 'Newark, NJ'");
}

if (!stationColumnNames.has("website_url")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN website_url TEXT NOT NULL DEFAULT 'https://wjtbradio.com'");
}

if (!stationColumnNames.has("events_enabled")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN events_enabled INTEGER NOT NULL DEFAULT 0");
}

if (!stationColumnNames.has("events_content")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN events_content TEXT NOT NULL DEFAULT ''");
}

if (!stationColumnNames.has("events_json")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN events_json TEXT NOT NULL DEFAULT '[]'");
}

if (!stationColumnNames.has("override_enabled")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN override_enabled INTEGER NOT NULL DEFAULT 0");
}

if (!stationColumnNames.has("override_title")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN override_title TEXT NOT NULL DEFAULT ''");
}

if (!stationColumnNames.has("override_message")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN override_message TEXT NOT NULL DEFAULT ''");
}

if (!stationColumnNames.has("status_section_label")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN status_section_label TEXT NOT NULL DEFAULT 'Studio Status'");
}

if (!stationColumnNames.has("live_badge_label")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN live_badge_label TEXT NOT NULL DEFAULT 'LIVE'");
}

if (!stationColumnNames.has("off_air_badge_label")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN off_air_badge_label TEXT NOT NULL DEFAULT 'OFF AIR'");
}

if (!stationColumnNames.has("off_air_title")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN off_air_title TEXT NOT NULL DEFAULT 'Off Air Broadcasting'");
}

if (!stationColumnNames.has("off_air_line_one")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN off_air_line_one TEXT NOT NULL DEFAULT 'Station automation is currently playing.'");
}

if (!stationColumnNames.has("off_air_line_two")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN off_air_line_two TEXT NOT NULL DEFAULT 'Tune in for music, promos, and station programming between live shows.'");
}

if (!stationColumnNames.has("status_button_label")) {
  db.exec("ALTER TABLE station_settings ADD COLUMN status_button_label TEXT NOT NULL DEFAULT 'Now Live'");
}

if (!scheduleColumnNames.has("poster_url")) {
  db.exec("ALTER TABLE schedule_slots ADD COLUMN poster_url TEXT NOT NULL DEFAULT ''");
}

const existing = db.prepare("SELECT COUNT(*) AS count FROM station_settings").get();
if (existing.count === 0) {
  db.prepare(`
    INSERT INTO station_settings (
      id, station_name, tagline, stream_url, timezone, clock_format, location_label, hero_message,
      website_url,
      events_enabled, events_content, events_json, override_enabled, override_title, override_message,
      status_section_label, live_badge_label, off_air_badge_label, off_air_title,
      off_air_line_one, off_air_line_two, status_button_label,
      accent_color, background_color, logo_url, updated_at
    ) VALUES (
      1, @station_name, @tagline, @stream_url, @timezone, @clock_format, @location_label, @hero_message,
      @website_url,
      @events_enabled, @events_content, @events_json, @override_enabled, @override_title, @override_message,
      @status_section_label, @live_badge_label, @off_air_badge_label, @off_air_title,
      @off_air_line_one, @off_air_line_two, @status_button_label,
      @accent_color, @background_color, @logo_url, @updated_at
    )
  `).run({
    station_name: "OnAirDoor Radio",
    tagline: "Live local programming all day",
    stream_url: "https://stream.example.com/live",
    timezone: "America/New_York",
    clock_format: "24",
    location_label: "Newark, NJ",
    website_url: "https://wjtbradio.com",
    events_enabled: 0,
    events_content: "",
    events_json: "[]",
    override_enabled: 0,
    override_title: "",
    override_message: "",
    status_section_label: "Studio Status",
    live_badge_label: "LIVE",
    off_air_badge_label: "OFF AIR",
    off_air_title: "Off Air Broadcasting",
    off_air_line_one: "Station automation is currently playing.",
    off_air_line_two: "Tune in for music, promos, and station programming between live shows.",
    status_button_label: "Now Live",
    hero_message: "Now broadcasting live from the studio",
    accent_color: "#f97316",
    background_color: "#111827",
    logo_url: "https://dummyimage.com/400x160/f97316/ffffff&text=OnAirDoor",
    updated_at: new Date().toISOString()
  });
}

db.prepare(`
  UPDATE station_settings
  SET
    clock_format = COALESCE(clock_format, '24'),
    location_label = COALESCE(location_label, 'Newark, NJ'),
    website_url = COALESCE(website_url, 'https://wjtbradio.com'),
    events_enabled = COALESCE(events_enabled, 0),
    events_content = COALESCE(events_content, ''),
    events_json = COALESCE(events_json, '[]'),
    override_enabled = COALESCE(override_enabled, 0),
    override_title = COALESCE(override_title, ''),
    override_message = COALESCE(override_message, ''),
    status_section_label = COALESCE(status_section_label, 'Studio Status'),
    live_badge_label = COALESCE(live_badge_label, 'LIVE'),
    off_air_badge_label = COALESCE(off_air_badge_label, 'OFF AIR'),
    off_air_title = COALESCE(off_air_title, 'Off Air Broadcasting'),
    off_air_line_one = COALESCE(off_air_line_one, 'Station automation is currently playing.'),
    off_air_line_two = COALESCE(off_air_line_two, 'Tune in for music, promos, and station programming between live shows.'),
    status_button_label = COALESCE(status_button_label, 'Now Live')
  WHERE id = 1
`).run();

const slotCount = db.prepare("SELECT COUNT(*) AS count FROM schedule_slots").get();
const insertSlot = db.prepare(`
  INSERT INTO schedule_slots (
    title, host, description, poster_url, day_of_week, start_time, end_time, is_live, color, updated_at
  ) VALUES (
    @title, @host, @description, @poster_url, @day_of_week, @start_time, @end_time, @is_live, @color, @updated_at
  )
`);

function insertScheduleRows(rows) {
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertSlot.run({
        title: item.title,
        host: item.host,
        description: item.description || "",
        poster_url: item.poster_url || "",
        day_of_week: item.day_of_week,
        start_time: item.start_time,
        end_time: item.end_time,
        is_live: item.is_live ? 1 : 0,
        color: item.color || "#f97316",
        updated_at: new Date().toISOString()
      });
    }
  });

  insertMany(rows);
}

function loadScheduleConfig() {
  if (!fs.existsSync(scheduleConfigPath)) {
    return null;
  }

  const raw = fs.readFileSync(scheduleConfigPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("schedule.json must be an array of schedule rows.");
  }
  return parsed;
}

const configuredSchedule = loadScheduleConfig();

const authCount = db.prepare("SELECT COUNT(*) AS count FROM admin_auth").get();
if (authCount.count === 0) {
  db.prepare(`
    INSERT INTO admin_auth (id, token_hash, configured_at)
    VALUES (1, '', '')
  `).run();
}

if (configuredSchedule && scheduleConfigMode === "overwrite") {
  // "overwrite" makes the checked-in schedule config the source of truth on
  // every startup, which is useful for predictable server deploys.
  db.prepare("DELETE FROM schedule_slots").run();
  insertScheduleRows(configuredSchedule);
} else if (slotCount.count === 0) {
  // "seed" only imports config when the DB has no schedule yet, so admins can
  // keep editing in the browser without having those changes replaced later.
  if (configuredSchedule) {
    insertScheduleRows(configuredSchedule);
  } else {
    insertScheduleRows([
      { title: "Morning Wake Up", host: "Avery Cole", description: "News, weather, and local updates.", day_of_week: 1, start_time: "06:00", end_time: "10:00", is_live: true, color: "#f97316" },
      { title: "Midday Mix", host: "Jordan Lane", description: "Interviews and community music blocks.", day_of_week: 1, start_time: "10:00", end_time: "14:00", is_live: true, color: "#06b6d4" },
      { title: "Drive Time Live", host: "Riley Brooks", description: "Afternoon commute programming.", day_of_week: 1, start_time: "14:00", end_time: "18:00", is_live: true, color: "#22c55e" },
      { title: "Night Sessions", host: "Taylor Reed", description: "Late-night themed playlists.", day_of_week: 1, start_time: "18:00", end_time: "22:00", is_live: true, color: "#a855f7" },
      { title: "Weekend Spotlight", host: "Morgan Price", description: "Special guests and station features.", day_of_week: 6, start_time: "09:00", end_time: "12:00", is_live: true, color: "#eab308" }
    ]);
  }
}

export default db;
