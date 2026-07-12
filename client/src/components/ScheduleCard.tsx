import { useEffect, useState } from "react";
import { CalendarDays, Clock, Video, Phone, MapPin, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getStoredUser, saveUser, type ScheduleEvent } from "../utils/auth";

const EVENT_TYPES = ["interview", "assessment", "training", "review", "meeting"] as const;
const MODES = ["video", "phone", "in-person"] as const;

const TYPE_COLORS: Record<string, string> = {
  interview: "var(--teal)",
  assessment: "var(--violet)",
  training: "var(--blue)",
  review: "var(--warning)",
  meeting: "var(--muted)",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getModeIcon(mode: string) {
  if (mode === "video") return <Video size={13} />;
  if (mode === "phone") return <Phone size={13} />;
  return <MapPin size={13} />;
}

function buildCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

export default function ScheduleCard() {
  const user = getStoredUser();
  const [events, setEvents] = useState<ScheduleEvent[]>(user?.scheduleEvents ?? []);
  const [showModal, setShowModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const today = new Date();

  useEffect(() => {
    function syncSchedule() {
      const latestUser = getStoredUser();
      setEvents(latestUser?.scheduleEvents ?? []);
    }

    window.addEventListener("aethrix-auth-change", syncSchedule);
    return () => window.removeEventListener("aethrix-auth-change", syncSchedule);
  }, []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [form, setForm] = useState({
    title: "", type: "interview" as typeof EVENT_TYPES[number],
    date: "", time: "", withPerson: "", mode: "video" as typeof MODES[number], notes: "",
  });

  const calDays = buildCalendarDays(viewYear, viewMonth);

  const eventDays = new Set(
    events
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      })
      .map((e) => new Date(e.date).getDate())
  );

  const selectedDateStr = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;

  const dayEvents = selectedDateStr
    ? events.filter((e) => e.date === selectedDateStr)
    : events.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function addEvent() {
    if (!form.title || !form.date || !form.time) return;
    const ev: ScheduleEvent = {
      id: `ev-${Date.now()}`,
      title: form.title, type: form.type,
      date: form.date, time: form.time,
      withPerson: form.withPerson, mode: form.mode,
      notes: form.notes, createdAt: new Date().toISOString(),
    };
    const next = [...events, ev];
    setEvents(next);
    if (user) saveUser({ ...user, scheduleEvents: next });
    setForm({ title: "", type: "interview", date: "", time: "", withPerson: "", mode: "video", notes: "" });
    setShowModal(false);
  }

  function removeEvent(id: string) {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    if (user) saveUser({ ...user, scheduleEvents: next });
  }

  return (
    <>
      <article className="dash-card schedule-card">
        <div className="card-header">
          <div>
            <span className="card-kicker">Schedule</span>
            <h2>Your calendar</h2>
          </div>
          <button className="primary-cta schedule-add-btn" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add event
          </button>
        </div>

        {/* Mini calendar */}
        <div className="schedule-cal">
          <div className="schedule-cal-nav">
            <button type="button" onClick={prevMonth}><ChevronLeft size={15} /></button>
            <span>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}><ChevronRight size={15} /></button>
          </div>
          <div className="schedule-cal-grid">
            {DAYS.map((d) => <span key={d} className="schedule-cal-day-label">{d}</span>)}
            {calDays.map((day, i) => {
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const hasEvent = day !== null && eventDays.has(day);
              const isSelected = day === selectedDay;
              return (
                <button
                  key={i}
                  className={`schedule-cal-cell${isToday ? " is-today" : ""}${hasEvent ? " has-event" : ""}${isSelected ? " is-selected" : ""}${day === null ? " is-empty" : ""}`}
                  onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                  disabled={day === null}
                >
                  {day}
                  {hasEvent && <span className="event-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Event list */}
        <div className="schedule-events">
          <p className="schedule-events-label">
            {selectedDateStr ? `Events on ${selectedDay} ${MONTHS[viewMonth]}` : "Upcoming events"}
          </p>
          {dayEvents.length === 0 && (
            <p className="schedule-empty">No events {selectedDateStr ? "on this day" : "scheduled"}.</p>
          )}
          {dayEvents.map((ev) => (
            <div key={ev.id} className="schedule-event-row">
              <span className="schedule-event-type-dot" style={{ background: TYPE_COLORS[ev.type] }} />
              <div className="schedule-event-info">
                <strong>{ev.title}</strong>
                <span>
                  <Clock size={11} /> {ev.time}
                  {ev.withPerson && <> · {ev.withPerson}</>}
                  · {getModeIcon(ev.mode)} {ev.mode}
                </span>
              </div>
              <span className="schedule-event-badge" style={{ color: TYPE_COLORS[ev.type], borderColor: TYPE_COLORS[ev.type] + "44" }}>
                {ev.type}
              </span>
              <button type="button" className="schedule-event-remove" onClick={() => removeEvent(ev.id)} title="Remove">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </article>

      {/* ADD EVENT MODAL */}
      {showModal && (
        <div className="schedule-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-header">
              <div className="schedule-modal-title">
                <CalendarDays size={20} />
                <h3>Add new event</h3>
              </div>
              <button type="button" className="schedule-modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="schedule-modal-body">
              <div className="schedule-form-row">
                <label>
                  <span>Event title</span>
                  <input className="schedule-input" placeholder="e.g. Technical interview" value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
              </div>

              <div className="schedule-form-row schedule-form-row--two">
                <label>
                  <span>Date</span>
                  <input className="schedule-input" type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
                <label>
                  <span>Time</span>
                  <input className="schedule-input" type="time" value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </label>
              </div>

              <div className="schedule-form-row schedule-form-row--two">
                <label>
                  <span>With (optional)</span>
                  <input className="schedule-input" placeholder="Recruiter / trainer name" value={form.withPerson}
                    onChange={(e) => setForm({ ...form, withPerson: e.target.value })} />
                </label>
                <label>
                  <span>Mode</span>
                  <div className="schedule-mode-row">
                    {MODES.map((m) => (
                      <button key={m} type="button"
                        className={`schedule-mode-btn${form.mode === m ? " active" : ""}`}
                        onClick={() => setForm({ ...form, mode: m })}>
                        {getModeIcon(m)} {m}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <div className="schedule-form-row">
                <span>Event type</span>
                <div className="schedule-type-row">
                  {EVENT_TYPES.map((t) => (
                    <button key={t} type="button"
                      className={`schedule-type-btn${form.type === t ? " active" : ""}`}
                      style={form.type === t ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t], background: TYPE_COLORS[t] + "18" } : {}}
                      onClick={() => setForm({ ...form, type: t })}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="schedule-form-row">
                <label>
                  <span>Notes (optional)</span>
                  <textarea className="schedule-input schedule-textarea" rows={3} placeholder="Any additional details..."
                    value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="schedule-modal-footer">
              <button type="button" className="secondary-cta" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-cta" onClick={addEvent} disabled={!form.title || !form.date || !form.time}>
                <Plus size={16} /> Save event
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
