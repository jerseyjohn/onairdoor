const tokenInput = document.querySelector("#token");
const saveTokenButton = document.querySelector("#save-token");
const authStatus = document.querySelector("#auth-status");
const settingsForm = document.querySelector("#settings-form");
const statusCopyForm = document.querySelector("#status-copy-form");
const eventsForm = document.querySelector("#events-form");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleBody = document.querySelector("#schedule-body");
const resetSlotButton = document.querySelector("#reset-slot");
const newSlotButton = document.querySelector("#new-slot");
const displayUrl = document.querySelector("#display-url");
const themeToggleButton = document.querySelector("#theme-toggle");
const scheduleCalendar = document.querySelector("#schedule-calendar");
const eventsBuilder = document.querySelector("#events-builder");
const newEventButton = document.querySelector("#new-event");

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_HEIGHT = 28;
let adminToken = sessionStorage.getItem("onairdoor-admin-token") || "";
let publicBaseUrl = window.location.origin;
let schedule = [];
let events = [];
let theme = localStorage.getItem("onairdoor-admin-theme") || "light";
let adminConfigured = true;

if (adminToken) {
  tokenInput.value = adminToken;
}

applyTheme(theme);

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#dc2626" : "#16a34a";
}

function applyTheme(nextTheme) {
  theme = nextTheme;
  document.body.dataset.theme = theme;
  themeToggleButton.textContent = theme === "dark" ? "Use Light Mode" : "Use Dark Mode";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-token": adminToken
  };
}

function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

async function fetchBootstrap() {
  if (!adminConfigured) {
    setStatus("Create your admin token to finish setup.", true);
    return;
  }

  if (!adminToken) {
    setStatus("Authentication required.", true);
    return;
  }

  const response = await fetch("/api/admin/bootstrap", {
    headers: authHeaders()
  });

  if (!response.ok) {
    setStatus("Admin token rejected.", true);
    throw new Error("Unauthorized");
  }

  const data = await response.json();
  publicBaseUrl = data.publicBaseUrl;
  displayUrl.textContent = `${publicBaseUrl}/display`;
  hydrateSettings(data.settings);
  schedule = data.schedule;
  renderSchedule();
  renderCalendar();
  setStatus("Authenticated.");
}

async function fetchAdminStatus() {
  const response = await fetch("/api/admin/status");
  const data = await response.json();
  adminConfigured = Boolean(data.configured);

  if (!adminConfigured) {
    setStatus("First start detected. Create your admin token to finish setup.", true);
    saveTokenButton.textContent = "Create Admin Token";
  } else {
    saveTokenButton.textContent = "Use Token";
  }
}

function hydrateSettings(settings) {
  events = parseStructuredEvents(settings);

  for (const [key, value] of Object.entries(settings)) {
    const field = settingsForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }

    const statusField = statusCopyForm?.elements.namedItem(key);
    if (statusField) {
      statusField.value = value;
    }

    const eventsField = eventsForm?.elements.namedItem(key);
    if (eventsField) {
      eventsField.value = value;
    }
  }

  syncEventsFields();
  renderEventsBuilder();
}

function collectSettingsPayload() {
  syncEventsFields();
  const settingsData = new FormData(settingsForm);
  const statusCopyData = new FormData(statusCopyForm);
  const eventsData = new FormData(eventsForm);
  return {
    ...Object.fromEntries(settingsData.entries()),
    ...Object.fromEntries(statusCopyData.entries()),
    ...Object.fromEntries(eventsData.entries())
  };
}

async function saveSettingsPayload(successMessage) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(collectSettingsPayload())
  });

  if (!response.ok) {
    setStatus("Failed to save settings.", true);
    return false;
  }

  await fetchBootstrap();
  setStatus(successMessage);
  return true;
}

function parseStructuredEvents(settings) {
  const raw = typeof settings.events_json === "string" ? settings.events_json.trim() : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((event) => ({
          title: event.title || "",
          date: event.date || "",
          time: event.time || "",
          location: event.location || "",
          featured: Boolean(event.featured)
        }));
      }
    } catch (_error) {
      // fall through to legacy parser
    }
  }

  const legacy = (settings.events_content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return legacy.map((line, index) => {
    const [title = "", date = "", time = ""] = line.split("|").map((part) => part.trim());
    return { title, date, time, location: "", featured: index === 0 };
  });
}

function syncEventsFields() {
  const jsonField = eventsForm.elements.namedItem("events_json");
  const contentField = eventsForm.elements.namedItem("events_content");
  if (!jsonField || !contentField) {
    return;
  }

  const cleanEvents = events
    .map((event) => ({
      title: event.title.trim(),
      date: event.date.trim(),
      time: event.time.trim(),
      location: event.location.trim(),
      featured: Boolean(event.featured)
    }))
    .filter((event) => event.title);

  if (cleanEvents.length > 0 && !cleanEvents.some((event) => event.featured)) {
    cleanEvents[0].featured = true;
  }

  events = cleanEvents;
  jsonField.value = JSON.stringify(cleanEvents);
  contentField.value = cleanEvents
    .map((event) => [event.title, event.date, event.time].filter(Boolean).join(" | "))
    .join("\n");
}

