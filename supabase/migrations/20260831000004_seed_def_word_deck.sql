-- Seed Def-Word example deck (from Def-Word.colpkg). Idempotent.

INSERT INTO public.vocab_decks (id, title, description)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Def-Word',
  'Example vocabulary deck imported from Default.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Erratic', 'noun', 'Unpredictable, inconsistent, irregular', 'His erratic dance moves were so unpredictable that even the DJ couldn’t keep up with the beat.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Secluded', 'noun', 'Hard to reach, hidden away', 'The WiFi signal was so bad in the secluded cabin that they had to make friends with the squirrels just for entertainment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fluctuate', 'noun', 'To rise and fall irregularly', 'His mood fluctuates like the stock market — happy when he gets pizza, but plummeting when it runs out.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exalt', 'noun', 'To praise, to worship', 'She exalted her coffee maker every morning, whispering, “You are my hero,” as it brewed her life-saving caffeine.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Admonish', 'noun', 'To warn or scold someone', 'The cat was admonished for knocking over the vase, but its smug face said, “I regret nothing!”', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abrupt', 'noun', 'Sudden, unexpected, without warning', 'His abrupt decision to cut his hair at 3 a.m. left him looking like a porcupine in a windstorm.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Content', 'noun', 'Satisfied', 'After eating an entire pizza by himself, he was so content that even the thought of dessert couldn’t move him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Eccentric', 'noun', 'Uncommon, strange', 'His eccentric habit of wearing socks over his shoes made people think he was either a genius or just really confused.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mired', 'noun', 'Stuck in mud', 'She was so mired in paperwork that even a bulldozer wouldn’t be able to dig her out of her office.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Colloquial', 'noun', 'Used in casual conversation', 'His speech was so full of colloquial slang that even his grandma said, “Bruh, I don’t understand you.”', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reconcile', 'noun', 'Settle one’s differences, make compatible, bring back to peace', 'They finally reconciled after their epic debate over whether pineapple belongs on pizza.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Alienate', 'noun', 'To cause someone to feel isolated or lonely', 'His decision to start every conversation with a detailed history of traffic lights quickly alienated all his friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Distinguish', 'noun', 'To tell the difference between', 'He could barely distinguish between his identical twin brothers until one started wearing neon green socks every day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adequate', 'noun', 'Sufficient, enough, acceptable', 'His cooking skills were adequate — let’s just say the fire alarm got a workout, but the pizza wasn’t that burnt.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contend', 'noun', '1) To deal with someone or something 2) To claim or state a belief confidently', 'He contended with his alarm clock every morning as if it was a fierce battle between sleep and reality.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Skeptical', 'noun', 'Having doubts', 'She was skeptical about the “miracle” face cream that claimed to make her look 20 years younger overnight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enfranchise', 'noun', 'To give the right to vote', 'The town held a parade to celebrate when they finally enfranchised the local raccoons… though they immediately voted for more trash cans.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sophisticated', 'noun', '1) Having a lot of worldly experience and knowledge 2) Complicated', 'His sophisticated taste in cheese made him the only person who actually knew what “gorgonzola” was at the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Radical', 'noun', '1) Thorough, complete, extensive 2) Fundamental, essential 3) Revolutionary, extreme', 'His radical idea to solve all the world’s problems by making every Friday “Free Ice Cream Day” was met with mixed reviews.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Formulate', 'noun', 'To create or think up', 'She formulated a foolproof plan to sneak past her dog — step one: tiptoe; step two: realize dogs can hear everything.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Attest', 'noun', 'To confirm or verify', 'He could attest to the fact that eating 10 tacos in one sitting was not a good life decision.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vexing', 'noun', 'Annoying, irritating', 'The constant buzzing of the fly around his head was so vexing that he considered giving it a name just to yell at it properly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unassuming', 'noun', 'Humble, low-key', 'The unassuming librarian turned out to be a ninja in her free time, proving you can’t judge a book by its cover.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coerce', 'noun', 'To pressure or force someone to do something', 'He coerced his little brother into trading his chocolate bar for a carrot by promising it was “just as tasty.”', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adept', 'noun', 'Very skilled at something', 'She was so adept at parallel parking that she could fit a bus into a space meant for a bicycle.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Eloquent', 'noun', 'Fluent or persuasive in speaking or writing', 'His speech was so eloquent that even his dog stopped barking just to listen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Austere', 'noun', 'Plain and without decoration, comforts, or anything extra', 'Her living room was so austere that the only decoration was a single chair—perfect for minimalist extreme sports.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dread', 'noun', 'To fear, be afraid of', 'He dreaded his mom’s reaction to the broken vase, but he blamed the wind—inside the house.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inevitable', 'noun', 'Unavoidable', 'It was inevitable that he would trip while texting and walking, as everyone saw it coming—except him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To Stress', 'noun', 'To emphasize', 'She stressed the importance of cleaning the room, but it still looked like a tornado had moved in.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Spawn', 'noun', 'To produce, generate, or create', 'The idea for his movie spawned after a dream where penguins took over the world with dance battles.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Renounce', 'noun', 'To give up, deny, or surrender something', 'He renounced his superhero cape after one too many failed attempts at flying off the couch.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unprecedented', 'noun', 'Never done or known before', 'His unprecedented move to start a cheese museum in his basement had the neighbors curiously excited.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Broach', 'noun', 'To bring up a difficult subject for discussion', 'He broached the subject of missing rent with his landlord, who thankfully had a sense of humor—about everything except rent.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Proxy', 'noun', 'A person authorized to act on behalf of another; substitute', 'He sent his dog as a proxy to the meeting, but all they got was a bowl of snacks and a nap under the table.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Detrimental', 'noun', 'Harmful, damaging', 'Eating 10 donuts for breakfast might be detrimental to your health, but it’s great for your mood—temporarily.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Secular', 'noun', 'Having no religious or spiritual basis', 'The concert was entirely secular, except for the part where the lead singer thanked ''the universe'' for his fans.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Innovative', 'noun', 'New and different', 'His innovative way of organizing his closet involved attaching his shirts to a ceiling fan—one quick spin, and he was dressed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tangible', 'noun', 'Real and able to be shown or touched', 'The excitement in the room was so tangible, you could practically high-five it.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disseminate', 'noun', 'To spread widely (particularly information)', 'He tried to disseminate the news about the school trip, but it somehow turned into a rumor about a school-wide pizza party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Delegate', 'noun', 'To assign a task to another person', 'He delegated the dishwashing duty to his little brother, but somehow the dishes were still dirty, and the brother was missing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apparent', 'noun', 'Clearly visible or understood; obvious', 'It became apparent that he had no idea how to assemble the furniture when the bookshelf started resembling a chair.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Postulate', 'noun', 'To suggest or propose something', 'He postulated that pizza should be considered a vegetable, which earned him both laughs and several high-fives.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Speculate', 'noun', 'To guess, to form a theory without firm evidence', 'He speculated that his lost sock had fallen into a black hole because where else could it have gone?', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bazaar', 'noun', 'A market selling a large variety of goods', 'The bazaar had everything from handmade rugs to pet unicorn horns—for cats, of course.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sporadic', 'noun', 'Scattered, irregular, unpredictable', 'His sporadic attempts to clean his room usually started strong and ended with him watching TV in the mess.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Suffrage', 'noun', 'The right to vote', 'She celebrated when women gained suffrage by voting for the cutest puppy in the election for ''Pet of the Year.''', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incredulous', 'noun', 'Unwilling or unable to believe something', 'He was incredulous when his cat finally learned how to fetch. ''Next up,'' he said, ''playing the piano.''', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Idealistic', 'noun', 'Unrealistically aiming for perfection', 'His idealistic goal of becoming a world-class chef in a week ended when he burned toast—three times in a row.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conflate', 'noun', 'To mix or combine into one (typically ideas)', 'He conflated his birthday party with Halloween, so everyone showed up in costumes to celebrate his ''vampire cake.''', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Paucity', 'noun', 'Poverty, scarcity', 'The paucity of snacks at the party led to a fierce competition over the last slice of pizza.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ephemeral', 'noun', 'Temporary, short-lived', 'His enthusiasm for working out was ephemeral—lasting just long enough to post about it on social media.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prompt', 'noun', 'To cause (someone) to take a course of action', 'The sight of chocolate cake promptly caused him to break his diet with zero hesitation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reverence', 'noun', 'Deep respect for someone or something', 'He showed great reverence for his grandma’s cooking, bowing before every plate of lasagna like it was a royal feast.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disparity', 'noun', 'A great difference', 'The disparity between his baking skills and his sister’s was obvious when his cookies looked like rocks and hers like art.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dispassionate', 'noun', 'Not influenced by strong emotion, fair-minded', 'As the judge, she remained dispassionate, even when the defendant made a very emotional argument about losing his last donut.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Phenomenon', 'noun', 'A noteworthy occurrence or situation', 'The sudden appearance of a double rainbow after the storm was such a phenomenon that everyone stopped to take selfies with it.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Boast', 'noun', 'To brag, to show off', 'He boasted so much about his new car that his friends started pretending they couldn’t hear him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irksome', 'noun', 'Irritating, annoying', 'The irksome sound of his neighbor’s endless lawn mowing made him wish grass would just stop growing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Allude', 'noun', 'To suggest or call attention to indirectly, to make a reference to something', 'She alluded to the surprise party by “accidentally” mentioning how much she loved cake in every conversation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Omnipotence', 'noun', 'Having unlimited or great power', 'He felt a sense of omnipotence when he finally found the TV remote, as if he could control the whole universe.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Provoke', 'noun', 'To cause a reaction or emotion (usually anger); to trigger', 'His joke about pineapple on pizza provoked a heated debate that threatened to divide the whole group of friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indulge', 'noun', 'To allow oneself to enjoy the pleasure of', 'He decided to indulge in a whole tub of ice cream after a long day of pretending to eat salads.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Entrenched', 'noun', 'Firmly established and unlikely to change', 'His entrenched belief that socks and sandals were the height of fashion would not be swayed by any amount of ridicule.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inherent', 'noun', 'Built-in, existing as a permanent or essential characteristic', 'His inherent love of naps made him the best couch tester in the world.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vernacular', 'noun', 'Everyday informal language, local dialect', 'He quickly picked up the local vernacular, casually saying “y’all” after just one day in Texas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inquisition', 'noun', 'Interrogation, questioning', 'His mom’s inquisition about his missing homework felt more intense than a detective show.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anecdote', 'noun', 'A short personal story', 'He told an amusing anecdote about the time he accidentally walked into the wrong Zoom meeting—and stayed for an hour.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Malign', 'noun', 'Evil in nature, harmful', 'The villain’s malign plot to steal all the world’s ice cream was met with global outrage.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anomaly', 'noun', 'Oddity, something that is not normal', 'His punctuality was such an anomaly that everyone asked if he was feeling okay when he arrived on time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inhibit', 'noun', 'To hold someone or something back, to suppress, to prevent', 'His fear of public speaking inhibited him from raising his hand in class, even when he knew all the answers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mutable', 'noun', 'Changeable', 'His mutable schedule meant that nobody ever knew when he’d actually show up.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Petty', 'noun', 'Of little importance; caring too much about trivial matters', 'The argument over whose turn it was to pick a movie was so petty that even the dog rolled his eyes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Avid', 'noun', 'Passionate about something', 'He was such an avid collector of rare comic books that he could smell a first edition from a mile away.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Invoke', 'noun', 'To call on or refer to something', 'He tried to invoke the “5-second rule” after dropping his sandwich, but it was too late—the dog already had it.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Imprudent', 'noun', 'Foolish, reckless', 'His imprudent decision to race a shopping cart down the hill ended exactly as you’d expect: with him in a bush.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tenacity', 'noun', 'Persistence, determination', 'His tenacity in building a treehouse was admirable, especially since he only had one hammer and an entire tree full of squirrels to deal with.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Respected', 'noun', 'Venerable', 'The venerable professor was so respected that even the campus squirrels lined up to listen to his lectures.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Authoritarian', 'noun', 'Enforcing strict obedience to authority', 'The authoritarian teacher had such strict rules that even whispering in class felt like a major rebellion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quarrel', 'noun', 'An angry argument or disagreement', 'Their quarrel over the last slice of cake was so intense that it ended with forks in the air like swords.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Yield', 'noun', '1) To produce or generate (a result) 2) To surrender', 'His hard work yielded excellent results, but he still had to yield to his little brother in their pillow fight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ambivalent', 'noun', 'Having mixed feelings', 'She felt ambivalent about the movie, loving the action scenes but hating the long romantic subplot.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Endeavor', 'noun', 'To try hard to do something', 'He endeavored to bake a perfect cake, but somehow it turned into a pancake instead.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insurrection', 'noun', 'A violent uprising or rebellion', 'The squirrels staged an insurrection in the park, stealing every picnic basket in sight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contemplate', 'noun', 'To think about for a long time', 'He spent hours contemplating the meaning of life—or at least why his pizza always arrived cold.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Compel', 'noun', 'To force someone to do something', 'His love for dessert compelled him to eat three slices of cake, even though he was already full.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Feasible', 'noun', 'Possible to do easily or conveniently', 'It wasn’t exactly feasible to finish all his homework in one night, but a lot of snacks helped.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conjecture', 'noun', 'An opinion or conclusion that is unproven; a guess', 'His conjecture that aliens stole his homework was a little far-fetched, but who’s to say for sure?', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Arbitrary', 'noun', 'Based on random choice or personal impulse, rather than any reason or system', 'His decision to wear a suit to the beach was completely arbitrary and confused everyone, including the lifeguard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reinforce', 'noun', 'To make stronger', 'He reinforced the pillow fort with extra blankets, ensuring it could survive even the fiercest of sibling attacks.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To Temper', 'noun', 'To serve as a neutralizing or counterbalancing force to something', 'She tempered the spicy chili with a spoonful of sour cream, saving everyone’s taste buds from certain doom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Decree', 'noun', 'An official order or command', 'The king issued a decree that all homework be completed before dessert, much to the children’s dismay.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Brevity', 'noun', 'Concise use of words in writing or speech', 'His brevity in giving directions was impressive, but it left everyone more confused than ever.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Equivocal', 'noun', 'Open to more than one interpretation; unclear', 'His equivocal answer about whether he ate the last cookie made it clear he was definitely guilty.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stronghold', 'noun', 'A place that is strongly defended, a fortress', 'The treehouse became their stronghold during the epic neighborhood water balloon fight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conceive', 'noun', 'To form or create a plan or idea', 'He conceived a brilliant plan to sneak snacks into the movie theater using his oversized jacket.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vanity', 'noun', 'Excessive pride in one’s own appearance or achievements', 'His vanity was so intense that he carried a mirror in his pocket just to check his reflection every five minutes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sluggish', 'noun', 'Slow-moving', 'He was so sluggish after Thanksgiving dinner that even his attempt to get off the couch felt like an Olympic event.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intuition', 'noun', 'Instinct, the ability to understand something immediately', 'Her intuition told her that the pie would be delicious, even though it looked slightly questionable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inexorable', 'noun', 'Impossible to stop or prevent', 'The inexorable march of time eventually led him to the sad realization that all the ice cream was gone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Engender', 'noun', 'To cause or give rise to (a feeling, situation, or condition)', 'His unexpected compliment engendered a wave of confidence that carried her through the entire day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Temperament', 'noun', 'A person’s nature, character, or frame of mind', 'His easygoing temperament made him the perfect mediator during family game night—especially when Monopoly got intense.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Upheaval', 'noun', 'A sudden change or disruption, chaos', 'The surprise snowstorm caused such an upheaval that even the snowmen were caught off guard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Embrace', 'noun', 'To welcome with open arms, to accept or support willingly', 'He embraced the idea of a pajama day at work, showing up in a full onesie without hesitation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Substantiate', 'noun', 'To show to be true', 'He tried to substantiate his claim that aliens ate his homework by showing a blurry UFO picture—but no one was convinced.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Superficial', 'noun', 'Shallow, on the surface', 'His knowledge of French was superficial, limited to knowing how to order croissants and say ''bonjour.''', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sovereignty', 'noun', 'Supreme power or authority', 'The sovereignty of the tiny nation was symbolized by its proud flag, which was carried everywhere—even to picnics.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lavish', 'noun', 'Luxurious', 'The birthday party was so lavish, it had a chocolate fountain, fireworks, and a live band—just for the dog.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Crux', 'noun', 'The essence, the main point', 'The crux of the mystery was solved when they realized the butler had been stealing all the cookies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indifference', 'noun', 'Lack of interest and concern', 'His indifference toward the new movie was clear—he spent more time looking at his phone than the screen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tact', 'noun', 'Skillfulness and sensitivity in dealing with others or difficult issues', 'She handled the awkward situation with such tact that no one even realized there had been a problem.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abundant', 'noun', 'Plentiful', 'The garden was so abundant with vegetables that even the neighbors started leaving zucchini on each other’s doorsteps.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Viable', 'noun', 'Capable of working successfully, realistic, doable', 'His plan to build a fort out of pillows and blankets was not only viable but also a masterpiece in engineering.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scorn', 'noun', 'Contempt, the feeling that someone or something is worthless', 'He looked at the burnt toast with such scorn that you’d think it had personally insulted him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Transgress', 'noun', 'Misbehave, disobey', 'His decision to transgress the ''No dessert before dinner'' rule resulted in the sneakiest midnight ice cream raid ever.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Analogy', 'noun', 'A comparison between two things', 'Comparing his bad haircut to a mop was an analogy that perfectly captured the disaster.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Objection', 'noun', 'A reason for disagreeing', 'His only objection to the plan was that it didn’t include any snacks—and that was a dealbreaker.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Construe', 'noun', 'To interpret in a particular way', 'He construed her silence as agreement, but little did he know, she was just thinking about pizza.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Procure', 'noun', 'Obtain, acquire', 'He managed to procure front-row tickets to the concert, a feat that felt like winning the lottery.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Evoke', 'noun', 'To bring to mind', 'The smell of fresh-baked cookies evoked memories of childhood visits to his grandma’s house.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Depiction', 'noun', 'Portrayal, illustration', 'The artist’s depiction of a cat playing the piano was so realistic, it almost seemed like the cat could play Mozart.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Burden', 'noun', 'A difficulty, problem, or responsibility', 'Carrying his little brother on his shoulders all day at the amusement park was both a joy and a burden.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recollection', 'noun', 'A memory; the act of remembering', 'His recollection of the event was a little fuzzy, but he clearly remembered the giant cake at the end.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tumult', 'noun', 'Confusion or disorder', 'The tumult in the cafeteria was so loud, it sounded like a herd of elephants had taken over lunch.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Concede', 'noun', 'Admit that something is true after first denying it', 'After hours of debate, he finally conceded that pineapple on pizza wasn’t that bad.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demeanor', 'noun', 'Manner, attitude, appearance', 'His cheerful demeanor was so infectious that even the grumpy cat started to smile—well, almost.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Emigration', 'noun', 'The act of leaving one’s own country', 'The emigration of penguins from Antarctica to a warmer beach resort was the talk of the animal kingdom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irate', 'noun', 'Angry, furious', 'He became irate when he found out someone had eaten his last slice of pizza—revenge was inevitable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tentative', 'noun', 'Unconfirmed, subject to change', 'Their tentative plans for a beach trip were quickly canceled when they realized they didn’t have enough sunscreen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Merely', 'noun', 'Only; just', 'He merely wanted a snack, but ended up devouring the entire cake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deceive', 'noun', 'To trick or mislead someone', 'He deceived his little brother into believing that broccoli was just ''green candy,'' but the taste gave it away.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Trifling', 'noun', 'Unimportant, insignificant', 'Arguing over who gets the front seat seemed trifling compared to the fact that they were late for the concert.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Labyrinthine', 'noun', 'Complicated or confusing', 'The school’s labyrinthine hallways made it feel like they needed a map and a compass just to find the cafeteria.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Decrepit', 'noun', '1) Weak, disabled 2) In a run-down state, decayed', 'The decrepit old house creaked so much, it sounded like it was telling ghost stories to itself.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Corroborate', 'noun', 'To confirm, to verify', 'The detective corroborated the suspect’s alibi with security footage of him happily eating donuts at the time of the crime.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obstinacy', 'noun', 'Stubbornness, unwilling to change', 'His obstinacy about not asking for directions turned a 10-minute trip into a 2-hour adventure.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Confinement', 'noun', 'Imprisonment, captivity', 'The dog’s brief confinement in the backyard felt like a lifetime, and the dramatic escape plan began at once.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Monotony', 'noun', 'Boredom, dullness, lack of variety', 'The monotony of online meetings was only broken by the occasional appearance of a surprise cat on screen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Degrade', 'noun', 'Treat with disrespect', 'The teacher reminded students not to degrade each other, even during competitive games of dodgeball.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dilemma', 'noun', 'A situation in which a difficult choice has to be made between two or more alternatives', 'He faced a true dilemma: whether to spend his last dollar on ice cream or save it for tomorrow’s lunch.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conventional', 'noun', 'Traditional, accepted, mainstream, standard', 'Wearing a suit to a pool party was far from conventional, but at least he looked sharp in the water.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Proliferate', 'noun', 'Increase or grow rapidly', 'His collection of quirky hats began to proliferate after he discovered a store that sold hats shaped like food.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aesthetic', 'noun', 'Concerned with beauty or the appreciation of beauty', 'Her aesthetic sense was so strong that she could turn even the most ordinary room into a work of art.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prominent', 'noun', 'Important; famous', 'The prominent scientist was so famous that even aliens might recognize him if they came to Earth.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unwieldy', 'noun', 'Difficult to carry or move', 'The unwieldy box of art supplies was so large that it looked like it was trying to move him, not the other way around.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unilaterally', 'noun', 'Done by only one person or group, without the agreement of others', 'He unilaterally decided that every meeting should now involve cake, which no one objected to in the end.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stimulate', 'noun', 'To trigger, spark, or activate; to excite', 'The surprise visit from the puppy stimulated a wave of energy in the office that lasted for hours.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abate', 'noun', 'To become less intense or widespread', 'The storm’s intensity finally began to abate, leaving behind a rainbow and a yard full of soggy shoes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diligent', 'noun', 'Hard-working', 'Her diligent study habits paid off when she aced the final exam, making her textbooks proud.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Relegate', 'noun', 'To downgrade, to lower in rank or status', 'After losing the championship, they were relegated to second-tier status, but they vowed to make a comeback.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demur', 'noun', 'To raise doubts or to protest', 'He demurred when his friends suggested going on a rollercoaster, citing his “strong preference for solid ground.”', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Novel', 'noun', 'New or unusual in an interesting way', 'His novel idea to combine pizza and sushi was met with skepticism, but surprisingly, it worked.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abstract', 'noun', 'Existing in thought or as an idea but not having a physical or concrete existence; conceptual', 'His abstract painting looked like a mix of colors thrown together, but he insisted it represented “the chaos of the universe.”', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vestigial', 'noun', 'Undeveloped, nonfunctional', 'The vestigial tail of the ancient creature was still visible in the fossil, though it no longer served any purpose.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Preoccupied', 'noun', 'Obsessed with something', 'He was so preoccupied with beating his high score that he didn’t notice the cat sitting on the keyboard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Optimistic', 'noun', 'Hopeful and confident about the future', 'Despite the dark clouds, he remained optimistic that the picnic wouldn’t be rained out—he even packed sunglasses.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Remembrance', 'noun', 'The act of remembering something; a memory', 'The old photo album brought back vivid remembrances of summer vacations and ice cream on the beach.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Retain', 'noun', 'To keep, to hold on to', 'He tried to retain his composure during the surprise quiz, but the panic was evident in his wide eyes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Susceptible', 'noun', 'Easily influenced or harmed by something; vulnerable', 'He was susceptible to flattery, so his friends always told him he was the best to get him to pay for lunch.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Strenuous', 'noun', 'Difficult, exhausting', 'Climbing the mountain was so strenuous that by the end, he felt like his legs were made of jelly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enchantment', 'noun', 'Magic, charm, fascination', 'The forest was filled with such enchantment that it felt like stepping into a fairy tale, with birds singing in harmony.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subservient', 'noun', 'Prepared to obey others, submissive, less important', 'The butler’s subservient attitude was clear as he quietly followed every command without question.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Empirical', 'noun', 'Based on experience rather than theory or pure logic', 'The scientist’s empirical data, gathered through years of experiments, spoke louder than any theory could.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hostile', 'noun', 'Unfriendly, threatening', 'The normally peaceful cat became hostile when someone tried to steal her favorite toy—she hissed like a lion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Promulgate', 'noun', 'To make widely known, to publicize', 'The new company policy was promulgated so thoroughly that even the janitor knew about the email etiquette rules.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enact', 'noun', 'To make law, to put into practice (a belief, idea, or suggestion)', 'The government enacted new laws to protect the endangered species, ensuring they wouldn’t disappear.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abject', 'noun', 'Miserable, hopeless, awful', 'The conditions in the abandoned building were abject, with broken windows and crumbling walls.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Expend', 'noun', 'To use up, to consume', 'After expending all his energy running the marathon, he collapsed at the finish line and refused to move for an hour.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Yielding', 'noun', 'Giving in to or complying with the requests of others', 'After hours of begging, she finally became yielding and allowed her little brother to play video games first.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ignominious', 'noun', 'Embarrassing, shameful', 'His ignominious fall during the talent show was caught on camera and played on repeat for days.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Naive', 'noun', 'Showing a lack of experience, wisdom, or judgment', 'His naive belief that he could fix his car with just duct tape and optimism didn’t last long.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Acquisition', 'noun', 'Something that is bought or obtained, an act of purchase', 'His latest acquisition, a rare comic book, quickly became the prized possession of his collection.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Wealthy', 'noun', 'Affluent', 'The affluent neighborhood was full of large mansions, each with perfectly manicured lawns and luxury cars in the driveway.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Consolidate', 'noun', '1) Strengthen 2) Combine or unite', 'The company decided to consolidate its departments, combining marketing and sales into one powerhouse team.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pious', 'noun', 'Very religious or spiritual', 'The pious monk spent his days in quiet prayer, finding peace in his simple, devoted life.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aggregate', 'noun', 'Collection or sum total', 'The aggregate of all his birthday gifts was impressive—especially the giant stuffed giraffe that wouldn’t fit through the door.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scatterbrained', 'noun', 'Disorganized, forgetful', 'His scatterbrained approach to packing meant he showed up to the beach with three pairs of socks but no swimsuit.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Yearn', 'noun', 'To have an intense feeling of longing for something', 'After weeks of salad, he yearned for a cheeseburger like a desert yearns for rain.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Consummate', 'noun', 'Complete or perfect, having a high degree of skill', 'She was the consummate chess player, planning her moves ten steps ahead while her opponent was still figuring out where to sit.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Endorse', 'noun', 'To support', 'The celebrity endorsed the new shoe brand, and suddenly everyone wanted to wear them—even though they looked like bananas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ascertain', 'noun', 'To find (something) out for certain', 'He had to ascertain whether his dog really ate his homework or if it was just an excuse—spoiler: it was both.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Onerous', 'noun', 'Involving a lot of effort, difficult', 'The onerous task of cleaning the garage took so long that he considered turning it into a new room instead.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Objective', 'noun', 'Fair-minded, not influenced by personal feelings', 'The judge remained objective throughout the debate, even though one side had cookies as a bribe.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aspire', 'noun', 'To hope to achieve something or be successful', 'He aspired to become a world-famous chef, but for now, his specialty was burning toast.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obsolete', 'noun', 'No longer produced or used; out of date', 'His old flip phone was so obsolete that when he pulled it out, people thought it was an antique.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inflammatory', 'noun', 'Arousing angry or violent feelings', 'His inflammatory comment about pineapple on pizza sparked a fiery debate that nearly tore the group apart.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sentiment', 'noun', 'A view or attitude towards a situation or event; a general feeling or opinion', 'The general sentiment in the room was that cats were better than dogs, but the lone dog lover refused to back down.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Candor', 'noun', 'Honesty', 'His candor during the meeting was refreshing—he wasn’t afraid to say the project was a mess and needed fixing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Materialistic', 'noun', 'Excessively concerned with material possessions or money', 'His materialistic obsession with buying the latest gadgets meant he owned five smartwatches—but only had one wrist.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prejudice', 'noun', 'A dislike or unfair opinion (of someone) that is not based on reason or actual experience', 'His prejudice against pineapple on pizza was so strong that he refused to try it, despite everyone’s pleas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Distinct', 'noun', 'Clearly separate and different', 'The distinct sound of the ice cream truck was enough to make every kid in the neighborhood drop what they were doing and run.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Respect', 'noun', 'Deference', 'He treated his grandmother with deference, always listening carefully to her stories and following her advice.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Extensive', 'noun', 'Large in amount or scale', 'His extensive collection of hats was so large that he needed a separate room just to store them all.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impose', 'noun', '1) To force the acceptance of something 2) To cause inconvenience to someone', 'He didn’t want to impose on his friend by asking for a ride, but the bus stop was ten miles away.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Articulate', 'noun', 'Having the ability to speak fluently and persuasively', 'His ability to articulate his thoughts clearly made him the go-to person for giving speeches.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pristine', 'noun', 'Original and pure; not spoiled or worn from use', 'The pristine condition of the rare comic book made it worth more than his entire savings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Veranda', 'noun', 'A porch or balcony', 'They spent the afternoon lounging on the veranda, sipping lemonade and enjoying the view of the garden.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Atypical', 'noun', 'Unusual, uncommon', 'His atypical approach to baking involved using chili peppers in cupcakes, which had a surprisingly spicy reception.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subjugate', 'noun', 'To bring under domination or control, to conquer', 'The villain’s plan was to subjugate the world with an army of robots, but his cat kept knocking over the blueprints.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ubiquitous', 'noun', 'Everywhere, universal', 'Cell phones have become so ubiquitous that you can’t walk five feet without seeing someone staring at one.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Altercation', 'noun', 'A noisy argument or disagreement', 'Their altercation over who got the last slice of pizza was so loud that even the neighbors started voting on the winner.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Robust', 'noun', 'Strong and healthy, durable', 'The robust tree withstood the storm, while everything else in the yard, including his hat, blew away.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subvert', 'noun', 'To damage or weaken the authority of an established system', 'The rebellious student tried to subvert the school’s dress code by wearing a neon-green tuxedo.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Melodramatic', 'noun', 'Exaggerated, sensationalized, or overemotional', 'His melodramatic reaction to losing a game of cards made it seem like he’d lost a fortune, not just a deck of cards.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Glut', 'noun', 'An excess supply of something', 'After the party, there was such a glut of cupcakes that even the ants got tired of them.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Antipathy', 'noun', 'Hatred, dislike', 'His antipathy towards spiders was so strong that he wouldn’t even stay in a room with a picture of one.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Perilous', 'noun', 'Dangerous', 'The perilous climb up the mountain was made worse by the fact that they forgot to pack any snacks.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conception', 'noun', '1) Origin or beginning 2) An idea or concept', 'The conception of the new app came to him while eating ice cream, proving that dessert really does inspire greatness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Repose', 'noun', 'Rest, relaxation', 'He found a rare moment of repose in the hammock, until the kids discovered him and turned it into a swing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impede', 'noun', 'To create difficulties for someone or something, resulting in delay', 'The giant snowstorm impeded their journey, forcing them to stay in and watch movies all day instead.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contradiction', 'noun', 'A combination of statements or ideas that are opposed to one another; inconsistency', 'His claim that he loved exercising was a contradiction to his habit of napping during workout time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Judgmental', 'noun', 'Having an excessively critical point of view; disapproving', 'His judgmental comments about everyone’s outfits made it clear that he thought himself the fashion police.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dismal', 'noun', 'Depressing, gloomy', 'The weather was so dismal that even the usually cheerful birds stayed silent in their nests.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ambiguous', 'noun', 'Open to more than one interpretation; unclear', 'His ambiguous answer to whether he liked pineapple on pizza left everyone confused—was it a yes or a no?', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Wayward', 'noun', 'Difficult to control or predict because of unusual behavior', 'The wayward kite zigzagged across the sky, making it impossible to predict where it would land—or if it would ever come down.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Implication', 'noun', '1) A conclusion that can be drawn from something 2) A consequence or result', 'The implication of skipping his homework was clear: extra chores on the weekend.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deploy', 'noun', 'To bring into effective action', 'The team deployed their secret weapon in the water balloon fight, a giant slingshot that could launch balloons over the fence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Credibility', 'noun', 'Believability, authority', 'His credibility as a chef skyrocketed after he won the local cooking competition with his famous chocolate mousse.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Complacent', 'noun', 'Overly satisfied or pleased with oneself', 'His complacent attitude after winning one game made him underestimate his next opponent, who won with ease.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convoke', 'noun', 'To summon, to call together', 'The principal convoked the students for an emergency assembly to discuss the mysterious disappearance of all the cafeteria cookies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mocking', 'noun', 'Making fun of someone or something in a cruel way', 'His mocking imitation of the teacher’s voice got a few laughs, but it also earned him a detention.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prospect', 'noun', 'The possibility or likelihood of some future event occurring', 'The prospect of summer vacation kept him going through the final weeks of school, even with a mountain of homework.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Friendly', 'noun', 'Amicable', 'Despite the breakup, their parting was surprisingly amicable, with no hard feelings and even a few shared laughs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Predecessor', 'noun', 'Someone or something that came before', 'His predecessor left big shoes to fill, but he was confident he could lead the team just as well.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deter', 'noun', 'To discourage (someone) from doing something', 'The sign “Beware of Dog” was enough to deter anyone from entering the yard, even though the dog was a tiny poodle.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indignation', 'noun', 'Anger or annoyance', 'His indignation was obvious when he discovered his favorite snack was missing, and the culprit was his own dog.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fetter', 'noun', 'To restrict or restrain, to put in chains', 'The strict rules fettered his creativity, making it impossible to express himself freely in art class.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rigid', 'noun', 'Stiff, firm, unchangeable', 'His rigid schedule allowed no room for spontaneous ice cream breaks, much to the dismay of his friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cultivate', 'noun', 'To grow, to develop', 'She worked hard to cultivate a love of reading in her children by filling the house with books.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Juvenile', 'noun', 'Young, childish, immature', 'His juvenile sense of humor made everyone roll their eyes, especially when he pulled out the whoopee cushion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convulsion', 'noun', 'A sudden, violent, irregular movement of the body', 'His attempt to dance looked more like a series of convulsions, but at least he was having fun.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Devise', 'noun', 'To plan or invent by careful thought', 'They devised an elaborate plan to surprise their friend, which involved cake, balloons, and a marching band.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Immure', 'noun', 'To imprison someone against their will', 'The villain planned to immure the hero in a tower, but the hero had other ideas—like escaping through the window.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Perturb', 'noun', 'To make someone anxious or unsettled; to disturb', 'The creepy noises coming from the attic perturbed him so much that he slept with the lights on.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solicitude', 'noun', 'Care or concern for someone or something', 'His grandmother’s constant solicitude meant she was always asking if he’d eaten enough or needed a sweater.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pervasive', 'noun', 'Spreading widely throughout an area or group of people', 'The pervasive smell of freshly baked cookies filled the entire house, drawing everyone to the kitchen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tyranny', 'noun', 'Cruel and abusive government or rule', 'The king’s tyranny led to a revolt as people demanded freedom from his unfair laws.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apprehensive', 'noun', 'Anxious or fearful that something bad or unpleasant will happen', 'He was apprehensive about skydiving, but once he jumped, the fear turned into excitement.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Provision', 'noun', '1) A condition or requirement in a legal document 2) The act of providing services or resources', 'The contract had a provision that allowed them to cancel anytime, which gave them peace of mind.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insolent', 'noun', 'Showing a rude lack of respect', 'His insolent remark to the teacher earned him a trip to the principal’s office.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Consensus', 'noun', 'General agreement', 'After much debate, the group reached a consensus to order pizza for dinner.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discord', 'noun', 'Disagreement between people', 'The discord between the two teams was so intense that even the referees couldn’t calm things down.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Complement (verb)', 'noun', 'To add to (something) in a way that enhances or completes it', 'The spicy salsa complemented the mild guacamole perfectly, creating a delicious balance of flavors.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mortify', 'noun', 'To cause (someone) to feel embarrassed, ashamed, or humiliated', 'He was mortified when his phone rang loudly in the middle of the silent library.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dissipate', 'noun', 'To disappear or evaporate', 'The fog dissipated as the sun rose, revealing a clear view of the mountains.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Doctrine', 'noun', 'A belief or set of beliefs', 'The school’s doctrine emphasized kindness and respect for all, values they instilled in every student.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incomprehensible', 'noun', 'Not able to be understood', 'His handwriting was so messy that it was completely incomprehensible, leaving everyone guessing what the note said.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recount', 'noun', 'To tell someone about something, to give a report of an event', 'He eagerly recounted the story of his adventure at the amusement park, complete with sound effects and dramatic pauses.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inefficacious', 'noun', 'Unable to produce the intended result', 'His attempt to fix the leaky faucet with duct tape was inefficacious, and water sprayed everywhere.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adversary', 'noun', 'One’s opponent or enemy', 'His adversary in the chess tournament was a fierce competitor, but he managed to win with a clever move.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Endow', 'noun', 'To provide, to supply', 'The school was endowed with state-of-the-art computers, making every student feel like a tech genius.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Confound', 'noun', 'To cause surprise or confusion in someone', 'His ability to solve the Rubik’s Cube in seconds confounded his friends, who were still stuck on step one.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assert', 'noun', 'To state a fact or belief confidently and forcefully', 'She asserted her right to the last piece of cake, declaring it with such conviction that no one dared challenge her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Undermine', 'noun', 'To gradually damage or weaken someone or something', 'The constant criticism slowly undermined his confidence, making him doubt even his best work.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Paradox', 'noun', 'A statement or situation that may be true but seems impossible or difficult to understand because it contains two opposite facts or characteristics', 'It’s a paradox that the more you sleep, the more tired you sometimes feel.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apt', 'noun', 'Appropriate or suitable in the circumstances', 'His joke about the rain was apt, especially since everyone had just arrived soaking wet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Competent', 'noun', 'Having the necessary ability, knowledge, or skill to do something successfully', 'He was a competent mechanic, able to fix anything from a car engine to a squeaky door.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Severity', 'noun', 'The quality of being very unpleasant, unkind, or difficult', 'The severity of the storm forced everyone to stay indoors and cancel all weekend plans.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dismay', 'noun', 'A feeling of shock and unhappiness', 'His dismay was evident when he realized the ice cream shop had just run out of his favorite flavor.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Usurp', 'noun', 'To take power or control of something by force or without the right to do so', 'The knight attempted to usurp the throne, but his plan was foiled by the clever princess.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nostalgic', 'noun', 'Feeling happy and also slightly sad when you think about things that happened in the past', 'Listening to his old favorite songs made him feel nostalgic for his high school days.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ornate', 'noun', 'Having a lot of complex patterns or decoration', 'The ornate chandelier sparkled so much it looked like a piece of art hanging from the ceiling.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hierarchy', 'noun', 'A system in which people or things are put at various levels or ranks according to their importance', 'The office hierarchy was clear, with the boss at the top and the interns scrambling at the bottom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irrational', 'noun', 'Not logical or reasonable', 'His irrational fear of flying made vacations complicated, especially since he lived on an island.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bluster', 'noun', 'Talk intended to seem important or threatening but which is not taken seriously and has little effect', 'His bluster about quitting his job was ignored by everyone—he said it at least once a week.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subordinate', 'noun', 'Having a lower or less important position', 'In the company, the interns were seen as subordinate to the full-time staff, even though they worked just as hard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Malicious', 'noun', 'Intending to cause harm; evil', 'The malicious hacker tried to steal everyone’s data, but was stopped by a strong firewall.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amend', 'noun', 'To revise, to make changes', 'They had to amend the report several times before it was finally approved by the boss.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conform', 'noun', 'To behave according to an expectation or rule', 'He refused to conform to the office dress code, showing up in bright, mismatched outfits every day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tout', 'noun', 'To advertise or praise something (often to sell it)', 'The salesman touted the benefits of his product so much that it started to sound too good to be true.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Permeate', 'noun', 'To spread throughout something', 'The smell of fresh popcorn permeated the theater, making everyone crave a snack.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incantation', 'noun', 'A series of words said as a magic spell or charm', 'The wizard muttered an ancient incantation, and suddenly the broomstick started to fly on its own.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impervious', 'noun', 'Not able to be influenced, hurt, or damaged', 'His thick winter coat made him impervious to the cold wind blowing across the mountain.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Actuate', 'noun', '1) To cause (a machine or device) to operate 2) To cause (someone) to act in a particular way', 'The switch actuated the alarm system, sending everyone into a panic.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Versatility', 'noun', 'Ability to adapt to many different functions or activities', 'Her versatility as an athlete meant she excelled at everything from swimming to soccer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Proclaim', 'noun', 'To announce officially or publicly', 'The mayor proclaimed that every Friday would be Free Ice Cream Day, and the entire town cheered.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obeisance', 'noun', 'Deep respect', 'The knight showed obeisance to the queen by kneeling before her and swearing loyalty.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Modest', 'noun', '1) Humble, not showy 2) Not large in size or amount', 'Despite his success, he remained modest, never boasting about his achievements.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adorn', 'noun', 'To decorate', 'They adorned the Christmas tree with lights, ornaments, and a star on top.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solitude', 'noun', 'The state or situation of being alone', 'She found peace in the solitude of the forest, far away from the noise of the city.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deplete', 'noun', 'To use up the supply or resources of', 'The long hike quickly depleted their water supply, leaving them thirsty and tired.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solemn', 'noun', 'Having or showing serious purpose and determination; formal', 'The graduation ceremony was solemn, with speeches about the future and a few tears.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Proponent', 'noun', 'A person who supports an idea, plan, or cause', 'He was a strong proponent of renewable energy, always promoting solar and wind power.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Keen', 'noun', 'Sharp; highly developed (usually the senses)', 'Her keen sense of smell allowed her to detect the faintest hint of cookies baking.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Engulf', 'noun', 'To surround and cover completely', 'The waves engulfed the small boat, leaving it barely visible beneath the water.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diverge', 'noun', 'To go in different directions from the same point; to become different', 'The paths diverged in the woods, and they had to choose which one to follow.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Squalid', 'noun', 'Extremely dirty, poor, and unpleasant', 'The abandoned house was squalid, with broken windows and garbage everywhere.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hypothetical', 'noun', 'Imagined or suggested but not necessarily real or true', 'The professor posed a hypothetical question about time travel, sparking a lively debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pressing', 'noun', 'Urgent or needing to be dealt with immediately', 'The pressing deadline forced him to work late into the night.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solicitation', 'noun', 'A request for money, information, or help', 'The charity sent out a solicitation for donations to help families in need.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Meddle', 'noun', 'Interfere in something that is not one’s concern', 'His little brother loved to meddle in his business, always snooping around and asking too many questions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coarse', 'noun', '1) Rough, not smooth 2) Rude or offensive in manner or speech', 'The sandpaper was coarse to the touch, perfect for smoothing out the rough wood.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reproach', 'noun', 'To criticize or express disapproval with someone', 'His mother reproached him for not finishing his homework before going out with friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Immerse', 'noun', '1) To put something completely under a liquid 2) To involve someone completely in an activity', 'She immersed herself in her book, losing track of time as she read for hours.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Clout', 'noun', 'Power and influence (especially in politics or business)', 'The CEO’s clout in the industry meant that everyone listened when he spoke.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exacerbate', 'noun', 'To make something that is already bad worse', 'His decision to skip studying only exacerbated his stress when the exam arrived.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dubious', 'noun', 'Doubtful', 'He was dubious about the claim that eating chocolate could help you lose weight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plausible', 'noun', 'Possibly true, able to be believed, reasonable', 'His explanation for why he was late was plausible, though still a bit suspicious.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Notion', 'noun', 'A belief or idea', 'The notion that he could finish the entire pizza by himself seemed ambitious but possible.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impartial', 'noun', 'Able to judge something fairly', 'The judge was impartial, weighing both sides of the argument equally before making a decision.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Swath', 'noun', 'A long strip or area of something', 'The farmer cut a wide swath through the field, leaving a neat row of wheat behind him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dabble', 'noun', 'To try an activity in a casual way', 'He likes to dabble in painting, though he’s not ready to call himself an artist just yet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Earnest', 'noun', 'Sincere and serious', 'His earnest apology made it clear he truly regretted his mistake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vitality', 'noun', 'Life, energy, and strength', 'The dancer’s vitality was contagious, filling the entire room with excitement.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mimic', 'noun', 'To imitate or copy (someone’s actions or words)', 'The parrot loved to mimic its owner, repeating everything in a high-pitched voice.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Agitate', 'noun', '1) To make someone troubled or nervous 2) To campaign for something in public', 'The loud noises outside began to agitate the baby, who started to cry.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Practical', 'noun', 'Likely to succeed or be effective in real circumstances, relating to actual experience rather than knowledge only', 'His practical solution to the problem saved time and effort, proving his experience was valuable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ominous', 'noun', 'Suggesting something unpleasant will happen', 'The dark clouds looked ominous, hinting at a storm on the way.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dominion', 'noun', '1) Control over a country or people 2) The land that belongs to a ruler', 'The king’s dominion stretched across vast lands, but his people lived peacefully.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pretense', 'noun', 'A false display, an attempt to deceive', 'Under the pretense of being friendly, he gathered information for his own gain.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Egocentric', 'noun', 'Thinking only of oneself; self-centered', 'His egocentric attitude made him forget that his friends also had opinions and feelings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exploit', 'noun', 'To make full use of (a resource), to use (a person) in an unfair or selfish way', 'The company was criticized for exploiting its workers, offering low pay for long hours.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Comprise', 'noun', 'To consist of or to be made up of', 'The team comprises players from five different countries, making it truly international.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plight', 'noun', 'A dangerous, difficult, or otherwise unfortunate situation', 'The plight of the stranded hikers was worsened by the sudden snowstorm.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exemplify', 'noun', 'To be a typical example of something', 'His work ethic exemplified what it means to be a dedicated student.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Momentous', 'noun', 'Very important (in reference to a decision or event)', 'The signing of the peace treaty was a momentous event in the nation’s history.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reverberate', 'noun', 'To continue to be heard; to echo repeatedly', 'The sound of the bell reverberated through the empty halls, filling the space with a low hum.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Paternal', 'noun', 'Behaving or feeling as a father does toward his child', 'His paternal instincts kicked in when he saw the child lost in the store, and he immediately offered help.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lament', 'noun', 'To express sadness and regret about something', 'She lamented the loss of her favorite necklace, which had sentimental value.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mediation', 'noun', 'The process by which someone tries to end a disagreement by helping the two sides to talk about and agree on a solution', 'The mediation between the two companies helped resolve the dispute without going to court.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Miser', 'noun', 'Someone who has a great desire to possess money and hates to spend it', 'The old miser refused to part with a single coin, even though he had more money than he could ever use.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Supple', 'noun', 'Bending or able to be bent easily; not stiff; flexible', 'The gymnast’s supple body allowed her to perform moves most people could only dream of.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Oblivious', 'noun', 'Not aware of what is happening around you', 'He was so engrossed in his book that he was oblivious to the chaos happening around him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sullen', 'noun', 'Silent and unpleasant; depressed; gloomy', 'After losing the game, he sat in sullen silence, refusing to talk to anyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Imperative', 'noun', '1) Extremely important or urgent 2) Something that needs to be done immediately', 'It’s imperative that we finish the project by Friday, or we’ll miss the deadline.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reminisce', 'noun', 'To talk about the past with pleasure', 'They loved to reminisce about their childhood adventures, laughing at all the mischief they used to get into.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tranquil', 'noun', 'Calm, quiet, and peaceful', 'The tranquil sound of the river made it the perfect spot to sit and relax with a good book.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cleave', 'noun', 'To cut or split into at least two parts', 'The sword cleaved through the air, cutting the fruit cleanly in two.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reluctance', 'noun', 'An unwillingness to do something', 'His reluctance to speak in front of the class was clear, as he avoided making eye contact with the teacher.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Misgiving', 'noun', 'A feeling of doubt, uncertainty, or worry about a future event', 'She had misgivings about signing the contract, feeling uneasy about the terms.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sparse', 'noun', 'Small in number, often spread over a large area; scarce', 'The sparse trees in the desert offered little shade from the blazing sun.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Progenitor', 'noun', 'Originator, creator, founder', 'He was the progenitor of the company, building it from the ground up with just an idea and hard work.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Absurd', 'noun', 'Ridiculous or completely unreasonable', 'The idea that cats could rule the world seemed absurd, but it still made for a funny movie.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Premise', 'noun', 'An idea or theory on which a statement or action is based; an assumption', 'The movie’s premise was simple—a superhero who could only use their powers once a day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scrutinize', 'noun', 'To examine someone or something very carefully', 'The jeweler scrutinized the diamond closely to ensure it was flawless.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Supplemental', 'noun', 'Added to something else in order to improve it or complete it', 'The supplemental guide provided additional tips for studying that weren’t in the main textbook.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Poignant', 'noun', 'Causing a feeling of sadness', 'The movie’s poignant ending left everyone in the theater wiping away tears.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obscure', 'noun', 'Not known to many people, difficult to understand', 'The professor mentioned an obscure historical figure that none of the students had ever heard of.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ancestral', 'noun', 'Belonging to or inherited from one’s ancestors', 'The family’s ancestral home had been passed down through generations, filled with history and memories.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gregarious', 'noun', 'Fond of company; sociable', 'His gregarious personality made him the life of every party, always surrounded by friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exert', 'noun', 'To use power or the ability to make something happen', 'The athlete exerted all his strength in the final lap to win the race.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vigorous', 'noun', 'Strong, healthy, and full of energy', 'After a vigorous workout, she felt energized and ready to take on the day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Entreat', 'noun', 'To ask someone sincerely or anxiously to do something', 'He entreated his friend to forgive him, apologizing over and over.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Desolation', 'noun', 'A state of complete emptiness or destruction', 'The desolation of the abandoned town was eerie, with empty streets and crumbling buildings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Notorious', 'noun', 'Famous for something bad', 'The notorious criminal was finally caught after years of evading the police.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Induce', 'noun', '1) To persuade someone to do something 2) To cause something to happen', 'The doctor induced labor to help the baby be born safely.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pompous', 'noun', 'Feeling that one is better or more important than other people', 'His pompous speech made it clear he thought he was the most important person in the room.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disparage', 'noun', 'To criticize someone or something in a way that shows a lack of respect', 'He disparaged his coworker’s ideas during the meeting, making her feel embarrassed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intact', 'noun', 'Complete and in the original state; not damaged', 'Despite the storm, the house remained intact, with not a single window broken.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Verdict', 'noun', 'An opinion or judgment', 'The jury delivered a verdict of “not guilty,” much to the relief of the defendant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mundane', 'noun', 'Ordinary and dull', 'His weekend was filled with mundane tasks like laundry and grocery shopping, nothing exciting at all.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Spur', 'noun', 'To encourage an activity or development, to cause something to develop faster', 'The coach’s pep talk spurred the team to play their best and win the championship.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sentinel', 'noun', 'A guard whose job is to stand and keep watch', 'The sentinel stood at the castle gates, alert for any signs of danger.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convey', 'noun', 'To make (an idea or feeling) known or understandable to someone; to communicate', 'He struggled to convey his gratitude, finally settling on a heartfelt thank-you note.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Render', 'noun', 'To cause someone or something to be in a particular state', 'The artist’s skillful painting rendered the scene so lifelike it felt like you could step into it.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Manifest', 'noun', 'To show something clearly, through signs or actions', 'Her nervousness manifested in her shaky hands as she prepared for the presentation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Continuum', 'noun', 'A continuous sequence; a range', 'Emotions exist on a continuum, with happiness at one end and sadness at the other.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Redress', 'noun', 'To correct a wrong', 'The company offered free repairs to redress the problems caused by their faulty products.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Underscore', 'noun', 'To emphasize the importance of something', 'The teacher underscored the importance of studying, reminding students that the final exam was only a week away.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enfeeble', 'noun', 'To make someone or something very weak', 'The long illness enfeebled him so much that even walking across the room was exhausting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disdain', 'noun', 'Dislike of someone or something that one feels does not deserve respect', 'He looked at the broken-down car with disdain, refusing to even consider buying it.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Flatter', 'noun', 'To praise someone in order to please him or her', 'The employee tried to flatter the boss with compliments, hoping to get a promotion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Posterity', 'noun', 'All future generations of people', 'The founding fathers made decisions that would affect posterity, ensuring freedom for future generations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sustain', 'noun', 'To strengthen or support; to keep alive', 'The trees sustained the village by providing food, shelter, and medicine for generations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sheer', 'noun', '1) Not mixed with anything else, pure or complete 2) Very large', 'The sheer size of the mountain left everyone speechless as they began the long climb.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assess', 'noun', 'To judge the quality or importance of something', 'The coach carefully assessed each player’s performance before making the final team selection.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Artisan', 'noun', 'A person who does skilled work with his or her hands', 'The artisan crafted beautiful, handmade pottery that was admired by everyone at the market.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subtle', 'noun', 'Not loud, bright, noticeable, or obvious', 'The subtle hint of lemon in the dish added a refreshing flavor without overpowering the other ingredients.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Repudiate', 'noun', 'To refuse to accept something or someone; to reject', 'He repudiated the false accusations, providing evidence that proved his innocence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Meander', 'noun', 'To follow a route that is not straight or direct', 'The river meandered through the valley, twisting and turning before reaching the ocean.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Effectual', 'noun', 'Successful in producing the intended results', 'His effectual leadership helped the company grow faster than anyone expected.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Meager', 'noun', 'Very small in amount or number', 'The meager portion of food left everyone still feeling hungry after dinner.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tedious', 'noun', 'Boring, slow, and tiring', 'Sorting through the paperwork was a tedious task, but it had to be done.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Calibrate', 'noun', 'To carefully measure or adjust', 'The technician calibrated the machine to ensure it worked accurately.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Potent', 'noun', 'Powerful, persuasive, or effective', 'The potent medicine worked quickly, relieving her headache in minutes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conducive', 'noun', 'Providing the right conditions for something to happen or exist; to help bring about', 'The quiet library was conducive to studying, allowing him to focus without distractions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reserved', 'noun', 'Tending to keep feelings or thoughts private; quiet', 'She was reserved during the meeting, listening carefully but not sharing her opinions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Medley', 'noun', 'A mixture of different things', 'The chef prepared a medley of vegetables, blending flavors from around the world.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Advocate', 'noun', '1) To support an idea 2) A person who publicly supports an idea', 'She is a strong advocate for animal rights, often speaking at rallies to raise awareness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Undulate', 'noun', 'To move with a smooth, wavelike motion', 'The flags undulated in the breeze, creating a mesmerizing display.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Magnitude', 'noun', '1) The great size or importance of something 2) The extent or degree of something', 'The magnitude of the earthquake was so great that buildings across the city were damaged.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aggrandize', 'noun', 'To make someone more powerful or important', 'The company’s new advertising campaign was designed to aggrandize its CEO as a visionary leader.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pummel', 'noun', 'To hit someone or something repeatedly', 'The boxer pummeled his opponent with a series of rapid punches, securing his victory.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Timid', 'noun', 'Easily frightened; shy', 'The timid puppy hid behind the couch whenever a loud noise startled him.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bias', 'noun', 'An unfair personal opinion that influences your judgment', 'His bias against certain groups clouded his ability to make fair decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Refine', 'noun', 'To improve something by making small changes', 'The artist refined her painting, adding details that made it more realistic.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Oscillate', 'noun', 'To swing back and forth', 'The fan oscillated, cooling different parts of the room as it moved.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Esteem', 'noun', 'Respect and admiration for someone', 'He was held in high esteem by his colleagues for his dedication and hard work.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Displace', 'noun', 'To force something or someone out of its usual or original place', 'The flood displaced many families, forcing them to leave their homes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pulpit', 'noun', 'A raised platform in a church from which the preacher speaks', 'The preacher delivered his sermon from the pulpit, his voice echoing through the church.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ingenious', 'noun', 'Clever, original, and inventive (in reference to a person)', 'His ingenious solution to the problem impressed everyone in the room.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Constitute', 'noun', 'To be the parts that form something', 'The committee constitutes members from various departments to ensure fair representation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insatiable', 'noun', 'Impossible to satisfy', 'His insatiable appetite for knowledge meant he was always reading or asking questions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Volition', 'noun', 'The power to make one’s own decisions', 'She left the company of her own volition, deciding it was time to pursue new opportunities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Relish', 'noun', 'To like or enjoy something', 'He relished every bite of the delicious meal, savoring the flavors.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Facilitate', 'noun', 'To make (an action or process) possible or easier', 'The new software will facilitate communication between the teams, making collaboration more efficient.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Threshold', 'noun', 'The level or point at which something starts', 'They were on the threshold of a scientific breakthrough, with only a few more experiments to go.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reform', 'noun', 'To make changes in something in order to improve it', 'The government promised to reform the education system to provide better opportunities for students.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sneer', 'noun', 'To make a facial expression that shows disapproval or disrespect', 'He sneered at his rival, showing his contempt for the competitor’s success.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Profound', 'noun', '1) Intense, extreme 2) Requiring deep thought', 'His speech left a profound impact on the audience, moving many to tears.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Venerable', 'noun', 'Respected', 'The venerable professor was so respected that even the campus squirrels lined up to listen to his lectures.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amicable', 'noun', 'Friendly', 'Despite the breakup, their parting was surprisingly amicable, with no hard feelings and even a few shared laughs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abstruse', 'noun', 'Difficult to understand', 'The professor’s abstruse explanation of quantum mechanics left many students confused.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cajole', 'noun', 'To coax', 'She managed to cajole her friend into joining her at the party, despite initial reluctance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Succinct', 'noun', 'Compendious', 'His compendious summary of the meeting saved everyone from reading the full report.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Concur', 'noun', 'To agree', 'The scientists concurred on the findings, confirming the accuracy of the results.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Delineate', 'noun', 'To list, explain', 'The speaker delineated the steps to solving the problem, making it easy for everyone to follow.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Digress(ion)', 'noun', 'To stray from the subject at hand', 'He started to discuss his weekend plans but quickly digressed into a story about his dog.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Elucidate', 'noun', 'To clarify', 'The teacher elucidated the complex math problem, making it easier for the students to understand.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Embroil(ed)', 'noun', 'Involved in an argument or conflict', 'The neighbors were embroiled in a heated argument about the property line.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Empiric(al)', 'noun', 'Based on observation and experiment (not theory)', 'The scientist’s empirical data provided strong evidence for the new hypothesis.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To list', 'noun', 'Enumerate', 'He enumerated the reasons for his decision, making it clear why he chose that option.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Representative example', 'noun', 'Epitome, Epitomize', 'Her dedication to her work epitomizes what it means to be a committed employee.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exemplar', 'noun', 'Representative example', 'The student’s essay was an exemplar of excellent writing, used as a model for others.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exhort', 'noun', 'To encourage', 'The coach exhorted his team to give their best effort in the final game.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Useful', 'noun', 'Expedient', 'The expedient solution helped resolve the issue quickly, though it wasn’t ideal.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To understand', 'noun', 'Fathom (verb)', 'She couldn’t fathom why her friend would act that way, leaving her puzzled.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Flagrant', 'noun', 'Evident, obvious', 'His flagrant disregard for the rules led to his immediate disqualification from the competition.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Florid(ity)', 'noun', 'Flushed, flowery', 'His florid speech was filled with elaborate metaphors, making it hard to follow.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inappropriateness, discrepancy', 'noun', 'Incongruity, Incongruous', 'The incongruity of her casual outfit at the formal event was hard to ignore.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ineffable', 'noun', 'Impossible to express in words', 'The beauty of the sunset was ineffable, leaving everyone speechless.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Innuendo', 'noun', 'Implicit suggestion', 'His speech was full of innuendos, hinting at his true feelings without directly stating them.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Concise', 'noun', 'Laconic', 'His laconic reply, a simple “yes,” left little room for further discussion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lucid', 'noun', 'Clear, easily understood', 'The instructions were so lucid that even beginners had no trouble following them.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vague', 'noun', 'Nebulous', 'His plans were so nebulous that no one could figure out what he actually intended to do.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nuance', 'noun', 'Subtle difference', 'There was a nuance in his tone that suggested he was upset, though he didn’t say it outright.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Paradigm', 'noun', 'Clear example', 'Her behavior was a paradigm of professionalism.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Babble', 'noun', 'Prattle', 'The child’s prattle went on for hours without making much sense.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pronouncement', 'noun', 'Formal declaration', 'The judge’s pronouncement ended the heated debate in the courtroom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Supporter', 'noun', 'Proponent', 'He was a strong proponent of renewable energy solutions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prosaic', 'noun', 'Lacking imagination, dull', 'His prosaic speech failed to inspire the audience.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rebuttal', 'noun', 'Defense, counterargument', 'The lawyer’s rebuttal weakened the opposing counsel''s case.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recant', 'noun', 'To reject, take back', 'The witness recanted her earlier testimony after realizing it was incorrect.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To reject', 'noun', 'Repudiate', 'She repudiated the accusations made against her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rescind', 'noun', 'To annul, retract', 'The company rescinded the offer after a background check revealed discrepancies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rhetoric', 'noun', 'Elegant speech or writing', 'The politician’s rhetoric was filled with persuasive and convincing points.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Simile', 'noun', 'A comparison using ''like'' or ''as''', 'The poet used a simile to describe her smile as bright as the sun.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tangential', 'noun', 'Irrelevant, digressive', 'His comment was tangential to the topic being discussed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Treatise', 'noun', 'Extensive written argument', 'She published a treatise on the environmental effects of deforestation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Verbose', 'noun', 'Wordy, long-winded', 'His verbose explanation made the simple concept difficult to follow.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aura', 'noun', 'Air, feeling', 'The old mansion had an eerie aura that made everyone uncomfortable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bombastic', 'noun', 'Pompous, inflated', 'His bombastic remarks made it hard for anyone to take him seriously.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Buoyant', 'noun', 'Cheerful, floating', 'Her buoyant personality made her the life of the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Callous', 'noun', 'Insensitive', 'His callous disregard for others’ feelings left everyone shocked.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cantankerous', 'noun', 'Irritable, argumentative', 'The cantankerous neighbor complained about everything.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Capricious', 'noun', 'Fickle, unpredictable', 'The weather in the mountains is notoriously capricious, changing without warning.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Caustic', 'noun', 'Bitter, sarcastic', 'Her caustic remarks stung even though they were meant as a joke.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convivial', 'noun', 'Sociable, lively', 'The convivial atmosphere at the party made everyone feel welcome.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demonstrative', 'noun', 'Openly emotional', 'She is very demonstrative, always expressing her emotions clearly and without hesitation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Despondent', 'noun', 'Sad, depressed', 'After the loss of his job, he felt despondent for weeks.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diffident', 'noun', 'Shy, lacking self-confidence', 'The diffident student hesitated to speak in front of the class.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discomfited', 'noun', 'Disappointed, defeated', 'She was discomfited by the sudden change in plans.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disillusionment', 'noun', 'Disenchantment, disappointment', 'The harsh reality of life led to her disillusionment with politics.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Elated', 'noun', 'Joyful, thrilled', 'He was elated when he received the acceptance letter from his dream university.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Felicitous', 'noun', 'Well-suited, happy', 'His felicitous choice of words made his speech very moving.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Forlorn', 'noun', 'Sad, abandoned', 'The forlorn dog waited by the door for its owner to return.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fortitude', 'noun', 'Courage in adversity', 'She showed great fortitude in the face of overwhelming challenges.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Furor', 'noun', 'Commotion, anger', 'The politician''s comments caused a furor among the public.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Histrionic', 'noun', 'Overly dramatic or emotional', 'Her histrionic outburst made everyone uncomfortable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Idyllic', 'noun', 'Simple and tranquil', 'They spent a week at an idyllic cabin by the lake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impetuous', 'noun', 'Rash, impulsive', 'His impetuous decision to quit his job surprised everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Jaded', 'noun', 'Tired, bored, lacking enthusiasm', 'After years of working in the same job, she felt jaded and unmotivated.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Jocular', 'noun', 'Cheerful, humorous', 'His jocular personality made him popular at parties.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Jovial', 'noun', 'Cheerful and friendly', 'She was in a jovial mood after hearing the good news.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Maudlin', 'noun', 'Overly sentimental', 'He became maudlin after a few drinks, reminiscing about his past.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bleak, sad', 'noun', 'Melancholy', 'There was a melancholy atmosphere at the funeral.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mercurial', 'noun', 'Fickle, changeable', 'Her mercurial temperament made it difficult to predict her reactions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Morose', 'noun', 'Gloomy, sullen', 'In academic writing, the word "Morose" often appears when authors gloomy, sullen…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Peevish', 'noun', 'Easily irritated', 'She became peevish when things didn’t go her way.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Penchant', 'noun', 'A strong preference', 'He has a penchant for collecting rare stamps.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Perfunctory', 'noun', 'Done without care or interest', 'His perfunctory handshake showed that he wasn’t truly interested in making a connection.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Petulant', 'noun', 'Irritable, easily annoyed', 'The petulant child threw a tantrum when he didn’t get his way.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Propensity', 'noun', 'Inclination, tendency', 'He has a propensity to overthink even simple decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Repugnant', 'noun', 'Offensive, disgusting', 'The smell coming from the garbage was utterly repugnant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reticent', 'noun', 'Emotionally reserved', 'She remained reticent during the discussion, keeping her thoughts to herself.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sanguine', 'noun', 'Cheerfully optimistic', 'Despite the challenges, she remained sanguine about her future.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solace', 'noun', 'Comfort, consolation', 'He sought solace in his friends after the breakup.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Somber', 'noun', 'Bleak, gloomy', 'The somber mood in the room reflected the tragic news.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Temperamental', 'noun', 'Moody, unpredictable', 'Her temperamental nature made it difficult to work with her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Trepidation', 'noun', 'Apprehension, fear', 'She approached the stage with trepidation, unsure of how the audience would react.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Truculent', 'noun', 'Aggressive, bad-tempered', 'The truculent attitude of the customer made the situation worse.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vicarious', 'noun', 'Felt indirectly through another’s experience', 'She felt vicarious excitement watching her friend perform.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Wrath', 'noun', 'Anger, rage', 'The wrath of the storm left a trail of destruction.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Alacrity', 'noun', 'Eagerness, readiness', 'She accepted the invitation with alacrity.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dormant', 'noun', 'Inactive', 'The volcano had been dormant for decades before erupting again.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ebullient', 'noun', 'Enthusiastic, lively', 'His ebullient personality made him the life of every gathering.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Equanimity', 'noun', 'Calmness, composure', 'She faced the chaos with equanimity, staying calm throughout.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hardy', 'noun', 'Robust, sturdy', 'The hardy plants survived the harsh winter conditions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indolent', 'noun', 'Lazy, avoiding activity', 'His indolent behavior prevented him from achieving his goals.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insipid', 'noun', 'Dull, boring', 'The presentation was so insipid that half the audience fell asleep.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Instigate', 'noun', 'To provoke, start', 'His comments instigated a heated argument among the group.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lackadaisical', 'noun', 'Lacking energy, lethargic', 'His lackadaisical attitude towards his work frustrated his colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Laggard', 'noun', 'Lazy person', 'The laggard in the group held up the completion of the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Languid', 'noun', 'Lacking energy; slow and relaxed', 'After a long, hot day, she lay languid on the couch, too tired to move.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Listless', 'noun', 'Languid, sluggish', 'She felt listless after staying up all night.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lull', 'noun', 'Short period of calm', 'There was a lull in the conversation after the awkward comment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pacify', 'noun', 'To soothe or calm', 'The mother pacified her crying baby with a lullaby.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Placate', 'noun', 'To calm someone down', 'The manager tried to placate the upset customer with a discount.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Calm', 'noun', 'Placid', 'The placid lake was a perfect spot for relaxation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Raucous', 'noun', 'Harsh, rowdy', 'The raucous crowd made it difficult to hear the speaker.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rouse', 'noun', 'To provoke, excite', 'The leader’s speech roused the crowd into action.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scintillating', 'noun', 'Lively, effervescent', 'Her scintillating performance captivated the audience.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stagnant', 'noun', 'Not moving, inactive', 'The stagnant water in the pond became a breeding ground for mosquitoes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Static', 'noun', 'Not moving', 'The static economy showed no signs of growth.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Torpor', 'noun', 'Drowsiness, apathy', 'After a big meal, he fell into a state of torpor.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unruly', 'noun', 'Boisterous, unrestrained', 'The unruly children caused chaos in the classroom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vapid', 'noun', 'Dull, uninteresting', 'The conversation was so vapid that he struggled to stay awake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abhor', 'noun', 'Hatred', 'In academic writing, the word "Abhor" often appears when authors hatred…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Acrimony', 'noun', 'Bitter animosity', 'The acrimony between the two rivals was evident during the debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amiable', 'noun', 'Friendly', 'Her amiable personality made her well-liked by everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dislike', 'noun', 'Antipathy', 'In academic writing, the word "Dislike" often appears when authors antipathy…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pleasant', 'noun', 'Congenial', 'The congenial atmosphere made the party enjoyable for everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quarrelsome', 'noun', 'Disputatious', 'Her disputatious nature often led to arguments with her friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Distaste', 'noun', 'Dislike, aversion', 'He expressed his distaste for the new policy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Empathetic', 'noun', 'Compassionate', 'She was empathetic towards her friend’s struggles.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exacting', 'noun', 'Demanding, severe', 'The exacting standards of the program were difficult to meet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Genial', 'noun', 'Friendly and cheerful', 'His genial smile and warm greeting made everyone feel welcome at the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Officious', 'noun', 'Meddlesome, interfering', 'The officious neighbor kept giving unsolicited advice.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Parody', 'noun', 'Intentional mockery', 'The comedian''s parody of the politician had the audience in stitches.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rancorous', 'noun', 'Bitter, resentful', 'Their rancorous relationship was filled with arguments and bitterness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rapport', 'noun', 'Relationship', 'She had a good rapport with her colleagues, which made working together easier.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recluse', 'noun', 'A hermit, someone who avoids others', 'The famous author lived as a recluse for many years.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Satire', 'noun', 'Sarcastic imitation', 'The movie was a satire on modern politics, full of sharp humor.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solicitous', 'noun', 'Expressing care or concern, often too much', 'The solicitous mother hovered over her child, worried about every move.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unwitting', 'noun', 'Unintentional', 'He made an unwitting mistake that led to a series of unfortunate events.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amenable', 'noun', 'Yielding, open to suggestions', 'She was amenable to trying out the new approach at work.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assiduous', 'noun', 'Diligent, hardworking', 'Her assiduous efforts resulted in a successful project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assuage', 'noun', 'To relieve or appease', 'He tried to assuage his guilt by apologizing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Compliant', 'noun', 'Yielding, submissive', 'The team was compliant with the new regulations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dauntless', 'noun', 'Courageous', 'The dauntless explorer ventured into uncharted territories.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Failure', 'noun', 'Debacle', 'The event was a complete debacle, with nothing going according to plan.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To weaken', 'noun', 'Debilitate', 'The illness debilitated him to the point where he could barely stand.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Debunk', 'noun', 'To prove wrong', 'The scientist debunked the popular myth with solid evidence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deference', 'noun', 'Respectful submission', 'Out of deference to her expertise, they followed her advice.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deterrent', 'noun', 'Hindrance, impediment', 'The threat of punishment acted as a deterrent to potential lawbreakers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discouraging', 'noun', 'Disheartening', 'The negative feedback was disheartening, but he continued working hard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dispel', 'noun', 'To drive away or disprove', 'She managed to dispel the rumors with a simple explanation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anxiety', 'noun', 'Disquiet', 'There was a sense of disquiet in the room as they waited for the results.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Facile', 'noun', 'Superficial, effortless', 'His facile response did not address the complexities of the issue.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Futile', 'noun', 'Hopeless, without effect', 'Their efforts to save the company were ultimately futile.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gallantry', 'noun', 'Brave, heroic behavior; polite attention or respect given by men to women', 'The knight showed great gallantry by defending the villagers from danger.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impasse', 'noun', 'Obstacle, deadlock', 'The negotiations reached an impasse, with neither side willing to compromise.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indomitable', 'noun', 'Too strong to be defeated', 'Her indomitable spirit kept her going even when things were tough.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intrepid', 'noun', 'Courageous, fearless', 'The intrepid adventurer explored the uncharted wilderness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Servile', 'noun', 'Submissive, subservient', 'His servile attitude towards his boss was noticed by everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Steadfast', 'noun', 'Loyal, not yielding', 'She remained steadfast in her belief, despite opposition.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tenacious', 'noun', 'Determined, persistent', 'Her tenacious efforts finally paid off when she was accepted into the program.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tenuous', 'noun', 'Insignificant, flimsy', 'His argument was tenuous and failed to convince the jury.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tribulation', 'noun', 'Suffering, distress', 'The family endured many tribulations during the difficult times.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vying', 'noun', 'Striving', 'Several companies were vying for the lucrative contract.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Acumen', 'noun', 'Insightfulness', 'Her business acumen helped her turn the company into a success.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adroit', 'noun', 'Skillful', 'The surgeon''s adroit hands saved the patient.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anthropology', 'noun', 'Study of human beings', 'He decided to major in anthropology to learn more about ancient cultures.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Boorish', 'noun', 'Crude, unmannered', 'His boorish behavior at the dinner offended many guests.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cerebral', 'noun', 'Intellectual', 'The book is too cerebral for me; I prefer more action-packed stories.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Churlish', 'noun', 'Rude, boorish', 'The churlish comments upset everyone at the table.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conscientious', 'noun', 'Careful, diligent', 'She was conscientious in completing her assignments on time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cosmopolitan', 'noun', 'Sophisticated, urbane', 'He has a cosmopolitan view, having traveled to many countries.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Credulity', 'noun', 'Gullibility, tendency to believe too easily', 'Her credulity made her an easy target for scams.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Didactic', 'noun', 'Morally instructive', 'The didactic novel aimed to teach its readers about kindness and empathy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discern', 'noun', 'To perceive or recognize', 'He could discern the slight differences between the original painting and the replica.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Epiphany', 'noun', 'Sudden realization', 'She had an epiphany about her career while on vacation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Erudite', 'noun', 'Having or showing great knowledge or learning', 'The professor’s erudite lecture on quantum physics left the students in awe of his expertise.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Esoteric', 'noun', 'Understood only by a few', 'The philosopher’s writings were so esoteric that only a small group of scholars could fully understand them.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fastidious', 'noun', 'Very careful, attentive to detail', 'Her fastidious attention to detail made her an excellent editor.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Finesse', 'noun', 'Tact, elegant skill', 'She handled the negotiations with great finesse.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Flummox', 'noun', 'To confuse', 'The complex instructions flummoxed everyone trying to assemble the furniture.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Folly', 'noun', 'Foolishness', 'It was pure folly to climb the mountain during a snowstorm.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Foolhardy', 'noun', 'Recklessly daring', 'His foolhardy decision to swim in the dangerous waters nearly cost him his life.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Grandiose', 'noun', 'Pompous, pretentious', 'His grandiose plans for the party were far beyond their budget.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inane', 'noun', 'Senseless, stupid', 'The comedian’s jokes were so inane that few people laughed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ineptitude', 'noun', 'Incompetence', 'His ineptitude at handling customer complaints cost the company several clients.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ingenuous', 'noun', 'Unsophisticated, naive', 'Her ingenuous nature made her an easy target for scams.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lithe', 'noun', 'Graceful, supple', 'The dancer’s lithe movements captivated the audience.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Beginner', 'noun', 'Neophyte', 'As a neophyte in the field, she had a lot to learn from her more experienced colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mistake', 'noun', 'Oversight', 'The oversight in the report was quickly corrected before the meeting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Painstaking', 'noun', 'Careful, diligent', 'The researcher conducted a painstaking analysis of the data.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pedantic', 'noun', 'Overly focused on rules or details', 'His pedantic approach to teaching bored many of his students.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Precocious', 'noun', 'Showing early development in maturity or intelligence', 'The precocious child could read by the age of three.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Provincial', 'noun', 'Narrow-minded, unsophisticated', 'His provincial views on art made him dismissive of modern styles.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Punctilious', 'noun', 'Meticulous, attentive to detail', 'He was punctilious in keeping his financial records in perfect order.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pundit', 'noun', 'A knowledgeable commentator', 'The political pundit offered insightful commentary during the debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quixotic', 'noun', 'Foolish, unrealistic', 'His quixotic plan to start a business with no experience was bound to fail.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Wise', 'noun', 'Sage', 'The sage advice from her mentor guided her through many difficult decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scrupulous', 'noun', 'Very careful, precise', 'Her scrupulous attention to detail ensured that no mistakes were made in the report.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Shrewd', 'noun', 'Astute, smart', 'The shrewd investor made profitable decisions even in a volatile market.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Slipshod', 'noun', 'Careless, sloppy', 'His slipshod work on the project caused many issues later on.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stupefy', 'noun', 'To stun or shock someone', 'The sudden announcement of his promotion stupefied him, leaving him speechless.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tractable', 'noun', 'Easily managed or controlled', 'The dog’s tractable nature made him easy to train.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Uncanny', 'noun', 'Extraordinary, weird', 'He had an uncanny ability to predict the outcome of the games.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Uncouth', 'noun', 'Crude, lacking manners', 'His uncouth behavior at the dinner shocked everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unfathomable', 'noun', 'Incomprehensible, unbelievable', 'The vastness of space is unfathomable to the human mind.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ungainly', 'noun', 'Clumsy, awkward', 'The ungainly teenager tripped over his own feet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Urbane', 'noun', 'Elegant, sophisticated', 'His urbane manners made him a favorite at social gatherings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Virtuoso', 'noun', 'One with exceptional musical skill', 'The young violinist was a virtuoso, performing with a depth beyond his years.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Wry', 'noun', 'Clever or grim sense of humor', 'His wry comments often lightened the mood during tense moments.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Decorum', 'noun', 'Order, politeness', 'Her sense of decorum was evident in how she handled the situation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Equitable', 'noun', 'Fair, even-handed', 'The judge made an equitable decision based on the evidence presented.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Illegal', 'noun', 'Illicit', 'He was arrested for his involvement in illicit activities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incriminate', 'noun', 'To accuse someone of a crime', 'The evidence incriminated him in the robbery.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indict', 'noun', 'Formally accuse of a crime', 'The grand jury indicted him on several charges of fraud.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indignant', 'noun', 'Angered by injustice', 'She was indignant when she learned she was passed over for promotion due to her gender.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lenient', 'noun', 'Indulgent', 'His indulgent parents never disciplined him, no matter what he did.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Judicious', 'noun', 'Fair, showing good judgment', 'The committee made a judicious decision that benefited everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ratify', 'noun', 'To approve or confirm', 'The treaty was ratified by both countries.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sanction', 'noun', 'To formally approve', 'The board sanctioned the new policy with a unanimous vote.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vindicate', 'noun', 'To clear of blame or suspicion', 'The new evidence vindicated the man, proving he was innocent of the crime.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Altruistic', 'noun', 'Generous, selfless', 'Her altruistic nature drove her to volunteer at the shelter every weekend.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Greed', 'noun', 'Avarice', 'His avarice led him to make unethical business decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Benevolent', 'noun', 'Well-meaning and kindly; showing goodwill', 'The benevolent stranger offered to help the lost tourists find their way.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bequeath', 'noun', 'To hand down through a will', 'He bequeathed his estate to his children in his will.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Depreciation', 'noun', 'Decrease in value', 'The depreciation of the car’s value was expected after five years of use.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Destitute', 'noun', 'Poor, lacking necessities', 'The charity aims to help destitute families get back on their feet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exorbitant', 'noun', 'Too expensive', 'The prices in the city were exorbitant compared to those in the countryside.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Frugal', 'noun', 'Cheap, economical', 'His frugal habits allowed him to save money over the years.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lucrative', 'noun', 'Profitable', 'She left her job to pursue a more lucrative career in finance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Luxuriant', 'noun', 'Lush, elaborate', 'The garden was filled with luxuriant plants and flowers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Generous', 'noun', 'Magnanimous', 'His magnanimous donation helped build a new school in the village.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mercenary', 'noun', 'Motivated by money', 'The mercenary soldier fought for whoever paid him the most.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Miserly', 'noun', 'Cheap, stingy', 'His miserly habits made him wealthy but also left him friendless.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Patronize', 'noun', 'To financially support or to condescend', 'She patronizes the local coffee shop every morning.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Penurious', 'noun', 'Stingy, poor', 'His penurious lifestyle was evident in his refusal to spend money on anything unnecessary.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Perquisite', 'noun', 'An additional payment or bonus', 'One of the perquisites of his job was access to the company car.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Philanthropist', 'noun', 'Someone who supports charity', 'The philanthropist donated millions to help fund education programs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Provident', 'noun', 'Prudent, frugal', 'His provident savings ensured he had a comfortable retirement.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To waste', 'noun', 'Squander', 'He squandered his inheritance on frivolous purchases.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Venal', 'noun', 'Willing to accept bribes', 'The venal politician was caught accepting money in exchange for favors.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Career', 'noun', 'Vocation', 'She felt that teaching was her true vocation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aberration', 'noun', 'Deviation from the norm', 'The storm was an aberration, as the region usually experiences mild weather.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Accost', 'noun', 'To confront', 'He was accosted by a stranger demanding money.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adamant', 'noun', 'Not yielding', 'She was adamant in her decision and refused to change her mind.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apathetic', 'noun', 'Lacking interest', 'The student’s apathetic attitude towards the class was concerning.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ascendancy', 'noun', 'Influence, domination', 'His ascendancy in the company was undeniable after his promotion to CEO.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ascetic', 'noun', 'Characterized by severe self-discipline and abstention from indulgence, often for religious reasons', 'The monk led an ascetic lifestyle, choosing to live in solitude and refrain from material possessions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('August', 'noun', 'Dignified', 'The august presence of the queen commanded respect.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Autocrat', 'noun', 'Dictator, dictatorial', 'The autocrat ruled the country with an iron fist.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Automaton', 'noun', 'A person who acts like a robot', 'He worked like an automaton, without showing any emotion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Banal', 'noun', 'Common, lacking originality', 'The movie was filled with banal dialogues and predictable plots.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bipartisanship', 'noun', 'Supported by two opposing groups (political parties)', 'The law was passed with surprising bipartisanship.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Depose', 'noun', 'To remove from power', 'The dictator was deposed by a peaceful revolution.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Derivative', 'noun', 'Not original', 'His style is derivative, clearly influenced by older artists.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Desecration', 'noun', 'Violation of something sacred', 'The desecration of the historic site caused public outrage.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Despot', 'noun', 'Dictator', 'The despot imposed strict laws and suppressed freedom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dogmatic', 'noun', 'Forcing one’s own opinions on others', 'He was so dogmatic that he refused to listen to anyone else’s ideas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Eclectic', 'noun', 'From diverse sources', 'Her taste in music is eclectic, ranging from classical to jazz.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Egalitarian', 'noun', 'Belief in equality', 'She is an egalitarian who supports equal rights for all.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exhibitionistic', 'noun', 'Deliberately attracting attention', 'His exhibitionistic behavior was meant to impress his peers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Faction', 'noun', 'A group within a larger group', 'A faction within the party opposed the new policy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fanaticism', 'noun', 'Excessive enthusiasm', 'His fanaticism for the team made him attend every game, regardless of the weather.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hackneyed', 'noun', 'Common, overused', 'The novel’s hackneyed plot made it uninteresting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Heresy', 'noun', 'Belief contrary to the established opinion', 'His ideas were considered heresy by the conservative members of the church.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Idiosyncrasy', 'noun', 'Unique personal trait', 'His habit of wearing mismatched socks was just one of his idiosyncrasies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Orthodox', 'noun', 'Conservative, traditional', 'The family followed orthodox customs passed down for generations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pacifist', 'noun', 'One who completely opposes violence', 'As a pacifist, he refused to join the army.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Partisan', 'noun', 'Biased supporter', 'He is a partisan of the ruling party, rarely critical of its decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Piety', 'noun', 'Religious devotion', 'Her piety led her to spend hours in prayer each day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Polemical', 'noun', 'Controversial', 'His polemical writing style often sparked heated debates.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reverent', 'noun', 'Respectful, showing deep respect', 'The crowd was reverent as the hero’s achievements were recounted.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sanctity', 'noun', 'Holiness, sacredness', 'The sanctity of the ancient temple was respected by all visitors.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Staunch', 'noun', 'Loyal and committed', 'He was a staunch supporter of animal rights.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stock', 'noun', 'Standard, common', 'His speech was filled with stock phrases, lacking originality.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Strident', 'noun', 'Loud and harsh', 'The strident alarm woke everyone in the building.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subversive', 'noun', 'Seeking to overthrow', 'The book was banned for its subversive ideas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Supplant', 'noun', 'To replace', 'Newer technologies have supplanted older devices.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sycophant', 'noun', 'Flatterer, someone who acts obsequiously', 'He was known as a sycophant, always agreeing with the boss.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Toady', 'noun', 'A person who behaves obsequiously', 'The toady eagerly complimented his manager at every opportunity.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Totalitarian', 'noun', 'Undemocratic, authoritarian control', 'The totalitarian regime controlled every aspect of citizens’ lives.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Trite', 'noun', 'Common, overused', 'His essay was filled with trite expressions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Zealot', 'noun', 'Fanatic, excessively enthusiastic', 'He was a zealot, willing to sacrifice everything for his beliefs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assail', 'noun', 'To attack verbally', 'In academic writing, the word "Assail" often appears when authors to attack verbally…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Berate', 'noun', 'To scold harshly', 'The coach berated the team for their poor performance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Castigate', 'noun', 'To punish or criticize severely', 'The teacher castigated the student for cheating.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Censorious', 'noun', 'Harshly critical', 'Her censorious remarks offended her friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Censure', 'noun', 'To scold or reprimand', 'The official was censured for his misconduct.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Chastise', 'noun', 'To punish or criticize', 'The mother chastised her son for his misbehavior.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Chide', 'noun', 'To scold', 'In academic writing, the word "Chide" often appears when authors to scold…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dismay, worry', 'noun', 'Consternation', 'He looked at the broken vase with consternation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contemptuous', 'noun', 'Showing disdain', 'Her contemptuous remarks upset her colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contemptible', 'noun', 'Despicable, deserving of disdain', 'The contemptible behavior shocked the community.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Culpable', 'noun', 'Deserving blame or censure; guilty', 'The manager was culpable for the violations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Denigrate', 'noun', 'Criticize unfairly', 'In academic writing, the word "Denigrate" often appears when authors criticize unfairly…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deprecate', 'noun', 'To express disapproval of', 'He deprecated the idea of increasing taxes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deride', 'noun', 'To mock or ridicule', 'The critics derided the actor’s latest performance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Derogatory', 'noun', 'Showing a critical or disrespectful attitude', 'The derogatory comments hurt her feelings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discount', 'noun', 'To disregard or dismiss as unimportant', 'He discounted her concerns about the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Eulogy', 'noun', 'A speech or piece of writing praising someone', 'The eulogy highlighted all of his major life accomplishments.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Extol', 'noun', 'To praise enthusiastically', 'The teacher extolled the student’s dedication to her studies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Laud', 'noun', 'To give praise; praiseworthy', 'The company received laudatory reviews for its innovation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Noxious', 'noun', 'Harmful, poisonous', 'The noxious fumes from the factory posed a health hazard.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reprehensible', 'noun', 'Deserving condemnation', 'His reprehensible actions led to his expulsion from school.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reprimand', 'noun', 'A formal expression of disapproval', 'The employee received a reprimand for his tardiness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scathing', 'noun', 'Severely critical', 'The scathing review damaged the author’s reputation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Slight', 'noun', 'To insult by treating with neglect', 'She felt slighted when they didn’t invite her to the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Spurn', 'noun', 'To reject with disdain or contempt', 'He spurned her offer to help with the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tirade', 'noun', 'A long, angry speech', 'His tirade about the unfair treatment lasted over an hour.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Affected', 'noun', 'Pretentious, designed to impress', 'His affected accent made him sound insincere.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Chagrin', 'noun', 'Distress or embarrassment at having failed', 'Much to his chagrin, he was not chosen for the promotion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Complacency', 'noun', 'A self-satisfied attitude with no desire to improve', 'His complacency led to a decline in the company’s performance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conciliate', 'noun', 'To soothe anger, make peace', 'He made a conciliatory gesture by apologizing first.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Degradation', 'noun', 'The act of lowering in dignity or status', 'The degradation of the environment is a global concern.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demure', 'noun', 'Modest and reserved in behavior', 'Her demure appearance belied her inner strength.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Flippant', 'noun', 'Lacking proper respect or seriousness', 'His flippant remarks about the serious issue upset everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hubris', 'noun', 'Excessive pride or self-confidence, often leading to downfall', 'His hubris blinded him to the potential risks, ultimately leading to the failure of his project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Public shame or disgrace', 'noun', 'Ignominy, Ignominious', 'His ignominious defeat ended his career in politics.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Imperious', 'noun', 'Assuming power or authority without justification', 'His imperious tone alienated his colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Not showing respect for others', 'noun', 'Impudence, Impudent', 'The child was punished for his impudence toward the teacher.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rude and disrespectful behavior', 'noun', 'Insolence, Insolent', 'Her insolent reply shocked everyone in the room.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lack of respect for serious things', 'noun', 'Irreverent, Irreverence', 'His irreverent comments during the meeting were inappropriate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Famous for something bad', 'noun', 'Notoriety, Notorious', 'The notorious gangster was finally arrested.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obdurate', 'noun', 'Stubbornly refusing to change one''s opinion', 'Despite the evidence, he remained obdurate in his stance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stubbornly refusing to change despite attempts to persuade', 'noun', 'Obstinate, Obstinacy', 'His obstinate refusal to cooperate caused delays.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Taking advantage of opportunities with little regard for principle', 'noun', 'Opportunist, Opportunistic', 'The opportunistic politician changed his views to gain more support.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Peremptory', 'noun', 'Insisting on immediate attention or obedience', 'The officer gave a peremptory command to the soldiers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Presumptuous', 'noun', 'Overstepping bounds, inappropriate boldness', 'It was presumptuous of him to assume she would agree.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recalcitrant', 'noun', 'Having an uncooperative attitude towards authority', 'The recalcitrant student refused to follow the teacher’s instructions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Self-righteous', 'noun', 'Believing one''s own actions and opinions are morally superior', 'Her self-righteous attitude alienated her friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Self-serving', 'noun', 'Prioritizing one''s own advantage over others', 'His self-serving behavior damaged his relationships with colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Supercilious', 'noun', 'Behaving as if superior to others', 'The supercilious waiter made the guests feel unwelcome.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unabashed', 'noun', 'Not embarrassed or ashamed', 'She was unabashed in her pursuit of success.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bog', 'noun', 'To be hindered or stalled', 'He got bogged down in the details of the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coalesce', 'noun', 'To come together to form one whole', 'The different factions coalesced into a united group.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Confluence', 'noun', 'The junction of two rivers, or the merging of ideas', 'There was a confluence of new ideas at the conference.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Effervesce', 'noun', 'To bubble, fizz, or show enthusiasm', 'Her effervescent personality made her the life of the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Elicit', 'noun', 'To draw out a response or reaction', 'His question elicited a thoughtful answer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indigenous', 'noun', 'Originating in a particular place', 'The indigenous people of the region have lived there for centuries.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Not moving or active', 'noun', 'Inert, Inertia', 'In academic writing, the word "Not moving or active" often appears when authors inert, inertia…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Multifarious', 'noun', 'Having many types', 'The multifarious talents of the artist amazed everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Outcome', 'noun', 'Precipitate', 'In academic writing, the word "Outcome" often appears when authors precipitate…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Allocate', 'noun', 'To assign or portion', 'They allocated a section of the budget for research.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Atrophy', 'noun', 'Waste away', 'The patient''s muscles began to atrophy from lack of use.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Attenuate', 'noun', 'To weaken or reduce', 'The signal was attenuated as it passed through the walls.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Burgeon', 'noun', 'To grow or flourish', 'Her interest in science burgeoned after the field trip.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To restrict', 'noun', 'Circumscribe', 'Their activities were circumscribed by the new regulations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Copious', 'noun', 'Abundant', 'She took copious notes during the lecture.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dearth', 'noun', 'Scarcity', 'There was a dearth of volunteers for the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Devoid', 'noun', 'Lacking', 'In academic writing, the word "Devoid" often appears when authors lacking…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diffuse', 'noun', 'To spread out', 'The light diffused through the frosted glass.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Extremely small', 'noun', 'Diminutive, Diminution', 'The diminutive bird fit easily in the palm of his hand.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To erase', 'noun', 'Efface(ment)', 'Time had effaced the memories of his childhood.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Encompass', 'noun', 'To include or surround', 'The syllabus encompasses all areas of the subject.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intrusive', 'noun', 'Encroaching', 'The weeds were encroaching on the garden.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Excavate', 'noun', 'To unearth or dig up', 'Archaeologists excavated the ancient city.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Extricate', 'noun', 'To disentangle', 'She extricated herself from the awkward situation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gigantic', 'noun', 'Gargantuan', 'The gargantuan statue towered over the park.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Germinate', 'noun', '(Cause to) grow', 'The seeds began to germinate after being planted.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hamper (verb)', 'noun', 'To hinder or restrict', 'The heavy traffic hampered their journey.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incubate', 'noun', 'To develop or grow', 'The eggs were incubated under controlled conditions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indiscriminate', 'noun', 'Done at random or without careful judgment; not selective', 'The indiscriminate use of pesticides harmed not only pests but also beneficial insects in the garden.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inhibit(ing)', 'noun', 'To restrain or hinder', 'In academic writing, the word "Inhibit(ing)" often appears when authors to restrain or hinder…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Innate', 'noun', 'Inborn or natural', 'She has an innate ability to communicate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Harmless', 'noun', 'Innocuous', 'His joke was innocuous, but it still offended some people.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insular(ity)', 'noun', 'Isolated or narrow-minded', 'His insular views made it difficult to discuss global issues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inundate', 'noun', 'To overwhelm or flood', 'The city was inundated by a massive storm.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Present but not visible or active', 'noun', 'Latent, Latency', 'The latent talent of the student was revealed in the final exam.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To make less severe or serious', 'noun', 'Mitigate, Mitigator', 'They tried to mitigate the damage caused by the hurricane.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Modicum', 'noun', 'A small quantity', 'He showed a modicum of respect during the debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Motley', 'noun', 'Varied or diverse', 'The motley crew included people from all walks of life.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Parch', 'noun', 'To dry out or dehydrate', 'The sun parched the land, leaving it barren.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Peripheral', 'noun', 'On the edge or outer boundary', 'The issue was peripheral to the main discussion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plasticity', 'noun', 'The ability to be shaped or molded', 'The plasticity of the brain allows it to adapt to new experiences.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('An excessive amount', 'noun', 'Plethora, Plethoric', 'The plethora of options made it hard to choose a restaurant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Easily bent or influenced', 'noun', 'Pliable, Pliant', 'The pliable clay was perfect for sculpting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Preclude', 'noun', 'To prevent or make impossible', 'His injury precluded him from playing in the game.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prodigious', 'noun', 'Remarkably large or impressive', 'He had a prodigious appetite, eating five plates of food.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plentiful or abundant', 'noun', 'Profuse, Profusion', 'The profusion of flowers made the garden beautiful.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Excessively high or restrictive', 'noun', 'Prohibitive, Prohibition', 'The cost of the car was prohibitive for most buyers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To increase rapidly', 'noun', 'Proliferate, Proliferation', 'The company has proliferated since launching its new product.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prolific', 'noun', 'Productive or creative', 'She is a prolific writer, publishing several books a year.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quell', 'noun', 'To suppress or put an end to', 'The police were called to quell the riot.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rampant', 'noun', 'Spreading unchecked', 'Crime was rampant in the city during the 90s.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ravenous', 'noun', 'Extremely hungry', 'After the hike, he was ravenous and ate everything in sight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reap', 'noun', 'To gather or harvest, especially crops', 'After months of hard work, they were finally able to reap the rewards of their efforts.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recessive', 'noun', 'Tending to recede or go backward', 'In academic writing, the word "Recessive" often appears when authors tending to recede or go backward…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Relinquish', 'noun', 'To give up or surrender', 'He relinquished control of the company to his partner.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Repertory', 'noun', 'A collection of plays or works', 'The theater company had a large repertory of Shakespearean plays.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Satiate', 'noun', 'To satisfy fully', 'In academic writing, the word "Satiate" often appears when authors to satisfy fully…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Saturate', 'noun', 'To soak or fill completely', 'In academic writing, the word "Saturate" often appears when authors to soak or fill completely…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scanty', 'noun', 'Small or insufficient in quantity', 'His scanty salary was barely enough to pay rent.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scope', 'noun', 'The range or extent of something', 'The scope of the project was much larger than expected.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Superfluous', 'noun', 'More than what is needed', 'She bought a superfluous amount of decorations for the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Surfeit', 'noun', 'An excessive amount', 'The surfeit of food at the banquet was overwhelming.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To be full of or swarming with', 'noun', 'Teem, Teeming', 'In academic writing, the word "To be full of or swarming with" often appears when authors teem, teeming…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lacking thought or intelligence', 'noun', 'Vacuous, Vacuity', 'His vacuous expression showed he wasn’t paying attention.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Viscous', 'noun', 'Thick and sticky', 'The viscous syrup slowly dripped from the bottle.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Waning', 'noun', 'Decreasing in size or strength', 'In academic writing, the word "Waning" often appears when authors decreasing in size or strength…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Byzantine', 'noun', 'Complex and intricate', 'The byzantine nature of the tax code confuses many people.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Harsh or discordant sounds', 'noun', 'Cacophonous, Cacophony', 'The cacophonous noise from the construction site was unbearable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cursory', 'noun', 'Hasty and not thorough', 'He gave the report a cursory glance before the meeting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gait', 'noun', 'A person''s manner of walking', 'In academic writing, the word "Gait" often appears when authors a person''s manner of walking…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Garish', 'noun', 'Excessively bright or flashy', 'The garish colors of the outfit made her stand out.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Glutton(ous)', 'noun', 'Someone who consumes too much food or drink', 'He was a glutton at the buffet, trying every dish.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lurid', 'noun', 'Vivid in a shocking way', 'The lurid details of the crime fascinated the media.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Malleable', 'noun', 'Easily influenced or shaped', 'The clay was malleable in her hands as she formed the sculpture.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ramshackle', 'noun', 'In a state of severe disrepair', 'The old ramshackle house looked like it could collapse at any moment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Redolent', 'noun', 'Strongly reminiscent or suggestive of', 'The air was redolent with the smell of pine trees.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Shroud', 'noun', 'To cover or hide', 'In academic writing, the word "Shroud" often appears when authors to cover or hide…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stark(ness)', 'noun', 'Complete or sheer; severe in appearance', 'The stark contrast between light and dark was striking.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Succulent', 'noun', 'Juicy or rich in desirable qualities', 'The succulent steak was cooked to perfection.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Antediluvian', 'noun', 'Extremely old or outdated', 'His ideas were antediluvian and no longer relevant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dilatory', 'noun', 'Slow to act', 'The government was criticized for its dilatory response to the crisis.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hasten', 'noun', 'To move or act quickly', 'She hastened to finish the project before the deadline.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Oracle', 'noun', 'A person or thing regarded as an infallible authority', 'The oracle predicted the future with great accuracy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prospective', 'noun', 'Expected or likely to happen', 'The prospective students visited the campus.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Regressive', 'noun', 'Moving backward or returning to a previous state', 'The company adopted a regressive policy that hindered progress.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Temporize', 'noun', 'To avoid making a decision in order to gain time', 'The politician tried to temporize instead of addressing the issue.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Transient', 'noun', 'Lasting for only a short time', 'The transient nature of the job meant he moved frequently.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Arcane', 'noun', 'Understood by few; mysterious or secret', 'The professor’s arcane knowledge of ancient languages fascinated the students.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Belie', 'noun', 'To give a false impression', 'Her calm expression belied the anxiety she was feeling.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Charlatan', 'noun', 'A person falsely claiming to have special knowledge or skill', 'The charlatan tricked people into buying fake medicine.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Circuitous', 'noun', 'Roundabout, not direct', 'The circuitous route took longer than expected.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Clandestine', 'noun', 'Kept secret or done secretly', 'The clandestine meeting was held late at night.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demystify', 'noun', 'To make something clearer and easier to understand', 'The teacher demystified the complex concept with a simple explanation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Disingenuous', 'noun', 'Not candid or sincere', 'His disingenuous apology did not seem genuine.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Divulge', 'noun', 'To reveal something private or secret', 'She refused to divulge the details of the confidential agreement.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dupe', 'noun', 'To deceive or trick', 'In academic writing, the word "Dupe" often appears when authors to deceive or trick…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deceitful, double-dealing', 'noun', 'Duplicitous, Duplicity', 'Her duplicitous behavior made it hard to trust her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enigma', 'noun', 'Difficult to understand', 'Math seemed like an enigma to her, though she was good at other subjects.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exposé', 'noun', 'A public report about wrongdoing', 'The exposé revealed corruption within the company.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fallacious', 'noun', 'Based on a mistaken belief', 'The argument was fallacious and misleading.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fallacy', 'noun', 'A false or mistaken idea', 'The belief that vaccines cause autism is a fallacy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fraudulent', 'noun', 'Dishonest or deceptive', 'The fraudulent scheme cost investors millions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Furtive', 'noun', 'Attempting to avoid notice or attention', 'She gave him a furtive glance as she passed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unwilling to believe something', 'noun', 'Incredulous, Incredulity', 'She was incredulous when she heard the shocking news.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indeterminate', 'noun', 'Not exactly known, established, or defined', 'The cause of the accident is still indeterminate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inscrutable', 'noun', 'Impossible to understand or interpret', 'His inscrutable expression made it hard to tell what he was thinking.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('The use of words to convey a meaning opposite of its literal meaning', 'noun', 'Irony, Ironic', 'It was ironic that the fire station burned down.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ostensible', 'noun', 'Appearing to be true, but not necessarily so', 'The ostensible reason for his absence was illness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Seeming reasonable or probable', 'noun', 'Plausible, Plausibility', 'His explanation for the mistake seemed plausible.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pretext', 'noun', 'A reason given in justification that is not the real reason', 'He used the meeting as a pretext to leave work early.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prevaricator', 'noun', 'A person who speaks falsely; a liar', 'The prevaricator twisted the truth to suit his own needs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('To correct or make right', 'noun', 'Rectify, Rectitude', 'He tried to rectify his mistake by apologizing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('The act of proving something wrong', 'noun', 'Refutation, Refute', 'The refutation of his argument was swift and thorough.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sanctimonious', 'noun', 'Making a show of being morally superior', 'His sanctimonious attitude alienated his friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sophistry', 'noun', 'The use of clever but false arguments', 'The politician used sophistry to win the debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Spurious', 'noun', 'Not being what it purports to be; false or fake', 'The spurious documents were quickly exposed as forgeries.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Auspicious', 'noun', 'Conducive to success; favorable', 'The sunny weather was an auspicious sign for the wedding.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Barrage', 'noun', 'A concentrated outpouring, as of questions or blows', 'The reporter faced a barrage of questions from the press.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Belligerent', 'noun', 'Hostile and aggressive', 'The belligerent crowd became violent after the match.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Blighted', 'noun', 'In a state of decline or decay', 'The blighted neighborhood was once a thriving community.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bolster', 'noun', 'To support or strengthen', 'The success of the project bolstered his confidence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Buttress', 'noun', 'To support', 'In academic writing, the word "Buttress" often appears when authors to support…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Circumvent', 'noun', 'To find a way around an obstacle', 'He circumvented the problem by using a different approach.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conflagration', 'noun', 'A large, destructive fire', 'The forest conflagration destroyed thousands of acres.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contentious', 'noun', 'Causing or likely to cause disagreement', 'The contentious issue divided the community.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Decimate', 'noun', 'To destroy a large part of', 'The disease decimated the population of the village.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deleterious', 'noun', 'Harmful or damaging', 'The chemicals had a deleterious effect on the environment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Depravity', 'noun', 'Moral corruption', 'The depravity of his actions shocked the community.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dire', 'noun', 'Extremely serious or urgent', 'They were in dire need of medical assistance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Divergent', 'noun', 'Differing from the standard or norm', 'Their divergent opinions led to a heated argument.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Divisive', 'noun', 'Tending to cause disagreement or hostility', 'The politician’s divisive rhetoric alienated many voters.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Elude', 'noun', 'To evade or escape from', 'In academic writing, the word "Elude" often appears when authors to evade or escape from…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Elusive', 'noun', 'Difficult to find, catch, or achieve', 'Success remained elusive despite their best efforts.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Embittered', 'noun', 'To make someone feel bitter or resentful', 'In academic writing, the word "Embittered" often appears when authors to make someone feel bitter or resentful…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Encumbrance', 'noun', 'A burden or impediment', 'The heavy bag was an encumbrance during the hike.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fortuitous', 'noun', 'Happening by chance rather than intention', 'The meeting was a fortuitous coincidence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Marred', 'noun', 'Impaired the appearance of; disfigured', 'The scratch marred the surface of the table.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nefarious', 'noun', 'Wicked or criminal', 'The nefarious villain plotted to take over the world.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Palliate', 'noun', 'To relieve or lessen without curing', 'The medicine palliated the symptoms but did not cure the illness.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Precarious', 'noun', 'Not securely held or in position; dangerously likely to fall or collapse', 'The ladder was placed in a precarious position.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Raze', 'noun', 'To completely destroy', 'The old building was razed to make way for a new development.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Serendipity', 'noun', 'The occurrence of events by chance in a happy or beneficial way', 'Finding the rare book at the store was pure serendipity.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Spartan', 'noun', 'Showing the indifference to comfort or luxury', 'His spartan lifestyle involved few possessions and no luxuries.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vanquish', 'noun', 'To defeat thoroughly', 'The army vanquished its enemies in a decisive battle.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vigilant', 'noun', 'Keeping careful watch for possible danger', 'The guards remained vigilant throughout the night.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vindictive', 'noun', 'Having or showing a strong desire for revenge', 'Her vindictive actions were driven by years of resentment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Virulent', 'noun', 'Extremely harmful or poisonous', 'The virulent strain of the virus spread rapidly, leading to a public health crisis.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Epitome, Epitomize', 'noun', 'Representative example', 'Her dedication to her work epitomizes what it means to be a committed employee.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fathom (verb)', 'noun', 'To understand', 'She couldn’t fathom why her friend would act that way, leaving her puzzled.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incongruity, Incongruous', 'noun', 'Inappropriateness, discrepancy', 'The incongruity of her casual outfit at the formal event was hard to ignore.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Laconic', 'noun', 'Concise', 'His laconic reply, a simple “yes,” left little room for further discussion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Melancholy', 'noun', 'Bleak, sad', 'There was a melancholy atmosphere at the funeral.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Estrange', 'noun', 'Alienate', 'The argument estranged him from his family for years.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Debacle', 'noun', 'Failure', 'The event was a complete debacle, with nothing going according to plan.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Neophyte', 'noun', 'Beginner', 'As a neophyte in the field, she had a lot to learn from her more experienced colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sage', 'noun', 'Wise', 'The sage advice from her mentor guided her through many difficult decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Illicit', 'noun', 'Illegal', 'He was arrested for his involvement in illicit activities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Squander', 'noun', 'To waste', 'He squandered his inheritance on frivolous purchases.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Consternation', 'noun', 'Dismay, worry', 'He looked at the broken vase with consternation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ignominy, Ignominious', 'noun', 'Public shame or disgrace', 'His ignominious defeat ended his career in politics.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impudence, Impudent', 'noun', 'Not showing respect for others', 'The child was punished for his impudence toward the teacher.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insolence, Insolent', 'noun', 'Rude and disrespectful behavior', 'Her insolent reply shocked everyone in the room.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irreverent, Irreverence', 'noun', 'Lack of respect for serious things', 'His irreverent comments during the meeting were inappropriate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Notoriety, Notorious', 'noun', 'Famous for something bad', 'The notorious gangster was finally arrested.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obstinate, Obstinacy', 'noun', 'Stubbornly refusing to change despite attempts to persuade', 'His obstinate refusal to cooperate caused delays.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Opportunist, Opportunistic', 'noun', 'Taking advantage of opportunities with little regard for principle', 'The opportunistic politician changed his views to gain more support.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inert, Inertia', 'noun', 'Not moving or active', 'In academic writing, the word "Inert, Inertia" often appears when authors not moving or active…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Latent, Latency', 'noun', 'Present but not visible or active', 'The latent talent of the student was revealed in the final exam.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mitigate, Mitigator', 'noun', 'To make less severe or serious', 'They tried to mitigate the damage caused by the hurricane.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plethora, Plethoric', 'noun', 'An excessive amount', 'The plethora of options made it hard to choose a restaurant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pliable, Pliant', 'noun', 'Easily bent or influenced', 'The pliable clay was perfect for sculpting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Profuse, Profusion', 'noun', 'Plentiful or abundant', 'The profusion of flowers made the garden beautiful.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prohibitive, Prohibition', 'noun', 'Excessively high or restrictive', 'The cost of the car was prohibitive for most buyers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Teem, Teeming', 'noun', 'To be full of or swarming with', 'In academic writing, the word "Teem, Teeming" often appears when authors to be full of or swarming with…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vacuous, Vacuity', 'noun', 'Lacking thought or intelligence', 'His vacuous expression showed he wasn’t paying attention.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cacophonous, Cacophony', 'noun', 'Harsh or discordant sounds', 'The cacophonous noise from the construction site was unbearable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Duplicitous, Duplicity', 'noun', 'Deceitful, double-dealing', 'Her duplicitous behavior made it hard to trust her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incredulous, Incredulity', 'noun', 'Unwilling to believe something', 'She was incredulous when she heard the shocking news.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irony, Ironic', 'noun', 'The use of words to convey a meaning opposite of its literal meaning', 'It was ironic that the fire station burned down.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Plausible, Plausibility', 'noun', 'Seeming reasonable or probable', 'His explanation for the mistake seemed plausible.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rectify, Rectitude', 'noun', 'To correct or make right', 'He tried to rectify his mistake by apologizing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Refutation, Refute', 'noun', 'The act of proving something wrong', 'The refutation of his argument was swift and thorough.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Afford', 'noun', 'To have enough resources to do or buy something.', 'I can finally afford a new bike after saving for months.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Clinical', 'noun', 'Objective and unemotional; related to medical treatment.', 'His clinical approach to problem-solving makes him an excellent scientist.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Controversial', 'noun', 'Causing disagreement or debate.', 'The new school policy became a controversial topic among parents.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Counterproductive', 'noun', 'Having the opposite effect of what is intended.', 'Skipping meals to lose weight is counterproductive and can harm your health.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dreary', 'noun', 'Dull, bleak, or depressing.', 'The rainy weather made the whole day feel dreary.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Entail', 'noun', 'To involve or require as a necessary step.', 'Becoming a doctor entails years of study and training.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Foment', 'noun', 'To instigate or stir up.', 'The leader’s speech was intended to foment rebellion against the unjust law.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Geriatric', 'noun', 'Relating to old age or elderly people.', 'The hospital opened a new geriatric ward to care for older patients.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pitiable', 'noun', 'Deserving pity or sympathy.', 'The stray dog’s pitiable condition moved everyone to tears.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pragmatic', 'noun', 'Dealing with things sensibly and realistically.', 'His pragmatic approach to saving money helped him buy a car quickly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prosecute', 'noun', 'To officially charge someone with a crime and pursue legal action.', 'The state decided to prosecute the case despite limited evidence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reluctantly', 'noun', 'In an unwilling or hesitant manner.', 'He reluctantly agreed to help clean up the mess after the party.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Substantial', 'noun', 'Of considerable importance, size, or worth.', 'The fundraiser collected a substantial amount of money for the charity.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Validate', 'noun', 'To confirm or prove something as true.', 'The scientist’s findings were validated by further experiments.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abysmal', 'noun', 'Extremely bad or appalling.', 'The team’s performance was abysmal, leading to their early exit from the competition.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adapt', 'noun', 'To adjust or modify to suit a new environment or condition.', 'Animals adapt to their surroundings to survive.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Advent', 'noun', 'The arrival or beginning of something significant.', 'The advent of the internet changed the way we communicate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ambitious', 'noun', 'Having a strong desire to achieve something.', 'She is ambitious and aims to become the CEO of her company.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ambivalence', 'noun', 'Mixed feelings or uncertainty about something.', 'His ambivalence about moving to a new city was clear.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Capitalize', 'noun', 'To take advantage of or profit from something.', 'He capitalized on his unique skills to succeed in business.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Capture', 'noun', 'To take into one’s possession or control by force.', 'The photographer captured the beauty of the sunset perfectly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coincide', 'noun', 'To happen at the same time or to agree.', 'The concert coincided with my birthday, making it a special day.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Condone', 'noun', 'To accept or allow behavior that is morally wrong.', 'The teacher refused to condone cheating in the exam.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conviction', 'noun', 'A firmly held belief or the act of declaring someone guilty.', 'Her conviction in her ideals inspired others to follow her.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incite', 'noun', 'To encourage or stir up violent or unlawful behavior.', 'The speech was accused of inciting violence among the crowd.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inversion', 'noun', 'A reversal of position, order, or relationship.', 'The inversion of roles in the play made it interesting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Omnipotent', 'noun', 'Having unlimited power; able to do anything.', 'The ruler considered himself omnipotent and ruled with an iron fist.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Opine', 'noun', 'To express an opinion.', 'He opined that the new policy would benefit small businesses.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Oust', 'noun', 'To remove from a position or place.', 'The board decided to oust the CEO due to poor performance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ramify', 'noun', 'To spread or branch out into smaller divisions.', 'The decision could ramify into unexpected consequences.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Raw', 'noun', 'Uncooked or in a natural state.', 'He prefers eating raw vegetables for a healthy diet.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Retention', 'noun', 'The ability to keep or hold something.', 'The company focuses on employee retention to maintain its workforce.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Comparable', 'noun', 'Able to be compared; similar.', 'The two houses are comparable in price and size.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conduct', 'noun', 'To organize or carry out a task.', 'The scientist conducted an experiment to test the hypothesis.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Envy', 'noun', 'A feeling of jealousy towards someone''s possessions or achievements.', 'Her new car was the envy of the neighborhood.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Authenticity', 'noun', 'The quality of being genuine or real.', 'The museum verified the authenticity of the ancient artifact.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fiscal', 'noun', 'Relating to government revenue, especially taxes.', 'The fiscal policy aims to reduce the national debt.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Foreseeable', 'noun', 'Able to be predicted or anticipated.', 'No major changes are expected in the foreseeable future.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Freewheeling', 'noun', 'Acting without concern for rules or consequences.', 'The freewheeling lifestyle of the artist shocked his family.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Imposing', 'noun', 'Impressive or grand in appearance.', 'The imposing building towered over the skyline.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Imposition', 'noun', 'The act of forcing something on someone.', 'The imposition of new taxes angered the citizens.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Locomotion', 'noun', 'The ability to move from one place to another.', 'The invention of the wheel revolutionized human locomotion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prohibit', 'noun', 'To formally forbid something by law or rule.', 'Smoking is prohibited in public buildings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reconsideration', 'noun', 'The act of thinking again about a decision.', 'After much reconsideration, she decided to take the job offer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Solidarity', 'noun', 'Unity or agreement among individuals with a common interest.', 'The workers showed solidarity during the strike.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sufficient', 'noun', 'Enough to meet the needs of something.', 'In academic writing, the word "Sufficient" often appears when authors enough to meet the needs of something.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Emit', 'noun', 'To release or give off.', 'The factory emits a lot of smoke into the air.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Emphatic', 'noun', 'Expressing something forcibly and clearly.', 'She was emphatic about her decision to leave.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Enumerate', 'noun', 'To mention things one by one.', 'He enumerated the reasons for his decision.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Adversarial', 'noun', 'Involving conflict or opposition.', 'In academic writing, the word "Adversarial" often appears when authors involving conflict or opposition.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bittersweet', 'noun', 'Both pleasant and painful at the same time.', 'Graduation day was a bittersweet moment for everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Complement', 'noun', 'Something that completes or goes well with something else.', 'The wine was a perfect complement to the meal.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Confide', 'noun', 'To tell someone a secret in trust.', 'He confided his fears to his closest friend.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contradict', 'noun', 'To say the opposite of something.', 'In academic writing, the word "Contradict" often appears when authors to say the opposite of something.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Egregious', 'noun', 'Outstandingly bad or shocking.', 'The company made an egregious error in their calculations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Establish', 'noun', 'To set up or found something.', 'In academic writing, the word "Establish" often appears when authors to set up or found something.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Objectivity', 'noun', 'The quality of being unbiased and impartial.', 'The judge''s objectivity was praised during the trial.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Perish', 'noun', 'To die or be destroyed.', 'Many ancient manuscripts perished in the fire.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Precedent', 'noun', 'An earlier event or action regarded as an example.', 'This case sets a precedent for future decisions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Principle', 'noun', 'A fundamental truth or proposition serving as a foundation.', 'In academic writing, the word "Principle" often appears when authors a fundamental truth or proposition serving as a foundation.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Taut', 'noun', 'Stretched or pulled tight.', 'In academic writing, the word "Taut" often appears when authors stretched or pulled tight.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unadorned', 'noun', 'Plain and without decoration.', 'In academic writing, the word "Unadorned" often appears when authors plain and without decoration.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unveil', 'noun', 'To reveal or disclose.', 'The company unveiled its latest product at the conference.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dispatch', 'noun', 'To send off to a destination for a purpose.', 'The goods were dispatched promptly to the customer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Endure', 'noun', 'To suffer patiently or to last over time.', 'In academic writing, the word "Endure" often appears when authors to suffer patiently or to last over time.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Galvanizing', 'noun', 'Shocking or exciting to action.', 'The speech was galvanizing and motivated the crowd to act.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impart', 'noun', 'To communicate or bestow information.', 'The teacher imparted valuable knowledge to the students.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Annihilate', 'noun', 'To destroy completely.', 'In academic writing, the word "Annihilate" often appears when authors to destroy completely.…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Artificial', 'noun', 'Made by humans, not natural.', 'The flowers were artificial but looked real.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Avenue', 'noun', 'A path or approach to achieving something.', 'Education is an important avenue to success.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demonstrate', 'noun', 'To show or explain something clearly.', 'The scientist demonstrated how the experiment works.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rash', 'noun', 'Acting without careful consideration.', 'His rash decision led to financial problems.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Readily', 'noun', 'Without hesitation; willingly.', 'She readily agreed to help with the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scandalous', 'noun', 'Causing general public outrage.', 'The politician was involved in a scandalous affair.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Subsequently', 'noun', 'After a particular thing has happened.', 'He moved to New York and subsequently found a job.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unilateral', 'noun', 'Performed by or affecting only one side.', 'The decision was made unilaterally by the manager.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Urge', 'noun', 'To strongly recommend or encourage.', 'She urged her friends to join the charity event.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Desolate', 'noun', 'Deserted and bleak.', 'The desolate landscape stretched for miles.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diminish', 'noun', 'To make or become less.', 'Her influence in the company diminished over time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indiscriminately', 'noun', 'Without careful distinction or choice.', 'The bombings were carried out indiscriminately.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Refute', 'noun', 'To prove to be false or incorrect.', 'She refuted the claims made by the opposition.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Surly', 'noun', 'Bad-tempered and unfriendly.', 'The waiter was surly and rude to the customers.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Surmount', 'noun', 'To overcome a difficulty or obstacle.', 'She surmounted numerous challenges to achieve her dream.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tactful', 'noun', 'Showing sensitivity in dealing with others', 'She gave a tactful response to the sensitive question.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Treacherous', 'noun', 'Guilty of or involving betrayal; dangerous', 'The journey through the mountains was treacherous.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Excel', 'noun', 'To be exceptionally good at something', 'In academic writing, the word "Excel" often appears when authors to be exceptionally good at something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Allow', 'noun', 'To give permission for something', 'The teacher allowed students to leave early.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anticipate', 'noun', 'To expect or predict', 'We anticipate a large crowd at the event.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Candid', 'noun', 'Honest and straightforward', 'She gave a candid opinion about the project.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Culmination', 'noun', 'The highest point of something', 'Winning the championship was the culmination of their efforts.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deficient', 'noun', 'Lacking in some necessary quality or element', 'Her diet was deficient in essential vitamins.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dismayed', 'noun', 'Feeling distressed or shocked', 'He was dismayed by the sudden change in plans.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Eminent', 'noun', 'Famous and respected in a field', 'He is an eminent scientist known for his research.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exhilarating', 'noun', 'Making one feel very happy or thrilled', 'The roller coaster ride was exhilarating.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Infer', 'noun', 'To deduce or conclude from evidence', 'From his silence, I inferred he was upset.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Modify', 'noun', 'To make changes to something', 'The rules were modified to accommodate new players.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Null', 'noun', 'Having no legal or binding force', 'In academic writing, the word "Null" often appears when authors having no legal or binding force…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Onset', 'noun', 'The beginning or start of something', 'In academic writing, the word "Onset" often appears when authors the beginning or start of something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Provocative', 'noun', 'Causing anger or strong reaction', 'The provocative article sparked a heated debate.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quantitative', 'noun', 'Relating to measurable quantities', 'The report focused on quantitative data analysis.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Simple', 'noun', 'Easily understood or done', 'In academic writing, the word "Simple" often appears when authors easily understood or done…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sinister', 'noun', 'Giving the impression of harm', 'The abandoned house had a sinister appearance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Transparent', 'noun', 'Easy to perceive or detect', 'The glass was so transparent that it was nearly invisible.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Tremendous', 'noun', 'Very great in amount or intensity', 'The team made tremendous progress in a short time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unjust', 'noun', 'Not based on fairness', 'In academic writing, the word "Unjust" often appears when authors not based on fairness…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Accordingly', 'noun', 'In a way that is appropriate', 'In academic writing, the word "Accordingly" often appears when authors in a way that is appropriate…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apprehension', 'noun', 'Anxiety or fear about something', 'Her apprehension about the test was evident.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Basic', 'noun', 'Fundamental or essential', 'Learning the basic concepts is important.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Boost', 'noun', 'To increase or improve something', 'The new ad campaign boosted sales significantly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Commission', 'noun', 'An instruction or command', 'The artist received a commission to paint a portrait.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Confine', 'noun', 'To keep within limits', 'In academic writing, the word "Confine" often appears when authors to keep within limits…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Counteract', 'noun', 'To neutralize the effects of something', 'In academic writing, the word "Counteract" often appears when authors to neutralize the effects of something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Counterargument', 'noun', 'An argument made to oppose another argument', 'The lawyer presented a strong counterargument.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Frankly', 'noun', 'In an honest and direct way', 'In academic writing, the word "Frankly" often appears when authors in an honest and direct way…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Peculiar', 'noun', 'Strange or unusual', 'She had a peculiar habit of humming while working.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Persecute', 'noun', 'To harass or oppress', 'In academic writing, the word "Persecute" often appears when authors to harass or oppress…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Quirk', 'noun', 'A peculiar behavioral trait', 'His quirk of tapping his fingers was noticeable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Satiated', 'noun', 'Satisfied to the full', 'The delicious meal left him completely satiated.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Savvy', 'noun', 'Practical knowledge and ability', 'She is very savvy about social media trends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Secrete', 'noun', 'To produce and release a substance', 'The glands secrete hormones into the bloodstream.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stark', 'noun', 'Severe or bare in appearance', 'The stark landscape was devoid of vegetation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Viability', 'noun', 'Ability to work or be successful', 'The viability of the plan was questioned.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vital', 'noun', 'Absolutely necessary or important', 'In academic writing, the word "Vital" often appears when authors absolutely necessary or important…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vow', 'noun', 'A solemn promise', 'She took a vow to always help those in need.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Analogous', 'noun', 'Comparable in certain respects', 'The human brain is analogous to a computer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Apex', 'noun', 'The top or highest part of something', 'In academic writing, the word "Apex" often appears when authors the top or highest part of something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Assertion', 'noun', 'A confident statement of fact or belief', 'In academic writing, the word "Assertion" often appears when authors a confident statement of fact or belief…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ferocity', 'noun', 'The state of being fierce or violent', 'In academic writing, the word "Ferocity" often appears when authors the state of being fierce or violent…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Flourish', 'noun', 'To grow or develop in a healthy way', 'In academic writing, the word "Flourish" often appears when authors to grow or develop in a healthy way…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Impartiality', 'noun', 'Fairness and lack of bias', 'The judge''s impartiality was unquestionable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Paramount', 'noun', 'More important than anything else', 'In academic writing, the word "Paramount" often appears when authors more important than anything else…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Teeming', 'noun', 'Full of or swarming with', 'In academic writing, the word "Teeming" often appears when authors full of or swarming with…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Warrant', 'noun', 'To justify or necessitate', 'His actions did not warrant such harsh punishment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Brawl', 'noun', 'A noisy fight in a crowd', 'In academic writing, the word "Brawl" often appears when authors a noisy fight in a crowd…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Civic', 'noun', 'Relating to a city or town', 'She is involved in many civic activities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diligence', 'noun', 'Careful and persistent work', 'In academic writing, the word "Diligence" often appears when authors careful and persistent work…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Diversification', 'noun', 'The action of diversifying', 'Diversification of investments reduces risk.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Feasibility', 'noun', 'The practicality of something', 'The feasibility of the plan was evaluated.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fundamental', 'noun', 'Forming a necessary base', 'Equality is a fundamental principle of democracy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irreconcilable', 'noun', 'Impossible to bring into agreement', 'In academic writing, the word "Irreconcilable" often appears when authors impossible to bring into agreement…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pinnacle', 'noun', 'The highest point', 'Winning the championship was the pinnacle of his career.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sparingly', 'noun', 'In a restricted or infrequent manner', 'Use the medicine sparingly to avoid side effects.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Transpose', 'noun', 'To change the order or arrangement of something', 'The teacher asked us to transpose the rows and columns.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Constrict', 'noun', 'To make narrower by pressing together', 'In academic writing, the word "Constrict" often appears when authors to make narrower by pressing together…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nebulous', 'noun', 'Vague, unclear, or ill-defined', 'His plans for the future remain nebulous.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Mitigate', 'noun', 'To make less severe, serious, or painful', 'Measures were taken to mitigate the effects of climate change.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Outsized', 'noun', 'Unusually large or oversized', 'The outsized package couldn’t fit through the door.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Palpable', 'noun', 'Easily noticeable or capable of being felt', 'There was a palpable sense of excitement in the air.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Evince', 'noun', 'To show or demonstrate clearly', 'The data evinced a clear trend in customer behavior.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Overlooked', 'noun', 'Failed to be noticed or considered', 'The significance of her contributions was overlooked.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Accentuate', 'noun', 'To emphasize or highlight something', 'The report accentuated the need for policy reform.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Insuperable', 'noun', 'Impossible to overcome', 'The mountain presented an insuperable challenge.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irreproachable', 'noun', 'Beyond criticism; faultless', 'Her irreproachable character earned her universal respect.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Pretentiousness', 'noun', 'The quality of being showy or self-important', 'Her pretentiousness was apparent in the way she spoke.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ineluctable', 'noun', 'Impossible to avoid or resist', 'The consequences of his actions were ineluctable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inconsequential', 'noun', 'Not important or significant', 'The typo in the document was inconsequential to the final decision.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Manifestations', 'noun', 'Visible signs or expressions of something', 'The protests were manifestations of widespread discontent.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Rectify', 'noun', 'To correct or make something right', 'He tried to rectify his mistakes by apologizing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Ameliorate', 'noun', 'To make a bad situation better', 'Efforts were made to ameliorate the living conditions in the area.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unattainable', 'noun', 'Impossible to achieve', 'The peak was deemed unattainable without proper equipment.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amorphous', 'noun', 'Without a clearly defined shape or form', 'The plan was amorphous and lacked clear goals.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Misconstrued', 'noun', 'Interpreted wrongly', 'His comments were misconstrued as criticism.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prohibitive', 'noun', 'Excessively expensive; forbidding', 'The cost of the tickets was prohibitive for most families.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stipulate', 'noun', 'To demand or specify as part of an agreement', 'The contract stipulates the terms of the agreement clearly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dispersed', 'noun', 'Scattered across a wide area', 'In academic writing, the word "Dispersed" often appears when authors scattered across a wide area…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Augment', 'noun', 'To make something greater by adding to it', 'The team augmented their resources to meet the deadline.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Idiosyncratic', 'noun', 'Distinctive or peculiar to an individual', 'His idiosyncratic habits made him memorable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Synopsis', 'noun', 'A brief summary or general overview', 'The report provided a concise synopsis of the findings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coarseness', 'noun', 'The quality of being rough or crude', 'The coarseness of his language offended the audience.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Municipal', 'noun', 'Relating to a town or city and its governance', 'Municipal elections will be held next month.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sway', 'noun', 'To move back and forth or to influence someone''s opinion', 'In academic writing, the word "Sway" often appears when authors to move back and forth or to influence someone''s opinion…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indulgently', 'noun', 'In a manner showing excessive generosity or leniency', 'She indulgently allowed her child to stay up late.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Behold', 'noun', 'To observe or see something', 'We beheld the stunning view from the mountain.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convening', 'noun', 'The act of gathering or assembling', 'The convening of the council was announced yesterday.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Idealize', 'noun', 'To view something or someone as perfect', 'She tends to idealize her past experiences.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Heterodox', 'noun', 'Not conforming to established doctrines or beliefs', 'In academic writing, the word "Heterodox" often appears when authors not conforming to established doctrines or beliefs…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irrefutable', 'noun', 'Impossible to deny or disprove', 'In academic writing, the word "Irrefutable" often appears when authors impossible to deny or disprove…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Venerate', 'noun', 'To regard with great respect or reverence', 'They venerate the founder of their community.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Arduous', 'noun', 'Involving great effort or difficulty', 'Climbing the mountain was an arduous task.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unpretentious', 'noun', 'Not pretentious; simple and sincere', 'Her unpretentious manner made her approachable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Satiable', 'noun', 'Capable of being satisfied', 'He is easily satiable with small portions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incongruous', 'noun', 'Not in harmony with surroundings or expectations', 'The modern decor was incongruous with the ancient building.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Recurrent', 'noun', 'Occurring or appearing again periodically', 'The symptoms were recurrent every few weeks.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Monetizing', 'noun', 'The act of generating revenue from something', 'She is monetizing her social media content.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Appraising', 'noun', 'Assessing or evaluating the value of something', 'The art dealer spent hours appraising the painting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unequivocal', 'noun', 'Leaving no doubt; clear and unambiguous', 'The instructions were unequivocal and left no room for doubt.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Superseded', 'noun', 'Replaced or succeeded by something newer', 'The old rules have been superseded by modern regulations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Common with', 'noun', 'Shared or similar to others', 'He has much in common with his colleagues.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Collaboration with', 'noun', 'Working jointly with others', 'The project was a collaboration with several universities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reserve', 'noun', 'A backup or supply held for future use', 'She kept a reserve of supplies for emergencies.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deserve', 'noun', 'To be worthy of something', 'In academic writing, the word "Deserve" often appears when authors to be worthy of something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Individualistic', 'noun', 'Focused on individual interests or independence', 'Her individualistic approach set her apart from the group.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Comparison', 'noun', 'The act of comparing or examining similarities and differences', 'A comparison of the two products showed significant differences.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Homogeneous', 'noun', 'Of the same kind or similar nature', 'The neighborhood is remarkably homogeneous in its culture.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Occupy', 'noun', 'To take up space or time', 'They occupy the house during the summer months.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Interdependent', 'noun', 'Mutually reliant on each other', 'The two species are interdependent for survival.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Antagonist', 'noun', 'A person who actively opposes something', 'The antagonist in the story plotted against the hero.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Emulate', 'noun', 'To imitate or strive to equal', 'He tried to emulate his mentor''s success.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Manifest in', 'noun', 'To be evident or appear in something', 'Her leadership skills were manifest in every project she undertook.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Scrutiny', 'noun', 'Close examination or observation', 'In academic writing, the word "Scrutiny" often appears when authors close examination or observation…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unyielding', 'noun', 'Stubborn or refusing to yield', 'In academic writing, the word "Unyielding" often appears when authors stubborn or refusing to yield…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Prestige', 'noun', 'High status or reputation', 'The award added to her prestige in the field.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Partiate', 'noun', 'To divide or share', 'The two partners decided to partiate the profits.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Animosities toward', 'noun', 'Hostile feelings or attitudes toward someone or something', 'The animosities toward the policy were evident in the protests.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Omnipresent', 'noun', 'Present everywhere at the same time', 'The influence of technology is omnipresent in modern life.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Familiarize', 'noun', 'To become knowledgeable about something', 'He familiarized himself with the new software before starting work.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Replace', 'noun', 'To take the place of something', 'The new model will replace the outdated version.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Observe', 'noun', 'To watch or monitor carefully', 'They observed the birds through binoculars.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reject', 'noun', 'To refuse or dismiss something', 'She rejected the offer without hesitation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exactitude', 'noun', 'The quality of being precise or accurate', 'The exactitude of the calculations impressed everyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Extrapolate', 'noun', 'To predict or infer based on known information', 'From the data, we can extrapolate future trends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Startle', 'noun', 'To cause someone to feel sudden shock or surprise', 'In academic writing, the word "Startle" often appears when authors to cause someone to feel sudden shock or surprise…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Affinity for', 'noun', 'A natural liking for or attraction to something', 'She has a strong affinity for classical music.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hesitancy about', 'noun', 'Uncertainty or doubt about something', 'His hesitancy about the decision was understandable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Partition', 'noun', 'To divide or separate into parts', 'The partition divided the room into two sections.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Untoward', 'noun', 'Inappropriate or unfavorable', 'The untoward comment caused an awkward silence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Define', 'noun', 'To explain the meaning of something', 'In academic writing, the word "Define" often appears when authors to explain the meaning of something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Visualize', 'noun', 'To form a mental image of something', 'She visualized her goals vividly before taking action.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Similarities with', 'noun', 'Resemblances or comparable aspects with something', 'Their artwork shows similarities with the Impressionist style.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Examples of', 'noun', 'Instances that demonstrate or illustrate something', 'The teacher provided examples of good essays.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indication of', 'noun', 'A sign or evidence of something', 'The sudden drop in temperature was an indication of the coming storm.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gaining on', 'noun', 'To approach or catch up with someone or something', 'The runner was gaining on the leader in the final lap.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hesitancy', 'noun', 'Uncertainty or doubt in making a decision', 'Her hesitancy to accept the job offer was evident.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Hew out', 'noun', 'To carve or shape something from a material', 'The artist hewed a sculpture out of the marble.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Convene', 'noun', 'To bring people together for a meeting or assembly', 'The committee will convene next Monday to discuss the issue.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vacate', 'noun', 'To leave a place, making it empty', 'They had to vacate the premises immediately.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conspicuous', 'noun', 'Easily noticeable or attracting attention', 'Her conspicuous outfit drew everyone''s attention.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Irreplaceable', 'noun', 'Impossible to replace or substitute', 'The handmade artifact was deemed irreplaceable.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Anomalous', 'noun', 'Deviating from what is standard or expected', 'In academic writing, the word "Anomalous" often appears when authors deviating from what is standard or expected…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unfounded', 'noun', 'Having no basis in fact; groundless', 'The rumors were unfounded and dismissed by the authorities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Blender', 'noun', 'A machine for mixing or blending substances', 'She used a blender to prepare the smoothie.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Affecting', 'noun', 'Evoking strong emotion or feeling', 'In academic writing, the word "Affecting" often appears when authors evoking strong emotion or feeling…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Precursor', 'noun', 'A person or thing that comes before another', 'The Wright brothers were precursors to modern aviation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Bemused', 'noun', 'Confused or bewildered', 'She looked bemused as she read the strange letter.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vitriolic', 'noun', 'Filled with bitter criticism or malice', 'His vitriolic remarks offended everyone at the meeting.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Biased', 'noun', 'Unfairly prejudiced for or against something', 'The biased referee favored the home team.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Serene', 'noun', 'Calm, peaceful, or untroubled', 'The serene lake was a perfect spot for meditation.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Implicit', 'noun', 'Implied or understood without being stated', 'Her agreement was implicit in her actions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Corollary', 'noun', 'A natural consequence or result', 'A corollary of economic growth is increased environmental impact.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coincided with', 'noun', 'Happened at the same time as something else', 'The meeting coincided with the CEO''s visit.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Meticulous', 'noun', 'Showing great attention to detail', 'He is meticulous about keeping his desk organized.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Resonance', 'noun', 'The ability to evoke a sense of harmony or sympathy', 'The resonance of the music filled the hall.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Vigilance', 'noun', 'The quality of being watchful and alert', 'The guards maintained vigilance throughout the night.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discrepancy', 'noun', 'An inconsistency or lack of compatibility', 'There was a discrepancy between the two accounts.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dispute', 'noun', 'A disagreement or argument', 'They had a dispute over the ownership of the land.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Deliberation', 'noun', 'Careful consideration or discussion', 'After much deliberation, they decided to accept the offer.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lobbying', 'noun', 'The act of trying to influence decisions, especially in politics', 'The company spent millions on lobbying for the new law.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Detract', 'noun', 'To reduce or take away the value of something', 'Criticism did not detract from her achievements.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cynical', 'noun', 'Believing that people are motivated by self-interest', 'In academic writing, the word "Cynical" often appears when authors believing that people are motivated by self-interest…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Indistinct', 'noun', 'Not clear or sharply defined', 'The photo was too indistinct to recognize anyone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exhaustive', 'noun', 'Comprehensive and thorough', 'The report provided an exhaustive analysis of the data.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Augmented', 'noun', 'Made greater in size, amount, or value', 'The features of the app were augmented in the new update.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Cited', 'noun', 'Quoted as evidence or support', 'She cited multiple studies to support her argument.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Clichéd', 'noun', 'Overused and unoriginal', 'In academic writing, the word "Clichéd" often appears when authors overused and unoriginal…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Congruence', 'noun', 'Agreement or harmony', 'There was a strong congruence between their goals.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Constrained', 'noun', 'Restricted or limited', 'His constrained movements indicated he was in pain.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Credible', 'noun', 'Believable and trustworthy', 'In academic writing, the word "Credible" often appears when authors believable and trustworthy…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Customary', 'noun', 'Traditional or habitual', 'It is customary to remove your shoes before entering.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Decisive', 'noun', 'Able to make decisions quickly and effectively', 'Her decisive leadership saved the company.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Fled', 'noun', 'Ran away quickly from danger or pursuit', 'The thief fled the scene before the police arrived.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Heterogeneous', 'noun', 'Diverse in content or character', 'In academic writing, the word "Heterogeneous" often appears when authors diverse in content or character…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Improve on', 'noun', 'To make improvements or do better than before', 'She worked hard to improve on her previous performance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inextricable from', 'noun', 'Closely linked or unable to be separated from', 'The issue is inextricable from larger social problems.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Interpretation', 'noun', 'The act of explaining the meaning of something', 'His interpretation of the law was controversial.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intrinsic', 'noun', 'Belonging naturally; essential', 'In academic writing, the word "Intrinsic" often appears when authors belonging naturally; essential…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Invaluable', 'noun', 'Extremely valuable or useful', 'The document was of invaluable importance to the case.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obstruct', 'noun', 'To block or prevent something', 'In academic writing, the word "Obstruct" often appears when authors to block or prevent something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Replicate', 'noun', 'To copy or reproduce something exactly', 'They replicated the experiment to confirm the results.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Suppress', 'noun', 'To put an end to something by force', 'In academic writing, the word "Suppress" often appears when authors to put an end to something by force…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Terraced', 'noun', 'Having flat, leveled surfaces for cultivation', 'The terraced hills were perfect for farming.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Denounce', 'noun', 'To publicly declare something to be wrong or evil', 'The journalist denounced the corruption scandal.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Defunct', 'noun', 'No longer existing or functioning', 'The factory is now defunct and abandoned.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Magnify', 'noun', 'To make something appear larger', 'In academic writing, the word "Magnify" often appears when authors to make something appear larger…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Designate', 'noun', 'To assign or appoint someone for a task', 'In academic writing, the word "Designate" often appears when authors to assign or appoint someone for a task…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Appeasement', 'noun', 'The act of making concessions to maintain peace', 'The policy of appeasement failed to prevent the war.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amplify', 'noun', 'To increase in size, strength, or effect', 'The speaker amplified his voice using a microphone.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Abstain', 'noun', 'To refrain or hold back voluntarily', 'He abstained from voting in the election.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Benign', 'noun', 'Kind and gentle, not harmful', 'In academic writing, the word "Benign" often appears when authors kind and gentle, not harmful…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gratuitous', 'noun', 'Unnecessary or unwarranted', 'The movie was criticized for its gratuitous violence.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Contingent to', 'noun', 'Dependent on something else', 'His attendance is contingent to the approval of his supervisor.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Obliged', 'noun', 'Required to do something', 'In academic writing, the word "Obliged" often appears when authors required to do something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Stymie', 'noun', 'To hinder or block progress', 'The ongoing strike stymied their plans for production.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nullify', 'noun', 'To make something invalid or void', 'The new evidence nullifies the previous claims.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Exploiting', 'noun', 'Taking unfair advantage of something or someone', 'He was exploiting the system for his own benefit.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Lighthearted about', 'noun', 'Not taking something seriously', 'She was lighthearted about the minor mistake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Outstrip', 'noun', 'To surpass or exceed', 'The athlete outstripped his competitors in the final lap.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Dignify', 'noun', 'To give something a sense of worth or nobility', 'The medal dignified his years of service.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Palatable', 'noun', 'Acceptable to taste or mind', 'The dish was both palatable and visually appealing.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unpalatable', 'noun', 'Unpleasant or unacceptable to taste or mind', 'The unpalatable truth was hard to accept.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nourish', 'noun', 'To provide with sustenance or support', 'The gardener nourished the plants with care.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Juxtapose', 'noun', 'To place side by side for comparison', 'The artist juxtaposed modern elements with classical designs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Aperture', 'noun', 'An opening, gap, or hole', 'Light filtered through the narrow aperture in the wall.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Meteged', 'noun', 'Word unclear or requires clarification', 'In academic writing, the word "Meteged" often appears when authors word unclear or requires clarification…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Haphazard', 'noun', 'Lacking any obvious organization', 'The decorations were arranged in a haphazard manner.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reprieve', 'noun', 'To give relief', 'The threatened hospitals could now be reprieved.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Illuminate', 'noun', 'To light up or clarify something', 'In academic writing, the word "Illuminate" often appears when authors to light up or clarify something…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Oddity', 'noun', 'Something unusual or peculiar', 'Her quirky style was considered an oddity in the office.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Coincidence', 'noun', 'A remarkable concurrence of events or circumstances', 'It was a coincidence that they met on the same flight.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Incident', 'noun', 'An event or occurrence', 'The incident was reported to the authorities.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Sincerity', 'noun', 'The quality of being honest and genuine', 'Her sincerity was evident in her heartfelt apology.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Counterfactual', 'noun', 'Contrary to facts or reality', 'The counterfactual scenario explored what might have been.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Delicate', 'noun', 'Fragile, sensitive, or requiring careful handling', 'The delicate vase shattered when it fell.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Traditional', 'noun', 'Based on long-established customs or practices', 'The festival is rooted in traditional practices.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Efficacy', 'noun', 'The ability to produce the desired effect', 'The efficacy of the drug was confirmed in clinical trials.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Peaceful', 'noun', 'Free from conflict or disturbance', 'They enjoyed a peaceful afternoon in the park.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Notional', 'noun', 'Existing only in theory or as a concept', 'The notional value of the property exceeded expectations.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Demarcation', 'noun', 'The action of setting boundaries or limits', 'The river served as a natural demarcation between the two regions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Desultory', 'noun', 'Lacking a clear plan or purpose', 'The student’s desultory approach to studying led to poor results.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Misanthropic', 'noun', 'Having a dislike or distrust of humankind', 'The misanthropic character preferred solitude.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Nominal', 'noun', 'Existing in name only; insignificant', 'The fee was only nominal and barely covered the costs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Intercede', 'noun', 'To mediate or intervene on behalf of another', 'She interceded to resolve the conflict between her friends.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Amass', 'noun', 'To gather or collect a large amount of something', 'Over the years, he amassed a large collection of rare books.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Inconspicuous', 'noun', 'Not easily noticed or attracting attention', 'The shy student remained inconspicuous in the crowd.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Discretion', 'noun', 'The quality of behaving or speaking in a careful way', 'She handled the sensitive matter with great discretion.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Veritable', 'noun', 'Being truly or very much so; genuine', 'The cake was a veritable masterpiece of baking.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Gauche', 'noun', 'Lacking social grace or sensitivity', 'His gauche comments embarrassed everyone at the table.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Blend', 'noun', 'To mix or combine into a single substance or entity', 'In academic writing, the word "Blend" often appears when authors to mix or combine into a single substance or entity…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Relocation', 'noun', 'The act of moving to a new place', 'The company''s relocation to the city was announced.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Classification', 'noun', 'The process of grouping items based on shared characteristics', 'The classification of plants helps in their study.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Unwarranted', 'noun', 'Not justified or necessary', 'The complaints were based on unwarranted assumptions.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Conflate with', 'noun', 'To combine two or more things into one', 'He mistakenly conflated the two ideas in his argument.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Reconstituted', 'noun', 'Reformed or restored to its original state', 'The reconstituted soup tasted as fresh as homemade.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('Jointly', 'noun', 'In a manner that is done together', 'In academic writing, the word "Jointly" often appears when authors in a manner that is done together…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ab', 'noun', 'away', 'The student was absent from class yesterday.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('able/ible', 'noun', 'capable of', 'The glass is breakable, so handle it with care.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ad', 'noun', 'to; toward', 'The company adapted quickly to market changes.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('al', 'noun', 'having to do with', 'Seasonal fruits are freshest during their natural growing season.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('amb/ambi', 'noun', 'around; both', 'The ambient lighting created a calm atmosphere.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ante', 'noun', 'before', 'The anterior part of the car was damaged in the accident.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('human', 'noun', 'anthrop', 'She studied anthropology to learn about human cultures.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('anti', 'noun', 'against', 'Antibiotics are used to treat bacterial infections.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('aqua', 'noun', 'water', 'The aquarium houses various aquatic species.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('astr', 'noun', 'star', 'Astronomy is the scientific study of stars and planets.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('aud', 'noun', 'hear', 'The audio quality was clear during the lecture.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('auto', 'noun', 'self', 'In academic writing, the word "auto" often appears when authors self…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('good', 'noun', 'ben/bene', 'The scholarship was a great benefit to the student.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('bi', 'noun', 'two', 'In academic writing, the word "bi" often appears when authors two…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('bio', 'noun', 'life', 'Biology helps us understand the complexities of life.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('cent', 'noun', 'hundred', 'The ancient structure has stood for over a century.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('time', 'noun', 'chrono', 'The story was told in chronological order.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('circum', 'noun', 'around', 'The circumference of the circle was measured accurately.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('counter', 'noun', 'opposing', 'She tried to counteract the effects of the medicine.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('cred', 'noun', 'believe', 'The story was incredible, almost too good to be true.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('cycl', 'noun', 'circle', 'The cyclone caused widespread damage to the area.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('dec', 'noun', 'ten', 'The couple celebrated a decade of marriage.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('people', 'noun', 'dem/demo', 'Democracy allows people to have a voice in government.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('two', 'noun', 'dia/du', 'The dialogue between the two characters was engaging.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('dia', 'noun', 'across; through', 'The diameter of the circle was measured accurately.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('dic/dict', 'noun', 'speak; say', 'The manager dictated a letter to his assistant.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('dis', 'noun', 'not', 'He chose to disobey the rules and faced the consequences.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ence/ance', 'noun', 'state; condition', 'The performance was both moving and inspiring.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('equ', 'noun', 'equal', 'The teacher explained the concept of equality in the classroom.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ex', 'noun', 'former; past', 'In academic writing, the word "ex" often appears when authors former; past…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('fer', 'noun', 'carry', 'He decided to transfer schools to be closer to home.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('break', 'noun', 'frac/frag', 'The glass was fragile and shattered easily.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ful', 'noun', 'full of', 'She was thoughtful and always considered others'' feelings.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('gen', 'noun', 'born', 'The study of genes helps us understand inheritance.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('geo', 'noun', 'earth', 'Geology is the study of the Earth''s structure and history.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('grad', 'noun', 'step', 'Her progress was gradual but steady over time.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('graph', 'noun', 'write', 'She wrote a long paragraph explaining her ideas.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('water', 'noun', 'hydro/hydra', 'It is important to hydrate after intense exercise.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('hyper', 'noun', 'over; beyond', 'The child was hyperactive and full of energy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ian', 'noun', 'related to; like', 'The librarian helped me find the book I needed.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ic/tic', 'noun', 'having to do with', 'In academic writing, the word "ic/tic" often appears when authors having to do with…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ile', 'noun', 'related to', 'In academic writing, the word "ile" often appears when authors related to…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('in', 'noun', 'not', 'The sound was inaudible in the noisy room.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('inter', 'noun', 'between', 'The internet connects people across the globe.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('intra', 'noun', 'within', 'Intrastate commerce occurs within a single state.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ism', 'noun', 'condition; belief in', 'Tourism brings economic benefits to the region.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ist', 'noun', 'person who does', 'In academic writing, the word "ist" often appears when authors person who does…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ity', 'noun', 'state of being', 'Her creativity shone through her artwork.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ject', 'noun', 'throw', 'He was ejected from the game for breaking the rules.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('join', 'noun', 'junct', 'The junction connected two major highways.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('less', 'noun', 'without', 'The man was homeless after losing his job.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('log', 'noun', 'word', 'The prologue gave a preview of the story.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ly', 'noun', 'how; how often', 'She completed the task quickly and efficiently.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('magn', 'noun', 'large; great', 'The scientist used a lens to magnify the specimen.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('mal', 'noun', 'bad; evil', 'The patient suffered from a mysterious malady.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('man', 'noun', 'hand', 'She decided to get a manicure before the event.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('medi', 'noun', 'middle', 'The quality of the food was mediocre at best.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('mega', 'noun', 'large', 'The megaphone amplified her voice so everyone could hear.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('meter', 'noun', 'measure', 'The thermometer showed a sudden drop in temperature.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('micro', 'noun', 'small', 'The microscope revealed tiny details invisible to the naked eye.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('min', 'noun', 'small', 'The sculpture was a perfect miniature of the real building.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('mis', 'noun', 'wrong', 'The students were punished for misbehaving during class.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('send', 'noun', 'miss/mit', 'The message was transmitted via radio signals.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('one', 'noun', 'mon/mono', 'The actor delivered a powerful monologue during the play.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('mort', 'noun', 'death', 'The story of the immortal being was fascinating.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('many', 'noun', 'multi', 'The artist''s painting was beautifully multicolored.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('non', 'noun', 'not', 'He prefers to read nonfiction books about history.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('eight', 'noun', 'oct/octo', 'In academic writing, the word "eight" often appears when authors oct/octo…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ology', 'noun', 'study of', 'Psychology is the study of the human mind.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ortho', 'noun', 'straight', 'An orthodontist specializes in straightening teeth.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ous', 'noun', 'having', 'Her virtuous actions earned her great respect.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('pan', 'noun', 'all', 'The panoramic view from the mountain was breathtaking.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('para', 'noun', 'beside; related', 'The two lines were perfectly parallel to each other.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('path', 'noun', 'disease; feeling', 'The pathogen caused a widespread infection.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ped', 'noun', 'foot', 'The pedestrian waited for the signal to cross.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('fear', 'noun', 'phobia', 'Her claustrophobia made it hard for her to stay in small spaces.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('phon', 'noun', 'sound', 'He used a microphone to amplify his voice.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('photo', 'noun', 'light', 'Photography captures light to create an image.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('phys', 'noun', 'body; nature', 'The physician examined the patient thoroughly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('plex', 'noun', 'parts; units', 'The problem was too complex to solve easily.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('poly', 'noun', 'many', 'A polygon can have many sides and angles.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('port', 'noun', 'carry', 'The truck transported goods across the country.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('pos', 'noun', 'put; place', 'In academic writing, the word "pos" often appears when authors put; place…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('post', 'noun', 'after', 'The event was postponed due to bad weather.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('pre', 'noun', 'before', 'We watched the preview of the movie before its release.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('mind', 'noun', 'psych', 'Psychology is the study of the mind and behavior.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('quad', 'noun', 'four', 'The chart was divided into four quadrants.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('re', 'noun', 'again', 'The team worked hard to rebuild the damaged house.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('retro', 'noun', 'back; backwards', 'In retrospect, the decision was a mistake.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('rupt', 'noun', 'break', 'In academic writing, the word "rupt" often appears when authors break…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('write', 'noun', 'script/scrib', 'The doctor prescribed medication for the patient.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('super', 'noun', 'over; greater', 'She received a superior grade on her exam.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('syn/sym', 'noun', 'with; together', 'He felt sympathy for the family that lost their home.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('tech', 'noun', 'craft; skill', 'Her painting technique was very advanced.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('far', 'noun', 'tele', 'The telephone allowed them to communicate over long distances.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('terr/terra', 'noun', 'land; earth', 'The terrain was rough and difficult to cross.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('god', 'noun', 'the/theo', 'Theology is the study of religious beliefs.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('heat', 'noun', 'therm', 'The thermometer showed a drop in temperature.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('cut', 'noun', 'sect', 'We examined a section of the tissue under a microscope.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('semi', 'noun', 'half', 'The garden path was designed as a semicircle.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('to feel', 'noun', 'sens/sent', 'She felt sentimental when looking at old photos.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('soci', 'noun', 'people', 'In academic writing, the word "soci" often appears when authors people…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('sol', 'noun', 'alone', 'He enjoyed the solo performance by the musician.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('see', 'noun', 'spec', 'The inspector carefully examined the building.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('spir', 'noun', 'breathe', 'Her speech inspired the audience to take action.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('build', 'noun', 'struct', 'The construction of the new school began last month.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('sub', 'noun', 'under', 'The subway is the fastest way to travel in the city.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('tion', 'noun', 'action; state of being', 'In academic writing, the word "tion" often appears when authors action; state of being…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('tract', 'noun', 'drag; pull', 'The flowers attract many bees in the garden.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('trans', 'noun', 'across; through', 'The caterpillar transformed into a butterfly.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('tri', 'noun', 'three', 'The photographer used a tripod to steady the camera.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('un', 'noun', 'not', 'The child was unhappy with her broken toy.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('uni', 'noun', 'one', 'In academic writing, the word "uni" often appears when authors one…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('vac', 'noun', 'empty', 'The room was vacant and ready for new occupants.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('ven', 'noun', 'come', 'The new policy aims to prevent accidents.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('turn', 'noun', 'vert/vers', 'He reversed the car into the parking space.', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;

INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, deck_id)
VALUES ('zoo', 'noun', 'animal', 'In academic writing, the word "zoo" often appears when authors animal…', NULL, '{}'::text[], NULL, 'Medium', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (word) DO NOTHING;
