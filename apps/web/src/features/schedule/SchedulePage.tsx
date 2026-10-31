import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./Schedule.css";

type Lesson = {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  group: string;
  room: string;
  tone: number;
};
type View = "Day" | "Week" | "Month";
const groups = ["Mathematics 10A", "Physics 11B", "English 10C"];
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d: Date) => shift(d, -((d.getDay() + 6) % 7));
const pretty = (d: Date, options: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("en-GB", options);
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
function seed(today: Date): Lesson[] {
  const start = monday(today);
  return Array.from({ length: 18 }, (_, i) => ({
    id: `mock-${i}`,
    date: dateKey(shift(start, Math.floor(i / 3) + (i > 14 ? 2 : 0))),
    start: ["08:00", "10:00", "14:00"][i % 3],
    end: ["09:30", "11:30", "15:30"][i % 3],
    title: ["Algebra & equations", "Motion & forces", "Reading workshop"][
      i % 3
    ],
    group: groups[i % 3],
    room: ["Room A-201", "Science lab B", "Room C-102"][i % 3],
    tone: i % 3,
  }));
}

export default function SchedulePage() {
  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState<View>("Week");
  const [lessons, setLessons] = useState(() => seed(today));
  const [group, setGroup] = useState("All classes");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalOpen = creating || selected !== null;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreating(false);
        setSelected(null);
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, input, select",
      );
      if (!focusable?.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [modalOpen]);
  const days = useMemo(() => {
    if (view === "Day") return [cursor];
    const start =
      view === "Week"
        ? monday(cursor)
        : monday(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return Array.from({ length: view === "Week" ? 7 : 42 }, (_, i) =>
      shift(start, i),
    );
  }, [cursor, view]);
  const filtered = lessons.filter(
    (l) =>
      (group === "All classes" || l.group === group) &&
      `${l.title} ${l.group} ${l.room}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visible = filtered.filter((l) =>
    days.some((d) => dateKey(d) === l.date),
  );
  const weekLessons = lessons.filter(
    (l) =>
      l.date >= dateKey(monday(cursor)) &&
      l.date <= dateKey(shift(monday(cursor), 6)),
  );
  function navigate(direction: number) {
    setCursor((d) =>
      view === "Month"
        ? new Date(d.getFullYear(), d.getMonth() + direction, 1)
        : shift(d, direction * (view === "Week" ? 7 : 1)),
    );
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    const item: Lesson = {
      id: `local-${Date.now()}`,
      title: value("title"),
      date: value("date"),
      start: value("start"),
      end: value("end"),
      room: value("room"),
      group: value("group"),
      tone: groups.indexOf(value("group")),
    };
    if (!item.title || !item.room || !item.date || !item.start || !item.end) {
      setError("Complete all fields.");
      return;
    }
    if (item.end <= item.start) {
      setError("End time must be after start time.");
      return;
    }
    if (
      lessons.some(
        (l) => l.date === item.date && l.start < item.end && item.start < l.end,
      )
    ) {
      setError("You already have a lesson at this time. Choose another time.");
      return;
    }
    setLessons((prev) => [...prev, item]);
    setCursor(new Date(`${item.date}T12:00:00`));
    setGroup("All classes");
    setQuery("");
    setCreating(false);
    setNotice("Lesson added to this demo session.");
  }
  function lessonButton(l: Lesson) {
    return (
      <button
        key={l.id}
        className={`sc-lesson sc-tone-${l.tone}`}
        onClick={() => setSelected(l)}
      >
        <span className="sc-time">
          {l.start} – {l.end}
        </span>
        <strong>{l.title}</strong>
        <span>{l.group}</span>
        <span className="sc-room">↳ {l.room}</span>
      </button>
    );
  }
  return (
    <section className="sc-page" aria-label="Teaching schedule">
      <header className="sc-heading">
        <div>
          <div className="sc-eyebrow">CLASSFLOW / TEACHING</div>
          <h1>
            Teaching schedule<span>✦</span>
          </h1>
          <p>A little structure. More room to inspire.</p>
        </div>
        <button
          className="sc-primary"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          ＋ Add lesson
        </button>
      </header>
      <div className="sc-stats">
        <article>
          <span>LESSONS THIS WEEK</span>
          <strong>
            {weekLessons.length}
            <small>scheduled sessions</small>
          </strong>
        </article>
        <article>
          <span>TEACHING HOURS</span>
          <strong>
            {(
              weekLessons.reduce(
                (sum, l) => sum + minutes(l.end) - minutes(l.start),
                0,
              ) / 60
            ).toLocaleString()}
            <small>hours this week</small>
          </strong>
        </article>
        <article>
          <span>ACTIVE CLASSES</span>
          <strong>
            {new Set(weekLessons.map((l) => l.group)).size}
            <small>classes to inspire</small>
          </strong>
        </article>
      </div>
      <div className="sc-workspace">
        <div className="sc-calendar">
          <div className="sc-toolbar">
            <div className="sc-period">
              <button aria-label="Previous period" onClick={() => navigate(-1)}>
                ‹
              </button>
              <button aria-label="Next period" onClick={() => navigate(1)}>
                ›
              </button>
              <h2>{pretty(cursor, { month: "long", year: "numeric" })}</h2>
              <button onClick={() => setCursor(new Date())}>Today</button>
            </div>
            <div className="sc-tabs" role="group" aria-label="Calendar view">
              {(["Day", "Week", "Month"] as View[]).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="sc-filters">
            <label>
              <span className="sc-sr">Search lessons</span>
              <input
                type="search"
                placeholder="Search lessons, rooms…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              <span className="sc-sr">Filter class</span>
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                {["All classes", ...groups].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <span>{visible.length} lessons in view</span>
          </div>
          <div
            className={`sc-grid sc-${view.toLowerCase()}`}
            aria-label={`${view} calendar`}
          >
            {days.map((day) => {
              const key = dateKey(day);
              const entries = visible
                .filter((l) => l.date === key)
                .sort((a, b) => a.start.localeCompare(b.start));
              return (
                <div
                  key={key}
                  className={`sc-day-cell ${day.getMonth() !== cursor.getMonth() ? "sc-outside" : ""}`}
                >
                  <div className="sc-day-label">
                    <span>{pretty(day, { weekday: "short" })}</span>
                    <button
                      className={key === dateKey(today) ? "sc-today" : ""}
                      aria-label={`View ${pretty(day, { dateStyle: "full" })}`}
                      onClick={() => {
                        setCursor(day);
                        setView("Day");
                      }}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                  <div className="sc-day-lessons">
                    {entries.map(lessonButton)}
                    {entries.length === 0 && view !== "Month" && (
                      <span className="sc-free">
                        No lessons
                        <br />
                        <small>Room to recharge</small>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {visible.length === 0 && (
            <p className="sc-empty" role="status">
              No lessons match this period or your filters.
            </p>
          )}
          <footer className="sc-legend">
            {groups.map((g, i) => (
              <span key={g}>
                <i className={`sc-dot sc-dot-${i}`} />
                {g}
              </span>
            ))}
          </footer>
        </div>
        <aside className="sc-aside">
          <div className="sc-note">
            <span className="sc-eyebrow">YOUR WEEK, AT A GLANCE</span>
            <h2>
              Make time for
              <br />
              great teaching.
            </h2>
            <p>
              Plan your sessions, find your classroom, and keep every class on
              track.
            </p>
            <div className="sc-art" aria-hidden="true">
              ▦<span>✦</span>
            </div>
          </div>
          <div className="sc-upcoming">
            <h2>Coming up</h2>
            <p>From {pretty(today, { day: "numeric", month: "short" })}</p>
            {filtered
              .filter(
                (l) =>
                  l.date > dateKey(today) ||
                  (l.date === dateKey(today) &&
                    l.end >=
                      `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`),
              )
              .sort((a, b) =>
                `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`),
              )
              .slice(0, 3)
              .map((l) => (
                <button key={l.id} onClick={() => setSelected(l)}>
                  <span>
                    {pretty(new Date(`${l.date}T12:00:00`), {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {l.start}
                  </span>
                  <strong>{l.title}</strong>
                  <small>{l.room}</small>
                </button>
              ))}
            {!filtered.some((l) => l.date >= dateKey(today)) && (
              <p>No upcoming lessons.</p>
            )}
          </div>
        </aside>
      </div>
      <p className="sc-demo">Mock data · Changes last for this session only.</p>
      <p className="sc-status" role="status">
        {notice}
      </p>
      {(creating || selected) && (
        <div
          className="sc-overlay"
          onClick={() => {
            setCreating(false);
            setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setCreating(false);
              setSelected(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            className="sc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="sc-close"
              aria-label="Close dialog"
              onClick={() => {
                setCreating(false);
                setSelected(null);
              }}
            >
              ×
            </button>
            <h2 id="sc-modal-title">
              {creating ? "Add a lesson" : selected?.title}
            </h2>
            {creating ? (
              <form onSubmit={save}>
                <label>
                  Lesson title
                  <input name="title" required maxLength={100} />
                </label>
                <label>
                  Class
                  <select name="group">
                    {groups.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={dateKey(cursor)}
                  />
                </label>
                <div className="sc-form-row">
                  <label>
                    Start
                    <input
                      name="start"
                      type="time"
                      required
                      defaultValue="08:00"
                    />
                  </label>
                  <label>
                    End
                    <input
                      name="end"
                      type="time"
                      required
                      defaultValue="09:30"
                    />
                  </label>
                </div>
                <label>
                  Room
                  <input name="room" required maxLength={80} />
                </label>
                {error && (
                  <p role="alert" className="sc-error">
                    {error}
                  </p>
                )}
                <button className="sc-primary" type="submit">
                  Add lesson
                </button>
              </form>
            ) : (
              selected && (
                <>
                  <p className="sc-detail-class">{selected.group}</p>
                  <dl>
                    <dt>Date</dt>
                    <dd>
                      {pretty(new Date(`${selected.date}T12:00:00`), {
                        dateStyle: "full",
                      })}
                    </dd>
                    <dt>Time</dt>
                    <dd>
                      {selected.start} – {selected.end}
                    </dd>
                    <dt>Location</dt>
                    <dd>{selected.room}</dd>
                  </dl>
                  <button
                    className="sc-primary"
                    onClick={() => {
                      setCursor(new Date(`${selected.date}T12:00:00`));
                      setView("Day");
                      setSelected(null);
                    }}
                  >
                    View day
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
