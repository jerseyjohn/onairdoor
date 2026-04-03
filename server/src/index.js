import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import db from "./db.js";
import {
  initializeAdminToken,
  initializeAdminTokenFromEnvironment,
  isAdminConfigured,
  requireAdmin,
  requireSetupAvailable
} from "./auth.js";
import { buildDisplayPayload, mapSchedule } from "./schedule.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const app = express();
const port = Number(process.env.PORT || 8080);
const displayClients = new Set();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; media-src 'self' http: https:; connect-src 'self' http: https:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});
app.use(express.json({ limit: "64kb" }));
app.use(morgan("dev"));
app.use("/assets", express.static(path.join(publicDir, "assets")));

const corsOrigin = (process.env.CORS_ORIGIN || "").trim();
if (corsOrigin) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }

    return next();
  });
}

initializeAdminTokenFromEnvironment();

function broadcastDisplayUpdate(reason = "content-updated") {
  const payload = `event: display-update\ndata: ${JSON.stringify({
    reason,
    updatedAt: new Date().toISOString()
  })}\n\n`;

  for (const client of displayClients) {
    client.write(payload);
  }
}

function parseHttpUrl(value, fieldName, { required = false } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) {
      throw new Error(`${fieldName} is required.`);
    }
    return "";
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${fieldName} must use http or https.`);
  }

  return parsed.toString();
}

function parseTimeValue(value, fieldName) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must use HH:MM format.`);
  }

  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error(`${fieldName} must be a real 24-hour time.`);
  }

  return trimmed;
}

function parseEventsJson(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "[]";
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("events_json must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("events_json must be an array.");
  }

  const cleanEvents = parsed
    .map((event) => ({
      title: typeof event?.title === "string" ? event.title.trim() : "",
      date: typeof event?.date === "string" ? event.date.trim() : "",
      time: typeof event?.time === "string" ? event.time.trim() : "",
      location: typeof event?.location === "string" ? event.location.trim() : "",
      featured: Boolean(event?.featured)
    }))
    .filter((event) => event.title);

  return JSON.stringify(cleanEvents);
}

function getSettings() {
  return db.prepare("SELECT * FROM station_settings WHERE id = 1").get();
}

function getSchedule() {
  const rows = db.prepare("SELECT * FROM schedule_slots ORDER BY day_of_week, start_time").all();
  return mapSchedule(rows);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "onairdoor", now: new Date().toISOString() });
});

app.get("/api/display/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: display-ready\ndata: ${JSON.stringify({
    connectedAt: new Date().toISOString()
  })}\n\n`);

  displayClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    displayClients.delete(res);
  });
});

app.get("/api/admin/status", (_req, res) => {
  res.json({
    configured: isAdminConfigured()
  });
});

app.post("/api/admin/setup", requireSetupAvailable, (req, res) => {
  try {
    initializeAdminToken(req.body.token || "");
    return res.status(201).json({ configured: true });
  } catch (error) {
    return res.status(400).json({
      error: "Setup failed",
      message: error.message
    });
  }
});

app.get("/api/admin/bootstrap", requireAdmin, (_req, res) => {
  res.json({
    settings: getSettings(),
    schedule: getSchedule(),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`
  });
});

app.get("/api/settings", (_req, res) => {
  res.json(getSettings());
});

app.put("/api/settings", requireAdmin, (req, res) => {
  try {
    const payload = {
      station_name: req.body.station_name?.trim(),
      tagline: req.body.tagline?.trim(),
      stream_url: parseHttpUrl(req.body.stream_url, "stream_url", { required: true }),
      timezone: req.body.timezone?.trim(),
      clock_format: req.body.clock_format?.trim(),
      location_label: req.body.location_label?.trim(),
      website_url: parseHttpUrl(req.body.website_url, "website_url", { required: true }),
      events_enabled: req.body.events_enabled === "true" || req.body.events_enabled === true ? 1 : 0,
      events_content: req.body.events_content?.trim() || "",
      events_json: parseEventsJson(req.body.events_json),
      override_enabled: req.body.override_enabled === "true" || req.body.override_enabled === true ? 1 : 0,
      override_title: req.body.override_title?.trim() || "",
      override_message: req.body.override_message?.trim() || "",
      status_section_label: req.body.status_section_label?.trim(),
      live_badge_label: req.body.live_badge_label?.trim(),
      off_air_badge_label: req.body.off_air_badge_label?.trim(),
      off_air_title: req.body.off_air_title?.trim(),
      off_air_line_one: req.body.off_air_line_one?.trim(),
      off_air_line_two: req.body.off_air_line_two?.trim(),
      status_button_label: req.body.status_button_label?.trim(),
      hero_message: req.body.hero_message?.trim(),
      accent_color: req.body.accent_color?.trim(),
      background_color: req.body.background_color?.trim(),
      logo_url: parseHttpUrl(req.body.logo_url, "logo_url", { required: true }),
      updated_at: new Date().toISOString()
    };

    const requiredFields = [
      payload.station_name,
      payload.tagline,
      payload.stream_url,
      payload.timezone,
      payload.clock_format,
      payload.location_label,
      payload.website_url,
      payload.status_section_label,
      payload.live_badge_label,
      payload.off_air_badge_label,
      payload.off_air_title,
      payload.off_air_line_one,
      payload.off_air_line_two,
      payload.status_button_label,
      payload.hero_message,
      payload.accent_color,
      payload.background_color,
      payload.logo_url
    ];

    if (requiredFields.some((value) => value === undefined || value === null || value === "")) {
      return res.status(400).json({ error: "All station settings are required." });
    }

    if (!["12", "24"].includes(payload.clock_format)) {
      return res.status(400).json({ error: "clock_format must be 12 or 24." });
    }

    db.prepare(`
      UPDATE station_settings
      SET
        station_name = @station_name,
        tagline = @tagline,
        stream_url = @stream_url,
        timezone = @timezone,
        clock_format = @clock_format,
        location_label = @location_label,
        website_url = @website_url,
        events_enabled = @events_enabled,
        events_content = @events_content,
        events_json = @events_json,
        override_enabled = @override_enabled,
        override_title = @override_title,
        override_message = @override_message,
        status_section_label = @status_section_label,
        live_badge_label = @live_badge_label,
        off_air_badge_label = @off_air_badge_label,
        off_air_title = @off_air_title,
        off_air_line_one = @off_air_line_one,
        off_air_line_two = @off_air_line_two,
        status_button_label = @status_button_label,
        hero_message = @hero_message,
        accent_color = @accent_color,
        background_color = @background_color,
        logo_url = @logo_url,
        updated_at = @updated_at
      WHERE id = 1
    `).run(payload);

    broadcastDisplayUpdate("settings-updated");
    return res.json(getSettings());
  } catch (error) {
    return res.status(400).json({ error: "Invalid station settings.", message: error.message });
  }
});

