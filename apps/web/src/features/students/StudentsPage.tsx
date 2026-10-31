import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./Students.css";

type Status = "Active" | "Pending";
type Student = {
  id: string;
  name: string;
  email: string;
  className: string;
  attendance: number;
  grade: string;
  status: Status;
  color: string;
};

const starterStudents: Student[] = [
  {
    id: "STU-2024-001",
    name: "Nguyễn Minh Anh",
    email: "minhanh.nguyen@greenwood.edu",
    className: "Math 10A1",
    attendance: 98,
    grade: "A",
    status: "Active",
    color: "violet",
  },
  {
    id: "STU-2024-002",
    name: "Emma Wilson",
    email: "emma.wilson@greenwood.edu",
    className: "Physics 11B2",
    attendance: 96,
    grade: "A−",
    status: "Active",
    color: "blue",
  },
  {
    id: "STU-2024-003",
    name: "Trần Đức Huy",
    email: "duchuy.tran@greenwood.edu",
    className: "English 10A2",
    attendance: 92,
    grade: "B+",
    status: "Active",
    color: "green",
  },
  {
    id: "STU-2024-004",
    name: "James Anderson",
    email: "james.anderson@greenwood.edu",
    className: "Chemistry 12A1",
    attendance: 89,
    grade: "B",
    status: "Active",
    color: "orange",
  },
  {
    id: "STU-2024-005",
    name: "Lê Hoàng Mai",
    email: "hoangmai.le@greenwood.edu",
    className: "Math 10A1",
    attendance: 99,
    grade: "A+",
    status: "Active",
    color: "pink",
  },
  {
    id: "STU-2024-006",
    name: "Olivia Martinez",
    email: "olivia.martinez@greenwood.edu",
    className: "Biology 11A1",
    attendance: 95,
    grade: "A",
    status: "Active",
    color: "blue",
  },
  {
    id: "STU-2024-007",
    name: "Phạm Gia Bảo",
    email: "giabao.pham@greenwood.edu",
    className: "Physics 11B2",
    attendance: 82,
    grade: "B−",
    status: "Pending",
    color: "violet",
  },
  {
    id: "STU-2024-008",
    name: "Noah Thompson",
    email: "noah.thompson@greenwood.edu",
    className: "English 10A2",
    attendance: 94,
    grade: "A−",
    status: "Active",
    color: "green",
  },
];

