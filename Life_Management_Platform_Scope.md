# Life Management Platform — Future Scope

This is the post-Build-Week product direction. It is deliberately not the Build Week build list.

## Product vision

A private life-management platform that helps a person capture commitments from a busy life, see what can realistically fit, and maintain daily reflection across work, learning, family, and social life. The Build Week version is a no-login web app; messaging channels can follow when the core habit is proven.

## Relationship to the Build Week product

**Build Week core:** Plan With Me, a no-login web capture module.

**Build Week rule:** no feature from this document is built unless it is necessary for the narrow capture → sort → view → reflect flow. Good ideas are parked here and revisited after Build Week.

## Product modules

### Module 1 — Plan With Me: capture and sort

Turn scattered thoughts, tasks, commitments, and ideas into an organized plan.

Possible future additions:

- Conversation-style capture.
- An unprocessed inbox that separates quick capture from later decisions.
- User-supplied duration and effort estimates, with a later comparison against actual completion where useful.
- Optional WhatsApp text and voice-note capture, subject to deliberate feasibility and privacy checks.
- AI-assisted interpretation of free-form messages, only after users show they prefer it.
- Voice capture and transcription.
- Import or transfer paths from existing notes, calendars, Sheets, Obsidian, email, WhatsApp, and paper workflows.
- Handwritten-note photo upload and optical character recognition (OCR), which means reading text from an image.
- A secure personal archive and search.
- Duplicate detection that warns before repeated entries inflate the plan.
- Clear user controls to view, delete, or export personal data.
- A richer web dashboard and account experience, after the no-login capture habit has proven repeat use.

### V2 — low-cost AI parsing layer

Add AI only after v1 proves that people return to the Unprocessed inbox. Keep it narrow and user-controlled:

- Run one explicit, batched parse call when Atul asks to process a brain dump.
- Split a dump into concise items while preserving dates, deadlines, quantities, dependencies, and important context.
- Show the parsed result for review; never silently overwrite a user’s note.
- Do not let AI choose categories, priorities, trade-offs, or schedule changes.
- Cache each processed dump so identical content is not charged twice.
- Use normal application logic for weekly totals, conflict checks, category summaries, and schedules.
- Keep a non-AI path for individual notes and when the service is unavailable.

### Module 2 — Commitments Map: weekly capacity and trade-offs

Make visible what fits in a week and what should wait.

Possible future additions:

- Available-time and energy planning using the user's own estimates; automatic predictions remain a later, unproven option.
- Work, learning, family, health, and social commitments in one view.
- Explicit defer, pause, or drop decisions.
- Advanced weekly planning ritual with capacity trade-offs.
- Monthly review and planning ritual.
- Available time reserved for non-work commitments such as strength training, sport, friends, family, rest, and travel.
- Calendar connections only when they reduce work rather than create setup burden.

### Module 3 — Daily Compass: morning and evening ritual

Preserve the useful bullet-journal habit without physical notebooks.

Possible future additions:

- Morning intention and top priorities.
- Richer end-of-day review and reflection history.
- Monthly reflection.
- A clear history of decisions, not just an endless task list.
- Time-stamped daily log entries.

### Module 4 — Personal relationships and social life

Privately manage people and social commitments as part of a balanced life.

Possible future additions:

- Friends, family, and professional relationships.
- Planned lunches, dinners, calls, and follow-ups.
- Gentle prompts based on the person’s own choices, not automated pressure.
- Visibility into whether work crowds out relationships and family time.

### Module 5 — Motivation and sustainable pace

Support consistency without turning life into a game that creates more pressure.

Possible future additions:

- Optional streaks, progress views, or small rewards.
- A workload and burnout-risk review based on user-entered commitments.
- Positive reinforcement for deferring work and protecting rest.

### Module 6 — Life balance dashboard

Show how a person is currently allocating their time and attention, so they can notice imbalance and deliberately reprioritize.

Possible future additions:

