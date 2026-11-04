import PageToolbar from "../../components/ui/PageToolbar";
import { useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Mail,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./Teachers.css";

type Teacher = {
  id: string;
  name: string;
  subject: string;
  email: string;
  phone: string;
  classes: string[];
  studentCount: number;
  experience: number;
  color: string;
  status: "Available" | "Busy";
  rating: number;
};

type TeacherDraft = Pick<
  Teacher,
  "name" | "subject" | "email" | "phone" | "experience" | "status"
>;

const initialTeachers: Teacher[] = [
  {
    id: "TCH-001",
    name: "Nguyễn Thị Lan",
    subject: "Mathematics",
    email: "lan.nguyen@greenwood.edu",
    phone: "028 5550 0201",
    classes: ["Math 10A1"],
    studentCount: 32,
    experience: 8,
    color: "violet",
    status: "Available",
    rating: 4.9,
  },
  {
    id: "TCH-002",
    name: "David Mitchell",
    subject: "Physics",
    email: "david.mitchell@greenwood.edu",
    phone: "028 5550 0202",
    classes: ["Physics 11B2"],
    studentCount: 28,
    experience: 7,
    color: "blue",
    status: "Available",
    rating: 4.8,
  },
  {
    id: "TCH-003",
    name: "Sarah Johnson",
    subject: "English Language",
    email: "sarah.johnson@greenwood.edu",
    phone: "028 5550 0203",
    classes: ["English 10A2"],
    studentCount: 30,
    experience: 9,
    color: "orange",
    status: "Busy",
    rating: 4.7,
  },
  {
    id: "TCH-004",
    name: "Trần Văn Minh",
    subject: "Chemistry",
    email: "minh.tran@greenwood.edu",
    phone: "028 5550 0204",
    classes: ["Chemistry 12A1"],
    studentCount: 26,
    experience: 6,
    color: "green",
    status: "Available",
    rating: 4.9,
  },
  {
    id: "TCH-005",
    name: "Emily Parker",
    subject: "Biology",
    email: "emily.parker@greenwood.edu",
    phone: "028 5550 0205",
    classes: ["Biology 11A1"],
    studentCount: 31,
    experience: 10,
    color: "pink",
    status: "Available",
    rating: 4.8,
  },
  {
    id: "TCH-006",
    name: "Lê Thanh Hà",
    subject: "World History",
    email: "ha.le@greenwood.edu",
    phone: "028 5550 0206",
    classes: ["History 12B1"],
    studentCount: 29,
    experience: 11,
    color: "violet",
    status: "Available",
    rating: 4.7,
  },
  {
    id: "TCH-007",
    name: "Michael Brown",
    subject: "Computer Science",
    email: "michael.brown@greenwood.edu",
    phone: "028 5550 0207",
    classes: ["Computer Science 11A2"],
    studentCount: 34,
    experience: 5,
    color: "blue",
    status: "Busy",
    rating: 4.9,
  },
  {
    id: "TCH-008",
    name: "Võ Ngọc Linh",
    subject: "Literature",
    email: "linh.vo@greenwood.edu",
    phone: "028 5550 0208",
    classes: ["Literature 12A2"],
    studentCount: 30,
    experience: 7,
    color: "pink",
    status: "Available",
    rating: 4.8,
  },
];

const blankDraft: TeacherDraft = {
  name: "",
  subject: "",
  email: "",
  phone: "",
  experience: 0,
  status: "Available",
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All subjects");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [draft, setDraft] = useState<TeacherDraft>(blankDraft);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [message, setMessage] = useState("");

  const subjects = useMemo(
    () => Array.from(new Set(teachers.map((t) => t.subject))).sort(),
    [teachers],
  );
  const filtered = useMemo(
    () =>
      teachers.filter((t) => {
        const searchMatch = `${t.name} ${t.subject} ${t.email} ${t.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        return (
          searchMatch &&
          (subjectFilter === "All subjects" || t.subject === subjectFilter) &&
          (statusFilter === "All statuses" || t.status === statusFilter)
        );
      }),
    [teachers, query, subjectFilter, statusFilter],
  );

  const inform = (text: string) => setMessage(text);
  const beginAdd = () => {
    setEditing(null);
    setDraft(blankDraft);
    setShowForm(true);
  };
  const beginEdit = (teacher: Teacher) => {
    setEditing(teacher);
    setDraft({
      name: teacher.name,
      subject: teacher.subject,
      email: teacher.email,
      phone: teacher.phone,
      experience: teacher.experience,
      status: teacher.status,
    });
    setSelected(null);
    setShowForm(true);
  };
  const saveTeacher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.subject.trim() || !draft.email.trim())
      return;
    const duplicate = teachers.some(
      (t) =>
        t.email.toLowerCase() === draft.email.trim().toLowerCase() &&
        t.id !== editing?.id,
    );
    if (duplicate) {
      inform("Email này đã được sử dụng bởi một giáo viên khác.");
      return;
    }
    const payload = {
      ...draft,
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      experience: Math.max(0, Number(draft.experience) || 0),
    };
    if (editing) {
      setTeachers((prev) =>
        prev.map((t) => (t.id === editing.id ? { ...t, ...payload } : t)),
      );
      inform("Teacher information updated.");
    } else {
      const nextId =
        Math.max(
          0,
          ...teachers.map((t) => Number(t.id.replace("TCH-", "")) || 0),
        ) + 1;
      setTeachers((prev) => [
        ...prev,
        {
          ...payload,
          id: `TCH-${String(nextId).padStart(3, "0")}`,
          classes: [],
          studentCount: 0,
          color: "violet",
          rating: 0,
        },
      ]);
      inform("Teacher added to the directory.");
    }
    setShowForm(false);
  };
  const removeTeacher = () => {
    if (!deleteTarget) return;
    setTeachers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setSelected(null);
    setDeleteTarget(null);
    inform("Teacher removed from the demo directory.");
  };

  return (
    <div className="teachers-page">
      <PageToolbar
        title="Our teaching community"
        subtitle="Passionate educators. Lasting impact."
      >
        <button
          type="button"
          className="teachers-btn teachers-btn-primary"
          onClick={beginAdd}
        >
          <Plus size={17} />
          Add Teacher
        </button>
      </PageToolbar>

      <div className="teachers-toolbar">
        <label className="teachers-search">
          <Search size={17} />
          <input
            aria-label="Search teachers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teachers, subjects, emails..."
          />
        </label>
        <label className="teachers-filter">
          <select
            aria-label="Filter by subject"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option>All subjects</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="teachers-filter">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All statuses</option>
            <option>Available</option>
            <option>Busy</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <span className="teachers-results">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length ? (
        <div className="teachers-grid">
          {filtered.map((t) => (
            <article className="teachers-card" key={t.id}>
              <div
                className={`teachers-status ${t.status === "Busy" ? "is-busy" : ""}`}
              >
                <span />
                {t.status}
              </div>
              <div className={`teachers-avatar teachers-color-${t.color}`}>
                {initials(t.name)}
              </div>
              <h3>{t.name}</h3>
              <p className="teachers-subject">{t.subject}</p>
              <div className="teachers-rating">
                <Star size={14} fill="currentColor" />
                {t.rating ? t.rating.toFixed(1) : "New"}
                {t.rating > 0 && <span>· demo rating</span>}
              </div>
              <div className="teachers-stats">
                <div>
                  <strong>{t.classes.length}</strong>
                  <span>Classes</span>
                </div>
                <div>
                  <strong>{t.studentCount}</strong>
                  <span>Students</span>
                </div>
                <div>
                  <strong>{t.experience}</strong>
                  <span>Years exp.</span>
                </div>
              </div>
              <div className="teachers-card-actions">
                <button
                  type="button"
                  className="teachers-btn teachers-btn-secondary"
                  onClick={() => setSelected(t)}
                >
                  <BookOpen size={15} />
                  View profile
                </button>
                <a
                  className="teachers-icon-btn"
                  href={`mailto:${t.email}`}
                  aria-label={`Email ${t.name}`}
                  title="Email"
                >
                  <Mail size={17} />
                </a>
                <button
                  type="button"
                  className="teachers-icon-btn"
                  onClick={() => beginEdit(t)}
                  aria-label={`Edit ${t.name}`}
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="teachers-empty">
          <Users size={28} />
          <h3>No teachers found</h3>
          <p>Try changing your search or filters.</p>
          <button
            type="button"
            className="teachers-btn teachers-btn-secondary"
            onClick={() => {
              setQuery("");
              setSubjectFilter("All subjects");
              setStatusFilter("All statuses");
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {selected && (
        <div
          className="teachers-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="teachers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-details-title"
          >
            <div className="teachers-modal-head">
              <h2 id="teacher-details-title">Teacher profile</h2>
              <button
                type="button"
                className="teachers-icon-btn"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <div className="teachers-profile">
              <div
                className={`teachers-avatar teachers-color-${selected.color}`}
              >
                {initials(selected.name)}
              </div>
              <h3>{selected.name}</h3>
              <p>{selected.subject}</p>
              <span className="teachers-profile-id">{selected.id}</span>
            </div>
            <dl className="teachers-profile-details">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{selected.experience} years</dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>
                  {selected.classes.length
                    ? selected.classes.join(", ")
                    : "Not assigned yet"}
                </dd>
              </div>
              <div>
                <dt>Students</dt>
                <dd>{selected.studentCount}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
            </dl>
            <div className="teachers-modal-actions">
              <button
                type="button"
                className="teachers-btn teachers-btn-danger-outline"
                onClick={() => {
                  setDeleteTarget(selected);
                  setSelected(null);
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
              <button
                type="button"
                className="teachers-btn teachers-btn-primary"
                onClick={() => beginEdit(selected)}
              >
                <Pencil size={16} />
                Edit teacher
              </button>
            </div>
          </section>
        </div>
      )}

      {showForm && (
        <div
          className="teachers-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <section
            className="teachers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-form-title"
          >
            <div className="teachers-modal-head">
              <h2 id="teacher-form-title">
                {editing ? "Edit teacher" : "Add new teacher"}
              </h2>
              <button
                type="button"
                className="teachers-icon-btn"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <p className="teachers-dialog-hint">
              Information is stored only in this browser session for now.
            </p>
            <form onSubmit={saveTeacher}>
              <div className="teachers-fields">
                <label>
                  Full name
                  <input
                    required
                    maxLength={100}
                    autoFocus
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Teacher's full name"
                  />
                </label>
                <label>
                  Subject
                  <input
                    required
                    maxLength={80}
                    value={draft.subject}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subject: e.target.value }))
                    }
                    placeholder="Mathematics"
                  />
                </label>
                <label className="teachers-span-2">
                  Email address
                  <input
                    required
                    type="email"
                    maxLength={120}
                    value={draft.email}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, email: e.target.value }))
                    }
                    placeholder="teacher@school.edu"
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    maxLength={30}
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, phone: e.target.value }))
                    }
                    placeholder="Phone number"
                  />
                </label>
                <label>
                  Years of experience
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={draft.experience}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        experience: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="teachers-span-2">
                  Availability
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as Teacher["status"],
                      }))
                    }
                  >
                    <option>Available</option>
                    <option>Busy</option>
                  </select>
                </label>
              </div>
              <div className="teachers-modal-actions">
                <button
                  type="button"
                  className="teachers-btn teachers-btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="teachers-btn teachers-btn-primary"
                >
                  <Check size={16} />
                  {editing ? "Save changes" : "Add Teacher"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="teachers-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            className="teachers-modal teachers-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacher-delete-title"
          >
            <div className="teachers-modal-head">
              <h2 id="teacher-delete-title">Delete teacher?</h2>
              <button
                type="button"
                className="teachers-icon-btn"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <p>
              Remove <strong>{deleteTarget.name}</strong> from the local demo
              list? This does not change any school database.
            </p>
            <div className="teachers-modal-actions">
              <button
                type="button"
                className="teachers-btn teachers-btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="teachers-btn teachers-btn-danger"
                onClick={removeTeacher}
              >
                <Trash2 size={16} />
                Delete teacher
              </button>
            </div>
          </section>
        </div>
      )}

      {message && (
        <div className="teachers-toast" role="status">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
