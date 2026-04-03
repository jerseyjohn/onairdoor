const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

function isOvernight(slot) {
  return parseTimeToMinutes(slot.end_time) <= parseTimeToMinutes(slot.start_time);
}

function previousDay(dayIndex) {
  return (dayIndex + 6) % 7;
}

function nextDay(dayIndex) {
  return (dayIndex + 1) % 7;
}

function slotIncludesMinute(slot, dayIndex, minute) {
  const start = parseTimeToMinutes(slot.start_time);
  const end = parseTimeToMinutes(slot.end_time);
  if (!isOvernight(slot)) {
    return slot.day_of_week === dayIndex && minute >= start && minute < end;
  }

  if (slot.day_of_week === dayIndex) {
    return minute >= start;
  }

  return nextDay(slot.day_of_week) === dayIndex && minute < end;
}

function sortKeyForDay(slot, dayIndex) {
  if (slot.day_of_week === dayIndex) {
    return parseTimeToMinutes(slot.start_time);
  }

  if (isOvernight(slot) && nextDay(slot.day_of_week) === dayIndex) {
    return -1;
  }

  return parseTimeToMinutes(slot.start_time);
}

export function mapSchedule(rows) {
  return rows.map((row) => ({
    ...row,
    is_live: Boolean(row.is_live),
    day_name: DAY_NAMES[row.day_of_week],
    crosses_midnight: isOvernight(row)
  }));
}

function parseStructuredEvents(settings) {
  const raw = typeof settings.events_json === "string" ? settings.events_json.trim() : "";
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((event) => event && typeof event.title === "string" && event.title.trim());
  } catch {
    return [];
  }
}

export function buildDisplayPayload(settings, slots, now = new Date()) {
  const activeTimezone = settings.timezone || "America/New_York";
  const use12Hour = settings.clock_format === "12";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: activeTimezone,
    weekday: "long"
  }).format(now);
  const time24 = new Intl.DateTimeFormat("en-GB", {
    timeZone: activeTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(now);
  const timeDisplay = new Intl.DateTimeFormat("en-US", {
    timeZone: activeTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: use12Hour
  }).format(now);

  const dayIndex = DAY_NAMES.indexOf(weekday);
  const minute = parseTimeToMinutes(time24);
  const today = slots
    .filter((slot) => slot.day_of_week === dayIndex || (slot.crosses_midnight && previousDay(dayIndex) === slot.day_of_week))
    .sort((a, b) => sortKeyForDay(a, dayIndex) - sortKeyForDay(b, dayIndex));

  const current = slots.find((slot) => slotIncludesMinute(slot, dayIndex, minute)) || null;
  const upcoming = today
    .filter((slot) => !slotIncludesMinute(slot, dayIndex, minute) && sortKeyForDay(slot, dayIndex) > minute)
    .slice(0, 4);
  const events = parseStructuredEvents(settings);
  const featuredEvent = events.find((event) => event.featured) || events[0] || null;
  const additionalEvents = featuredEvent
    ? events.filter((event) => event !== featuredEvent)
    : [];

  return {
    station: {
      ...settings,
      events,
      featured_event: featuredEvent,
      additional_events: additionalEvents,
      override_active: Boolean(settings.override_enabled && settings.override_title && settings.override_message)
    },
    clock: {
      dayName: weekday,
      timeDisplay,
      time24
    },
    current,
    upcoming,
    today,
    weekly: slots
  };
}
