# Classes

Staff open `/admin/classes`. Each class workspace has Attendance, VAR, Ranking, Homework, and Chat. VAR is three completion flags per student and lesson (Vocabulary, Assignment, Article). It does not change rank.

Rank is RW + Math, each section clamped to 200–800. Tiers are S 1500+, A 1400+, B 1300+, C 1200+, and D below 1200.

Payments live at `/admin/payments` and are admin-only. Editors are redirected by the admin layout, and ledger tables reject non-admin reads. Balance is the sum of live payments and discounts minus charges and refunds. A month is charged only when the student was active on at least one day of that month. Voiding a row keeps it in the ledger.

Students see their own score, rank, homework feedback, and VAR on `/classes`. They do not see classmates or money.
