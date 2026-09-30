-- Merge the v1 per-subject classes into parents with Maths and Eng sub-classes.
-- "SAT 10" + "SAT 10 Math" -> parent "SAT 10". The kept row is the one without a
-- suffix, else the English row, else the Math row; it takes the base name.
-- Members land in the sub-class of their old class's subject; no suffix = both.
-- Idempotent. Every step is logged to _bs_merge_log (and RAISE NOTICE). For a dry
-- run, execute this file inside BEGIN ... ROLLBACK and read the final SELECT.

DROP TABLE IF EXISTS pg_temp._bs_merge_log;
CREATE TEMP TABLE _bs_merge_log (n serial, line text);

DO $$
DECLARE
  v_base text;
  v_keep record;
  v_drop record;
  v_mem record;
  v_keep_group uuid;
  v_drop_group uuid;
  v_subject public.class_subject;
  v_thread record;
  v_keep_thread uuid;
  v_count int;
BEGIN
  DROP TABLE IF EXISTS pg_temp._bs_merge;
  CREATE TEMP TABLE _bs_merge AS
  SELECT
    c.id,
    c.name,
    btrim(regexp_replace(c.name, '\s+(maths?|english|eng)\s*$', '', 'i')) AS base,
    CASE
      WHEN c.name ~* '\s(maths?)\s*$' THEN 'math'
      WHEN c.name ~* '\s(english|eng)\s*$' THEN 'ebrw'
    END::public.class_subject AS suffix
  FROM public.classes c;

  IF EXISTS (
    SELECT 1 FROM _bs_merge GROUP BY base, suffix HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Two classes map to the same parent and subject. Rename one first.';
  END IF;

  FOR v_base IN SELECT DISTINCT base FROM _bs_merge ORDER BY base LOOP
    SELECT * INTO v_keep FROM _bs_merge
    WHERE base = v_base
    ORDER BY (suffix IS NULL) DESC, (suffix = 'ebrw') DESC, name
    LIMIT 1;

    INSERT INTO _bs_merge_log (line)
    VALUES (format('Parent "%s": keep "%s" (%s)', v_base, v_keep.name, v_keep.id));

    DELETE FROM public.class_memberships m
    WHERE m.class_id IN (SELECT id FROM _bs_merge WHERE base = v_base) AND m.status = 'left';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      INSERT INTO _bs_merge_log (line) VALUES (format('  removed %s member(s) marked left', v_count));
    END IF;

    -- Members of the kept row that predate sub-classes.
    FOR v_mem IN
      SELECT m.* FROM public.class_memberships m
      WHERE m.class_id = v_keep.id
        AND NOT EXISTS (
          SELECT 1 FROM public.class_group_memberships g
          WHERE g.class_id = m.class_id AND g.user_id = m.user_id
        )
    LOOP
      FOR v_keep_group IN
        SELECT g.id FROM public.class_groups g
        WHERE g.class_id = v_keep.id AND (v_keep.suffix IS NULL OR g.subject = v_keep.suffix)
      LOOP
        PERFORM public._bs_upsert_group_member(
          v_keep_group, v_mem.user_id, v_mem.status, v_mem.enrolled_on, v_mem.enrolled_on
        );
      END LOOP;
    END LOOP;
    SELECT count(*) INTO v_count FROM public.class_group_memberships WHERE class_id = v_keep.id;
    INSERT INTO _bs_merge_log (line)
    VALUES (format('  %s sub-class membership(s) in "%s"', v_count, v_keep.name));

    FOR v_drop IN
      SELECT * FROM _bs_merge WHERE base = v_base AND id <> v_keep.id ORDER BY name
    LOOP
      INSERT INTO _bs_merge_log (line)
      VALUES (format('  merge "%s" (%s) into it, then delete it', v_drop.name, v_drop.id));

      IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE class_id = v_drop.id
                   OR group_id IN (SELECT id FROM public.class_groups WHERE class_id = v_drop.id))
         OR EXISTS (SELECT 1 FROM public.class_group_fees f JOIN public.class_groups g ON g.id = f.group_id
                    WHERE g.class_id = v_drop.id)
         OR EXISTS (SELECT 1 FROM public.student_level_scores s JOIN public.class_groups g ON g.id = s.group_id
                    WHERE g.class_id = v_drop.id) THEN
        RAISE EXCEPTION '"%" has money or level history. Merge it by hand.', v_drop.name;
      END IF;

      FOR v_subject IN SELECT unnest(ARRAY['math', 'ebrw']::public.class_subject[]) LOOP
        SELECT id INTO v_keep_group FROM public.class_groups WHERE class_id = v_keep.id AND subject = v_subject;
        SELECT id INTO v_drop_group FROM public.class_groups WHERE class_id = v_drop.id AND subject = v_subject;

        -- The dropped row's own subject carries that sub-class's schedule and teacher.
        IF v_drop.suffix = v_subject THEN
          UPDATE public.class_groups k
          SET schedule_days = COALESCE(d.schedule_days, k.schedule_days),
              start_time = COALESCE(d.start_time, k.start_time),
              end_time = COALESCE(d.end_time, k.end_time),
              teacher_id = COALESCE(d.teacher_id, k.teacher_id),
              room = COALESCE(d.room, k.room),
              level = COALESCE(d.level, k.level)
          FROM public.class_groups d
          WHERE k.id = v_keep_group AND d.id = v_drop_group;
        END IF;

        UPDATE public.class_lessons SET group_id = v_keep_group WHERE group_id = v_drop_group;
        UPDATE public.lesson_attendance SET group_id = v_keep_group WHERE group_id = v_drop_group;
        UPDATE public.homework_assignments SET group_id = v_keep_group WHERE group_id = v_drop_group;
        UPDATE public.lesson_hw_marks SET group_id = v_keep_group WHERE group_id = v_drop_group;
        UPDATE public.lesson_results SET group_id = v_keep_group WHERE group_id = v_drop_group;
      END LOOP;

      UPDATE public.vocab_homework_assignments SET class_id = v_keep.id WHERE class_id = v_drop.id;
      UPDATE public.user_notifications SET class_id = v_keep.id WHERE class_id = v_drop.id;

      PERFORM public.ensure_class_threads(v_keep.id);
      FOR v_thread IN
        SELECT * FROM public.chat_threads WHERE class_id = v_drop.id AND kind <> 'direct'
      LOOP
        SELECT id INTO v_keep_thread FROM public.chat_threads
        WHERE class_id = v_keep.id AND kind = v_thread.kind
          AND subject IS NOT DISTINCT FROM v_thread.subject
        LIMIT 1;
        UPDATE public.chat_messages SET thread_id = v_keep_thread WHERE thread_id = v_thread.id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
          INSERT INTO _bs_merge_log (line)
          VALUES (format('    moved %s chat message(s) from "%s"', v_count, v_thread.title));
        END IF;
      END LOOP;

      FOR v_mem IN SELECT m.* FROM public.class_memberships m WHERE m.class_id = v_drop.id LOOP
        DELETE FROM public.class_memberships WHERE class_id = v_drop.id AND user_id = v_mem.user_id;
        FOR v_keep_group IN
          SELECT g.id FROM public.class_groups g
          WHERE g.class_id = v_keep.id AND (v_drop.suffix IS NULL OR g.subject = v_drop.suffix)
        LOOP
          PERFORM public._bs_upsert_group_member(
            v_keep_group, v_mem.user_id, v_mem.status, v_mem.enrolled_on, v_mem.enrolled_on
          );
        END LOOP;
        INSERT INTO _bs_merge_log (line)
        VALUES (format('    moved member %s', v_mem.user_id));
      END LOOP;

      DELETE FROM public.classes WHERE id = v_drop.id;
    END LOOP;

    IF v_keep.name <> v_base THEN
      UPDATE public.classes SET name = v_base WHERE id = v_keep.id;
      INSERT INTO _bs_merge_log (line) VALUES (format('  renamed "%s" to "%s"', v_keep.name, v_base));
    END IF;

    INSERT INTO _bs_merge_log (line)
    SELECT format('  -> %s: %s member(s)', g.name,
                  (SELECT count(*) FROM public.class_group_memberships m WHERE m.group_id = g.id))
    FROM public.class_groups g WHERE g.class_id = v_keep.id ORDER BY g.subject;
  END LOOP;

  -- Subject chats are for that sub-class only.
  DELETE FROM public.chat_thread_members tm
  USING public.chat_threads t
  WHERE tm.thread_id = t.id
    AND t.kind = 'subject_group'
    AND EXISTS (
      SELECT 1 FROM public.class_memberships m WHERE m.class_id = t.class_id AND m.user_id = tm.user_id
    )
    AND NOT public._bs_in_class_subject(t.class_id, t.subject, tm.user_id)
    AND NOT public._bs_user_is_staff(tm.user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO _bs_merge_log (line)
  VALUES (format('Removed %s subject-chat membership(s) outside the sub-class', v_count));

  DROP TABLE pg_temp._bs_merge;
END $$;

SELECT n, line FROM _bs_merge_log ORDER BY n;
