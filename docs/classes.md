# Classes

A class is a parent (`classes`) with exactly two sub-classes (`class_groups`): Maths, whose homework scheme is AFL, and Eng, whose scheme is VAR. Creating a parent creates both sub-classes. A sub-class cannot be deleted on its own; deleting the parent cascades.

## Membership

A student joins one or both sub-classes of a single parent. The parent row in `class_memberships` is derived by trigger from the live sub-class rows, so the student `/classes` page and class chat keep working. Status is `active`, `trial`, `frozen` or removed. `activated_on` is the billing start and is admin-only.

## Routes

| URL | Who | What |
|---|---|---|
| `/admin/classes` | staff | Parent cards, each with its two sub-classes |
| `/admin/classes/$classId` | staff | Roster and Ranking for the parent, edit dialog |
| `/admin/classes/$classId/$subject` | staff | Sub-class workspace: Attendance, VAR or AFL, Level, Results, Homework, Chat |
| `/admin/classes/$classId/students/$userId` | staff, money admin-only | Student profile |
| `/admin/payments` | admin | Balances, transactions, charges, payments |

`$subject` is `math` or `eng`. Tab, month, lesson, filter and the Level section toggle live in the URL.

## Homework marks

Eng uses VAR: Vocabulary, Assignment, Article. Maths uses AFL: Assignment and Formulas, plus Level, which is not a per-lesson tick. Marks live in `lesson_hw_marks`; a trigger rejects items that don't belong to the sub-class's scheme. Accepted homework and completed vocab homework auto-tick and never overwrite a manual tick. "Tick all complete" marks the listed students present and ticks every item of the scheme. "Untick all" clears the items and leaves attendance alone.

## Level

Each subject has seeded sections in `level_sections` (16 Maths, 11 Eng). Scores are 400–1000, append-only in `student_level_scores`: a correction is a void with a reason plus a new entry. The overall is the weighted mean of the sections that have a score, rounded half-up; blank sections are left out. With the default weight of 1 that is the plain mean. No sections scored shows "—". Level does not feed Ranking or Results.

## Results and Ranking

Results are M1 and M2 correct answers per lesson, each 0–27. The score is M1 + M2 and shows "N.A." below 30. Ranking is RW + Math, each 200–800, with tiers S 1500+, A 1400+, B 1300+, C 1200+ and D below 1200. An empty score shows "—".

## Payments

Admin only. Editors are redirected and the money tables return no rows for them. The fee is per sub-class (`class_group_fees`), with an optional per-student override (`student_fee_overrides`): override, else group fee, else the group is unpriced and never charged. A change never rewrites past charges.

The balance is per student: payments + discounts − charges − refunds, over non-voided rows. Payments are not split across sub-classes. The join month is prorated by the lessons on or after `activated_on` out of the month's lessons, rounded half-up to the nearest 1 000 UZS. No lessons that month charges the full fee; none remaining charges nothing. Every later month is full price. A month is charged only when the student was `active` in that sub-class on at least one day, and never before the activation month. Moving the activation date voids the affected auto charges and re-applies them; manual rows stay.

Amounts are integers. The payment cap is `billing_max_payment_uzs` (default 100 000 000) and the ledger rejects anything outside 1 to 1 000 000 000. 10 000 000 or more, or more than three times the debt, asks for a second confirmation. Ledger rows are append-only; voiding keeps the row and needs a reason.

## Students

On `/classes` a student sees their own rank, homework ticks, Level and latest Result per sub-class, read-only. They do not see classmates or money.
