import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FeaturedVideos, ForYouVideos } from "@/components/lessons/FeaturedVideos";
import { LessonPageHead, sectionKind } from "@/components/lessons/LessonSectionMark";
import { Panel } from "@/components/ui/panel";
import { HeadSkeleton, CardGridSkeleton } from "@/components/ui/skeletons";
import { fetchSyllabus } from "@/lib/lessons/client";
import type { RecommendedVideo, SyllabusTopic } from "@/lib/lessons/types";

export const Route = createFileRoute("/_authenticated/lessons/$subjectSlug/")({
  component: LessonSkills,
});

function LessonSkills() {
  const { subjectSlug } = Route.useParams();
  const [title, setTitle] = useState("Lessons");
  const [topics, setTopics] = useState<SyllabusTopic[] | null>(null);
  const [featured, setFeatured] = useState<RecommendedVideo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSyllabus(subjectSlug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError("Subject not found.");
          setTopics([]);
          return;
        }
        setTitle(data.subject.title);
        setTopics(data.topics);
        setFeatured(data.featured);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load skills");
      });
    return () => {
      cancelled = true;
    };
  }, [subjectSlug]);

  if (!topics) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <CardGridSkeleton count={4} height={140} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Link
        to="/lessons"
        className="lesson-back-enter nudge group inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        Lessons
      </Link>
      <LessonPageHead
        kind={sectionKind(subjectSlug)}
        title={title}
        subtitle="Which type of question do you want to watch?"
      />
      {error && <Panel className="p-4 text-sm text-brand-100">{error}</Panel>}
      <div className="lesson-stagger grid gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            to="/lessons/$subjectSlug/$topicId"
            params={{ subjectSlug, topicId: topic.id }}
            className="lift block"
          >
            <Panel className="group h-full p-5">
              <h2 className="text-lg font-bold text-white">{topic.title}</h2>
              {topic.description && (
                <p className="mt-1 text-sm text-brand-100">{topic.description}</p>
              )}
              <p className="mt-3 text-xs font-semibold text-brand-200">
                {topic.lessons.length} lesson{topic.lessons.length === 1 ? "" : "s"}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200">
                Open videos{" "}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1.5" />
              </span>
            </Panel>
          </Link>
        ))}
      </div>
      <ForYouVideos />
      <FeaturedVideos videos={featured} />
    </div>
  );
}
