const stationName = document.querySelector("#station-name");
const tagline = document.querySelector("#tagline");
const logo = document.querySelector("#logo");
const clockTime = document.querySelector("#clock-time");
const clockDay = document.querySelector("#clock-day");
const locationLabel = document.querySelector("#location-label");
const nowCard = document.querySelector(".now-card");
const statusSectionLabel = document.querySelector("#status-section-label");
const statusBadge = document.querySelector("#status-badge");
const currentTitle = document.querySelector("#current-title");
const currentHost = document.querySelector("#current-host");
const currentDescription = document.querySelector("#current-description");
const currentPoster = document.querySelector("#current-poster");
const heroMessage = document.querySelector("#hero-message");
const statusButtonLabel = document.querySelector("#status-button-label");
const websitePanel = document.querySelector("#website-panel");
const websiteUrl = document.querySelector("#website-url");
const streamVideo = document.querySelector("#stream-video");
const streamStatus = document.querySelector("#stream-status");
const overrideBanner = document.querySelector("#override-banner");
const overrideTitle = document.querySelector("#override-title");
const overrideMessage = document.querySelector("#override-message");
const eventsCard = document.querySelector("#events-card");
const eventsList = document.querySelector("#events-list");
const todayList = document.querySelector("#today-list");
const upcomingList = document.querySelector("#upcoming-list");

let hlsInstance = null;
let currentStreamUrl = "";
let displayEventSource = null;
let refreshInFlight = null;

function updateVideoAspectRatio() {
  if (!streamVideo.videoWidth || !streamVideo.videoHeight) {
    return;
  }

  document.documentElement.style.setProperty(
    "--stream-aspect",
    `${streamVideo.videoWidth} / ${streamVideo.videoHeight}`
  );
}

function showCurrentPoster(posterUrl) {
  if (posterUrl) {
    currentPoster.src = posterUrl;
    currentPoster.classList.remove("hidden");
    return;
  }

  currentPoster.removeAttribute("src");
  currentPoster.classList.add("hidden");
}

function parseEventLine(line) {
  const segments = line.split("|").map((segment) => segment.trim()).filter(Boolean);

  if (segments.length >= 3) {
    return {
      title: segments[0],
      date: segments[1],
      time: segments.slice(2).join(" | ")
    };
  }

  if (segments.length === 2) {
    return {
      title: segments[0],
      date: segments[1],
      time: ""
    };
  }

  return {
    title: line,
    date: "",
    time: ""
  };
}

function buildEventCard(event) {
  const item = document.createElement("article");
  item.className = "event-item";

  const title = document.createElement("div");
  title.className = "event-title";
  title.textContent = event.title;

  const meta = document.createElement("div");
  meta.className = "event-meta";

  const date = document.createElement("span");
  date.className = "event-date";
  date.textContent = event.date || "Date TBA";

  const time = document.createElement("span");
  time.className = "event-time";
  time.textContent = event.time || "Time TBA";

  meta.append(date, time);
  item.append(title, meta);

  if (event.location) {
    const location = document.createElement("span");
    location.className = "event-location";
    location.textContent = event.location;
    meta.append(location);
  }

  return item;
}

function buildNoticeEventCard(event) {
  const item = buildEventCard(event);
  item.classList.add("notice-event");
  return item;
}

function renderEvents(station) {
  const events = Array.isArray(station.events) ? station.events : [];

  if (!station.events_enabled || events.length === 0) {
    eventsCard.classList.add("hidden");
    eventsList.textContent = "";
    return;
  }

  eventsCard.classList.remove("hidden");
  eventsList.innerHTML = "";
  const board = document.createElement("div");
  board.className = "events-board";

  const featured = buildEventCard(station.featured_event || events[0]);
  featured.classList.add("featured-event");
  board.appendChild(featured);

  if ((station.additional_events || []).length > 0) {
    const stack = document.createElement("div");
    stack.className = "events-stack";

    const stackHeading = document.createElement("div");
    stackHeading.className = "events-stack-heading";
    stackHeading.textContent = "More Events";
    stack.appendChild(stackHeading);

    const additionalEvents = station.additional_events || [];
    const stackWindow = document.createElement("div");
    stackWindow.className = "events-stack-window";
    stack.appendChild(stackWindow);

    const stackTrack = document.createElement("div");
    stackTrack.className = "events-scroll-track";
    stackWindow.appendChild(stackTrack);

    for (const event of additionalEvents) {
      stackTrack.appendChild(buildNoticeEventCard(event));
    }

    if (additionalEvents.length > 3) {
      stack.classList.add("scrolling");
      stack.style.setProperty("--notice-count", String(additionalEvents.length));

      for (const event of additionalEvents) {
        const duplicate = buildNoticeEventCard(event);
        duplicate.setAttribute("aria-hidden", "true");
        stackTrack.appendChild(duplicate);
      }
    }

    board.appendChild(stack);
  }

  eventsList.appendChild(board);
}