app.get("/api/schedule", (_req, res) => {
  res.json(getSchedule());
});

app.post("/api/schedule", requireAdmin, (req, res) => {
  try {
    const payload = {
      title: req.body.title?.trim(),
      host: req.body.host?.trim(),
      description: req.body.description?.trim() || "",
      poster_url: parseHttpUrl(req.body.poster_url, "poster_url"),
      day_of_week: Number(req.body.day_of_week),
      start_time: parseTimeValue(req.body.start_time, "start_time"),
      end_time: parseTimeValue(req.body.end_time, "end_time"),
      is_live: req.body.is_live === "false" || req.body.is_live === false ? 0 : 1,
      color: req.body.color?.trim() || "#f97316",
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.host || Number.isNaN(payload.day_of_week) || payload.day_of_week < 0 || payload.day_of_week > 6) {
      return res.status(400).json({ error: "Missing required schedule fields." });
    }

    const result = db.prepare(`
      INSERT INTO schedule_slots (
        title, host, description, poster_url, day_of_week, start_time, end_time, is_live, color, updated_at
      ) VALUES (
        @title, @host, @description, @poster_url, @day_of_week, @start_time, @end_time, @is_live, @color, @updated_at
      )
    `).run(payload);

    broadcastDisplayUpdate("schedule-created");
    return res.status(201).json(
      db.prepare("SELECT * FROM schedule_slots WHERE id = ?").get(result.lastInsertRowid)
    );
  } catch (error) {
    return res.status(400).json({ error: "Invalid schedule payload.", message: error.message });
  }
});

app.put("/api/schedule/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM schedule_slots WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Schedule item not found." });
  }

  try {
    const payload = {
      id: Number(req.params.id),
      title: req.body.title?.trim(),
      host: req.body.host?.trim(),
      description: req.body.description?.trim() || "",
      poster_url: parseHttpUrl(req.body.poster_url, "poster_url"),
      day_of_week: Number(req.body.day_of_week),
      start_time: parseTimeValue(req.body.start_time, "start_time"),
      end_time: parseTimeValue(req.body.end_time, "end_time"),
      is_live: req.body.is_live === "false" || req.body.is_live === false ? 0 : 1,
      color: req.body.color?.trim() || "#f97316",
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.host || Number.isNaN(payload.day_of_week) || payload.day_of_week < 0 || payload.day_of_week > 6) {
      return res.status(400).json({ error: "Missing required schedule fields." });
    }

    db.prepare(`
      UPDATE schedule_slots
      SET
        title = @title,
        host = @host,
        description = @description,
        poster_url = @poster_url,
        day_of_week = @day_of_week,
        start_time = @start_time,
        end_time = @end_time,
        is_live = @is_live,
        color = @color,
        updated_at = @updated_at
      WHERE id = @id
    `).run(payload);

    broadcastDisplayUpdate("schedule-updated");
    return res.json(db.prepare("SELECT * FROM schedule_slots WHERE id = ?").get(payload.id));
  } catch (error) {
    return res.status(400).json({ error: "Invalid schedule payload.", message: error.message });
  }
});

app.delete("/api/schedule/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM schedule_slots WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Schedule item not found." });
  }
  broadcastDisplayUpdate("schedule-deleted");
  return res.status(204).send();
});

app.get("/api/display", (_req, res) => {
  res.json(buildDisplayPayload(getSettings(), getSchedule()));
});

app.get("/", (_req, res) => {
  res.redirect("/display");
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin/index.html"));
});

app.get("/display", (_req, res) => {
  res.sendFile(path.join(publicDir, "display/index.html"));
});

app.use(express.static(publicDir));

app.listen(port, () => {
  console.log(`OnAirDoor server listening on http://localhost:${port}`);
});
