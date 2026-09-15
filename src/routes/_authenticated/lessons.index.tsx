import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TopRankedVideos } from "@/components/lessons/FeaturedVideos";
import { LessonPageHead, LessonSectionMark, sectionKind } from "@/components/lessons/LessonSectionMark";
import { Panel } from "@/components/ui/panel";
import { HeadSkeleton, CardGridSkeleton } from "@/components/ui/skeletons";
import { listSubjects } from "@/lib/lessons/client";
import type { LessonSubject } from "@/lib/lessons/types";

export const Route = createFileRoute("/_authenticated/lessons/")({
  component: LessonsCatalog,
});

function SubjectCard({ subject }: { subject: LessonSubject }) {
  const [hot, setHot] = useState(false);
  const kind = sectionKind(subject.slug);
  return (
    <Link
      to="/lessons/$subjectSlug"
      params={{ subjectSlug: subject.slug }}
      className="lesson-card lift block"
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
    >
      <Panel className="group/lesson h-full p-5 transition hover:border-brand-400/40">
        <LessonSectionMark kind={kind} size="sm" active={hot} />
        <h2 className="mt-4 text-lg font-bold text-white">{subject.title}</h2>
        <p className="mt-1 text-sm text-brand-100">
          Choose a question type, then watch our lessons or recommended YouTube clips.
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200">
          Choose a skill{" "}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/lesson:translate-x-1.5" />
        </span>
      </Panel>
    </Link>
  );
}

function LessonsCatalog() {
  const [subjects, setSubjects] = useState<LessonSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSubjects()
      .then(setSubjects)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load lessons"));
  }, []);

  if (error) {
    return (
      <div className="relative isolate mx-auto max-w-3xl space-y-6">
        <LessonPageHead
          kind="lessons"
          title="Lessons"
          subtitle="Pick Reading & Writing or Math, then a question type."
        />
        <Panel className="p-5 text-sm text-brand-100">{error}</Panel>
      </div>
    );
  }

  if (!subjects) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <CardGridSkeleton count={2} height={200} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Link
        to="/dashboard"
        className="lesson-back-enter nudge group inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        Dashboard
      </Link>
      <LessonPageHead
        kind="lessons"
        title="Lessons"
        subtitle="Pick a section, then the SAT skill you want to watch."
      />
      <TopRankedVideos limit={3} />
      <div className="lesson-stagger grid gap-4 sm:grid-cols-2">
        {subjects.map((subject) => (
          <SubjectCard key={subject.id} subject={subject} />
        ))}
      </div>
    </div>
  );
}
