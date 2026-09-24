import { createFileRoute, notFound } from "@tanstack/react-router";
import { SECTION_LABEL, type Section } from "@/lib/sat";
import { SectionPaperBrowse } from "./practice.$section";

export const Route = createFileRoute("/_authenticated/practice/sqb/$section")({
  parseParams: (p) => {
    const s = p.section;
    if (s !== "reading_writing" && s !== "math") throw notFound();
    return { section: s as Section };
  },
  component: SqbSectionBrowse,
  head: ({ params }) => ({
    meta: [
      {
        title: `SQB ${params.section === "math" ? "Math" : "Reading & Writing"} — BeyondSAT`,
      },
    ],
  }),
});

function SqbSectionBrowse() {
  const { section } = Route.useParams() as { section: Section };
  return (
    <SectionPaperBrowse
      section={section}
      bankFormat="sqb"
      backTo="/practice/sqb"
      emptyTitle={`No SQB ${SECTION_LABEL[section]} packs yet`}
      emptyBody="Admins haven't published an SQB pack for this section yet."
    />
  );
}
