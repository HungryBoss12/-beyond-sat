-- =====================================================================
-- BeyondSAT — landing page content for the ambient 3D redesign
--
-- Paste this into the Supabase SQL editor and run it once. It is safe to
-- run again: the hero UPDATE merges rather than replaces, and each INSERT
-- is guarded by a NOT EXISTS on `kind`, so a second run changes nothing.
--
-- Run supabase/MAINTENANCE_MODE.sql first if you haven't — that one seeds
-- app_settings and the Beyond AI model keys. This file is content only.
--
-- What it does:
--   1. Rewrites the hero headline for the Beyond AI positioning
--   2. Adds five new sections: showcase, ai_demo, programs, reviews, free
--
-- Every section here is editable afterwards at /admin/homepage — the copy
-- below is a starting point, not a fixture. The review testimonials are
-- placeholders; replace them with real ones before that section is shown,
-- since invented score claims on a test-prep site are a problem in
-- themselves.
--
-- There is no pricing section: Beyond SAT is free, with no subscription
-- and no gated content. The `free` band below states that outright.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Hero copy
--
-- `data || jsonb_build_object(...)` merges: it overwrites only the three
-- keys named here and leaves primary_cta_label, secondary_cta_href and
-- anything else on the row untouched. Assigning a fresh object instead
-- would silently drop the buttons.
--
-- `highlight` must appear in `title` verbatim — the landing page splits
-- the headline on that substring to render it in the blue gradient, and
-- falls back to a plain headline when it doesn't match.
-- ---------------------------------------------------------------------
UPDATE public.homepage_sections
SET data = data || jsonb_build_object(
  'title', 'Driven by Beyond AI — your personal 1-on-1 Digital SAT coach',
  'highlight', 'Beyond AI',
  'subtitle', 'Practice like it''s test day, then ask why. Beyond AI walks you through every question, finds the topics costing you points, and tells you what to do next.'
)
WHERE kind = 'hero';


-- ---------------------------------------------------------------------
-- 2. New sections
--
-- Positions slot into the gaps in the existing 10/20/30/40/50 sequence,
-- so the final order reads:
--   hero 10 · stats 20 · showcase 25 · ai_demo 28 · features 30 ·
--   programs 35 · how 40 · reviews 45 · free 48 · cta 50
-- Reorder any of them with the arrows at /admin/homepage afterwards.
-- ---------------------------------------------------------------------

-- The dashboard preview graphic, which used to sit beside the headline.
-- It moved down here to make room for the 3D emblem, and it reads better
-- at this width anyway.
INSERT INTO public.homepage_sections (kind, position, visible, data)
SELECT 'showcase', 25, true, '{
  "title": "Your whole prep, on one screen",
  "subtitle": "Scores, accuracy, weak topics and what to do next — updated after every session."
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_sections WHERE kind = 'showcase');


-- The Beyond AI feature block. `messages` is a scripted transcript, not a
-- live call: this section renders for logged-out visitors and /api/ai/chat
-- requires a session. Maths in dollar signs is rendered by KaTeX, the same
-- renderer the real chat uses.
INSERT INTO public.homepage_sections (kind, position, visible, data)
SELECT 'ai_demo', 28, true, '{
  "eyebrow": "Beyond AI",
  "title": "Stuck on a question? Just ask.",
  "subtitle": "Beyond AI is trained on the Digital SAT and nothing else. It works through the problem with you step by step instead of handing you a letter.",
  "items": [
    {"text": "Worked solutions for every question, not just the answer key"},
    {"text": "Reads your results and names the topic costing you the most points"},
    {"text": "Understands diagrams and geometry figures"},
    {"text": "Available the moment you get stuck, at any hour"}
  ],
  "button_label": "Try Beyond AI free",
  "button_href": "/signup",
  "chat_title": "Beyond AI",
  "messages": [
    {"role": "user", "text": "I got this one wrong. Why isn''t the answer 6?"},
    {"role": "assistant", "text": "You solved $2x + 3 = 9$ correctly down to $2x = 6$ — that part is right. The last step is dividing both sides by 2, which gives $x = 3$. It looks like you stopped one step early."},
    {"role": "user", "text": "That keeps happening to me."},
    {"role": "assistant", "text": "It shows up in your results: you are at 91% on setting up equations and 64% on finishing them. That gap is worth roughly 30 points. Want a set of ten questions that drill only the final step?"}
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_sections WHERE kind = 'ai_demo');


