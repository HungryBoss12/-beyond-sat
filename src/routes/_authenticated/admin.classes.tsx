import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  SUBJECT_LABEL,
  addHomeworkFiles,
  createClass,
  createHomework,
  deleteClass,
  getChatProfile,
  listAllClasses,
  listClassAttendanceOnDate,
  listClassMembers,
  listHomework,
  listSubmissionsForAssignment,
  markAttendance,
  reviewSubmission,
  updateClass,
  uploadHomeworkFile,
  type ChatProfile,
  type ClassRow,
  type ClassSubject,
  type HomeworkAssignment,
  type HomeworkSubmission,
  type HomeworkSubmissionStatus,
} from "@/lib/classes";

export const Route = createFileRoute("/_authenticated/admin/classes")({
  component: AdminClasses,
  head: () => ({ meta: [{ title: "Classes — Admin" }] }),
});

const CONTROL =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

function AdminClasses() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<ClassRow | null>(null);
  const [tab, setTab] = useState<"members" | "homework" | "attendance">("homework");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditDesc(selected.description ?? "");
  }, [selected?.id, selected?.name, selected?.description]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setClasses(await listAllClasses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addClass() {
    if (!name.trim()) return alert("Enter a class name.");
    try {
      const row = await createClass({ name, description: desc });
      setName("");
      setDesc("");
      await reload();
      setSelected(row);
    } catch (e) {
      alert((e as Error)?.message ?? "Could not create class.");
    }
  }

  async function saveGroupDetails() {
    if (!selected) return;
    const nextName = editName.trim();
    if (!nextName) return alert("Group name cannot be empty.");
    setSavingName(true);
    try {
      await updateClass(selected.id, {
        name: nextName,
        description: editDesc.trim() || null,
      });
      await reload();
      setSelected((cur) =>
        cur && cur.id === selected.id
          ? { ...cur, name: nextName, description: editDesc.trim() || null }
          : cur,
      );
    } catch (e) {
      alert((e as Error)?.message ?? "Could not rename this group.");
    } finally {
      setSavingName(false);
    }
  }

  async function toggleActive(c: ClassRow) {
    await updateClass(c.id, { active: !c.active });
    await reload();
  }

  async function remove(c: ClassRow) {
            if (!confirm(`Delete group "${c.name}"? This removes memberships and related threads.`)) return;
    await deleteClass(c.id);
    if (selected?.id === c.id) setSelected(null);
    await reload();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Create groups students join at onboarding. Manage homework per subject and mark lesson
        attendance.
      </p>

      <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white shadow-panel">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-100">New group</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className={CONTROL}
            placeholder="Group name (e.g. Group A)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={CONTROL}
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <button
            onClick={() => void addClass()}
            className="btn-brand inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-panel">
            {classes.length === 0 ? (
              <li className="p-4 text-sm text-brand-100">No classes yet.</li>
            ) : (
              classes.map((c) => (
                <li key={c.id} className="border-b border-brand-400/30 last:border-0">
                  <button
                    onClick={() => setSelected(c)}
                    className={
                      "tap flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-brand-500 " +
                      (selected?.id === c.id ? "bg-brand-500" : "")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{c.name}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {c.active ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="min-w-0">
            {!selected ? (
              <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center text-sm text-brand-100">
                Select a class to manage members, homework, and attendance.
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        Group name
                      </span>
                      <input
                        className={CONTROL}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        Description
                      </span>
                      <input
                        className={CONTROL}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                    <button
                      onClick={() => void saveGroupDetails()}
                      disabled={
                        savingName ||
                        !editName.trim() ||
                        (editName.trim() === selected.name &&
                          (editDesc.trim() || null) === (selected.description || null))
                      }
                      className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save name
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void toggleActive(selected)}
                      className="tap rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-bold"
                    >
                      {selected.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => void remove(selected)}
                      className="tap inline-flex items-center gap-1 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 rounded-lg bg-brand-800 p-1">
                  {(
                    [
                      ["homework", "Homework"],
                      ["members", "Members"],
                      ["attendance", "Attendance"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={
                        "tap flex-1 rounded-md px-3 py-1.5 text-xs font-bold " +
                        (tab === id ? "bg-brand-400 text-white" : "text-brand-100")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "homework" && <HomeworkPanel classId={selected.id} />}
                {tab === "members" && <MembersPanel classId={selected.id} />}
                {tab === "attendance" && <AttendancePanel classId={selected.id} />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkPanel({ classId }: { classId: string }) {
  const [items, setItems] = useState<HomeworkAssignment[]>([]);
  const [subject, setSubject] = useState<ClassSubject>("math");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [reviewFor, setReviewFor] = useState<HomeworkAssignment | null>(null);
  const [subs, setSubs] = useState<HomeworkSubmission[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ChatProfile>>(new Map());

  const reload = useCallback(async () => {
    setItems(await listHomework(classId));
  }, [classId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    if (!title.trim()) return alert("Title required.");
    setSaving(true);
    try {
      const hw = await createHomework({
        class_id: classId,
        subject,
        title,
        body,
        due_at: due ? new Date(due).toISOString() : null,
      });
      if (files.length) {
        const uploaded = [];
        for (const f of files) uploaded.push(await uploadHomeworkFile(f, f.name, `staff/${classId}`));
        await addHomeworkFiles(hw.id, uploaded);
      }
      setTitle("");
      setBody("");
      setDue("");
      setFiles([]);
      await reload();
    } catch (e) {
      alert((e as Error)?.message ?? "Could not create homework.");
    } finally {
      setSaving(false);
    }
  }

  async function openReview(a: HomeworkAssignment) {
    setReviewFor(a);
    const rows = await listSubmissionsForAssignment(a.id);
    setSubs(rows);
    const map = new Map<string, ChatProfile>();
    for (const s of rows) {
      const p = await getChatProfile(s.student_id).catch(() => null);
      if (p) map.set(s.student_id, p);
    }
    setProfiles(map);
  }

  async function setStatus(id: string, status: HomeworkSubmissionStatus) {
    await reviewSubmission(id, status);
    if (reviewFor) await openReview(reviewFor);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-400/40 bg-brand-800 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-100">Assign homework</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            className={CONTROL}
            value={subject}
            onChange={(e) => setSubject(e.target.value as ClassSubject)}
          >
            <option value="math">Maths</option>
            <option value="ebrw">EBRW</option>
          </select>
          <input
            type="datetime-local"
            className={CONTROL}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <input
          className={CONTROL + " mt-2"}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={CONTROL + " mt-2"}
          rows={3}
          placeholder="Instructions / text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="tap inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold ring-1 ring-brand-400/40">
            <Upload className="h-3.5 w-3.5" />
            Attach files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {files.length > 0 && (
            <span className="text-xs text-brand-100">{files.length} file(s)</span>
          )}
          <button
            onClick={() => void create()}
            disabled={saving}
            className="btn-brand ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-xs font-bold disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Publish
          </button>
        </div>
      </div>

      <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl border border-brand-400/40">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase text-brand-100">
                {SUBJECT_LABEL[a.subject]}
              </div>
              <div className="truncate text-sm font-bold">{a.title}</div>
            </div>
            <button
              onClick={() => void openReview(a)}
              className="tap rounded-lg bg-brand-800 px-2.5 py-1 text-xs font-bold"
            >
              Review
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-4 text-sm text-brand-100">No homework for this class yet.</li>
        )}
      </ul>

      {reviewFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-400/40 bg-brand-600 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black">Submissions · {reviewFor.title}</h3>
              <button onClick={() => setReviewFor(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {subs.length === 0 ? (
              <p className="text-sm text-brand-100">No student submissions yet.</p>
            ) : (
              <ul className="space-y-3">
                {subs.map((s) => (
                  <li key={s.id} className="rounded-xl bg-brand-800 p-3">
                    <div className="text-sm font-bold">
                      {profiles.get(s.student_id)?.username
                        ? `@${profiles.get(s.student_id)!.username}`
                        : s.student_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-brand-100">Status: {s.status}</div>
                    {s.note && <p className="mt-1 text-sm text-brand-100">{s.note}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(["accepted", "needs_revision", "reviewed"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => void setStatus(s.id, st)}
                          className="tap rounded-md bg-brand-600 px-2 py-1 text-[10px] font-bold uppercase"
                        >
                          {st.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MembersPanel({ classId }: { classId: string }) {
  const [rows, setRows] = useState<{ user_id: string; joined_at: string; profile: ChatProfile | null }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const members = await listClassMembers(classId);
      const out = [];
      for (const m of members) {
        out.push({
          ...m,
          profile: await getChatProfile(m.user_id).catch(() => null),
        });
      }
      setRows(out);
      setLoading(false);
    })();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-100" />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl border border-brand-400/40">
      {rows.map((r) => (
        <li key={r.user_id} className="flex items-center gap-3 px-3 py-2.5">
          <Users className="h-4 w-4 text-brand-100" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {r.profile?.username ? `@${r.profile.username}` : r.profile?.full_name || r.user_id.slice(0, 8)}
            </div>
            <div className="text-[11px] text-brand-100">{r.profile?.email}</div>
          </div>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="px-3 py-4 text-sm text-brand-100">No students in this class yet.</li>
      )}
    </ul>
  );
}

function AttendancePanel({ classId }: { classId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState<ClassSubject | "">("");
  const [members, setMembers] = useState<{ user_id: string; profile: ChatProfile | null }[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [previouslyPresent, setPreviouslyPresent] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const rows = await listClassMembers(classId);
      const out = [];
      for (const m of rows) {
        out.push({
          user_id: m.user_id,
          profile: await getChatProfile(m.user_id).catch(() => null),
        });
      }
      setMembers(out);
      const att = await listClassAttendanceOnDate(classId, date, subject || null).catch(() => []);
      const checked = new Set(att.filter((a) => a.participated).map((a) => a.user_id));
      setPresent(checked);
      setPreviouslyPresent(checked);
    })();
  }, [classId, date, subject]);

  function toggle(uid: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      for (const m of members) {
        const nowPresent = present.has(m.user_id);
        if (!nowPresent && !previouslyPresent.has(m.user_id)) continue;
        await markAttendance({
          class_id: classId,
          user_id: m.user_id,
          lesson_date: date,
          subject: subject || null,
          participated: nowPresent,
        });
      }
      setPreviouslyPresent(new Set(present));
      alert("Attendance saved.");
    } catch (e) {
      alert((e as Error)?.message ?? "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input type="date" className={CONTROL} value={date} onChange={(e) => setDate(e.target.value)} />
        <select
          className={CONTROL}
          value={subject}
          onChange={(e) => setSubject(e.target.value as ClassSubject | "")}
        >
          <option value="">Any / general</option>
          <option value="math">Maths</option>
          <option value="ebrw">EBRW</option>
        </select>
      </div>
      <ul className="max-h-72 divide-y divide-brand-400/30 overflow-y-auto rounded-xl border border-brand-400/40">
        {members.map((m) => (
          <li key={m.user_id}>
            <button
              onClick={() => toggle(m.user_id)}
              className="tap flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-500"
            >
              <span
                className={
                  "grid h-5 w-5 place-items-center rounded border " +
                  (present.has(m.user_id)
                    ? "border-brand-200 bg-brand-400 text-white"
                    : "border-brand-400/50")
                }
              >
                {present.has(m.user_id) && <Check className="h-3 w-3" />}
              </span>
              <span className="text-sm font-bold">
                {m.profile?.username ? `@${m.profile.username}` : m.user_id.slice(0, 8)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void save()}
        disabled={saving || members.length === 0}
        className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save attendance
      </button>
    </div>
  );
}
