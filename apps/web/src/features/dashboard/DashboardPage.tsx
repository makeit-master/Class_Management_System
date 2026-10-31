import { useState } from "react";
import "./Dashboard.css";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Clock3,
  Download,
  Ellipsis,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import IconButton from "../../components/ui/IconButton";
import SectionHeading from "../../components/ui/SectionHeading";
import Select from "../../components/ui/Select";

type Page =
  | "Dashboard"
  | "Classes"
  | "Students"
  | "Student Detail"
  | "Teachers"
  | "Attendance"
  | "Grades"
  | "Schedule"
  | "Settings"
  | "Login";

const classes = [
  {
    name: "Math 10A1",
    subject: "Mathematics",
    teacher: "Nguyễn Thị Lan",
    initials: "NL",
    students: 32,
    time: "08:00 – 09:30",
    room: "Room 201",
    day: "Mon, Wed, Fri",
    color: "violet",
    progress: 72,
  },
  {
    name: "Physics 11B2",
    subject: "Physics",
    teacher: "David Mitchell",
    initials: "DM",
    students: 28,
    time: "09:45 – 11:15",
    room: "Lab 102",
    day: "Mon, Tue, Thu",
    color: "blue",
    progress: 64,
  },
  {
    name: "English 10A2",
    subject: "English Language",
    teacher: "Sarah Johnson",
    initials: "SJ",
    students: 30,
    time: "13:00 – 14:30",
    room: "Room 305",
    day: "Mon, Wed, Fri",
    color: "orange",
    progress: 85,
  },
  {
    name: "Chemistry 12A1",
    subject: "Chemistry",
    teacher: "Trần Văn Minh",
    initials: "TM",
    students: 26,
    time: "14:45 – 16:15",
    room: "Lab 104",
    day: "Tue, Thu",
    color: "green",
    progress: 58,
  },
  {
    name: "Biology 11A1",
    subject: "Biology",
    teacher: "Emily Parker",
    initials: "EP",
    students: 31,
    time: "08:00 – 09:30",
    room: "Lab 103",
    day: "Tue, Thu, Fri",
    color: "pink",
    progress: 68,
  },
  {
    name: "History 12B1",
    subject: "World History",
    teacher: "Lê Thanh Hà",
    initials: "LH",
    students: 29,
    time: "09:45 – 11:15",
    room: "Room 204",
    day: "Mon, Wed",
    color: "violet",
    progress: 76,
  },
];

