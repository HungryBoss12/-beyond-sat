import { createFileRoute, Link, type SearchSchemaInput } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  CalendarCheck,
  Banknote,
  Download,
  HandCoins,
  Layers,
  ListChecks,
  ReceiptText,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/panel";
import { TableSkeleton } from "@/components/ui/skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoneyTile } from "@/components/billing/MoneyTile";
import { RecordPaymentDialog, type PaymentTarget } from "@/components/billing/RecordPaymentDialog";
import { TransactionsTable, type TxRow } from "@/components/billing/TransactionsTable";
import { BalanceLabel, StatusLabel } from "@/components/billing/labels";
import { KIND_META } from "@/components/billing/meta";
import { chargeThisMonth } from "@/components/billing/charge";
import { txMethodOrPeriod, txSign, txType } from "@/lib/billing/ledger";
import { CLASS_CONTROL } from "@/components/classes/control";
import { SubclassChip } from "@/components/classes/SubclassChip";
import { FeeDialog } from "@/components/billing/FeeDialog";
import {
  applyRecurringFees,
  classFees,
  groupFees,
  listAllLedger,
  listBalances,
  paymentsSummary,
  setClassFee,
} from "@/lib/billing/api";
import { downloadCsv, toCsv } from "@/lib/billing/csv";
import { tashkentToday } from "@/lib/billing/dates";
import { compactUzs, formatUzs, groupDigits, parseUzsInput } from "@/lib/billing/money";
import type { BalanceRow, GroupFeeRow, PaymentsSummary } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

const CHIPS = ["all", "debt", "credit", "settled"] as const;
type Chip = (typeof CHIPS)[number];
const CHIP_LABEL: Record<Chip, string> = {
  all: "All",
  debt: "Debtors",
  credit: "Credit",
  settled: "Settled",
};

const digits = z.string().regex(/^\d*$/).catch("");

const searchSchema = z.object({
  view: z.enum(["balances", "ledger"]).catch("balances"),
  chip: z.enum(CHIPS).catch("all"),
  group: z.string().catch(""),
  q: z.string().catch(""),
  status: z.enum(["", "active", "trial", "frozen"]).catch(""),
  activeSort: z.enum(["active", "other"]).catch("active"),
  rank: z.enum(["", "S", "A", "B", "C", "D"]).catch(""),
  minDebt: digits,
  maxDebt: digits,
  monthsInDebt: digits,
  method: z.enum(["", "cash", "card", "transfer"]).catch(""),
  kind: z.enum(["", "charge", "payment", "discount", "refund"]).catch(""),
  source: z.enum(["", "auto", "manual"]).catch(""),
});
type Search = z.infer<typeof searchSchema>;

const MORE_FILTERS = [
  "status",
  "rank",
  "minDebt",
  "maxDebt",
  "monthsInDebt",
  "method",
  "kind",
  "source",
] as const;

export const Route = createFileRoute("/_authenticated/admin/payments/")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    searchSchema.parse(search),
  component: PaymentsPage,
});

function studentName(row: Pick<BalanceRow, "full_name" | "username" | "user_id">): string {
  return row.full_name || row.username || row.user_id.slice(0, 8);
}

function isActiveStudent(row: BalanceRow): boolean {
  return row.status === "active" || row.groups.some((group) => group.status === "active");
}

function PaymentsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [census, setCensus] = useState<BalanceRow[]>([]);
  const [ledger, setLedger] = useState<TxRow[] | null>(null);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [fees, setFees] = useState<GroupFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<PaymentTarget | null>(null);
  const [feeOpen, setFeeOpen] = useState(false);
  const [feeClasses, setFeeClasses] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState(search.q);
  const applied = useRef(false);

  const patch = useCallback(
    (next: Partial<Search>) => void navigate({ search: (prev) => ({ ...prev, ...next }) }),
    [navigate],
  );

  useEffect(() => setQuery(search.q), [search.q]);
  useEffect(() => {
    if (query === search.q) return;
    const handle = window.setTimeout(() => patch({ q: query }), 300);
    return () => window.clearTimeout(handle);
  }, [query, search.q, patch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!applied.current) {
        applied.current = true;
        await applyRecurringFees().catch(() => 0);
      }
      const maxDebt = parseUzsInput(search.maxDebt, 10n ** 12n);
      const minDebt = parseUzsInput(search.minDebt, 10n ** 12n);
      const [sum, groupRows, people] = await Promise.all([
        paymentsSummary(),
        groupFees(),
        listBalances({}),
      ]);
      setSummary(sum);
      setFees(groupRows);
      setCensus(people);
      if (search.view === "ledger") {
        const names = new Map(people.map((r) => [r.user_id, studentName(r)]));
        const ledgerRows = await listAllLedger();
        setLedger(
          ledgerRows.map((r) => ({
            ...r,
            student: names.get(r.user_id ?? "") ?? "—",
          })),
        );
      } else {
        setRows(
          await listBalances({
            search: search.q,
            groupId: search.group,
            kind: search.chip === "all" ? "" : search.chip,
            status: search.status,
            rank: search.rank,
            minBalance: maxDebt == null ? null : -maxDebt,
            maxBalance: minDebt == null ? null : -minDebt,
            monthsInDebt: search.monthsInDebt ? Number(search.monthsInDebt) : null,
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balances");
    } finally {
      setLoading(false);
    }
  }, [
    search.view,
    search.q,
    search.group,
    search.chip,
    search.status,
    search.rank,
    search.minDebt,
    search.maxDebt,
    search.monthsInDebt,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupsByParent = useMemo(() => {
    const map = new Map<string, GroupFeeRow[]>();
    for (const row of fees) map.set(row.class_name, [...(map.get(row.class_name) ?? []), row]);
    return [...map.entries()];
  }, [fees]);

  const txRows = useMemo(() => {
    const needle = search.q.trim().toLowerCase();
    return (ledger ?? []).filter(
      (row) =>
        (!search.group || row.group_id === search.group) &&
        (!search.method || row.method === search.method) &&
        (!search.kind || row.kind === search.kind) &&
        (!search.source || row.source === search.source) &&
        (!needle ||
          (row.student ?? "").toLowerCase().includes(needle) ||
          (row.note ?? "").toLowerCase().includes(needle)),
    );
  }, [ledger, search.q, search.group, search.method, search.kind, search.source]);

  const debtors = rows.filter((row) => row.balance < 0n);
  const owed = debtors.reduce((sum, row) => sum - row.balance, 0n);
  const sortedRows = useMemo(() => {
    const activeFirst = search.activeSort !== "other";
    return [...rows].sort((a, b) => {
      const rank = Number(isActiveStudent(b)) - Number(isActiveStudent(a));
      const byActive = activeFirst ? rank : -rank;
      if (byActive !== 0) return byActive;
      return studentName(a).localeCompare(studentName(b));
    });
  }, [rows, search.activeSort]);

  const revenue = useMemo(() => {
    const seen = new Set<string>();
    let students = 0;
    let expected = 0n;
    let tuition = 0n;
    for (const row of census) {
      if (seen.has(row.user_id) || row.groups.length === 0) continue;
      seen.add(row.user_id);
      students += 1;
      expected += row.expected_this_month ?? 0n;
      tuition += row.monthly_tuition ?? 0n;
    }
    return { students, expected, tuition };
  }, [census]);
  const activeFilters = MORE_FILTERS.filter((key) => search[key]);
  const isFiltered = Boolean(
    search.q || search.group || search.chip !== "all" || activeFilters.length,
  );

  async function chargeAll() {
    if (
      !confirm("Ensure the monthly class fee is applied for all billable students through today?")
    ) {
      return;
    }
    try {
      const added = await applyRecurringFees();
      toast.success(
        added ? `Applied ${added} new fee charge(s)` : "All recurring fees already up to date",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply fees");
    }
  }

  function exportCsv() {
    const today = tashkentToday();
    if (search.view === "ledger") {
      downloadCsv(
        `transactions-${today}.csv`,
        toCsv([
          ["Date", "Student", "Type", "Group", "Amount (UZS)", "Method / period", "Note", "Voided"],
          ...txRows.map((row) => [
            row.occurred_on,
            row.student,
            txType(row),
            row.group_name,
            `${txSign(row) === "−" ? "-" : ""}${row.amount_uzs}`,
            txMethodOrPeriod(row),
            row.note,
            row.voided_at ? row.void_reason : "",
          ]),
        ]),
      );
      return;
    }
    downloadCsv(
      `balances-${today}.csv`,
      toCsv([
        [
          "Student",
          "Phone",
          "Class",
          "Sub-classes",
          "Status",
          "Balance (UZS)",
          "Kind",
          "Monthly fee (UZS)",
          "Months in debt",
        ],
        ...rows.map((row) => [
          studentName(row),
          row.phone,
          row.class_name,
          row.groups.map((g) => g.name).join(" + "),
          row.status,
          row.balance,
          KIND_META[row.balance < 0n ? "debt" : row.balance > 0n ? "credit" : "settled"].label,
          row.monthly_fee,
          row.months_in_debt,
        ]),
      ]),
    );
  }

  const feeMeta =
    summary == null
      ? undefined
      : summary.priced_groups === 0
        ? "No class fee set yet — edit the class in Classes"
        : summary.min_fee === summary.max_fee
          ? `${groupDigits(summary.min_fee ?? 0n)} UZS per class`
          : `${groupDigits(summary.min_fee ?? 0n)}–${groupDigits(summary.max_fee ?? 0n)} UZS per class`;

  return (
    <div className="space-y-5 text-brand-900">
      <div className="flex flex-col gap-3 rise-in md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Balances & Payments</h1>
          <p className="mt-1 text-sm text-brand-700">
            Track student debt, credit, and payment history. Course fees recur monthly
            automatically.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton
            icon={CalendarCheck}
            label="Charge monthly fee"
            variant="brand"
            text="Charge monthly fee"
            onClick={() => void chargeAll()}
          />
          <IconButton
            icon={SlidersHorizontal}
            label="Edit class fee"
            variant="outline"
            onClick={() => {
              void classFees()
                .then((rows) => {
                  setFeeClasses(rows.map((row) => ({ id: row.class_id, name: row.class_name })));
                  setFeeOpen(true);
                })
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : "Could not load class fees"),
                );
            }}
          />
          <IconButton icon={Download} label="Export CSV" variant="outline" onClick={exportCsv} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 stagger">
        <MoneyTile
          icon={TriangleAlert}
          label="Total owed"
          amount={summary?.total_owed ?? null}
          hint={summary ? `${summary.debtors} debtor(s)` : undefined}
          loading={!summary}
        />
        <MoneyTile
          icon={Wallet}
          label="Credits / prepaid"
          amount={summary?.credits ?? null}
          hint={summary ? `${summary.settled} settled` : undefined}
          loading={!summary}
        />
        <MoneyTile
          icon={Layers}
          label="Monthly class fees"
          text={summary ? `${summary.priced_groups} of ${summary.active_groups} classes` : undefined}
          hint={feeMeta}
          loading={!summary}
        />
        <MoneyTile
          icon={Users}
          label="Students in groups"
          text={loading ? undefined : String(revenue.students)}
          hint="Each person once"
          loading={loading}
        />
        <MoneyTile
          icon={CalendarCheck}
          label="Expected this month"
          amount={loading ? null : revenue.expected}
          hint="Join month is a share of the lessons. Two classes count twice."
          loading={loading}
        />
        <MoneyTile
          icon={Banknote}
          label="Monthly tuition"
          amount={loading ? null : revenue.tuition}
          hint="One full fee per student"
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative isolate flex rounded-full bg-brand-25 p-1" role="tablist">
          <span
            aria-hidden="true"
            className="nav-tab-pill absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-500"
            style={{ transform: `translateX(${search.view === "ledger" ? "100%" : "0"})` }}
          />
          {(
            [
              ["balances", "Balances", Wallet],
              ["ledger", "All transactions", ListChecks],
            ] as const
          ).map(([view, label, Icon]) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={search.view === view}
              className={cn(
                "tap relative z-10 flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-200",
                search.view === view ? "text-white" : "text-brand-700",
              )}
              onClick={() => patch({ view })}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <ul
          className="flex flex-wrap items-center gap-3 text-xs font-bold text-brand-700"
          aria-label="Legend"
        >
          {(["debt", "settled", "credit"] as const).map((kind) => {
            const Icon = KIND_META[kind].icon;
            return (
              <li key={kind} className="inline-flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {KIND_META[kind].label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200"
            aria-hidden="true"
          />
          <input
            className={CLASS_CONTROL + " pl-9"}
            placeholder={search.view === "ledger" ? "Student name or note" : "Name or phone"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Group filter"
          className={CLASS_CONTROL + " w-auto max-w-[14rem]"}
          value={search.group}
          onChange={(e) => patch({ group: e.target.value })}
        >
          <option value="">All groups</option>
          {groupsByParent.map(([parent, groups]) => (
            <optgroup key={parent} label={parent}>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Balance filter">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={search.chip === chip}
              className={cn(
                "tap rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-200",
                search.chip === chip ? "bg-brand-500 text-white" : "bg-brand-25 text-brand-700",
              )}
              onClick={() => patch({ chip, view: "balances" })}
            >
              {CHIP_LABEL[chip]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort by active">
          {(
            [
              ["active", "Active first"],
              ["other", "Not active first"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={search.activeSort === value}
              className={cn(
                "tap rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-200",
                search.activeSort === value ? "bg-brand-500 text-white" : "bg-brand-25 text-brand-700",
              )}
              onClick={() => patch({ activeSort: value, view: "balances" })}
            >
              {label}
            </button>
          ))}
        </div>
        <MoreFilters search={search} onChange={patch} />
        {isFiltered && (
          <button
            type="button"
            className="tap inline-flex items-center gap-1 rounded-full bg-brand-25 px-3 py-1.5 text-xs font-bold text-brand-700"
            onClick={() =>
              patch({
                q: "",
                group: "",
                chip: "all",
                ...Object.fromEntries(MORE_FILTERS.map((key) => [key, ""])),
              })
            }
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
      <p className="text-xs text-brand-700">
        Fees recur monthly. Click a name for the full student profile.
      </p>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Could not load payments"
          body={error}
          action={
            <button
              type="button"
              className="tap text-sm font-bold underline"
              onClick={() => void load()}
            >
              Retry
            </button>
          }
        />
      ) : search.view === "ledger" ? (
        <>
          <TransactionsTable rows={txRows} showGroup />
          <p className="text-xs text-brand-700">
            {txRows.length} transactions · one class fee per month
          </p>
        </>
      ) : rows.length === 0 ? (
        <EmptyState icon={Search} title="No students match" body="Try another filter or search." />
      ) : (
        <>
          <BalancesTable
            rows={sortedRows}
            onPay={(row) =>
              setPayFor({
                userId: row.user_id,
                name: studentName(row),
                balance: row.balance,
                monthlyFee: row.monthly_fee,
              })
            }
            onCharge={(row) =>
              void chargeThisMonth({
                userId: row.user_id,
                name: studentName(row),
                active: row.groups.some((g) => g.status === "active"),
              }).then((charged) => {
                if (charged) return load();
              })
            }
          />
          <p className="text-xs text-brand-700 tabular-nums">
            {rows.length} shown · {debtors.length} debtors · owed {compactUzs(owed)} · fee auto-runs
            monthly
          </p>
        </>
      )}

      <RecordPaymentDialog target={payFor} onClose={() => setPayFor(null)} onSaved={load} />
      <FeeDialog
        open={feeOpen}
        title="Class fee"
        description="The monthly price, and the month it starts. The first month is still a share of the lessons."
        classes={feeClasses}
        onClose={() => setFeeOpen(false)}
        onSave={async (fee, month, classId) => {
          const targets = classId ? feeClasses.filter((row) => row.id === classId) : feeClasses;
          await Promise.all(targets.map((row) => setClassFee(row.id, fee, month)));
          toast.success("Fee saved");
          await load();
        }}
      />
    </div>
  );
}

function BalancesTable({
  rows,
  onPay,
  onCharge,
}: {
  rows: BalanceRow[];
  onPay: (row: BalanceRow) => void;
  onCharge: (row: BalanceRow) => void;
}) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-panel">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-bold text-white">
          <tr>
            <th className="p-3">Student</th>
            <th className="whitespace-nowrap p-3">Balance</th>
            <th className="whitespace-nowrap p-3">Recent activity</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-t border-brand-400/30 align-top">
              <td className="p-3">
                <div className="flex min-w-0 items-center gap-2">
                  {row.class_id ? (
                    <Link
                      to="/admin/classes/$classId/students/$userId"
                      params={{ classId: row.class_id, userId: row.user_id }}
                      className="tap truncate font-bold underline-offset-2 hover:underline"
                    >
                      {studentName(row)}
                    </Link>
                  ) : (
                    <span className="truncate font-bold">{studentName(row)}</span>
                  )}
                  {row.status && <StatusLabel status={row.status} className="text-white" />}
                </div>
                <div className="mt-0.5 text-xs text-white">{row.phone || "No phone"}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.groups.map((g) => (
                    <SubclassChip key={g.id} subject={g.subject} name={g.name} />
                  ))}
                </div>
              </td>
              <td className="p-3">
                <BalanceLabel balance={row.balance} />
                {row.months_in_debt > 0 && (
                  <div className="mt-1 text-xs text-white">
                    {row.months_in_debt} month(s) in debt
                  </div>
                )}
              </td>
              <td className="p-3 text-xs">
                {row.groups.length > 0 && (row.expected_this_month ?? 0n) > 0n && (
                  <div className="mb-1 font-bold tabular-nums text-white">
                    Expected {formatUzs(row.expected_this_month ?? 0n)}
                  </div>
                )}
                {row.recent.length === 0 ? (
                  <span className="text-white">No transactions yet</span>
                ) : (
                  <ul className="space-y-0.5">
                    {row.recent.map((entry) => (
                      <li key={entry.id} className="break-words tabular-nums">
                        <span className="font-bold">
                          {entry.kind === "charge" || entry.kind === "refund" ? "−" : "+"}
                          {formatUzs(entry.amount_uzs)}
                        </span>
                        <span className="text-white">
                          {" "}
                          · {entry.note ?? entry.kind} · {entry.occurred_on}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="p-2">
                <div className="flex justify-end gap-1">
                  {row.class_id && (
                    <Link
                      to="/admin/classes/$classId/students/$userId"
                      params={{ classId: row.class_id, userId: row.user_id }}
                      aria-label={`Profile of ${studentName(row)}`}
                      className="tap grid h-10 w-10 place-items-center rounded-full text-white hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200"
                    >
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                  <IconButton
                    icon={HandCoins}
                    label="Record payment"
                    className="text-white hover:bg-brand-500"
                    onClick={() => onPay(row)}
                  />
                  <IconButton
                    icon={ReceiptText}
                    label="Charge fee"
                    className="text-white hover:bg-brand-500"
                    onClick={() => onCharge(row)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoreFilters({
  search,
  onChange,
}: {
  search: Search;
  onChange: (next: Partial<Search>) => void;
}) {
  const count = MORE_FILTERS.filter((key) => search[key]).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          icon={SlidersHorizontal}
          label={count ? `More filters (${count} on)` : "More filters"}
          variant="outline"
          pressed={count > 0}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 space-y-3 border-brand-400/40 bg-brand-800 text-white"
      >
        {search.view === "balances" ? (
          <>
            <label className="block text-xs font-bold text-white">
              Status
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={search.status}
                onChange={(e) => onChange({ status: e.target.value as Search["status"] })}
              >
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="frozen">Frozen</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-white">
                Debt from
                <input
                  inputMode="numeric"
                  className={CLASS_CONTROL + " mt-1 tabular-nums"}
                  value={search.minDebt}
                  onChange={(e) => onChange({ minDebt: e.target.value.replace(/\D/g, "") })}
                />
              </label>
              <label className="block text-xs font-bold text-white">
                Debt to
                <input
                  inputMode="numeric"
                  className={CLASS_CONTROL + " mt-1 tabular-nums"}
                  value={search.maxDebt}
                  onChange={(e) => onChange({ maxDebt: e.target.value.replace(/\D/g, "") })}
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-white">
              Months in debt at least
              <input
                inputMode="numeric"
                className={CLASS_CONTROL + " mt-1"}
                value={search.monthsInDebt}
                onChange={(e) =>
                  onChange({ monthsInDebt: e.target.value.replace(/\D/g, "").slice(0, 2) })
                }
              />
            </label>
            <label className="block text-xs font-bold text-white">
              Rank tier
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={search.rank}
                onChange={(e) => onChange({ rank: e.target.value as Search["rank"] })}
              >
                <option value="">Any</option>
                {(["S", "A", "B", "C", "D"] as const).map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="block text-xs font-bold text-white">
              Method
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={search.method}
                onChange={(e) => onChange({ method: e.target.value as Search["method"] })}
              >
                <option value="">Any</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank transfer</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-white">
              Type
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={search.kind}
                onChange={(e) => onChange({ kind: e.target.value as Search["kind"] })}
              >
                <option value="">Any</option>
                <option value="charge">Charge</option>
                <option value="payment">Payment</option>
                <option value="discount">Discount</option>
                <option value="refund">Refund</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-white">
              Source
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={search.source}
                onChange={(e) => onChange({ source: e.target.value as Search["source"] })}
              >
                <option value="">Any</option>
                <option value="auto">Recurring</option>
                <option value="manual">Manual</option>
              </select>
            </label>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
