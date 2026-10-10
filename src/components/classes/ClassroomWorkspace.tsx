import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  ListChecks,
  MessageSquare,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatPanel } from "@/components/classes/ChatPanel";
import { HomeworkPanel } from "@/components/classes/HomeworkPanel";
import { AddStudentDialog } from "@/components/classes/AddStudentDialog";
import {
  AttendanceGrid,
  DateStrip,
  MarksGrid,
  type GridPerson,
} from "@/components/classes/LessonGrids";
import { ResultsGrid } from "@/components/classes/ResultsGrid";
import { LevelTab } from "@/components/classes/LevelTab";
import { LevelModal } from "@/components/classes/LevelModal";
import { LevelHistorySheet } from "@/components/classes/LevelHistorySheet";
import { GroupRail, type RailFilter, type RailPerson } from "@/components/classes/GroupRail";
import { ActivationDateDialog } from "@/components/billing/ActivationDateDialog";
import { listAllClasses } from "@/lib/classes/api";
import type { ClassRow } from "@/lib/classes/types";
import { shiftMonth } from "@/lib/classes/classroom";
import {
  ensureGroupLessons,
  levelBoard,
  listGroupAttendance,
  listGroupLessons,
  listFormerMembers,
  listGroupMembers,
  listUserGroupMemberships,
  listHwMarks,
  listLevelSections,
  listProfiles,
  listResults,
  personName,
  type AttendanceRow,
  type ClassGroup,
  type FormerMember,
  type GroupLesson,
  type GroupMember,
  type HwMark,
  type LevelBoardRow,
  type LevelSection,
  type PersonProfile,
  type ResultRow,
} from "@/lib/classes/groups";
import { schemeFor, subjectToSlug } from "@/lib/classes/schemes";
import { classFees, listBalances } from "@/lib/billing/api";
import { tashkentToday } from "@/lib/billing/dates";
import { balanceKind, type BalanceKind } from "@/lib/billing/money";
import { cn } from "@/lib/utils";

