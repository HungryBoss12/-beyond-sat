import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Bell, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import { AdminAudiencePicker } from "@/components/admin/AdminAudiencePicker";
import { AdminFieldLabel, adminInputCls } from "@/components/admin/AdminSelect";
import { listActiveClasses } from "@/lib/classes/api";
import { signedUrl } from "@/lib/classes/api";
import { uploadHomeworkFile } from "@/lib/classes/uploads";
import {
  createNotification,
  deleteNotification,
  listStaffNotifications,
  updateNotification,
} from "@/lib/notifications/client";
import { validateNotificationAudience, type StaffNotificationRow } from "@/lib/notifications/admin";
import type { NotificationAudience } from "@/lib/notifications/types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Admin" }] }),
});

function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [recent, setRecent] = useState<StaffNotificationRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audienceType, setAudienceType] = useState<NotificationAudience>("all");
  const [classId, setClassId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [displaySeconds, setDisplaySeconds] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, c, p] = await Promise.all([
        listStaffNotifications(),
        listActiveClasses(),
        supabase.from("profiles").select("id,full_name").order("full_name").limit(200),
      ]);
      setRecent(rows);
      setClasses(c.map((x) => ({ id: x.id, name: x.name })));
      setProfiles((p.data ?? []) as { id: string; full_name: string | null }[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classOptions = useMemo(
    () => classes.map((c) => ({ value: c.id, label: c.name })),
    [classes],
  );
  const userOptions = useMemo(
    () =>
      profiles.map((p) => ({
        id: p.id,
        label: p.full_name?.trim() || p.id.slice(0, 8),
      })),
    [profiles],
  );

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setLinkUrl("");
    setImageUrl(null);
    setAudienceType("all");
    setClassId("");
    setSelectedUsers([]);
    setDisplaySeconds(30);
  }

  function startEdit(n: StaffNotificationRow) {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body ?? "");
    setLinkUrl(n.link_url ?? "");
    setImageUrl(n.image_url);
    setDisplaySeconds(n.overlay_display_seconds);
    setAudienceType(n.audience_type);
    setSent(null);
    setError(null);
  }

  async function onImage(file: File) {
    const uploaded = await uploadHomeworkFile(file, file.name, "notifications");
    const url = await signedUrl("homework-uploads", uploaded.storage_path, file.name);
    setImageUrl(url);
  }

  async function handleSend() {
    if (!title.trim()) {
      setError("Enter a notification title.");
      return;
    }

    if (editingId) {
      setBusy(true);
      setError(null);
      setSent(null);
      try {
        await updateNotification(editingId, {
          title,
          body,
          linkUrl: linkUrl || null,
          imageUrl: imageUrl,
          displaySeconds,
        });
        resetForm();
        setSent("Notification updated.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update notification");
      } finally {
        setBusy(false);
      }
      return;
    }

    const audienceErr = validateNotificationAudience(audienceType, classId, selectedUsers);
    if (audienceErr) {
      setError(audienceErr);
      return;
    }
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      await createNotification({
        title,
        body,
        imageUrl: imageUrl ?? undefined,
        linkUrl: linkUrl || undefined,
        linkLabel: "Open",
        audienceType,
        classId: audienceType === "class" ? classId : undefined,
        userIds: audienceType === "users" ? selectedUsers : undefined,
        displaySeconds,
      });
      resetForm();
      setSent("Notification sent — it will appear on student dashboards.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send notification");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(n: StaffNotificationRow) {
    if (!confirm(`Delete notification “${n.title}”? This removes it for all recipients.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteNotification(n.id);
      if (editingId === n.id) resetForm();
      setSent("Notification deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete notification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHead
        title="Notifications"
        subtitle="Send dashboard alerts that slide in from the right, then move to the bell inbox."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </div>
      ) : (
        <>
          {error ? (
            <Panel className="border-red-400/40 bg-red-900/20 p-4 text-sm text-red-200">{error}</Panel>
          ) : null}
          {sent ? (
            <Panel className="border-brand-300/40 bg-brand-800/60 p-4 text-sm text-brand-100">{sent}</Panel>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="space-y-4 lg:col-span-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-400 text-white">
                  <Bell className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-black text-white">
                  {editingId ? "Edit notification" : "Send notification"}
                </h2>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setSent(null);
                    }}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                ) : null}
              </div>

              <AdminFieldLabel label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={adminInputCls} />
              </AdminFieldLabel>
              <AdminFieldLabel label="Message">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className={adminInputCls}
                />
              </AdminFieldLabel>
              <AdminFieldLabel label="Link URL">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/dashboard or /vocab"
                  className={adminInputCls}
                />
              </AdminFieldLabel>
              {!editingId ? (
                <AdminAudiencePicker
                  audienceType={audienceType}
                  onAudienceTypeChange={setAudienceType}
                  classId={classId}
                  onClassIdChange={setClassId}
                  classes={classOptions}
                  users={userOptions}
                  selectedUserIds={selectedUsers}
                  onSelectedUserIdsChange={setSelectedUsers}
                />
              ) : (
                <p className="text-xs text-brand-200">
                  Audience stays as originally sent ({audienceType}).
                </p>
              )}
              <AdminFieldLabel
                label="On-screen duration (seconds)"
                hint="How long the card stays on the dashboard before moving to the bell inbox"
              >
                <input
                  type="number"
                  min={1}
                  value={displaySeconds}
                  onChange={(e) => setDisplaySeconds(Number(e.target.value))}
                  className={adminInputCls}
                />
              </AdminFieldLabel>
              <AdminFieldLabel label="Image">
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block text-sm text-brand-100"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImage(f);
                  }}
                />
              </AdminFieldLabel>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="text-xs font-semibold text-brand-100 underline hover:text-white"
                  >
                    Remove image
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSend()}
                className="btn-brand inline-flex items-center gap-2 rounded-xl bg-grad-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {editingId ? (
                  <>
                    <Pencil className="h-4 w-4" /> Save changes
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send notification
                  </>
                )}
              </button>
            </Panel>

            <Panel className="space-y-3 lg:col-span-2">
              <h2 className="text-lg font-black text-white">Recent</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-brand-100">No notifications sent yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((n) => (
                    <li
                      key={n.id}
                      className={
                        "rounded-xl border px-3 py-2.5 " +
                        (editingId === n.id
                          ? "border-brand-300/60 bg-brand-800/70"
                          : "border-brand-400/30 bg-brand-900/40")
                      }
                    >
                      <div className="truncate text-sm font-bold text-white">{n.title}</div>
                      <div className="mt-1 text-[11px] text-brand-100">
                        {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")} ·{" "}
                        {n.overlay_display_seconds}s on-screen · {n.audience_type}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(n)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-800 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-brand-400/40 hover:bg-brand-900 disabled:opacity-50"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDelete(n)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-900/50 px-2.5 py-1 text-[11px] font-semibold text-red-100 ring-1 ring-red-400/30 hover:bg-red-900/80 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-brand-200">
                Vocab homework still sends its own notifications from{" "}
                <Link to="/admin/vocab/assignments" className="font-semibold text-white underline">
                  Assignments
                </Link>
                .
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
