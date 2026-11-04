import PageToolbar from "../../components/ui/PageToolbar";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Search, Pencil, X } from "lucide-react";
import { useAuth } from "../../auth/auth-context";
import { apiClient } from "../../lib/api-client";
import "./Teachers.css";

type Teacher = {
  id: string;
  employeeCode: string | null;
  subject: string | null;
  phone: string | null;
  bio: string | null;
  user: { fullName: string; email: string; isActive: boolean };
  classes: { id: string; name: string; archivedAt: string | null }[];
};
type Directory = {
  items: Teacher[];
  pagination: { total: number; totalPages: number };
};
const blank = {
  fullName: "",
  email: "",
  employeeCode: "",
  subject: "",
  phone: "",
  bio: "",
  password: "",
};
export default function TeachersPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<Directory | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [target, setTarget] = useState<Teacher | null>(null);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      apiClient<Directory>(
        `/teachers?page=${page}&limit=12&search=${encodeURIComponent(query)}`,
        { token },
      )
        .then((d) => {
          if (!ignore) {
            if (!d.items.length && page > 1) setPage(page - 1);
            else setData(d);
          }
        })
        .catch((e) => {
          if (!ignore) setError(e.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [token, user?.role, page, query, refresh]);
  if (user?.role !== "ADMIN")
    return (
      <div className="teachers-empty">
        Teacher management is available to administrators only.
      </div>
    );
  function begin(t: Teacher | null) {
    setEditing(t);
    setDraft(
      t
        ? {
            ...blank,
            fullName: t.user.fullName,
            email: t.user.email,
            employeeCode: t.employeeCode ?? "",
            subject: t.subject ?? "",
            phone: t.phone ?? "",
            bio: t.bio ?? "",
          }
        : blank,
    );
    setSelected(null);
    setFormError("");
    setForm(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const { password, ...fields } = draft;
      await apiClient(`/teachers${editing ? `/${editing.id}` : ""}`, {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(editing ? fields : { ...fields, password }),
      });
      setForm(false);
      setDraft(blank);
      setMessage(editing ? "Teacher updated." : "Teacher account created.");
      setRefresh((v) => v + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to save teacher.");
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (!target) return;
    setBusy(true);
    setFormError("");
    try {
      await apiClient(
        `/teachers/${target.id}/${target.user.isActive ? "deactivate" : "reactivate"}`,
        { token, method: "PATCH" },
      );
      setMessage("Teacher status updated.");
      setTarget(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setBusy(false);
    }
  }
  async function profile(t: Teacher) {
    setError("");
    try {
      setSelected(await apiClient<Teacher>(`/teachers/${t.id}`, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load profile.");
    }
  }
  const button = "teachers-btn teachers-btn-secondary";
  return (
    <div className="teachers-page">
      <PageToolbar
        title="Our teaching community"
        subtitle="Passionate educators. Lasting impact."
      >
        <button
          className="teachers-btn teachers-btn-primary"
          onClick={() => begin(null)}
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
            placeholder="Search teachers, subjects, emails..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <span className="teachers-results">
          {data?.pagination.total ?? 0} teachers
        </span>
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <div role="alert">
          {error}{" "}
          <button className={button} onClick={() => setRefresh((v) => v + 1)}>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading teachers...</p>
      ) : (
        !error && (
          <>
            <div className="teachers-grid">
              {data?.items.map((t) => (
                <article className="teachers-card" key={t.id}>
                  <div
                    className={`teachers-status ${t.user.isActive ? "" : "is-busy"}`}
                  >
                    <span />
                    {t.user.isActive ? "Active" : "Inactive"}
                  </div>
                  <div className="teachers-avatar">
                    {t.user.fullName
                      .split(/\s+/)
                      .slice(-2)
                      .map((v) => v[0])
                      .join("")}
                  </div>
                  <h3>{t.user.fullName}</h3>
                  <p className="teachers-subject">
                    {t.subject || "Subject not provided"}
                  </p>
                  <p className="teachers-subject">
                    {t.employeeCode || "No employee code"}
                  </p>
                  <div className="teachers-stats">
                    <div>
                      <strong>
                        {t.classes.filter((c) => !c.archivedAt).length}
                      </strong>
                      <span>Active classes</span>
                    </div>
                    <div>
                      <strong>{t.classes.length}</strong>
                      <span>Total classes</span>
                    </div>
                  </div>
                  <div className="teachers-card-actions">
                    <button className={button} onClick={() => profile(t)}>
                      View profile
                    </button>
                    <button
                      className="teachers-icon-btn"
                      aria-label={`Edit ${t.user.fullName}`}
                      onClick={() => begin(t)}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data?.items.length === 0 && (
              <div className="teachers-empty">
                <h3>No teachers found</h3>
                <p>Try another search or add a teacher.</p>
              </div>
            )}
            <div className="teachers-modal-actions">
              <button
                className={button}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, data?.pagination.totalPages ?? 1)}
              </span>
              <button
                className={button}
                disabled={page >= (data?.pagination.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )
      )}
      {(form || selected || target) && (
        <div className="teachers-overlay">
          <section
            className="teachers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) {
                setForm(false);
                setSelected(null);
                setTarget(null);
                setDraft(blank);
              }
            }}
          >
            <div className="teachers-modal-head">
              <h2 id="teacher-dialog-title">
                {form
                  ? editing
                    ? "Edit teacher"
                    : "Add new teacher"
                  : selected
                    ? "Teacher profile"
                    : target?.user.isActive
                      ? "Deactivate teacher"
                      : "Reactivate teacher"}
              </h2>
              <button
                className="teachers-icon-btn"
                aria-label="Close"
                disabled={busy}
                onClick={() => {
                  setForm(false);
                  setSelected(null);
                  setTarget(null);
                  setDraft(blank);
                }}
              >
                <X size={19} />
              </button>
            </div>
            {form && (
              <form onSubmit={save}>
                <p className="teachers-dialog-hint">
                  {editing
                    ? "Update the teacher profile."
                    : "Set an initial password (12–72 bytes). Share credentials with the teacher through a secure channel."}
                </p>
                <div className="teachers-fields">
                  {(Object.keys(blank) as (keyof typeof blank)[])
                    .filter((k) => k !== "password" || !editing)
                    .map((k) => (
                      <label key={k}>
                        {
                          {
                            fullName: "Full name",
                            email: "Email address",
                            employeeCode: "Employee code",
                            subject: "Subject",
                            phone: "Phone",
                            bio: "Biography",
                            password: "Initial password",
                          }[k]
                        }
                        <input
                          autoFocus={k === "fullName"}
                          required={["fullName", "email", "password"].includes(
                            k,
                          )}
                          type={
                            k === "password"
                              ? "password"
                              : k === "email"
                                ? "email"
                                : "text"
                          }
                          autoComplete={
                            k === "password" ? "new-password" : "off"
                          }
                          minLength={k === "password" ? 12 : undefined}
                          maxLength={
                            {
                              fullName: 120,
                              email: 254,
                              employeeCode: 50,
                              subject: 120,
                              phone: 30,
                              bio: 2000,
                              password: 72,
                            }[k]
                          }
                          value={draft[k]}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [k]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                </div>
                {formError && <p role="alert">{formError}</p>}
                <div className="teachers-modal-actions">
                  <button
                    className="teachers-btn teachers-btn-primary"
                    disabled={busy}
                  >
                    {busy ? "Saving..." : "Save teacher"}
                  </button>
                </div>
              </form>
            )}
            {selected && (
              <>
                <div className="teachers-profile">
                  <h3>{selected.user.fullName}</h3>
                  <p>{selected.subject}</p>
                </div>
                <dl className="teachers-profile-details">
                  {Object.entries({
                    Email: selected.user.email,
                    Phone: selected.phone,
                    "Employee code": selected.employeeCode,
                    Biography: selected.bio,
                    Status: selected.user.isActive ? "Active" : "Inactive",
                    Classes: selected.classes
                      .map(
                        (c) => `${c.name}${c.archivedAt ? " (archived)" : ""}`,
                      )
                      .join(", "),
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "Not provided"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="teachers-modal-actions">
                  <button
                    className={button}
                    onClick={() => {
                      setTarget(selected);
                      setSelected(null);
                      setFormError("");
                    }}
                  >
                    {selected.user.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className={button} onClick={() => begin(selected)}>
                    Edit teacher
                  </button>
                </div>
              </>
            )}
            {target && (
              <>
                <p>
                  {target.user.isActive
                    ? "Reassign all active classes first. Historical records will be preserved and account access will be disabled."
                    : "Restore access using the existing account and password."}
                </p>
                <p>{target.user.fullName}</p>
                {formError && <p role="alert">{formError}</p>}
                <div className="teachers-modal-actions">
                  <button
                    className="teachers-btn teachers-btn-primary"
                    disabled={busy}
                    onClick={changeStatus}
                  >
                    {busy ? "Saving..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
