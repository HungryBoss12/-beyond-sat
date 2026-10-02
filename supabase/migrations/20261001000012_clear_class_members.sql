-- Remove every student from every class. Accounts and the classes themselves stay.
-- Parent memberships and subject-chat memberships follow via the existing trigger.

DELETE FROM public.class_group_memberships;