function createScheduleSlot(slot, currentId) {
  const article = document.createElement("article");
  article.className = `schedule-slot${currentId === slot.id ? " current" : ""}`;

  const swatch = document.createElement("span");
  swatch.className = "slot-swatch";
  swatch.style.background = slot.color;

  const copy = document.createElement("div");
  copy.className = "slot-copy";

  const title = document.createElement("h3");
  title.textContent = slot.title;

  const host = document.createElement("p");
  host.className = "muted";
  host.textContent = slot.host;

  const time = document.createElement("div");
  time.className = "slot-time";
  time.textContent = `${slot.start_time} - ${slot.end_time}`;

  if (currentId === slot.id) {
    const badge = document.createElement("div");
    badge.className = "slot-badge";
    badge.textContent = "LIVE NOW";
    copy.appendChild(badge);
  }

  copy.append(title, host, time);
  article.append(swatch, copy);
  return article;
}

function renderWeeklySchedule(payload) {
  const groups = new Map();
  todayList.innerHTML = "";

  for (const slot of payload.weekly || []) {
    const slotsForDay = groups.get(slot.day_name) || [];
    slotsForDay.push(slot);
    groups.set(slot.day_name, slotsForDay);
  }

  const dayStrip = document.createElement("div");
  dayStrip.className = "schedule-day-strip";

  for (const [dayName] of groups.entries()) {
    const chip = document.createElement("div");
    chip.className = `schedule-day-chip${payload.clock.dayName === dayName ? " active-day" : ""}`;
    chip.textContent = dayName.slice(0, 3).toUpperCase();
    dayStrip.appendChild(chip);
  }

  const activeDayName = payload.clock.dayName;
  const activeSlots = groups.get(activeDayName) || [];
  const dayColumn = document.createElement("section");
  dayColumn.className = "schedule-day active-day";

  const items = document.createElement("div");
  items.className = "schedule-day-items";

  for (const slot of activeSlots) {
    items.appendChild(createScheduleSlot(slot, payload.current?.id));
  }

  if (activeSlots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "schedule-empty";
    empty.textContent = "No scheduled shows today.";
    items.appendChild(empty);
  }

  dayColumn.append(items);
  todayList.append(dayStrip, dayColumn);
}

function renderUpcoming(upcoming) {
  upcomingList.innerHTML = "";

  if (!upcoming || upcoming.length === 0) {
    const empty = document.createElement("div");
    empty.className = "upcoming-empty";
    empty.textContent = "No additional shows scheduled today.";
    upcomingList.appendChild(empty);
    return;
  }

  for (const [index, slot] of upcoming.slice(0, 3).entries()) {
    const item = document.createElement("div");
    item.className = `upcoming-item${index === 0 ? " upcoming-primary" : ""}`;
    item.innerHTML = `
      <strong>${slot.title}</strong>
      <span>${slot.start_time} - ${slot.end_time}</span>
      <small>${slot.host}</small>
    `;
    upcomingList.appendChild(item);
  }
}

function renderOverride(station) {
  if (!station.override_active) {
    overrideBanner.classList.add("hidden");
    overrideTitle.textContent = "";
    overrideMessage.textContent = "";
    return;
  }

  overrideTitle.textContent = station.override_title;
  overrideMessage.textContent = station.override_message;
  overrideBanner.classList.remove("hidden");
}

function setStreamStatus(message, isError = false) {
  streamStatus.textContent = message;
  streamStatus.style.color = isError ? "#fca5a5" : "";
}

function destroyPlayer() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  document.documentElement.style.removeProperty("--stream-aspect");
  streamVideo.removeAttribute("src");
  streamVideo.load();
}

