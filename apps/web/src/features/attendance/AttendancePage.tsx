import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Download,
  Search,
  UsersRound,
} from "lucide-react";
import "./Attendance.css";

type AttendanceStatus = "Present" | "Absent" | "Late";
type Student = {
  id: string;
  name: string;
  className: string;
  email: string;
  color: string;
};

const students: Student[] = [
  {
    id: "STU-2024-001",
    name: "Nguyễn Minh Anh",
    className: "Math 10A1",
    email: "minhanh.nguyen@greenwood.edu",
    color: "violet",
  },
  {
    id: "STU-2024-002",
    name: "Emma Wilson",
    className: "Physics 11B2",
    email: "emma.wilson@greenwood.edu",
    color: "blue",
  },
  {
    id: "STU-2024-003",
    name: "Trần Đức Huy",
    className: "English 10A2",
    email: "duchuy.tran@greenwood.edu",
    color: "green",
  },
  {
    id: "STU-2024-004",
    name: "James Anderson",
    className: "Chemistry 12A1",
    email: "james.anderson@greenwood.edu",
    color: "orange",
  },
  {
    id: "STU-2024-005",
    name: "Lê Hoàng Mai",
    className: "Math 10A1",
    email: "hoangmai.le@greenwood.edu",
    color: "pink",
  },
  {
    id: "STU-2024-006",
    name: "Olivia Martinez",
    className: "Biology 11A1",
    email: "olivia.martinez@greenwood.edu",
    color: "blue",
  },
  {
    id: "STU-2024-007",
    name: "Phạm Gia Bảo",
    className: "Physics 11B2",
    email: "giabao.pham@greenwood.edu",
    color: "violet",
  },
  {
    id: "STU-2024-008",
    name: "Noah Thompson",
    className: "English 10A2",
    email: "noah.thompson@greenwood.edu",
    color: "green",
  },
];

