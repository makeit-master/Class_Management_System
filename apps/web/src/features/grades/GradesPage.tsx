import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  GraduationCap,
  Search,
  TrendingUp,
} from "lucide-react";
import "./Grades.css";

type Student = {
  id: string;
  name: string;
  className: string;
  email: string;
};

type ScoreName = "quiz1" | "quiz2" | "assignment" | "midterm";
type Scores = Record<string, Partial<Record<ScoreName, string>>>;

const scoreColumns: { key: ScoreName; label: string }[] = [
  { key: "quiz1", label: "Quiz 1" },
  { key: "quiz2", label: "Quiz 2" },
  { key: "assignment", label: "Assignment" },
  { key: "midterm", label: "Midterm" },
];

const students: Student[] = [
  {
    id: "STU-001",
    name: "Nguyễn Minh Anh",
    className: "Math 10A1",
    email: "minhanh@example.edu",
  },
  {
    id: "STU-002",
    name: "Trần Quốc Bảo",
    className: "Math 10A1",
    email: "quocbao@example.edu",
  },
  {
    id: "STU-003",
    name: "Lê Thảo Nguyên",
    className: "Math 10A1",
    email: "thaonguyen@example.edu",
  },
  {
    id: "STU-004",
    name: "Phạm Gia Huy",
    className: "Math 10A1",
    email: "giahuy@example.edu",
  },
  {
    id: "STU-005",
    name: "Hoàng Mai Linh",
    className: "English 10A2",
    email: "mailinh@example.edu",
  },
  {
    id: "STU-006",
    name: "Vũ Đức Anh",
    className: "English 10A2",
    email: "ducanh@example.edu",
  },
  {
    id: "STU-007",
    name: "Đỗ Ngọc Hà",
    className: "English 10A2",
    email: "ngocha@example.edu",
  },
  {
    id: "STU-008",
    name: "Bùi Thanh Phong",
    className: "Physics 11B2",
    email: "thanhphong@example.edu",
  },
  {
    id: "STU-009",
    name: "Nguyễn Hải Nam",
    className: "Physics 11B2",
    email: "hainam@example.edu",
  },
  {
    id: "STU-010",
    name: "Trương Bảo Châu",
    className: "Chemistry 12A1",
    email: "baochau@example.edu",
  },
];

const initialScores: Scores = Object.fromEntries(
  students.map((student, index) => [
    student.id,
    {
      quiz1: String(86 + ((index * 7) % 14)),
      quiz2: String(76 + ((index * 5) % 21)),
      assignment: String(83 + ((index * 3) % 17)),
      midterm: String(72 + ((index * 9) % 25)),
    },
  ]),
);

function averageFor(
  row: Partial<Record<ScoreName, string>> | undefined,
): number | null {
  const entries = scoreColumns
    .map(({ key }) => row?.[key])
    .filter((value): value is string => value !== undefined && value !== "");
  if (entries.length === 0) return null;
  return (
    entries.reduce((sum, value) => sum + Number(value), 0) / entries.length
  );
}