async function tryAutoplay() {
  try {
    await streamVideo.play();
    setStreamStatus("Live stream connected.");
  } catch (_error) {
    setStreamStatus("Autoplay is blocked. Press play to start the live stream.");
  }
}

function attachStream(url) {
  if (!url) {
    destroyPlayer();
    currentStreamUrl = "";
    setStreamStatus("No live stream URL is configured.", true);
    return;
  }

  if (url === currentStreamUrl) {
    return;
  }

  destroyPlayer();
  currentStreamUrl = url;

  if (streamVideo.canPlayType("application/vnd.apple.mpegurl")) {
    streamVideo.src = url;
    streamVideo.addEventListener("loadedmetadata", () => {
      updateVideoAspectRatio();
      tryAutoplay();
    }, { once: true });
    streamVideo.addEventListener("error", () => {
      currentStreamUrl = "";
      setStreamStatus("The live stream could not be loaded.", true);
    }, { once: true });
    return;
  }

  if (window.Hls?.isSupported()) {
    hlsInstance = new window.Hls({
      lowLatencyMode: true,
      backBufferLength: 90
    });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(streamVideo);
    hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
      tryAutoplay();
    });
    hlsInstance.on(window.Hls.Events.LEVEL_LOADED, () => {
      updateVideoAspectRatio();
    });
    hlsInstance.on(window.Hls.Events.ERROR, (_event, data) => {
      if (data?.fatal) {
        currentStreamUrl = "";
        setStreamStatus("The live stream encountered a playback error.", true);
      }
    });
    return;
  }

  setStreamStatus("This browser does not support HLS playback.", true);
}

function render(payload) {
  const { station, clock, current } = payload;

  document.documentElement.style.setProperty("--accent", station.accent_color);
  document.documentElement.style.setProperty("--background", station.background_color);
  stationName.textContent = station.station_name;
  tagline.textContent = station.tagline;
  logo.src = station.logo_url;
  clockTime.textContent = clock.timeDisplay;
  clockDay.textContent = clock.dayName;
  locationLabel.textContent = station.location_label || "";
  statusSectionLabel.textContent = station.status_section_label || "Studio Status";
  heroMessage.textContent = station.hero_message;
  heroMessage.classList.toggle("hidden", !station.hero_message);
  statusButtonLabel.textContent = station.status_button_label || "Now Live";
  websiteUrl.textContent = station.website_url || "";
  websitePanel.classList.toggle("hidden", !station.website_url);
  attachStream(station.stream_url);
  renderOverride(station);
  renderEvents(station);

  if (current) {
    statusBadge.textContent = station.live_badge_label || "LIVE";
    statusBadge.classList.remove("off-air");
    nowCard.classList.remove("off-air-card");
    currentTitle.textContent = current.title;
    currentHost.textContent = `Hosted by ${current.host}`;
    currentDescription.textContent = current.description;
    statusButtonLabel.classList.toggle("hidden", !(station.status_button_label || "Now Live"));
    showCurrentPoster(current.poster_url);
  } else {
    statusBadge.textContent = station.off_air_badge_label || "OFF AIR";
    statusBadge.classList.add("off-air");
    nowCard.classList.add("off-air-card");
    currentTitle.textContent = station.off_air_title || "Off Air Broadcasting";
    currentHost.textContent = station.off_air_line_one || "Station automation is currently playing.";
    currentDescription.textContent = station.off_air_line_two || "Tune in for music, promos, and station programming between live shows.";
    statusButtonLabel.classList.add("hidden");
    showCurrentPoster("");
  }

  renderWeeklySchedule(payload);
  renderUpcoming(payload.upcoming);
}

async function refresh() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const response = await fetch("/api/display");
    const payload = await response.json();
    render(payload);
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function connectDisplayUpdates() {
  if (displayEventSource) {
    displayEventSource.close();
  }

  displayEventSource = new window.EventSource("/api/display/stream");
  displayEventSource.addEventListener("display-update", () => {
    refresh().catch(() => {
      // polling fallback continues running
    });
  });
  displayEventSource.addEventListener("error", () => {
    displayEventSource?.close();
    displayEventSource = null;
    window.setTimeout(connectDisplayUpdates, 5000);
  });
}

async function start() {
  await refresh();
  connectDisplayUpdates();
  setInterval(refresh, 30000);
}

start().catch(() => {
  setStreamStatus("The display data could not be loaded.", true);
});