function createEvent(defaults = {}) {
  return {
    title: defaults.title || "",
    date: defaults.date || "",
    time: defaults.time || "",
    location: defaults.location || "",
    featured: Boolean(defaults.featured)
  };
}

function renderEventsBuilder() {
  eventsBuilder.innerHTML = "";

  if (events.length === 0) {
    events.push(createEvent({ featured: true }));
  }

  events.forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "event-row";
    row.dataset.index = String(index);

    row.innerHTML = `
      <label>Title<input data-field="title" value="${escapeHtml(event.title)}" /></label>
      <label>Date<input data-field="date" value="${escapeHtml(event.date)}" placeholder="Tuesdays or 04/22" /></label>
      <label>Time<input data-field="time" value="${escapeHtml(event.time)}" placeholder="9:00 PM - 10:00 PM" /></label>
      <label>Location<input data-field="location" value="${escapeHtml(event.location)}" placeholder="Student Center" /></label>
      <label class="event-featured">Featured
        <input type="radio" name="featured_event" data-action="featured" ${event.featured ? "checked" : ""} />
      </label>
      <button type="button" class="secondary" data-action="remove">Remove</button>
    `;

    eventsBuilder.appendChild(row);
  });
}

function renderSchedule() {
  scheduleBody.innerHTML = "";

  for (const slot of schedule) {
    const row = document.createElement("tr");
    const showCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "pill";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = slot.color;
    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(slot.title));
    showCell.appendChild(pill);

    const hostCell = document.createElement("td");
    hostCell.textContent = slot.host;

    const dayCell = document.createElement("td");
    dayCell.textContent = slot.crosses_midnight ? `${slot.day_name} / ${DAY_NAMES[(slot.day_of_week + 1) % 7]}` : slot.day_name;

    const timeCell = document.createElement("td");
    timeCell.textContent = `${slot.start_time} - ${slot.end_time}`;

    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = String(slot.id);
    editButton.textContent = "Edit";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = String(slot.id);
    deleteButton.className = "secondary";
    deleteButton.textContent = "Delete";
    actionsCell.append(editButton, deleteButton);

    row.append(showCell, hostCell, dayCell, timeCell, actionsCell);
    scheduleBody.appendChild(row);
  }
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60) + minutes;
}

