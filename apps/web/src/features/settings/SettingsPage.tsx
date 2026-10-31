import { useState, type FormEvent } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  GraduationCap,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
  LockKeyhole,
  Info,
} from "lucide-react";
import "./Settings.css";

type Tab = "Profile" | "School" | "Notifications" | "Security" | "Appearance";
type NotificationKey =
  | "Email notifications"
  | "Attendance alerts"
  | "Grade updates"
  | "Weekly digest";

const tabs: { name: Tab; icon: typeof UserRound }[] = [
  { name: "Profile", icon: UserRound },
  { name: "School", icon: GraduationCap },
  { name: "Notifications", icon: Bell },
  { name: "Security", icon: ShieldCheck },
  { name: "Appearance", icon: Sun },
];

const notificationItems: { key: NotificationKey; description: string }[] = [
  {
    key: "Email notifications",
    description: "Receive important updates in your inbox.",
  },
  {
    key: "Attendance alerts",
    description: "Get notified when a student misses class.",
  },
  {
    key: "Grade updates",
    description: "Keep track of newly published grades.",
  },
  { key: "Weekly digest", description: "A summary of your teaching week." },
];

type SettingsPageProps = {
  /** Match AppLayout's isDark state. Do not create a second theme state. */
  isDark: boolean;
  onToggleTheme: () => void;
};

