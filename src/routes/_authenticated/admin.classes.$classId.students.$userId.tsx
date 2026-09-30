import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Panel, PanelGlow } from "@/components/ui/panel";
import { StudentMoney } from "@/components/classes/StudentMoney";
import {
  displayName,
  getChatProfile,
  listAllClasses,
  type ChatProfile,
  type ClassRow,
  type MemberStatus,
} from "@/lib/classes";
import { getMyScore, listMemberships, listMyVar, setMemberStatus } from "@/lib/classes/classroom";
import { listBalances } from "@/lib/billing/api";

export const Route = createFileRoute("/_authenticated/admin/classes/$classId/students/$userId")({
  component: StudentProfilePage,
});

const adminRoute = getRouteApi("/_authenticated/admin");

function StudentProfilePage() {
  const { classId, userId } = Route.useParams();
  const { staffRole } = adminRoute.useRouteContext();
  const isAdmin = staffRole === "admin";
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [klass, setKlass] = useState<ClassRow | null>(null);
  const [status, setStatus] = useState<MemberStatus>("active");
  const [enrolled, setEnrolled] = useState("");
  const [score, setScore] = useState({ rw: 200, math: 200 });
  const [varDone, setVarDone] = useState(0);
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setProfile(await getChatProfile(userId).catch(() => null));
      const classes = await listAllClasses();
      setKlass(classes.find((row) => row.id === classId) ?? null);
      const members = await listMemberships(classId);
      const mine = members.find((row) => row.user_id === userId);
      if (mine) {
        setStatus(mine.status);
        setEnrolled(mine.enrolled_on);
      }
      const mineScore = await getMyScore(userId).catch(() => null);
      if (mineScore) setScore({ rw: mineScore.rw, math: mineScore.math });
      const marks = await listMyVar(userId).catch(() => []);
      setVarDone(marks.filter((mark) => mark.vocab || mark.assignment || mark.article).length);
      if (isAdmin) {
        const balances = await listBalances({ classId }).catch(() => []);
        setFee(balances.find((row) => row.user_id === userId)?.monthly_fee ?? null);
      }
    })();
  }, [classId, userId, isAdmin]);

  const name = profile ? displayName(profile) : "Student";

  return (
    <div className="space-y-4 text-brand-900">
      <div className="flex flex-wrap gap-3 text-sm font-bold uppercase">
        <Link
          to="/admin/classes/$classId"
          params={{ classId }}
          search={{ tab: "attendance", month: new Date().toISOString().slice(0, 7), lesson: "" }}
          className="tap text-brand-900"
        >
          ← BACK
        </Link>
        {isAdmin && (
          <Link to="/admin/payments" className="tap text-brand-900">
            ALL BALANCES
          </Link>
        )}
      </div>
      <p className="text-sm font-bold uppercase text-brand-900">
        {klass?.name} · {enrolled ? `ENROLLED ${enrolled}` : "ENROLLMENT DATE UNKNOWN"} · VAR{" "}
        {varDone}
      </p>
      <Panel tone="brand" className="relative overflow-hidden p-5 text-white">
        <PanelGlow />
        <p className="relative text-[10px] font-bold uppercase tracking-wider text-white">
          STUDENT PROFILE
        </p>
        <h1 className="relative text-3xl font-black text-white">{name}</h1>
      </Panel>
      {isAdmin ? (
        <StudentMoney
          userId={userId}
          name={name}
          status={status}
          rw={score.rw}
          math={score.math}
          fee={fee}
          onStatus={async (next) => {
            await setMemberStatus(userId, next);
            setStatus(next);
          }}
        />
      ) : (
        <p className="text-sm font-bold uppercase text-brand-900">
          STATUS {status}. SCORES AND VAR ARE VISIBLE TO STAFF. PAYMENTS ARE ADMIN ONLY.
        </p>
      )}
    </div>
  );
}