const classOptions = [
  "Math 10A1",
  "Physics 11B2",
  "English 10A2",
  "Chemistry 12A1",
  "Biology 11A1",
];
const initialForm = {
  name: "",
  email: "",
  className: classOptions[0],
  status: "Active" as Status,
};
const PAGE_SIZE = 6;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}
function Avatar({
  student,
  large = false,
}: {
  student: Student;
  large?: boolean;
}) {
  return (
    <span
      className={`students-avatar students-avatar-${student.color}${large ? " students-avatar-large" : ""}`}
    >
      {initials(student.name)}
    </span>
  );
}
function downloadCsv(rows: Student[]) {
  const csvCell = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    [
      "Student ID",
      "Name",
      "Email",
      "Class",
      "Attendance (%)",
      "Grade",
      "Status",
    ],
    ...rows.map((s) => [
      s.id,
      s.name,
      s.email,
      s.className,
      s.attendance,
      s.grade,
      s.status,
    ]),
  ];
  const csv =
    "\uFEFF" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "classflow-students.csv";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(starterStudents);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const allClasses = useMemo(
    () =>
      Array.from(
        new Set([...classOptions, ...students.map((s) => s.className)]),
      ),
    [students],
  );
  const filtered = useMemo(
    () =>
      students.filter((s) => {
        const matchQuery = `${s.name} ${s.id} ${s.email}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        return (
          matchQuery &&
          (classFilter === "All classes" || s.className === classFilter) &&
          (statusFilter === "All statuses" || s.status === statusFilter)
        );
      }),
    [students, query, classFilter, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const selectedOnPage =
    visible.length > 0 && visible.every((s) => selectedIds.includes(s.id));
  const detail = students.find((s) => s.id === detailId);
  const deleting = students.find((s) => s.id === deleteId);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const resetFiltersPage = () => {
    setPage(1);
    setSelectedIds([]);
  };
  const showMessage = (text: string) => {
    setMessage(text);
  };
  const startAdd = () => {
    setEditingId(null);
    setForm(initialForm);
    setFormOpen(true);
    setMenuId(null);
  };
  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      email: s.email,
      className: s.className,
      status: s.status,
    });
    setFormOpen(true);
    setMenuId(null);
  };
  const saveStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email) return;
    if (
      students.some(
        (s) =>
          s.email.toLowerCase() === email.toLowerCase() && s.id !== editingId,
      )
    ) {
      showMessage("This email already belongs to another student.");
      return;
    }
    if (editingId) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingId ? { ...s, ...form, name, email } : s,
        ),
      );
      showMessage("Student updated successfully.");
    } else {
      const nextNumber =
        students.reduce(
          (max, s) => Math.max(max, Number(s.id.match(/(\d+)$/)?.[1] ?? 0)),
          0,
        ) + 1;
      const student: Student = {
        id: `STU-2024-${String(nextNumber).padStart(3, "0")}`,
        ...form,
        name,
        email,
        attendance: 100,
        grade: "—",
        color: "violet",
      };
      setStudents((prev) => [...prev, student]);
      setClassFilter("All classes");
      setStatusFilter("All statuses");
      setQuery("");
      setPage(1);
      showMessage("Student added successfully.");
    }
    setFormOpen(false);
  };
  const confirmDelete = () => {
    if (!deleteId) return;
    setStudents((prev) => prev.filter((s) => s.id !== deleteId));
    setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
    if (detailId === deleteId) setDetailId(null);
    setDeleteId(null);
    setMenuId(null);
    showMessage("Student removed from demo data.");
  };

  return (
    <div className="students-page">
      {message && (
        <div className="students-toast" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
      {detail ? (
        <>
          <button className="students-back" onClick={() => setDetailId(null)}>
            <ArrowLeft size={17} /> Back to students
          </button>
          <div className="students-profile students-panel">
            <Avatar student={detail} large />
            <div className="students-profile-info">
              <h2>{detail.name}</h2>
              <p>
                {detail.id} · {detail.className}
              </p>
              <span>
                <Mail size={15} /> {detail.email}
              </span>
            </div>
            <button className="students-btn" onClick={() => startEdit(detail)}>
              <Pencil size={16} /> Edit student
            </button>
          </div>
          <div className="students-detail-stats">
            <div className="students-panel">
              <small>Attendance rate</small>
              <strong>{detail.attendance}%</strong>
            </div>
            <div className="students-panel">
              <small>Average grade</small>
              <strong>{detail.grade}</strong>
            </div>
            <div className="students-panel">
              <small>Current status</small>
              <strong>{detail.status}</strong>
            </div>
          </div>
          <div className="students-panel students-notes">
            <h3>Teacher notes</h3>
            <p>
              Private demo notes about this student, stored only until you
              refresh the page.
            </p>
            <textarea
              rows={4}
              value={notes[detail.id] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [detail.id]: e.target.value }))
              }
              placeholder="Write an observation about this student's progress..."
            />
          </div>
        </>
      ) : (
        <>
          <div className="students-topbar">
            <div>
              <div className="students-eyebrow">
                <Users size={14} /> STUDENT MANAGEMENT
              </div>
              <h2>
                All students{" "}
                <span className="students-count">
                  {students.length} students
                </span>
              </h2>
              <p>A community of curious minds.</p>
            </div>
            <div className="students-toolbar-actions">
              <button
                className="students-btn"
                onClick={() => downloadCsv(filtered)}
              >
                <Download size={16} /> Export
              </button>
              <button
                className="students-btn students-btn-primary"
                onClick={startAdd}
              >
                <Plus size={17} /> Add Student
              </button>
            </div>
          </div>
          <div className="students-panel students-table-panel">
            <div className="students-filters">
              <label className="students-search">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetFiltersPage();
                  }}
                  placeholder="Search students..."
                  aria-label="Search students"
                />
              </label>
              <select
                aria-label="Filter by class"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  resetFiltersPage();
                }}
              >
                <option>All classes</option>
                {allClasses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  resetFiltersPage();
                }}
              >
                <option>All statuses</option>
                <option>Active</option>
                <option>Pending</option>
              </select>
              <span className="students-results">
                {selectedIds.length
                  ? `${selectedIds.length} selected`
                  : `${filtered.length} results`}
              </span>
            </div>
            <div className="students-table-scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all on page"
                        checked={selectedOnPage}
                        onChange={(e) => {
                          const visibleIds = visible.map((s) => s.id);
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, ...visibleIds]))
                              : prev.filter((id) => !visibleIds.includes(id)),
                          );
                        }}
                      />
                    </th>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Class</th>
                    <th>Attendance</th>
                    <th>Avg. grade</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.name}`}
                          checked={selectedIds.includes(s.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, s.id]
                                : prev.filter((id) => id !== s.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="students-person"
                          onClick={() => setDetailId(s.id)}
                        >
                          <Avatar student={s} />
                          <span>
                            <b>{s.name}</b>
                            <small>{s.email}</small>
                          </span>
                        </button>
                      </td>
                      <td className="students-muted">{s.id}</td>
                      <td>
                        <span className="students-class-pill">
                          {s.className}
                        </span>
                      </td>
                      <td>
                        <div className="students-attendance">
                          <span
                            className={
                              s.attendance < 90
                                ? "students-warn"
                                : "students-good"
                            }
                          >
                            {s.attendance}%
                          </span>
                          <div className="students-progress">
                            <i style={{ width: `${s.attendance}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="students-grade">{s.grade}</span>
                      </td>
                      <td>
                        <span
                          className={`students-status ${s.status === "Active" ? "students-status-active" : "students-status-pending"}`}
                        >
                          <i />
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div className="students-action-wrap">
                          <button
                            className="students-icon-btn"
                            aria-label={`Actions for ${s.name}`}
                            onClick={() =>
                              setMenuId(menuId === s.id ? null : s.id)
                            }
                          >
                            <Ellipsis size={18} />
                          </button>
                          {menuId === s.id && (
                            <div className="students-row-menu">
                              <button
                                onClick={() => {
                                  setDetailId(s.id);
                                  setMenuId(null);
                                }}
                              >
                                View profile
                              </button>
                              <button onClick={() => startEdit(s)}>
                                Edit student
                              </button>
                              <button
                                className="students-danger"
                                onClick={() => {
                                  setDeleteId(s.id);
                                  setMenuId(null);
                                }}
                              >
                                Delete student
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="students-empty">
                  No students found. Try adjusting the filters.
                </div>
              )}
            </div>
            <div className="students-pagination">
              <span>
                Showing{" "}
                {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} students
              </span>
              <div>
                <button
                  className="students-btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <span className="students-page-number">
                  {safePage} / {totalPages}
                </span>
                <button
                  className="students-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <div
          className="students-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <section
            className="students-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="students-form-title"
          >
            <div className="students-modal-title">
              <div>
                <h3 id="students-form-title">
                  {editingId ? "Edit student" : "Add student"}
                </h3>
                <p>Manage student information for your classes.</p>
              </div>
              <button
                className="students-icon-btn"
                aria-label="Close dialog"
                onClick={() => setFormOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveStudent}>
              <label>
                Full name
                <input
                  required
                  maxLength={100}
                  autoFocus
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Student full name"
                />
              </label>
              <label>
                Email address
                <input
                  required
                  type="email"
                  maxLength={160}
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="student@school.edu"
                />
              </label>
              <label>
                Class
                <select
                  value={form.className}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, className: e.target.value }))
                  }
                >
                  {allClasses.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as Status,
                    }))
                  }
                >
                  <option>Active</option>
                  <option>Pending</option>
                </select>
              </label>
              <div className="students-modal-actions">
                <button
                  type="button"
                  className="students-btn"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="students-btn students-btn-primary"
                >
                  <Check size={16} />{" "}
                  {editingId ? "Save changes" : "Add student"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleting && (
        <div
          className="students-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteId(null);
          }}
        >
          <section
            className="students-modal students-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="students-delete-title"
          >
            <Trash2 size={28} className="students-danger" />
            <h3 id="students-delete-title">Delete student?</h3>
            <p>
              Remove <strong>{deleting.name}</strong> from this demo list? This
              action cannot be undone in the current session.
            </p>
            <div className="students-modal-actions">
              <button
                className="students-btn"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="students-btn students-btn-danger"
                onClick={confirmDelete}
              >
                Delete student
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