- Separate buckets for family, friends, work, personal development, finance, recreation, and health/fitness.
- A clear chart or summary of planned and completed commitments by bucket over a chosen period.
- A weekly scatterplot where each task is a category-colored dot and denser clusters reveal where time is concentrated.
- Visibility into buckets receiving too much attention or being neglected.
- A deliberate reprioritization step that changes the next week's plan rather than only displaying a chart.
- User-controlled categories and privacy settings, because life areas can overlap and the data is personal.

### Module 7 — Goals and progress

Connect daily and weekly choices to a small number of longer-term goals.

Possible future additions:

- Weekly and monthly goals.
- Progress tracking toward a goal, based on user-confirmed work rather than assumed progress.
- A weekly summary of the completed week, the coming week, and progress toward monthly goals.

## Future plans / parking lot

Add every cut Build Week feature here with its reason and user evidence.

| Idea | Why it is deferred | What evidence would justify revisiting it? |
|---|---|---|
| WhatsApp automation and reliable voice processing | A business number is unavailable during Build Week; reliability, privacy, and voice handling need deliberate decisions. | Users repeatedly say the link is the blocker and ask to capture through WhatsApp. |
| User accounts and cross-device sync | No-login use is the lower-friction experiment. | Users return and ask to use the same plan across devices or after clearing their browser. |
| Automatic source aggregation | Email, messages, calendars, and notes contain sensitive data and need separate connection and consent work. | Users show that manual capture is the main reason they do not return. |
| Handwriting OCR | Photographing and reading a bullet-journal page adds image handling and uncertain text quality. | Users repeatedly choose paper because it is faster than the web capture flow. |
| Automatic duplicate detection | Similar tasks can be different; incorrect merging could hide important work. | Users report repeated duplicate entries after using the basic capture flow. |
| Time-learning model | Early estimates are too sparse to make trustworthy predictions. | Users consistently record estimates and completion outcomes over several reviews. |
| Goal and progress system | Goals only help once daily capture and reviews are habitual. | Users return weekly and ask how daily choices connect to a larger objective. |
| AI planning agent | Trust and planning quality are unproven; it can make bad trade-offs. | Users provide enough real inputs and ask for help organizing them after manual sorting works. |
| Weekly capacity map | It is a second module after capture works. | Users capture commitments but still cannot decide what fits. |
| Morning ritual | The end-of-day and capture loop must show repeat use first. | Users return and ask for a way to choose priorities before the day begins. |
| Calendar / Obsidian / Sheets import | Each connection adds setup and maintenance. | Users identify repeated duplicate entry as the reason they stop. |
| Social and relationship management | Important, but a separate sensitive domain with more design questions. | Users naturally enter social commitments and ask for people-based follow-up. |
| Gamification | Could motivate or create pressure. | Users complete the basic ritual but say motivation, rather than clarity, is the blocker. |
| Life balance dashboard | It needs enough consistently categorized planning data; a chart without reliable inputs could mislead. | Users capture and review commitments over time, then ask where their attention is going or what they are neglecting. |
| Notifications | Easy to misuse and may add noise. | Users explicitly request timely prompts after choosing a sustainable rhythm. |
| Sharing or collaboration | Private personal planning comes first. | Users ask to coordinate commitments with a partner, family, or team. |

## Principles to preserve

- One calm place, not another source of obligations.
- Phone-first and quick enough to use during a busy day.
- Retain the reflective rhythm of a bullet journal.
- Make trade-offs visible; do not pretend every commitment can fit.
- Treat work, learning, family, rest, and relationships as parts of the same life.
- Keep personal information private and explain clearly what is stored and why.
- Start with anonymous, minimal data collection; add identity and cross-device access only when users need it and the privacy design is ready.
- Build from observed user behavior, not feature accumulation.

## Post-Build-Week decision gate

Before expanding beyond capture, review:

1. Did strangers or non-polite testers use the core flow without help?
2. Did any person return for another planning or reflection session?
3. What exact step caused the most drop-off?
4. Which future feature was requested repeatedly, in users’ own words?
5. Does the next module reduce a proven blocker, or only sound impressive?

Only the next module that answers a proven blocker should be scoped.