const classOptions = [...new Set(students.map((student) => student.className))];
const statusOptions: AttendanceStatus[] = ["Present", "Absent", "Late"];

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportCsv(
  date: string,
  rows: Student[],
  getStatus: (id: string) => AttendanceStatus | undefined,
) {
  const lines = [
    ["Date", "Student ID", "Name", "Class", "Status"].map(csvCell).join(","),
    ...rows.map((student) =>
      [
        date,
        student.id,
        student.name,
        student.className,
        getStatus(student.id) ?? "Unmarked",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `classflow-attendance-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AttendancePage() {
  const [date, setDate] = useState(localDate);
  const [className, setClassName] = useState("All classes");
  const [query, setQuery] = useState("");
  // Each selected date gets its own attendance entries. In-memory demo only.
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [savedSessions, setSavedSessions] = useState<Record<string, boolean>>(
    {},
  );
  const [feedback, setFeedback] = useState("");

  const keyFor = (studentId: string) => `${date}::${studentId}`;
  const sessionKey = `${date}::${className}`;
  const getStatus = (studentId: string) => records[keyFor(studentId)];

  const classStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          className === "All classes" || student.className === className,
      ),
    [className],
  );
  const visibleStudents = useMemo(
    () =>
      classStudents.filter((student) =>
        `${student.name} ${student.id} ${student.email} ${student.className}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      ),
    [classStudents, query],
  );
  const totals = {
    Present: classStudents.filter(
      (student) => getStatus(student.id) === "Present",
    ).length,

    Absent: classStudents.filter(
      (student) => getStatus(student.id) === "Absent",
    ).length,

    Late: classStudents.filter((student) => getStatus(student.id) === "Late")
      .length,

    Unmarked: classStudents.filter(
      (student) => getStatus(student.id) === undefined,
    ).length,
  };

  const mark = (studentId: string, status: AttendanceStatus) => {
    setRecords((previous) => ({ ...previous, [keyFor(studentId)]: status }));
    setSavedSessions((previous) => ({ ...previous, [sessionKey]: false }));
    setFeedback("");
  };

  const markAllPresent = () => {
    setRecords((previous) => {
      const next = { ...previous };
      // Do not limit bulk action to the currently searched subset.
      classStudents.forEach((student) => {
        next[keyFor(student.id)] = "Present";
      });
      return next;
    });
    setSavedSessions((previous) => ({ ...previous, [sessionKey]: false }));
    setFeedback(
      `Đã đánh dấu có mặt cho ${classStudents.length} học sinh trong phạm vi lớp đang chọn.`,
    );
  };

  const save = () => {
    if (totals.Unmarked > 0) {
      setFeedback(
        `Còn ${totals.Unmarked} học sinh chưa điểm danh. Hãy hoàn thành trước khi lưu.`,
      );
      return;
    }
    setSavedSessions((previous) => ({ ...previous, [sessionKey]: true }));
    setFeedback(
      `Đã ghi nhận điểm danh ngày ${date} trong phiên demo. Chưa lưu lên server.`,
    );
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div>
          <span className="attendance-eyebrow">
            <span className="attendance-pulse" /> CLASSROOM OVERVIEW
          </span>
          <h2>
            Daily attendance<span className="attendance-accent">.</span>
          </h2>
          <p>A simple check-in. A stronger connection.</p>
        </div>
        <div className="attendance-header-actions">
          <button
            className="attendance-button"
            type="button"
            onClick={() => exportCsv(date, classStudents, getStatus)}
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            className="attendance-button attendance-primary"
            type="button"
            onClick={save}
          >
            <Check size={17} /> Save attendance
          </button>
        </div>
      </div>

      <div className="attendance-stats">
        {(
          [
            {
              title: "Present",
              color: "green",
              icon: CheckCheck,
              value: totals.Present,
            },
            {
              title: "Absent",
              color: "red",
              icon: UsersRound,
              value: totals.Absent,
            },
            {
              title: "Late",
              color: "orange",
              icon: Clock3,
              value: totals.Late,
            },
          ] as const
        ).map((item) => (
          <div
            className={`attendance-stat attendance-stat-${item.color}`}
            key={item.title}
          >
            <div className="attendance-stat-top">
              <span>
                <i /> {item.title}
              </span>
              <item.icon size={19} />
            </div>
            <strong>
              {item.value}
              <small> students</small>
            </strong>
            <p>
              {classStudents.length
                ? Math.round((item.value / classStudents.length) * 100)
                : 0}
              % of selected students
            </p>
          </div>
        ))}
      </div>

      <section className="attendance-panel">
        <div className="attendance-panel-top">
          <div>
            <h3>Attendance register</h3>
            <p>Record attendance by class and date.</p>
          </div>
          <span className="attendance-count">
            {classStudents.length} students
          </span>
        </div>
        <div className="attendance-filters">
          <label className="attendance-date">
            <CalendarDays size={17} />
            <input
              aria-label="Attendance date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setFeedback("");
              }}
            />
          </label>
          <label className="attendance-select-label">
            <span className="attendance-sr-only">Choose class</span>
            <select
              aria-label="Choose class"
              value={className}
              onChange={(event) => {
                setClassName(event.target.value);
                setFeedback("");
              }}
            >
              <option>All classes</option>
              {classOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="attendance-search">
            <Search size={17} />
            <input
              aria-label="Search students"
              placeholder="Search students..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className="attendance-button attendance-mark-all"
            type="button"
            onClick={markAllPresent}
          >
            <CheckCheck size={16} /> Mark all present
          </button>
        </div>
        <div className="attendance-summary">
          <span>
            <ClipboardCheck size={15} />{" "}
            {classStudents.length - totals.Unmarked}/{classStudents.length}{" "}
            marked
          </span>
          <span>
            {savedSessions[sessionKey]
              ? "Saved in demo session"
              : totals.Unmarked
                ? `${totals.Unmarked} unmarked`
                : "Ready to save"}
          </span>
        </div>
        {feedback && (
          <p className="attendance-feedback" role="status">
            {feedback}
          </p>
        )}
        <div className="attendance-table-scroll">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Class</th>
                <th>Attendance status</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="attendance-student">
                      <span
                        className={`attendance-avatar attendance-avatar-${student.color}`}
                      >
                        {initials(student.name)}
                      </span>
                      <div>
                        <strong>{student.name}</strong>
                        <small>{student.email}</small>
                      </div>
                    </div>
                  </td>
                  <td className="attendance-muted">{student.id}</td>
                  <td>
                    <span className="attendance-class-tag">
                      {student.className}
                    </span>
                  </td>
                  <td>
                    <div
                      className="attendance-segments"
                      role="group"
                      aria-label={`Attendance for ${student.name}`}
                    >
                      {statusOptions.map((status) => (
                        <button
                          type="button"
                          key={status}
                          aria-pressed={getStatus(student.id) === status}
                          className={
                            getStatus(student.id) === status
                              ? `is-active is-${status.toLowerCase()}`
                              : ""
                          }
                          onClick={() => mark(student.id, status)}
                        >
                          {getStatus(student.id) === status && (
                            <Check size={13} />
                          )}
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="attendance-empty">
                    No students match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="attendance-footer">
          <span>Mock data · Changes reset on reload</span>
          <span>{visibleStudents.length} visible students</span>
        </footer>
      </section>
    </div>
  );
}
