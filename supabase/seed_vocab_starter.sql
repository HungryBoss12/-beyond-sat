-- Starter vocab content for BeyondSAT (idempotent-ish via ON CONFLICT).

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier)
VALUES
  (
    'plastic',
    'adjective',
    'Adaptable or capable of being shaped or molded',
    'Sculpture during the early Renaissance remained remarkably plastic, allowing artists to reshape traditional forms without abandoning classical ideals entirely.',
    'Greek ''plastikos'' = fit for molding',
    ARRAY['malleable', 'pliant', 'adaptable'],
    'Usually means synthetic material, but on the SAT it almost always means adaptable or flexible.',
    'Advanced'
  ),
  (
    'ephemeral',
    'adjective',
    'Lasting for a very short time',
    'The critic argued that social media fame is ephemeral, fading as quickly as the trends that create it.',
    'Greek ''ephemeros'' = lasting a day',
    ARRAY['fleeting', 'transient', 'momentary'],
    'Do not confuse with ''ethereal'' (light, airy, heavenly).',
    'Medium'
  ),
  (
    'benevolent',
    'adjective',
    'Well-meaning and kindly',
    'The foundation''s benevolent donors funded scholarships for students who could not otherwise afford test preparation.',
    'Latin ''bene'' = good + ''volens'' = wishing',
    ARRAY['charitable', 'generous', 'kind'],
    'Often confused with ''beneficial'' (producing good results).',
    'Foundational'
  ),
  (
    'ambiguous',
    'adjective',
    'Open to more than one interpretation; unclear',
    'The contract''s ambiguous wording left both parties uncertain about who would pay shipping costs.',
    'Latin ''ambi'' = both + ''agere'' = to drive',
    ARRAY['unclear', 'vague', 'equivocal'],
    'SAT passages use context to disambiguate—look for clarifying clauses.',
    'Medium'
  ),
  (
    'scrutinize',
    'verb',
    'To examine or inspect closely and thoroughly',
    'Historians scrutinize primary sources for bias before drawing conclusions about past events.',
    'Latin ''scruta'' = trash (originally to search through)',
    ARRAY['examine', 'inspect', 'analyze'],
    'Stronger than ''look at''—implies careful, detailed review.',
    'Medium'
  )
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_quizzes (title, description, time_limit_seconds)
SELECT 'Words in Context - Starter Set', 'Five high-yield Digital SAT vocabulary items.', 600
WHERE NOT EXISTS (SELECT 1 FROM public.vocab_quizzes WHERE title = 'Words in Context - Starter Set');

INSERT INTO public.vocab_quiz_questions (quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position)
SELECT q.id, c.id,
  'In his later essays, the writer''s style proved surprisingly ______, adapting effortlessly to both formal satire and intimate memoir.',
  'plastic',
  ARRAY['plastic', 'rigid', 'archaic', 'pompous'],
  'The context emphasizes adaptability (''adapting effortlessly''), making ''plastic'' (malleable/flexible) the correct choice.',
  1
FROM public.vocab_quizzes q, public.vocab_cards c
WHERE q.title = 'Words in Context - Starter Set' AND c.word = 'plastic'
  AND NOT EXISTS (SELECT 1 FROM public.vocab_quiz_questions WHERE quiz_id = q.id AND position = 1);

INSERT INTO public.vocab_quiz_questions (quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position)
SELECT q.id, c.id,
  'Fashion influencers often enjoy ______ popularity; yesterday''s viral post is forgotten by morning.',
  'ephemeral',
  ARRAY['ephemeral', 'enduring', 'systematic', 'redundant'],
  'The passage contrasts short-lived fame with how quickly trends fade, matching ''ephemeral''.',
  2
FROM public.vocab_quizzes q, public.vocab_cards c
WHERE q.title = 'Words in Context - Starter Set' AND c.word = 'ephemeral'
  AND NOT EXISTS (SELECT 1 FROM public.vocab_quiz_questions WHERE quiz_id = q.id AND position = 2);

INSERT INTO public.vocab_quiz_questions (quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position)
SELECT q.id, c.id,
  'The scholarship committee praised the ______ alumni who quietly paid exam fees for dozens of applicants.',
  'benevolent',
  ARRAY['benevolent', 'ambitious', 'skeptical', 'indifferent'],
  'Paying fees for others reflects kindness and goodwill—''benevolent'' fits best.',
  3
FROM public.vocab_quizzes q, public.vocab_cards c
WHERE q.title = 'Words in Context - Starter Set' AND c.word = 'benevolent'
  AND NOT EXISTS (SELECT 1 FROM public.vocab_quiz_questions WHERE quiz_id = q.id AND position = 3);

INSERT INTO public.vocab_quiz_questions (quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position)
SELECT q.id, c.id,
  'Because the memo was deliberately ______, managers interpreted the deadline differently.',
  'ambiguous',
  ARRAY['ambiguous', 'explicit', 'uniform', 'concise'],
  'Different interpretations imply unclear wording—''ambiguous''.',
  4
FROM public.vocab_quizzes q, public.vocab_cards c
WHERE q.title = 'Words in Context - Starter Set' AND c.word = 'ambiguous'
  AND NOT EXISTS (SELECT 1 FROM public.vocab_quiz_questions WHERE quiz_id = q.id AND position = 4);

INSERT INTO public.vocab_quiz_questions (quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position)
SELECT q.id, c.id,
  'Before publishing, the editor asked interns to ______ every citation for accuracy.',
  'scrutinize',
  ARRAY['scrutinize', 'ignore', 'summarize', 'celebrate'],
  'Checking citations closely matches ''scrutinize'' (examine thoroughly).',
  5
FROM public.vocab_quizzes q, public.vocab_cards c
WHERE q.title = 'Words in Context - Starter Set' AND c.word = 'scrutinize'
  AND NOT EXISTS (SELECT 1 FROM public.vocab_quiz_questions WHERE quiz_id = q.id AND position = 5);