function AttendanceChart({ period = "This week" }: { period?: string }) {
  const points =
    period === "Last week"
      ? "0,100 80,126 160,72 240,92 320,45 400,75 480,24 560,46 640,16"
      : "0,130 40,122 80,136 120,99 160,96 200,105 240,75 280,81 320,44 360,61 400,66 440,42 480,51 520,25 560,42 600,32 640,18";
  return (
    <div className="line-chart">
      <div className="chart-y">
        <span>100%</span>
        <span>95%</span>
        <span>90%</span>
        <span>85%</span>
        <span>80%</span>
      </div>
      <div className="chart-plot">
        <svg
          viewBox="0 0 640 180"
          preserveAspectRatio="none"
          role="img"
          aria-label="Attendance rose from 89% on Monday to 98% on Sunday"
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".23" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 44, 88, 132, 176].map((y) => (
            <line key={y} x1="0" x2="640" y1={y} y2={y} className="grid-line" />
          ))}
          <polygon points={`0,180 ${points} 640,180`} fill="url(#area)" />
          <polyline
            points={
              period === "Last week"
                ? "0,142 80,130 160,145 240,113 320,118 400,90 480,105 560,80 640,93"
                : "0,150 80,140 160,150 240,123 320,130 400,104 480,115 560,97 640,105"
            }
            fill="none"
            stroke="#4a3a68"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#9b79ff"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx="400"
            cy={period === "Last week" ? 75 : 66}
            r="5"
            fill="#a78bfa"
            stroke="var(--surface)"
            strokeWidth="3"
          />
        </svg>
        <div className="chart-x">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function DashboardPage({
  navigate,
  notify,
}: {
  navigate: (p: Page) => void;
  notify: (s: string) => void;
}) {
  const [period, setPeriod] = useState("This week");
  return (
    <div className="dashboard-figma">
      <div className="page-toolbar dashboard-toolbar">
        <div className="greeting">
          <span className="eyebrow">
            <span className="live-dot" /> SCHOOL OVERVIEW
          </span>
          <h2>
            A good day to make a difference
            <span className="violet-text">.</span>
          </h2>
        </div>
        <div className="toolbar-actions">
          <Button
            onClick={() =>
              notify("Showing the current school day: Monday, May 19, 2025")
            }
          >
            <CalendarDays size={16} />
            May 19, 2025
            <ChevronDown size={14} />
          </Button>
          <Button
            onClick={() => {
              const a = document.createElement("a");
              a.href =
                "data:text/csv;charset=utf-8,Metric,Value%0ATotal Students,1248%0ATotal Classes,42%0ATotal Teachers,64%0AAttendance,96.8%25";
              a.download = "classflow-report.csv";
              a.click();
              notify("Your school report has been exported.");
            }}
          >
            <Download size={16} />
            Export report
          </Button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Total Students",
            value: "1,248",
            change: "12.8%",
            note: "vs. last month",
            icon: UsersRound,
            color: "violet",
            mini: [12, 20, 17, 29, 25, 37, 34, 48],
          },
          {
            title: "Total Classes",
            value: "42",
            change: "8.2%",
            note: "vs. last month",
            icon: BookOpen,
            color: "blue",
            mini: [14, 12, 22, 19, 30, 28, 38, 43],
          },
          {
            title: "Total Teachers",
            value: "64",
            change: "4.9%",
            note: "vs. last month",
            icon: GraduationCap,
            color: "orange",
            mini: [12, 18, 15, 26, 25, 33, 31, 40],
          },
          {
            title: "Attendance Rate",
            value: "96.8",
            change: "2.1%",
            note: "vs. last month",
            icon: CheckCheck,
            color: "green",
            mini: [14, 22, 18, 28, 23, 34, 30, 45],
          },
        ].map((s, i) => (
          <div className="stat-card card" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span className={`icon-tile ${s.color}`}>
                <s.icon size={21} strokeWidth={1.6} />
              </span>
            </div>
            <div className="stat-main">
              <div className="stat-value">
                {s.value}
                {i === 3 && <span className="percent">%</span>}
              </div>
              <div className={`spark-bars ${s.color}`}>
                {s.mini.map((h, n) => (
                  <i key={n} style={{ height: h, opacity: 0.3 + n * 0.09 }} />
                ))}
              </div>
            </div>
            <div className="stat-footer">
              <span className="trend">
                <TrendingUp size={13} />
                {s.change}
              </span>
              <span>{s.note}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="card attendance-card">
          <SectionHeading
            title="Attendance overview"
            subtitle="A little consistency goes a long way."
            action={
              <Select value={period} onChange={setPeriod}>
                <option>This week</option>
                <option>Last week</option>
              </Select>
            }
          />
          <div className="chart-summary">
            <strong>
              {period === "This week" ? "96.8" : "94.7"}
              <span>%</span>
            </strong>
            <span className="trend">
              <ArrowUpRight size={14} />
              2.1%
            </span>
            <span className="muted">from last week</span>
          </div>
          <AttendanceChart period={period} />
          <div className="chart-legend">
            <span>
              <i className="legend-dot" />
              This week
            </span>
            <span>
              <i className="legend-dot faded" />
              Last week
            </span>
            <span className="legend-note">Average daily attendance</span>
          </div>
        </section>
        <section className="card upcoming-card">
          <SectionHeading
            title="Upcoming classes"
            action={<span className="count-tag">Today · 4</span>}
          />
          <div className="class-timeline">
            {classes.slice(0, 3).map((c, i) => (
              <div className="upcoming-class" key={c.name}>
                <div className={`class-line ${c.color}`} />
                <div className="upcoming-inner">
                  <div className="class-time">
                    <Clock3 size={13} />
                    {c.time}
                    {i === 0 && <span className="now-label">In progress</span>}
                  </div>
                  <div className="class-title-row">
                    <h4>{c.name}</h4>
                    <span className="muted">{c.room}</span>
                  </div>
                  <div className="class-teacher">
                    <Avatar name={c.teacher} color={c.color} size="tiny" />
                    <span>{c.teacher}</span>
                    <span className="class-student-count">
                      <Users size={13} />
                      {c.students}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            className="card-footer-link"
            onClick={() => navigate("Schedule")}
          >
            View full schedule
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="card activity-card">
          <SectionHeading
            title="Recent activity"
            subtitle="The latest from your school community."
            action={
              <IconButton
                icon={Ellipsis}
                label="View all activity"
                onClick={() =>
                  notify("You’re up to date — all recent activity is shown.")
                }
              />
            }
          />
          <div className="activity-list">
            {[
              {
                icon: UserRound,
                color: "violet",
                text: (
                  <>
                    <b>Nguyễn Minh Anh</b> enrolled in <b>Math 10A1</b>
                  </>
                ),
                time: "5 min ago",
                detail: "A new chapter starts here.",
              },
              {
                icon: CheckCheck,
                color: "green",
                text: (
                  <>
                    Attendance marked for <b>Physics 11B2</b>
                  </>
                ),
                time: "18 min ago",
                detail: "28 students · 26 present, 2 absent",
              },
              {
                icon: BookOpen,
                color: "blue",
                text: (
                  <>
                    <b>Sarah Johnson</b> published new grades
                  </>
                ),
                time: "42 min ago",
                detail: "English 10A2 · Midterm examination",
              },
              {
                icon: CalendarDays,
                color: "orange",
                text: (
                  <>
                    <b>Chemistry 12A1</b> schedule updated
                  </>
                ),
                time: "1 hour ago",
                detail: "Tuesday & Thursday · Lab 104",
              },
            ].map((a, i) => (
              <div className="activity-item" key={i}>
                <span className={`activity-icon ${a.color}`}>
                  <a.icon size={17} />
                </span>
                <div className="activity-copy">
                  <p>{a.text}</p>
                  <span>{a.detail}</span>
                </div>
                <time>{a.time}</time>
              </div>
            ))}
          </div>
          <button
            className="card-footer-link"
            onClick={() =>
              notify("You’re all caught up with your school’s recent activity.")
            }
          >
            View all activity
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="card performance-card">
          <SectionHeading
            title="Top performing classes"
            subtitle="Celebrating a little extra effort."
            action={<span className="small-label">AVG. GRADE</span>}
          />
          <div className="performance-list">
            {[
              {
                name: "Math 10A1",
                teacher: "Nguyễn Thị Lan",
                score: 94.2,
                color: "violet",
              },
              {
                name: "English 10A2",
                teacher: "Sarah Johnson",
                score: 91.8,
                color: "blue",
              },
              {
                name: "Physics 11B2",
                teacher: "David Mitchell",
                score: 89.5,
                color: "green",
              },
              {
                name: "Chemistry 12A1",
                teacher: "Trần Văn Minh",
                score: 87.3,
                color: "orange",
              },
            ].map((c, i) => (
              <div className="performance-row" key={c.name}>
                <span className="rank">0{i + 1}</span>
                <div className="performance-content">
                  <div className="performance-label">
                    <span>{c.name}</span>
                    <strong>
                      {c.score}
                      <span>%</span>
                    </strong>
                  </div>
                  <div className={`progress-track ${c.color}`}>
                    <i style={{ width: `${c.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="performance-note">
            <Sparkles size={14} />
            <span>Great teaching. Remarkable results.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-foot">
        <span>
          <ShieldCheck size={14} />
          Your school data is secure and up to date.
        </span>
        <span>
          Last synced just now
          <span className="live-dot" />
        </span>
      </div>
    </div>
  );
}