export default function SettingsPage({
  isDark,
  onToggleTheme,
}: SettingsPageProps) {
  const [tab, setTab] = useState<Tab>("Profile");
  const [savedNotice, setSavedNotice] = useState("");
  const [profile, setProfile] = useState({
    firstName: "Teacher",
    lastName: "Demo",
    email: "teacher@example.edu",
    phone: "",
    bio: "Helping students grow, one lesson at a time.",
  });
  const [school, setSchool] = useState({
    name: "Greenwood High School",
    year: "2026 – 2027",
    timezone: "Asia/Ho_Chi_Minh",
  });
  const [notifications, setNotifications] = useState<
    Record<NotificationKey, boolean>
  >({
    "Email notifications": true,
    "Attendance alerts": true,
    "Grade updates": false,
    "Weekly digest": true,
  });

  const saveDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedNotice(
      "Demo only: changes are stored in this page until you refresh. No server update was made.",
    );
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setSavedNotice("");
  };

  return (
    <div className="settings-page">
      <div className="settings-page__heading">
        <span className="settings-page__eyebrow">YOUR WORKSPACE</span>
        <h2>
          Settings<span className="settings-page__accent">.</span>
        </h2>
        <p>Make ClassFlow work your way.</p>
      </div>
      <div className="settings-page__layout">
        <nav className="settings-page__nav" aria-label="Settings sections">
          {tabs.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              className={`settings-page__nav-btn ${tab === name ? "is-active" : ""}`}
              onClick={() => switchTab(name)}
              aria-current={tab === name ? "page" : undefined}
            >
              <Icon size={18} /> {name}{" "}
              <ChevronRight size={15} className="settings-page__nav-arrow" />
            </button>
          ))}
        </nav>
        <div className="settings-page__main">
          <section className="settings-page__card">
            <header className="settings-page__section-heading">
              <h3>
                {tab === "Profile"
                  ? "Personal information"
                  : tab === "School"
                    ? "School information"
                    : tab === "Appearance"
                      ? "Appearance"
                      : tab === "Notifications"
                        ? "Notification preferences"
                        : "Security"}
              </h3>
              <p>
                {tab === "Profile"
                  ? "Your profile, just the way you like it."
                  : "Manage your preferences for the current demo session."}
              </p>
            </header>
            {(tab === "Profile" || tab === "School") && (
              <form onSubmit={saveDemo}>
                {tab === "Profile" ? (
                  <div className="settings-page__form-grid">
                    <label>
                      First name
                      <input
                        required
                        value={profile.firstName}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            firstName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        required
                        value={profile.lastName}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            lastName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="settings-page__full">
                      Email address
                      <input
                        type="email"
                        required
                        value={profile.email}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, email: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, phone: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Role
                      <input value="Teacher" readOnly disabled />
                    </label>
                    <label className="settings-page__full">
                      Bio
                      <textarea
                        rows={3}
                        value={profile.bio}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, bio: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="settings-page__form-grid">
                    <label className="settings-page__full">
                      School name
                      <input
                        value={school.name}
                        onChange={(e) =>
                          setSchool((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Academic year
                      <select
                        value={school.year}
                        onChange={(e) =>
                          setSchool((p) => ({ ...p, year: e.target.value }))
                        }
                      >
                        <option>2025 – 2026</option>
                        <option>2026 – 2027</option>
                        <option>2027 – 2028</option>
                      </select>
                    </label>
                    <label>
                      Time zone
                      <select
                        value={school.timezone}
                        onChange={(e) =>
                          setSchool((p) => ({ ...p, timezone: e.target.value }))
                        }
                      >
                        <option value="Asia/Ho_Chi_Minh">
                          GMT+7 · Ho Chi Minh City
                        </option>
                        <option value="UTC">GMT+0 · UTC</option>
                      </select>
                    </label>
                  </div>
                )}
                <div className="settings-page__footer">
                  <span>Demo settings are not saved to the database.</span>
                  <button className="settings-page__primary" type="submit">
                    <Save size={16} /> Save changes
                  </button>
                </div>
              </form>
            )}
            {tab === "Notifications" && (
              <div>
                {notificationItems.map((item) => (
                  <div className="settings-page__toggle-row" key={item.key}>
                    <div>
                      <strong>{item.key}</strong>
                      <p>{item.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      aria-label={item.key}
                      className={`settings-page__switch ${notifications[item.key] ? "is-on" : ""}`}
                      onClick={() =>
                        setNotifications((p) => ({
                          ...p,
                          [item.key]: !p[item.key],
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>
                ))}
                <p className="settings-page__hint">
                  <Info size={15} /> Notification toggles are visual demo
                  settings. No emails or alerts will be sent.
                </p>
              </div>
            )}
            {tab === "Security" && (
              <div className="settings-page__security">
                <LockKeyhole size={28} />
                <h4>Account security</h4>
                <p>
                  Password changes and two-factor authentication require a
                  secure backend connection. These actions are intentionally
                  unavailable in this UI-only milestone.
                </p>
                <button type="button" disabled>
                  Change password (coming later)
                </button>
                <button type="button" disabled>
                  Enable two-factor authentication (coming later)
                </button>
              </div>
            )}
            {tab === "Appearance" && (
              <div>
                <div className="settings-page__theme-grid">
                  {[true, false].map((dark) => (
                    <button
                      type="button"
                      key={String(dark)}
                      aria-pressed={isDark === dark}
                      className={`settings-page__theme-choice ${isDark === dark ? "is-selected" : ""}`}
                      onClick={() => {
                        if (isDark !== dark) onToggleTheme();
                      }}
                    >
                      <span
                        className={`settings-page__theme-preview ${dark ? "is-dark" : "is-light"}`}
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="settings-page__theme-name">
                        {dark ? <Moon size={17} /> : <Sun size={17} />}{" "}
                        {dark ? "Dark" : "Light"}{" "}
                        {isDark === dark && <Check size={17} />}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="settings-page__hint">
                  <Info size={15} /> Theme changes apply to the current
                  application session.
                </p>
              </div>
            )}
            {savedNotice && (
              <p className="settings-page__notice" role="status">
                <Check size={16} />
                {savedNotice}
              </p>
            )}
          </section>
          <div className="settings-page__help">
            <ShieldCheck size={16} /> This is a teacher-only demo.
            Authentication and persistence will be integrated later.
          </div>
        </div>
      </div>
    </div>
  );
}