function gradeLetter(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function GradesPage() {
  const [selectedClass, setSelectedClass] = useState("All classes");
  const [semester, setSemester] = useState("Spring 2025");
  const [query, setQuery] = useState("");
  const [scores, setScores] = useState<Scores>(initialScores);
  const [savedMessage, setSavedMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const classes = useMemo(
    () => Array.from(new Set(students.map((student) => student.className))),
    [],
  );
  const filtered = useMemo(
    () =>
      students.filter(
        (student) =>
          (selectedClass === "All classes" ||
            student.className === selectedClass) &&
          `${student.name} ${student.id} ${student.email}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [selectedClass, query],
  );

  const averages = filtered
    .map((student) => averageFor(scores[student.id]))
    .filter((value): value is number => value !== null);
  const overallAverage = averages.length
    ? averages.reduce((sum, value) => sum + value, 0) / averages.length
    : null;
  const distribution = ["A", "B", "C", "D", "F"].map((grade) => ({
    grade,
    count: averages.filter((value) => gradeLetter(value) === grade).length,
  }));
  const gradedStudents = averages.length;

  const updateScore = (id: string, key: ScoreName, value: string) => {
    if (
      value !== "" &&
      (!/^\d{1,3}(\.\d{0,2})?$/.test(value) || Number(value) > 100)
    )
      return;
    setScores((previous) => ({
      ...previous,
      [id]: { ...previous[id], [key]: value },
    }));
    setSavedMessage("");
    setHasChanges(true);
  };

  const exportCsv = () => {
    const header = [
      "Student ID",
      "Student",
      "Class",
      ...scoreColumns.map((column) => column.label),
      "Average",
    ];
    const rows = filtered.map((student) => {
      const average = averageFor(scores[student.id]);
      return [
        student.id,
        student.name,
        student.className,
        ...scoreColumns.map(({ key }) => scores[student.id]?.[key] ?? ""),
        average === null ? "" : average.toFixed(1),
      ];
    });
    const csv =
      "\ufeff" +
      [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `classflow-grades-${semester.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grades-page">
      <div className="grades-heading">
        <div>
          <div className="grades-eyebrow">
            <GraduationCap size={14} /> ACADEMIC PERFORMANCE
          </div>
          <h2>
            Gradebook<span>.</span>
          </h2>
          <p>Every effort deserves to be recognized.</p>
        </div>
        <div className="grades-actions">
          <button className="grades-button" onClick={exportCsv} type="button">
            <Download size={16} /> Export CSV
          </button>
          <button
            className="grades-button grades-primary"
            type="button"
            onClick={() => {
              setHasChanges(false);
              setSavedMessage(
                "Demo only: scores are kept in this page until refresh.",
              );
            }}
          >
            <Check size={16} /> Save changes
          </button>
        </div>
      </div>

      <div className="grades-stats">
        <div className="grades-stat">
          <span className="grades-stat-icon violet">
            <BookOpen size={20} />
          </span>
          <div>
            <p>Students in view</p>
            <strong>{filtered.length}</strong>
          </div>
        </div>
        <div className="grades-stat">
          <span className="grades-stat-icon blue">
            <GraduationCap size={20} />
          </span>
          <div>
            <p>Graded students</p>
            <strong>{gradedStudents}</strong>
          </div>
        </div>
        <div className="grades-stat">
          <span className="grades-stat-icon green">
            <TrendingUp size={20} />
          </span>
          <div>
            <p>Average score</p>
            <strong>
              {overallAverage === null ? "—" : overallAverage.toFixed(1)}
              <small> / 100</small>
            </strong>
          </div>
        </div>
      </div>

      <div className="grades-filters">
        <label className="grades-filter">
          <span>Class</span>
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
          >
            <option>All classes</option>
            {classes.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="grades-filter">
          <span>Semester</span>
          <select
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
          >
            <option>Spring 2025</option>
            <option>Fall 2024</option>
          </select>
        </label>
        <label className="grades-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students..."
            aria-label="Search students"
          />
        </label>
        <span className="grades-hint">Click a score to edit · / 100</span>
      </div>

      <div className="grades-grid">
        <section className="grades-card grades-table-card">
          <div className="grades-card-title">
            <div>
              <h3>Student grades</h3>
              <p>
                {filtered.length} students · Equal weight for four assessments
              </p>
            </div>
            {hasChanges && (
              <span className="grades-unsaved">Unsaved changes</span>
            )}
          </div>
          <div className="grades-table-scroll">
            <table className="grades-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {scoreColumns.map(({ key, label }) => (
                    <th key={key}>
                      {label}
                      <small>/100</small>
                    </th>
                  ))}
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => {
                  const average = averageFor(scores[student.id]);
                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="grades-student">
                          <span className="grades-avatar">
                            {student.name
                              .trim()
                              .split(/\s+/)
                              .slice(-2)
                              .map((part) => part[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div>
                            <strong>{student.name}</strong>
                            <small>
                              {student.id} · {student.className}
                            </small>
                          </div>
                        </div>
                      </td>
                      {scoreColumns.map(({ key, label }) => (
                        <td key={key}>
                          <input
                            className="grades-score-input"
                            aria-label={`${student.name} ${label}`}
                            inputMode="decimal"
                            type="text"
                            value={scores[student.id]?.[key] ?? ""}
                            onChange={(event) =>
                              updateScore(student.id, key, event.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td>
                        <strong className="grades-average">
                          {average === null ? "—" : average.toFixed(1)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="grades-empty">
                No students match your filters.
              </div>
            )}
          </div>
          <div className="grades-table-footer">
            <span>
              Scores must be between 0 and 100. Empty cells are ungraded.
            </span>
            <span>{filtered.length} results</span>
          </div>
        </section>

        <aside className="grades-card grades-distribution">
          <div className="grades-card-title">
            <div>
              <h3>Grade distribution</h3>
              <p>A snapshot of student performance.</p>
            </div>
          </div>
          <div className="grades-bars">
            {distribution.map(({ grade, count }) => (
              <div className="grades-bar-col" key={grade}>
                <span>{count}</span>
                <div className="grades-bar-track">
                  <div
                    style={{
                      height: `${gradedStudents && count ? Math.max(4, (count / gradedStudents) * 100) : 0}%`,
                    }}
                    className={`grades-bar grade-${grade.toLowerCase()}`}
                  />
                </div>
                <strong>{grade}</strong>
              </div>
            ))}
          </div>
          <div className="grades-distribution-footer">
            <span>Class average</span>
            <strong>
              {overallAverage === null ? "—" : overallAverage.toFixed(1)}
              <small> / 100</small>
            </strong>
          </div>
          <p className="grades-grading-note">
            Demo scale: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F &lt; 60. These
            thresholds can be configured when the backend is integrated.
          </p>
        </aside>
      </div>
      {savedMessage && (
        <div className="grades-message" role="status">
          <Check size={16} />
          {savedMessage}
        </div>
      )}
    </div>
  );
}
