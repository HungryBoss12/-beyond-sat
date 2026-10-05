-- Move the SATashkent course into Reading & Writing and Math as teacher-added videos.

DELETE FROM public.lesson_subjects WHERE slug = 'satashkent';

WITH src(slug, topic, title, url, sort_order) AS (
  VALUES
    ('reading-writing', 'Craft and Structure', 'Lesson 9: SAT English, Text structure and Purpose', 'https://www.youtube.com/watch?v=i7YF8BJmYQA', 0),
    ('reading-writing', 'Craft and Structure', 'Lesson 10: SAT English, Cross text connections points of view!', 'https://www.youtube.com/watch?v=J5OhOb63qFI', 1),
    ('reading-writing', 'Craft and Structure', 'Lesson 11: SAT English, words in context', 'https://www.youtube.com/watch?v=7pifl33P_rw', 2),
    ('reading-writing', 'Information and Ideas', 'Lesson 6: SAT English, Main Idea and detail questions!', 'https://www.youtube.com/watch?v=4RvY9qp4nIA', 0),
    ('reading-writing', 'Information and Ideas', 'Lesson 7: SAT English, Command of evidence', 'https://www.youtube.com/watch?v=Zy4Xg7ktyVM', 1),
    ('reading-writing', 'Information and Ideas', 'Lesson 8: SAT English Inference', 'https://www.youtube.com/watch?v=1blvcHT8zQc', 2),
    ('reading-writing', 'Standard English Conventions', 'Lesson 1 (English): SAT Grammar', 'https://www.youtube.com/watch?v=CPN8yFIN_Rg', 0),
    ('reading-writing', 'Standard English Conventions', 'Lesson 2 (English): SAT Grammar Part 2', 'https://www.youtube.com/watch?v=Um8zWuOLACE', 1),
    ('reading-writing', 'Standard English Conventions', 'Lesson 3 (English): SAT Grammar 3', 'https://www.youtube.com/watch?v=JKv7-O05Dfg', 2),
    ('reading-writing', 'Expression of Ideas', 'Lesson 4: SAT English, Transitions', 'https://www.youtube.com/watch?v=WB2fIQYQa9k', 0),
    ('reading-writing', 'Expression of Ideas', 'Lesson 5: SAT English, Rhetorical synthesis.', 'https://www.youtube.com/watch?v=a3sLcMtM1e0', 1),
    ('math', 'Algebra', 'Lesson 1: SAT Math | Functions', 'https://www.youtube.com/watch?v=Rqn6MFE1oyo', 0),
    ('math', 'Algebra', 'Lesson 2: SAT Math: Linear Functions', 'https://www.youtube.com/watch?v=tr_XLIouYCM', 1),
    ('math', 'Algebra', 'Lesson Math 3: Systems of Equations', 'https://www.youtube.com/watch?v=-GJboehidZs', 2),
    ('math', 'Advanced Math', 'Lesson 5: SAT Math | Exponential VS Linear', 'https://www.youtube.com/watch?v=mDdyt7z7px4', 0),
    ('math', 'Advanced Math', 'Lesson 6: SAT Math | Functions & Quadratics!', 'https://www.youtube.com/watch?v=D1sOaNPXvLQ', 1),
    ('math', 'Advanced Math', 'Lesson 7: SAT Math | Transformation of graphs: reflection!', 'https://www.youtube.com/watch?v=pyVGzpYoYNw', 2),
    ('math', 'Problem-Solving and Data Analysis', 'Lesson 12: SAT Math | Percent, ratio and units', 'https://www.youtube.com/watch?v=hftPxQ3YqB8', 0),
    ('math', 'Problem-Solving and Data Analysis', 'Lesson 13: SAT Math | Standard deviation, boxplots and scatterplots', 'https://www.youtube.com/watch?v=R8Mp_YHANaY', 1),
    ('math', 'Problem-Solving and Data Analysis', 'Lesson 14: SAT Math: Mean, median, Mode and Range!', 'https://www.youtube.com/watch?v=A9s-x12_JnI', 2),
    ('math', 'Problem-Solving and Data Analysis', 'Lesson 15: SAT Math | Research organizing.', 'https://www.youtube.com/watch?v=FhS3vDM6yVI', 3),
    ('math', 'Geometry and Trigonometry', 'Lesson 4: SAT Math | Circles and Angles!', 'https://www.youtube.com/watch?v=En-wyChbBUI', 0),
    ('math', 'Geometry and Trigonometry', 'Lesson 8: SAT Math | Triangle & Angles', 'https://www.youtube.com/watch?v=UhDHTlD9djI', 1),
    ('math', 'Geometry and Trigonometry', 'Lesson 9: SAT Math | Triangles-part 2', 'https://www.youtube.com/watch?v=kTO03fMG_5g', 2),
    ('math', 'Geometry and Trigonometry', 'Lesson 10: SAT Math | Trigonometry', 'https://www.youtube.com/watch?v=U69TIvblaII', 3),
    ('math', 'Geometry and Trigonometry', 'Lesson 11: SAT Math | Prisms', 'https://www.youtube.com/watch?v=QEEzZ62I4FM', 4)
)
INSERT INTO public.lesson_recommended_videos (topic_id, title, youtube_url, sort_order)
SELECT t.id, src.title, src.url, src.sort_order
FROM src
JOIN public.lesson_subjects s ON s.slug = src.slug
JOIN public.lesson_topics t ON t.subject_id = s.id AND t.title = src.topic
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lesson_recommended_videos r
  WHERE r.topic_id = t.id AND r.youtube_url = src.url
);

INSERT INTO public.lesson_video_catalog (youtube_video_id, title, youtube_url)
SELECT public.bs_youtube_video_id(r.youtube_url), r.title, r.youtube_url
FROM public.lesson_recommended_videos r
WHERE public.bs_youtube_video_id(r.youtube_url) IS NOT NULL
ON CONFLICT (youtube_video_id) DO UPDATE
SET
  title = EXCLUDED.title,
  youtube_url = EXCLUDED.youtube_url;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261005000001', 'satashkent_into_english_math')
ON CONFLICT (version) DO NOTHING;
