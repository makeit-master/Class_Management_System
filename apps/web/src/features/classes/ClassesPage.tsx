import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  List,
  Plus,
  Search,
  Users,
  X,
  Clock3,
  MapPin,
} from "lucide-react";
import "./Classes.css";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  teacher: string;
  students: number;
  time: string;
  room: string;
  day: string;
  color: "violet" | "blue" | "orange" | "green" | "pink";
  progress: number;
};

const initialClasses: ClassItem[] = [
  {
    id: "1",
    name: "Math 10A1",
    subject: "Mathematics",
    teacher: "Nguyễn Thị Lan",
    students: 32,
    time: "08:00 – 09:30",
    room: "Room 201",
    day: "Mon, Wed, Fri",
    color: "violet",
    progress: 72,
  },
  {
    id: "2",
    name: "Physics 11B2",
    subject: "Physics",
    teacher: "David Mitchell",
    students: 28,
    time: "09:45 – 11:15",
    room: "Lab 102",
    day: "Mon, Tue, Thu",
    color: "blue",
    progress: 64,
  },
  {
    id: "3",
    name: "English 10A2",
    subject: "English Language",
    teacher: "Sarah Johnson",
    students: 30,
    time: "13:00 – 14:30",
    room: "Room 305",
    day: "Mon, Wed, Fri",
    color: "orange",
    progress: 85,
  },
  {
    id: "4",
    name: "Chemistry 12A1",
    subject: "Chemistry",
    teacher: "Trần Văn Minh",
    students: 26,
    time: "14:45 – 16:15",
    room: "Lab 104",
    day: "Tue, Thu",
    color: "green",
    progress: 58,
  },
  {
    id: "5",
    name: "Biology 11A1",
    subject: "Biology",
    teacher: "Emily Parker",
    students: 31,
    time: "08:00 – 09:30",
    room: "Lab 103",
    day: "Tue, Thu, Fri",
    color: "pink",
    progress: 68,
  },
  {
    id: "6",
    name: "History 12B1",
    subject: "World History",
    teacher: "Lê Thanh Hà",
    students: 29,
    time: "09:45 – 11:15",
    room: "Room 204",
    day: "Mon, Wed",
    color: "violet",
    progress: 76,
  },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

export default function ClassesPage() {
  const [items, setItems] = useState<ClassItem[]>(initialClasses);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("All grades");
  const [teacher, setTeacher] = useState("All teachers");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const teachers = useMemo(
    () => [...new Set(items.map((c) => c.teacher))].sort(),
    [items],
  );
  const filtered = useMemo(
    () =>
      items.filter((c) => {
        const matchText = `${c.name} ${c.subject} ${c.teacher}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchGrade =
          grade === "All grades" || c.name.match(/\b(10|11|12)/)?.[0] === grade;
        return (
          matchText &&
          matchGrade &&
          (teacher === "All teachers" || c.teacher === teacher)
        );
      }),
    [items, query, grade, teacher],
  );

  function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const assignedTeacher = String(data.get("teacher") ?? "").trim();
    if (!name || !subject || !assignedTeacher) return;
    if (items.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      window.alert("A class with this name already exists.");
      return;
    }
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        subject,
        teacher: assignedTeacher,
        students: 0,
        time: String(data.get("time") || "To be scheduled"),
        room: String(data.get("room") || "TBA"),
        day: String(data.get("day") || "TBA"),
        color: "violet",
        progress: 0,
      },
    ]);
    setShowCreate(false);
    setQuery("");
    setGrade("All grades");
    setTeacher("All teachers");
  }

  return (
    <div className="classes-ui">
      <div className="classes-toolbar">
        <div>
          <h2>
            All classes{" "}
            <span className="classes-count">{items.length} classes</span>
          </h2>
          <p>Manage your classes and keep learning on track.</p>
        </div>
        <button
          type="button"
          className="classes-primary"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={17} /> New Class
        </button>
      </div>

      <div className="classes-filters">
        <label className="classes-search">
          <Search size={17} />
          <input
            aria-label="Search classes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes..."
          />
        </label>
        <select
          aria-label="Filter by grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          <option>All grades</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
        </select>
        <select
          aria-label="Filter by teacher"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
        >
          <option>All teachers</option>
          {teachers.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="classes-view-switch" aria-label="Layout mode">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className={`classes-grid ${view === "list" ? "is-list" : ""}`}>
        {filtered.map((c) => (
          <article className="classes-card" key={c.id}>
            <div className="classes-card-top">
              <span className={`classes-icon classes-${c.color}`}>
                <BookOpen size={22} strokeWidth={1.7} />
              </span>
              <span className="classes-status">
                <span /> Active
              </span>
            </div>
            <h3>{c.name}</h3>
            <p className="classes-subject">{c.subject} · Demo academic year</p>
            <div className="classes-teacher">
              <span className={`classes-avatar classes-${c.color}`}>
                {initials(c.teacher)}
              </span>
              <span>
                <strong>{c.teacher}</strong>
                <small>Class teacher</small>
              </span>
            </div>
            <div className="classes-metadata">
              <span>
                <Users size={15} /> {c.students} students
              </span>
              <span>
                <CalendarDays size={15} /> {c.day}
              </span>
            </div>
            <div className="classes-progress-title">
              <span>Course progress</span>
              <b>{c.progress}%</b>
            </div>
            <div className="classes-progress">
              <span
                className={`classes-fill classes-${c.color}`}
                style={{ width: `${c.progress}%` }}
              />
            </div>
            {selectedId === c.id && (
              <div className="classes-detail">
                <span>
                  <Clock3 size={15} /> {c.time}
                </span>
                <span>
                  <MapPin size={15} /> {c.room}
                </span>
              </div>
            )}
            <button
              type="button"
              className="classes-details-button"
              aria-expanded={selectedId === c.id}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
            >
              {selectedId === c.id
                ? "Hide class details"
                : "View class details"}{" "}
              <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="classes-empty">
          <Search size={28} />
          <h3>No classes found</h3>
          <p>Try another search or change your filters.</p>
        </div>
      )}

      {showCreate && (
        <div
          className="classes-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <section
            className="classes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-class-heading"
          >
            <div className="classes-modal-header">
              <div>
                <h2 id="create-class-heading">Create new class</h2>
                <p>Add a class to your demo workspace.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCreate(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={createClass}>
              <label>
                Class name{" "}
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Math 10A3"
                />
              </label>
              <label>
                Subject{" "}
                <input
                  name="subject"
                  required
                  maxLength={80}
                  placeholder="e.g. Mathematics"
                />
              </label>
              <label>
                Teacher{" "}
                <input
                  name="teacher"
                  required
                  maxLength={100}
                  placeholder="e.g. Nguyễn Thị Lan"
                />
              </label>
              <div className="classes-form-row">
                <label>
                  Room <input name="room" placeholder="Room 201" />
                </label>
                <label>
                  Time <input name="time" placeholder="08:00 – 09:30" />
                </label>
              </div>
              <label>
                Days <input name="day" placeholder="Mon, Wed, Fri" />
              </label>
              <div className="classes-modal-actions">
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="classes-primary" type="submit">
                  <Plus size={16} /> Create class
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
