import { useEffect, useMemo, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  List,
  Plus,
  Search,
  Users,
  Clock3,
  MapPin,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";

import {
  getClasses,
  type ClassRecord,
  type ClassListResponse,
} from "../../classes/class-api";

import "./Classes.css";

type ViewMode = "grid" | "list";

const COLORS = ["violet", "blue", "orange", "green", "pink"] as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

function classColor(id: string) {
  const hash = Array.from(id).reduce(
    (value, char) => value + char.charCodeAt(0),
    0,
  );

  return COLORS[hash % COLORS.length];
}

function getTeacherName(item: ClassRecord): string {
  return item.teacher.user.fullName;
}

function getGrade(name: string): string | null {
  return name.match(/\b(10|11|12)\b/)?.[0] ?? null;
}

export default function ClassesPage() {
  const { user, token } = useAuth();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [pagination, setPagination] = useState<ClassListResponse["pagination"]>(
    {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  );

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All grades");
  const [teacher, setTeacher] = useState("All teachers");

  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = user?.role === "ADMIN";

  // Debounce search requests.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  // Fetch actual classes from the API.
  useEffect(() => {
    if (!token) {
      setClasses([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      setError("");

      try {
        const response = await getClasses(token!, {
          page,
          limit: 20,
          search,
        });

        if (cancelled) return;

        setClasses(response.items);
        setPagination(response.pagination);
      } catch (caught) {
        if (cancelled) return;

        setClasses([]);
        setError(
          caught instanceof Error ? caught.message : "Unable to load classes.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [token, page, search, refreshKey]);

  // Teacher names available on the current page.
  const teachers = useMemo(
    () =>
      [...new Set(classes.map(getTeacherName))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [classes],
  );

  // Grade and teacher filters apply to the loaded page.
  const filtered = useMemo(
    () =>
      classes.filter((item) => {
        const matchGrade =
          grade === "All grades" || getGrade(item.name) === grade;

        const matchTeacher =
          teacher === "All teachers" || getTeacherName(item) === teacher;

        return matchGrade && matchTeacher;
      }),
    [classes, grade, teacher],
  );

  function retry() {
    setRefreshKey((previous) => previous + 1);
  }

  return (
    <div className="classes-ui">
      {/* Toolbar */}
      <div className="classes-toolbar">
        <div>
          <h2>
            All classes{" "}
            <span className="classes-count">{pagination.total} classes</span>
          </h2>

          <p>Manage your classes and keep learning on track.</p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="classes-primary"
            onClick={() =>
              window.alert("Class creation will be available in M15.5.3.")
            }
          >
            <Plus size={17} />
            New Class
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="classes-filters">
        <label className="classes-search">
          <Search size={17} />

          <input
            aria-label="Search classes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search classes by name..."
          />
        </label>

        <select
          aria-label="Filter by grade"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
        >
          <option>All grades</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
        </select>

        <select
          aria-label="Filter by teacher"
          value={teacher}
          onChange={(event) => setTeacher(event.target.value)}
        >
          <option>All teachers</option>

          {teachers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
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

      {/* Loading */}
      {loading && (
        <div className="classes-empty" role="status">
          <RefreshCw size={28} />
          <h3>Loading classes...</h3>
          <p>Fetching your classes from the server.</p>
        </div>
      )}

      {/* API error */}
      {!loading && error && (
        <div className="classes-empty" role="alert">
          <h3>Unable to load classes</h3>
          <p>{error}</p>

          <button type="button" className="classes-primary" onClick={retry}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {/* Actual class records */}
      {!loading && !error && (
        <>
          <div className={`classes-grid ${view === "list" ? "is-list" : ""}`}>
            {filtered.map((item) => {
              const color = classColor(item.id);
              const teacherName = getTeacherName(item);
              const expanded = selectedId === item.id;

              return (
                <article className="classes-card" key={item.id}>
                  <div className="classes-card-top">
                    <span className={`classes-icon classes-${color}`}>
                      <BookOpen size={22} strokeWidth={1.7} />
                    </span>

                    <span className="classes-status">
                      <span />
                      Active
                    </span>
                  </div>

                  <h3>{item.name}</h3>

                  <p className="classes-subject">
                    {item.subject || "Subject not assigned"}
                  </p>

                  <div className="classes-teacher">
                    <span className={`classes-avatar classes-${color}`}>
                      {initials(teacherName)}
                    </span>

                    <span>
                      <strong>{teacherName}</strong>
                      <small>Class teacher</small>
                    </span>
                  </div>

                  <div className="classes-metadata">
                    <span>
                      <Users size={15} />
                      {item._count.enrollments} students
                    </span>

                    <span>
                      <MapPin size={15} />
                      {item.room || "Room not assigned"}
                    </span>
                  </div>

                  {expanded && (
                    <div className="classes-detail">
                      <span>
                        <Clock3 size={15} />
                        Schedule not available yet
                      </span>

                      <span>
                        <CalendarDays size={15} />
                        Created {new Date(item.createdAt).toLocaleDateString()}
                      </span>

                      {item.description && <span>{item.description}</span>}
                    </div>
                  )}

                  <button
                    type="button"
                    className="classes-details-button"
                    aria-expanded={expanded}
                    onClick={() => setSelectedId(expanded ? null : item.id)}
                  >
                    {expanded ? "Hide class details" : "View class details"}{" "}
                    <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="classes-empty">
              <Search size={28} />

              <h3>No classes found</h3>

              <p>
                {classes.length === 0
                  ? "There are no active classes matching your search."
                  : "Try another grade or teacher filter."}
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div
              className="classes-modal-actions"
              style={{
                justifyContent: "center",
                marginTop: 24,
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((value) => value - 1);
                  setSelectedId(null);
                }}
              >
                Previous
              </button>

              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  setPage((value) => value + 1);
                  setSelectedId(null);
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
