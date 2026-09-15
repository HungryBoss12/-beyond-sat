export type LessonSubject = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  icon: string;
};

export type LessonTopic = {
  id: string;
  subject_id: string;
  title: string;
  sort_order: number;
  description: string | null;
};

export type Lesson = {
  id: string;
  topic_id: string;
  title: string;
  sort_order: number;
  body: string;
  video_url: string | null;
  video_path: string | null;
  duration_seconds: number | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type LessonListItem = Pick<
  Lesson,
  "id" | "topic_id" | "title" | "sort_order" | "duration_seconds" | "published" | "video_path"
> & { completed?: boolean };

export type VideoVote = -1 | 0 | 1;

export type RecommendedVideo = {
  id: string;
  topic_id: string;
  title: string;
  youtube_url: string;
  sort_order: number;
  duration_seconds: number | null;
  youtube_video_id?: string;
  score?: number;
  my_vote?: VideoVote;
};

export type StaffTree = {
  subjects: LessonSubject[];
  topics: LessonTopic[];
  lessons: Lesson[];
  recommended: RecommendedVideo[];
};

export type SkillWatch = {
  subject: LessonSubject;
  topic: LessonTopic;
  lessons: LessonListItem[];
  recommended: RecommendedVideo[];
};

export type SyllabusTopic = LessonTopic & {
  lessons: LessonListItem[];
};

export type PlayerPayload = {
  subject: LessonSubject;
  topic: LessonTopic;
  lesson: Lesson;
  playlist: LessonListItem[];
  prev: LessonListItem | null;
  next: LessonListItem | null;
  completed: boolean;
};

export type LessonVideo =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "file"; src: string }
  | { kind: "none" };