-- Programs. Duration and copy are placeholders — set them to whatever you
-- actually offer before launch.
INSERT INTO public.homepage_sections (kind, position, visible, data)
SELECT 'programs', 35, true, '{
  "title": "Pick the program that fits your timeline",
  "subtitle": "However long you have, there''s a route to your goal score.",
  "items": [
    {
      "icon": "Target",
      "title": "Score Sprint",
      "duration": "4 weeks",
      "description": "For students with a test date close by. Diagnostic first, then daily targeted sets on the topics costing you the most points.",
      "button_label": "See the plan",
      "button_href": "/signup"
    },
    {
      "icon": "GraduationCap",
      "title": "Full Preparation",
      "duration": "12 weeks",
      "description": "Complete coverage of Reading & Writing and Math, with weekly full-length mocks and a review session after each one.",
      "button_label": "See the plan",
      "button_href": "/signup"
    },
    {
      "icon": "Users",
      "title": "Guided Group",
      "duration": "8 weeks",
      "description": "Small-group sessions alongside the full question bank, for students who work better with a schedule and other people.",
      "button_label": "See the plan",
      "button_href": "/signup"
    }
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_sections WHERE kind = 'programs');


-- Reviews. Replace these with real testimonials before launch — invented
-- score claims on a test-prep site are a problem, not just filler.
INSERT INTO public.homepage_sections (kind, position, visible, data)
SELECT 'reviews', 45, true, '{
  "title": "Students who got there",
  "subtitle": "",
  "items": [
    {"stars": 5, "quote": "The practice interface is identical to the real thing. Walking into the test centre felt like another practice session.", "name": "Student name", "detail": "1520 · +180 points", "avatar": ""},
    {"stars": 5, "quote": "Being able to ask why an answer was wrong, at midnight, is the reason I stopped repeating the same mistakes.", "name": "Student name", "detail": "1480 · +150 points", "avatar": ""},
    {"stars": 5, "quote": "The analysis page told me my problem was one specific topic. Two weeks on it and my Math score jumped.", "name": "Student name", "detail": "1550 · +120 points", "avatar": ""}
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_sections WHERE kind = 'reviews');


-- ---------------------------------------------------------------------
-- The "it's free" band.
--
-- This replaced a three-tier pricing table. Beyond SAT has no paid plan,
-- no subscription and no gated content, so a tier grid advertised a
-- product that doesn't exist — and a column labelled "Free" implies the
-- others cost money. The DELETE below removes the pricing row if an
-- earlier run of this file created one; it is a no-op otherwise.
-- ---------------------------------------------------------------------
DELETE FROM public.homepage_sections WHERE kind = 'pricing';

INSERT INTO public.homepage_sections (kind, position, visible, data)
SELECT 'free', 48, true, '{
  "eyebrow": "Free forever",
  "title": "Every question, every mock, every explanation — free",
  "subtitle": "No subscription, no paywall, no locked content. Make an account and start practising.",
  "items": [
    {"text": "The entire question bank"},
    {"text": "Unlimited full-length mock exams"},
    {"text": "Beyond AI tutor, unlimited"},
    {"text": "Full analysis and weak-topic breakdown"},
    {"text": "Every mistake saved for review"},
    {"text": "Daily practice sets"}
  ],
  "button_label": "Create a free account",
  "button_href": "/signup",
  "footnote": "No card required, now or later."
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_sections WHERE kind = 'free');


-- ---------------------------------------------------------------------
-- Check the result
-- ---------------------------------------------------------------------
SELECT position, kind, visible, left(data::text, 60) AS preview
FROM public.homepage_sections
ORDER BY position;