function minutesToTime(minutes) {
  const normalized = Math.max(0, Math.min(minutes, 1439));
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mins = String(normalized % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function formatLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:00 ${suffix}`;
}

function populateScheduleForm(slot) {
  for (const [key, value] of Object.entries(slot)) {
    const field = scheduleForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  }
  scheduleForm.elements.namedItem("is_live").value = String(slot.is_live);
  scheduleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCalendar() {
  scheduleCalendar.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "calendar-corner";
  corner.textContent = "Time";
  scheduleCalendar.appendChild(corner);

  for (const dayName of DAY_NAMES) {
    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = dayName.slice(0, 3);
    scheduleCalendar.appendChild(header);
  }

  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = formatLabel(hour * 60);
    scheduleCalendar.appendChild(label);

    for (let day = 0; day < 7; day += 1) {
      if (hour === 0) {
        const lane = document.createElement("div");
        lane.className = "calendar-lane";
        lane.dataset.day = String(day);
        lane.style.gridColumn = String(day + 2);
        lane.style.gridRow = "2 / span 24";
        scheduleCalendar.appendChild(lane);
      }
    }
  }

  const lanes = [...scheduleCalendar.querySelectorAll(".calendar-lane")];
  for (const slot of schedule) {
    const startMinutes = timeToMinutes(slot.start_time);
    const endMinutes = timeToMinutes(slot.end_time);
    const segments = slot.crosses_midnight
      ? [
          { day: slot.day_of_week, start: startMinutes, end: 24 * 60, label: `${slot.start_time} - 24:00` },
          { day: (slot.day_of_week + 1) % 7, start: 0, end: endMinutes, label: `00:00 - ${slot.end_time}` }
        ]
      : [
          { day: slot.day_of_week, start: startMinutes, end: Math.max(startMinutes + 30, endMinutes), label: `${slot.start_time} - ${slot.end_time}` }
        ];

    for (const segment of segments) {
      const lane = lanes.find((entry) => entry.dataset.day === String(segment.day));
      if (!lane) {
        continue;
      }

      const block = document.createElement("button");
      block.type = "button";
      block.className = "calendar-slot";
      block.dataset.id = String(slot.id);
      block.style.background = slot.color;
      block.style.top = `${(segment.start / 30) * SLOT_HEIGHT + 4}px`;
      block.style.height = `${Math.max(((segment.end - segment.start) / 30) * SLOT_HEIGHT - 8, 40)}px`;
      appendTextElement(block, "strong", slot.title);
      appendTextElement(block, "span", segment.label);
      appendTextElement(block, "span", slot.host);
      lane.appendChild(block);
    }
  }
}

function resetScheduleForm() {
  scheduleForm.reset();
  scheduleForm.elements.namedItem("id").value = "";
  scheduleForm.elements.namedItem("color").value = "#f97316";
  scheduleForm.elements.namedItem("is_live").value = "true";
}

themeToggleButton.addEventListener("click", () => {
  const nextTheme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("onairdoor-admin-theme", nextTheme);
  applyTheme(nextTheme);
});

saveTokenButton.addEventListener("click", async () => {
  adminToken = tokenInput.value.trim();

  if (!adminConfigured) {
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: adminToken })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setStatus(error.message || "Failed to create admin token.", true);
      return;
    }

    adminConfigured = true;
    saveTokenButton.textContent = "Use Token";
    setStatus("Admin token created.");
  }

  sessionStorage.setItem("onairdoor-admin-token", adminToken);
  try {
    await fetchBootstrap();
  } catch (_error) {
    // status already shown
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettingsPayload("Station settings saved.");
});

statusCopyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettingsPayload("Status panel copy saved.");
});

eventsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettingsPayload("Events settings saved.");
});

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(scheduleForm);
  const payload = Object.fromEntries(formData.entries());
  payload.is_live = payload.is_live === "true";

  const hasId = Boolean(payload.id);
  const endpoint = hasId ? `/api/schedule/${payload.id}` : "/api/schedule";
  const method = hasId ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    setStatus("Failed to save schedule slot.", true);
    return;
  }

  await fetchBootstrap();
  resetScheduleForm();
  setStatus("Schedule updated.");
});

scheduleBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const slot = schedule.find((entry) => String(entry.id) === target.dataset.id);
  if (!slot) {
    return;
  }

  if (target.dataset.action === "edit") {
    populateScheduleForm(slot);
  }

  if (target.dataset.action === "delete") {
    const response = await fetch(`/api/schedule/${slot.id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    if (!response.ok) {
      setStatus("Failed to delete schedule slot.", true);
      return;
    }

    await fetchBootstrap();
    setStatus("Schedule slot deleted.");
  }
});

scheduleCalendar.addEventListener("click", (event) => {
  const target = event.target;

  if (target instanceof HTMLButtonElement && target.classList.contains("calendar-slot")) {
    const slot = schedule.find((entry) => String(entry.id) === target.dataset.id);
    if (slot) {
      populateScheduleForm(slot);
    }
    return;
  }

  const lane = target.closest(".calendar-lane");
  if (!(lane instanceof HTMLElement)) {
    return;
  }

  const rect = lane.getBoundingClientRect();
  const offsetY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
  const halfHours = Math.floor(offsetY / SLOT_HEIGHT);
  const startMinutes = Math.min(halfHours * 30, 23 * 60 + 30);
  const endMinutes = Math.min(startMinutes + 60, 24 * 60 - 1);

  resetScheduleForm();
  scheduleForm.elements.namedItem("day_of_week").value = lane.dataset.day;
  scheduleForm.elements.namedItem("start_time").value = minutesToTime(startMinutes);
  scheduleForm.elements.namedItem("end_time").value = minutesToTime(endMinutes);
  scheduleForm.scrollIntoView({ behavior: "smooth", block: "start" });
});

resetSlotButton.addEventListener("click", () => {
  resetScheduleForm();
});

newSlotButton.addEventListener("click", () => {
  resetScheduleForm();
  scheduleForm.scrollIntoView({ behavior: "smooth", block: "start" });
});

newEventButton.addEventListener("click", () => {
  events.push(createEvent({ featured: events.length === 0 }));
  renderEventsBuilder();
});

eventsBuilder.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest(".event-row");
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const index = Number(row.dataset.index);
  const field = target.dataset.field;
  if (Number.isNaN(index) || !field || !events[index]) {
    return;
  }

  events[index][field] = target.value;
});

eventsBuilder.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const row = target.closest(".event-row");
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const index = Number(row.dataset.index);
  if (Number.isNaN(index) || !events[index]) {
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.action === "featured") {
    events = events.map((item, itemIndex) => ({
      ...item,
      featured: itemIndex === index
    }));
    renderEventsBuilder();
    return;
  }

  if (target instanceof HTMLButtonElement && target.dataset.action === "remove") {
    events.splice(index, 1);
    if (events.length > 0 && !events.some((item) => item.featured)) {
      events[0].featured = true;
    }
    renderEventsBuilder();
  }
});

resetScheduleForm();
fetchAdminStatus()
  .then(() => fetchBootstrap())
  .catch(() => {
    displayUrl.textContent = `${window.location.origin}/display`;
  });