export const WORKSPACE_TABS = [
  "attendance",
  "marks",
  "level",
  "results",
  "homework",
  "chat",
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export type WorkspaceSearch = {
  tab: WorkspaceTab;
  month: string;
  lesson: string;
  q: string;
  status: RailFilter;
  sections: 0 | 1;
};

const TAB_ICON: Record<WorkspaceTab, LucideIcon> = {
  attendance: CalendarDays,
  marks: ListChecks,
  level: Gauge,
  results: ClipboardCheck,
  homework: NotebookPen,
  chat: MessageSquare,
};

export function ClassroomWorkspace({
  klass,
  group,
  sibling,
  allClasses,
  isAdmin,
  search,
  onNavigate,
  onReload,
}: {
  klass: ClassRow;
  group: ClassGroup;
  sibling: ClassGroup | null;
  allClasses: ClassRow[];
  isAdmin: boolean;
  search: WorkspaceSearch;
  onNavigate: (patch: Partial<WorkspaceSearch>) => void;
  onReload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [former, setFormer] = useState<FormerMember[]>([]);
  const [alsoIn, setAlsoIn] = useState<Map<string, string[]>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, PersonProfile>>(new Map());
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [marks, setMarks] = useState<HwMark[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [board, setBoard] = useState<Map<string, LevelBoardRow>>(new Map());
  const [sections, setSections] = useState<LevelSection[]>([]);
  const [balances, setBalances] = useState<Map<string, BalanceKind>>(new Map());
  const [fee, setFee] = useState<bigint | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [levelFor, setLevelFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [activationFor, setActivationFor] = useState<string | null>(null);
  const [query, setQuery] = useState(search.q);

  useEffect(() => setQuery(search.q), [search.q]);
  useEffect(() => {
    if (query === search.q) return;
    const handle = window.setTimeout(() => onNavigate({ q: query }), 250);
    return () => window.clearTimeout(handle);
  }, [query, search.q, onNavigate]);

  const loadBoard = useCallback(async () => {
    const rows = await levelBoard(group.id);
    setBoard(new Map(rows.map((r) => [r.user_id, r])));
  }, [group.id]);

  const load = useCallback(async () => {
    try {
      await ensureGroupLessons(group.id, search.month).catch(() => 0);
      const [memberRows, formerRows, lessonRows, attendanceRows, sectionRows] = await Promise.all([
        listGroupMembers(group.id),
        listFormerMembers(group.id),
        listGroupLessons(group.id, search.month),
        listGroupAttendance(group.id, search.month),
        listLevelSections(group.subject),
      ]);
      const lessonIds = lessonRows.map((l) => l.id);
      const [people, markRows, resultRows] = await Promise.all([
        listProfiles([
          ...memberRows.map((m) => m.user_id),
          ...formerRows.map((row) => row.userId),
          ...(group.teacher_id ? [group.teacher_id] : []),
        ]),
        listHwMarks(lessonIds),
        listResults(lessonIds),
        loadBoard(),
      ]);
      const [everywhere, catalog] = await Promise.all([
        listUserGroupMemberships(memberRows.map((m) => m.user_id)),
        listAllClasses().catch(() => allClasses),
      ]);
      const classNames = new Map(catalog.map((row) => [row.id, row.name]));
      const extra = new Map<string, string[]>();
      for (const row of everywhere) {
        if (row.class_id === klass.id) continue;
        const label = classNames.get(row.class_id);
        if (!label) continue;
        const list = extra.get(row.user_id) ?? [];
        if (!list.includes(label)) list.push(label);
        extra.set(row.user_id, list);
      }
      for (const list of extra.values()) list.sort((a, b) => a.localeCompare(b));
      setMembers(memberRows);
      setFormer(formerRows);
      setAlsoIn(extra);
      setLessons(lessonRows);
      setAttendance(attendanceRows);
      setSections(sectionRows);
      setProfiles(people);
      setMarks(markRows);
      setResults(resultRows);
      if (isAdmin) {
        const [money, fees] = await Promise.all([
          listBalances({ groupId: group.id }).catch(() => []),
          classFees().catch(() => []),
        ]);
        setBalances(new Map(money.map((m) => [m.user_id, balanceKind(m.balance)])));
        setFee(fees.find((f) => f.class_id === group.class_id)?.monthly_fee_uzs ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [group.id, group.subject, group.teacher_id, klass.id, allClasses, search.month, isAdmin, loadBoard]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const formerPeople = useMemo(
    () =>
      former
        .map((row) => ({
          userId: row.userId,
          name: personName(profiles.get(row.userId), row.userId),
          effectiveOn: row.effectiveOn,
          movedTo: row.movedTo,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [former, profiles],
  );

  const railPeople = useMemo<RailPerson[]>(
    () =>
      members
        .map((m) => ({
          userId: m.user_id,
          name: personName(profiles.get(m.user_id), m.user_id),
          status: m.status,
          alsoIn: alsoIn.get(m.user_id) ?? [],
          balanceKind: isAdmin ? balances.get(m.user_id) : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, profiles, alsoIn, balances, isAdmin],
  );

  const filtered = useMemo(() => {
    const needle = search.q.trim().toLowerCase();
    return railPeople.filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      if (search.status === "debt") return p.balanceKind === "debt";
      if (search.status) return p.status === search.status;
      return true;
    });
  }, [railPeople, search.q, search.status]);

  const gridPeople = useMemo<GridPerson[]>(
    () => filtered.map((p) => ({ userId: p.userId, name: p.name, status: p.status })),
    [filtered],
  );

  const today = tashkentToday();
  const selectedId = useMemo(() => {
    if (lessons.some((l) => l.id === search.lesson)) return search.lesson;
    const past = lessons.filter((l) => l.lesson_date <= today);
    return (past[past.length - 1] ?? lessons[0])?.id ?? null;
  }, [lessons, search.lesson, today]);

  const scheme = schemeFor(group.subject);
  const tabLabel: Record<WorkspaceTab, string> = {
    attendance: "Attendance",
    marks: scheme,
    level: "Level",
    results: "Results",
    homework: "Homework",
    chat: "Chat",
  };
  const tabIndex = WORKSPACE_TABS.indexOf(search.tab);
  const nameOf = (userId: string | null) =>
    userId ? { userId, name: personName(profiles.get(userId), userId) } : null;
  const activationMember = members.find((m) => m.user_id === activationFor);
  const otherParents = allClasses.filter((c) => c.id !== klass.id);

  return (
    <div className="space-y-4 text-brand-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/classes/$classId"
          params={{ classId: klass.id }}
          search={{ tab: "roster" }}
          className="tap inline-flex items-center gap-1 text-sm font-bold text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {klass.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-brand-25 p-1" role="group" aria-label="Sub-class">
            {(
              [
                ["math", "Maths", Calculator],
                ["ebrw", "Eng", BookOpen],
              ] as const
            ).map(([subject, label, Icon]) => {
              const current = group.subject === subject;
              return (
                <Link
                  key={subject}
                  to="/admin/classes/$classId/$subject"
                  params={{ classId: klass.id, subject: subjectToSlug(subject) }}
                  search={{ ...search, lesson: "", q: "", status: "" }}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors duration-200",
                    current ? "bg-brand-500 text-white" : "text-brand-700",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
          {otherParents.length > 0 && (
            <select
              aria-label="Active group"
              className="h-10 rounded-full border border-brand-200 bg-white px-3 text-sm font-bold text-brand-700"
              value={klass.id}
              onChange={(e) =>
                void navigate({
                  to: "/admin/classes/$classId/$subject",
                  params: { classId: e.target.value, subject: subjectToSlug(group.subject) },
                  search: { ...search, lesson: "", q: "", status: "" },
                })
              }
            >
              {allClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <GroupRail
          klass={klass}
          group={group}
          people={filtered}
          former={formerPeople}
          teacherName={
            group.teacher_id ? personName(profiles.get(group.teacher_id), group.teacher_id) : null
          }
          fee={isAdmin ? fee : undefined}
          isAdmin={isAdmin}
          query={query}
          filter={search.status}
          allClasses={allClasses}
          onQuery={setQuery}
          onFilter={(status) => onNavigate({ status })}
          onAdd={() => setAddOpen(true)}
          onActivation={setActivationFor}
          onChanged={async () => {
            await load();
            await onReload();
          }}
        />

        <Panel className="min-w-0 space-y-4 p-3 md:p-4">
          <div
            className="relative isolate flex rounded-xl bg-brand-800 p-1"
            role="tablist"
            aria-label={`${group.name} sections`}
          >
            <span
              aria-hidden="true"
              className="nav-tab-pill pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-brand-400"
              style={{
                width: `calc((100% - 0.5rem) / ${WORKSPACE_TABS.length})`,
                transform: `translateX(calc(${tabIndex} * 100%))`,
              }}
            />
            {WORKSPACE_TABS.map((id) => {
              const Icon = TAB_ICON[id];
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={search.tab === id}
                      aria-label={tabLabel[id]}
                      onClick={() => onNavigate({ tab: id })}
                      className={cn(
                        "tap relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-xs font-bold transition-colors duration-200",
                        search.tab === id ? "text-white" : "text-white/80",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="hidden lg:inline">{tabLabel[id]}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-brand-800 text-white lg:hidden">
                    {tabLabel[id]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {search.tab !== "chat" && search.tab !== "level" && (
            <div className="flex flex-wrap items-center gap-2">
              <IconButton
                icon={ChevronLeft}
                label="Previous month"
                className="text-white hover:bg-brand-500"
                onClick={() => onNavigate({ month: shiftMonth(search.month, -1), lesson: "" })}
              />
              <span className="min-w-24 text-center text-sm font-bold tabular-nums">
                {search.month}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Next month"
                className="text-white hover:bg-brand-500"
                onClick={() => onNavigate({ month: shiftMonth(search.month, 1), lesson: "" })}
              />
            </div>
          )}
          {["attendance", "marks", "results"].includes(search.tab) && !loading && (
            <DateStrip
              groupId={group.id}
              lessons={lessons}
              selectedId={selectedId}
              onSelect={(lesson) => onNavigate({ lesson })}
              onAdded={load}
            />
          )}

          {loading ? (
            <ListSkeleton rows={5} />
          ) : search.tab === "attendance" ? (
            <AttendanceGrid
              groupId={group.id}
              lessons={lessons}
              people={gridPeople}
              attendance={attendance}
              selectedId={selectedId}
              onSelect={(lesson) => onNavigate({ lesson })}
              onChanged={load}
            />
          ) : search.tab === "marks" ? (
            <MarksGrid
              subject={group.subject}
              lessons={lessons}
              people={gridPeople}
              marks={marks}
              board={board}
              selectedId={selectedId}
              onSelect={(lesson) => onNavigate({ lesson })}
              onOpenLevel={setLevelFor}
              onChanged={load}
            />
          ) : search.tab === "level" ? (
            <LevelTab
              people={gridPeople}
              sections={sections}
              board={board}
              expanded={search.sections === 1}
              onToggle={() => onNavigate({ sections: search.sections === 1 ? 0 : 1 })}
              onEdit={setLevelFor}
              onHistory={setHistoryFor}
            />
          ) : search.tab === "results" ? (
            <ResultsGrid
              subject={group.subject}
              lessons={lessons}
              people={gridPeople}
              results={results}
              selectedId={selectedId}
              onSelect={(lesson) => onNavigate({ lesson })}
            />
          ) : search.tab === "homework" ? (
            <HomeworkPanel group={group} month={search.month} people={gridPeople} />
          ) : (
            <ChatPanel classId={klass.id} subject={group.subject} />
          )}
        </Panel>
      </div>

      <AddStudentDialog
        open={addOpen}
        klass={klass}
        groups={sibling ? [group, sibling] : [group]}
        defaultSubject={group.subject}
        isAdmin={isAdmin}
        onClose={() => setAddOpen(false)}
        onAdded={async () => {
          await load();
          await onReload();
        }}
      />
      <LevelModal
        open={levelFor != null}
        group={group}
        sections={sections}
        student={nameOf(levelFor)}
        board={levelFor ? (board.get(levelFor) ?? null) : null}
        lessons={lessons}
        defaultLessonId={selectedId}
        onClose={() => setLevelFor(null)}
        onSaved={loadBoard}
      />
      <LevelHistorySheet
        open={historyFor != null}
        group={group}
        sections={sections}
        student={nameOf(historyFor)}
        onClose={() => setHistoryFor(null)}
        onChanged={loadBoard}
      />
      {isAdmin && (
        <ActivationDateDialog
          open={activationFor != null}
          userId={activationFor ?? ""}
          name={nameOf(activationFor)?.name ?? ""}
          groups={
            activationMember
              ? [
                  {
                    groupId: group.id,
                    groupName: group.name,
                    activatedOn: activationMember.activated_on,
                  },
                ]
              : []
          }
          onClose={() => setActivationFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
