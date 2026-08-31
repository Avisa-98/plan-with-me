# Plan With Me — Build Week Scope

## Scope lock

**One-sentence product:** Plan With Me is a phone-first life manager that captures scattered thoughts, organizes them into a draft week, and shows category and time trade-offs without requiring sign-up.

**Primary track:** TBD. V1 uses no paid AI service; choose the Build Week scoring track separately before submission.

### What is stated, inferred, and unverified

- **Stated by the founder:** planning is fragmented across a physical bullet journal, Obsidian, Sheets, calendars, notes, and paper; overlapping work, learning, family, and social commitments cause mental fog and burnout risk; a phone-first workflow with morning and evening reflection is desired.
- **Stated by the founder:** a WhatsApp Business number cannot be obtained within the workshop timeframe.
- **Inference:** a no-login web app is the quickest replacement because it needs only a link and avoids WhatsApp setup.
- **Unverified:** people will open a new link, use anonymous same-device storage, and return for reflection without an account.

## Riskiest-assumption test — do this before any build

**Assumption:** People will find a link that captures and sorts a thought faster than their existing notes or task lists, even without an account.

**30-minute no-code test:** Direct-message these three people before writing code: the lawyer, Founder A (similar workload), and Founder B (similar workload).

> I am testing a one-link planner with no sign-up. Send me everything you are trying to remember or get done this week in one messy message. I will turn it into a short plan, then tell me whether you would open a link to do that yourself instead of using your usual notes.

Manually return each reply as **Today / This Week / Later**. Record: invite sent, reply received, whether they used the returned plan, and their exact feedback.

**Pass signal:** at least one person sends a real, messy list and says the returned structure was useful enough to try again. This is evidence, not proof.

**If it fails:** do not add features. Ask the person what stopped them—trust, effort, unclear value, or preference for their existing tool—then narrow the wording and repeat with the next invite.

## The v1 core flow

1. A user opens a phone-friendly link; no account or password is requested.
2. They write one messy thought, task, or commitment; it lands in an **Unprocessed** inbox.
3. During a calm review, the app guides them to add a rough time estimate, a simple category, and **Today**, **This Week**, or **Later**.
4. The weekly view shows the total estimated time currently committed for the week, with the items behind that total.
5. At day end, they mark an item done or move it forward and complete a short reflection.
6. At week end, they complete a short review of what changed, what should carry forward, and what should be deferred.

### v1 includes

- A phone-friendly link with no sign-up or password.
- A guided text capture screen.
- An **Unprocessed** inbox.
- A calm, guided organization step with a user-supplied rough time estimate.
- Simple categories: work, family, friends, health, and entertainment.
- Today / This Week / Later buckets.
- A weekly view that totals the user-entered estimated time for This Week and supports the draft schedule.
- A draft weekly schedule arranged from Atul’s inputs, targets, fixed events, durations, and priorities.
- A conflict view that shows what does not fit and previews the category split after Atul chooses a trade-off.
- A basic duplicate warning for obviously matching items.
- A short end-of-day reflection with done and carry-forward actions.
- A short end-of-week reflection with carry-forward and defer actions.
- Anonymous same-device storage for the pilot.
- A deployed Vercel link and a public GitHub repository.

## Feature buckets

### Must have

- Fast text capture.
- An Unprocessed inbox.
- A simple, non-daunting organization flow.
- Rough time estimate, simple category, and Today / This Week / Later choice.
- A clear This Week total of user-estimated time.
- A draft weekly schedule and conflict preview that Atul must approve or edit.
- Basic warning for an obviously duplicated item.
- A clear delete-my-data action.
- End-of-day reflection and done/carry-forward actions.
- End-of-week reflection and carry-forward/defer actions.

### Nice to have — only after must-haves work

- Category scatterplot: one colored dot per task, with denser clusters showing more tasks in a category.
- Light gamification.

### Not this week

- Daily time-stamped log beyond the short end-of-day reflection.
- Monthly reviews, goals, and progress tracking.
- Silent capacity decisions, automatic time prediction, or calendar commitments without Atul’s approval.
- WhatsApp, voice-note capture, source imports, email reading, and handwriting OCR.
- Accounts, cross-device sync, and collaboration.
- Relationship management and social-life planning.
- Full life-balance dashboard beyond the optional scatterplot.
- Every other future feature in [Life_Management_Platform_Scope.md](Life_Management_Platform_Scope.md).

### Where pilot data is stored

- On first open, the browser creates a random anonymous device key and keeps it on that device.
- A user’s captured items, rough time estimates, categories, buckets, and reflections are stored in the browser under that anonymous key for v1.
- Each reflection stores its type (daily or weekly), its text, and the time it was submitted.
- When the same person reopens the link in the same browser, the key retrieves their plan without a sign-up or password.
- The pilot does not collect a name, email address, phone number, or contact list unless a later test makes that necessary.
- Switching devices, changing browsers, or clearing browser data can lose access in v1. This is a deliberate trade-off for no-login testing.
- Add a clear delete-my-data action and do not invite people to enter highly sensitive personal or financial details during the pilot.

### v1 explicitly excludes

- Calendar, Obsidian, Sheets, or notes import.
- Automatic time prediction, schedule creation, or dependable free-form AI decisions.
- User accounts, passwords, cross-device sync, and account recovery.
- WhatsApp integration or voice-note capture.
- A visual life-balance scatterplot or category dashboard.
- Automatic capacity decisions, calendar scheduling, and source imports.
- Reminders and notifications.
- Gamification, streaks, badges, or points.
- Detailed relationship management, lunches, dinners, or follow-ups.
- Multi-user plans, sharing, or collaboration.
- Polished design beyond a clear phone-friendly flow.

Every excluded feature with future value belongs in [Life_Management_Platform_Scope.md](Life_Management_Platform_Scope.md).

## Fixed Build Week milestones

### 1. Saturday, 29 August — choose and test the problem

**Tasks**

- Run the 30-minute no-code test before building.
- Record responses and exact words from the three invitees.
- Keep this document as the scope boundary.

**Acceptance test:** Three people have received the message; at least one real response has been handled manually; the response is recorded.

**If I am behind, cut to this:** Send the message to all three and manually organize the first response. Do not begin visual design or extra feature work.

### 2. Sunday, 30 August — deploy one ugly, complete flow

**Tasks**

- Build only the five-step core flow above.
- Hard-code any labels, prompts, and example states needed to complete the flow.
- Push the code to a public GitHub repository.
- Deploy it to Vercel and test the live link on a phone without signing in.

**Acceptance test:** A new person can open the live link, capture one item into Unprocessed, organize it with a rough time estimate and category, place it in a bucket, see its contribution to the This Week time total, view a draft week, see a conflict when inputs do not fit, preview a resulting category split, complete a short end-of-day reflection, and complete a short end-of-week review without creating an account or needing an explanation.

**If I am behind, cut to this:** One text box, one Unprocessed list, one rough-duration choice, three bucket buttons, a visible This Week total, and one short reflection text box reused for daily and weekly reviews. Keep entries only on the device; remove categories, duplicate warnings, visual polish, and optional states.

### 3. Monday, 31 August — observe three users

**Tasks**

- Schedule these three sessions: 7:15 PM Founder A, 8:15 PM lawyer, and 9:15 PM Founder B (or move each only with their confirmation).
- Send each the live link before the session.
- Watch quietly as they attempt: capture → estimate → sort → prioritize → close the day.
- Write down the exact step where each person stops, hesitates, or asks for help.

**Acceptance test:** Three sessions are completed or have a clearly recorded reschedule; each has a note on the first blocker.

**If I am behind, cut to this:** Ask each tester to send a screen recording or voice note while using the link. Capture only the first blocker per person.

### 4. Tuesday, 1 September — invite people where they gather

**Tasks**

- At 7:15 PM, post a short direct invite in one friend group chat.
- At 8:00 PM, personally message the people most likely to have the problem.
- At 9:00 PM, log every reply, click, signup, and completed core flow in one simple tracking sheet.
- Only share in GrowthX or a builder Discord after the first message is clear and the live product works.

**Acceptance test:** One group invite and at least three direct invites are sent; the tracking sheet exists and has entries.

**If I am behind, cut to this:** Send three personal messages and record replies manually. Do not prepare a broad public launch post.

### 5. Wednesday, 2 September to Friday, 4 September — fix one blocker and repeat

**Tasks each evening**

- Speak to at least one user or follow up with a tester.
- Identify the single blocker that appears most often.
- Change only what removes that blocker.
- Redeploy, then invite or follow up with the next person.
- Add every tempting extra feature to the future-platform parking lot instead of building it.

**Acceptance test:** At least one user-reported blocker is fixed and tested by another user; the live link remains working.

**If I am behind, cut to this:** Fix the first screen or step that prevents a person from completing capture → sort → view. Do not add any new module.

### 6. Saturday, 5 September — verify and submit by 11:00 AM IST

**Tasks**

- Re-run the full core flow on the live Vercel link.
- Confirm the GitHub repository is public and opens correctly.
- Verify the live product works on a phone without a login.
- Take screenshots of the live product and the tracked numbers.
- Write the final numbers without inflating them.
- Submit the live product, public repository, and numbers by **11:00 AM IST**.
- Keep 3:00 PM IST free for the demo.

**Acceptance test:** The submission contains a live working link, a public repository link, screenshots or recorded evidence of numbers, and only verified metrics.

**If I am behind, cut to this:** Submit the working Sunday version with honest numbers and a clear explanation of what users did. Do not hold submission for another feature.

## Metrics ledger

Track only observed numbers:

- Direct invites sent
- Group posts sent
- Replies received
- Live-link opens, if available
- People who complete a first capture
- Rough-time estimates added
- Priority selections made
- End-of-day reflections completed
- People who return on another day
- User quotes about value or friction
- The most common stopping point

## Parking lot — do not build during Build Week

Move ideas here as they arise. Detailed direction lives in [Life_Management_Platform_Scope.md](Life_Management_Platform_Scope.md).

- AI that interprets free-form messages and makes planning decisions
- Automatic weekly capacity and trade-off planning
- Morning planning ritual
- Calendar, Obsidian, Sheets, and notes consolidation
- Relationship, lunch, dinner, family, and social-life management
- Gamification and motivation systems
- Reminders, notifications, and recurring routines
- Multi-device syncing and integrations

## Next single action

Send the no-code test message to the lawyer, Founder A, and Founder B, then manually turn the first reply into **Today / This Week / Later** before building anything.

## Clarified product scope — 31 August

### 1. USER — specific person

Atul, 28, owns and operates a business. He is managing work, social plans, marriage and family, health and fitness, learning the piano, workshops and programs, real-estate investing, reading, news, travel, and other projects at the same time.

### 2. PROBLEM — what is broken in his day

During unpredictable interruptions in office hours and deep work, an important thought or commitment arrives. Atul captures it wherever is closest—WhatsApp to himself, Obsidian, a notebook, or a sticky note—and then loses the single picture of what his life requires. Context switching breaks focus; new commitments collide with existing ones; faulty time estimates can overload the week; duplicate capture can inflate the apparent workload.

He needs to record and return to the current task, then decide during a daily or weekly reflection whether a new item fits, replaces something, is pushed later, or is cancelled. The product is a life manager across Work, Family, Friends, Health, and Entertainment—not only a task list.

### 3. WHAT V1 DOES — full user flow, step by step

1. Atul opens the phone-friendly web app. No account is required. If category targets are missing, the weekly screen explains why targets improve the plan and offers setup; he may skip it.
2. The combined home screen shows the Unprocessed inbox and a clear **Add new thought** button.
3. Atul types a concise thought, task, event, or project and taps **Add**. The original user-written note is saved immediately into Unprocessed.
4. If he submits an identical note twice, the app warns him before saving the second copy. He may keep it or cancel.
5. At any time, Atul opens Unprocessed and selects one item to organize. Missing information does not block capture; blank fields remain blank.
6. The organize view lets him edit the note, choose one of Work, Family, Friends, Health, or Entertainment, add an optional separate due date, choose an optional start and end time for an event, and enter estimated duration and effort.
7. Atul can identify a project, give it a total estimate, and attach subtasks under it. General tasks and events can exist without a project.
8. The item moves into the planning pipeline only when Atul chooses to commit it. Until then it remains Unprocessed.
9. Atul can set weekly category targets during setup or later from the weekly planning screen. Targets may be changed; skipping setup is allowed but the reminder remains on that screen.
10. The weekly planner arranges entered items into a **draft** week using Atul’s dates, durations, fixed event times, category targets, and priorities. It does not silently commit the schedule.
11. If the draft does not fit, the app shows the conflict and lets Atul choose what to drop, replace, defer, or reprioritize. Before accepting, it previews the resulting time split across the five categories.
12. At the end of each day, the reflection shows unresolved items and lets Atul decide priorities, push items, cancel items, or replace existing items. It also asks fixed prompts for Done, Carry forward, and Drop or replace, plus one optional free-text reflection.
13. At the end of each week, the review asks What went well?, What stayed unfinished?, What should change next week?, and What are next week’s priorities?
14. When Atul marks an item done, he may enter actual time in hours and minutes beside the original estimate. This history is stored for later personal forecasting; v1 does not claim to learn accurate predictions yet.
15. **Note Archive** keeps the original captured version out of the normal interface so the cleaned or edited version does not create clutter. V1 does not use a paid AI cleanup service; it reminds Atul to write concisely.
16. A manual **Summarize unresolved** action may be added only if it can work without paid AI; otherwise the unresolved list remains the review surface. It never runs automatically.

### 4. WHAT V1 DOES NOT DO — everything parked

- Paid AI or LLM cleanup, rewriting, categorization, transcription, or decision-making.
- Automatic category suggestions; Atul chooses the category.
- WhatsApp, email, calendar, Obsidian, Sheets, or other source connections.
- Voice notes, photos, handwriting OCR, and blurry-photo handling.
- A full visual dashboard or scatterplot; those remain future work.
- Gamification, streaks, badges, and points.
- Silent scheduling decisions or calendar bookings. V1 produces a draft and requires Atul’s approval.
- “Average human” time estimates. V1 records Atul’s estimates and actual time.
- Automatic merging of similar-but-different tasks. V1 only warns on an identical note.
- Cross-device sync, user accounts, password recovery, sharing, or collaboration.
- Detailed relationship management, social CRM, or family coordination.
- Automatic reminders or notifications outside the in-app daily and weekly reflection surfaces.
- Monthly goals, goal progress, richer analytics, and the complete life-balance platform.

All parked ideas and their evidence tests belong in [Life_Management_Platform_Scope.md](Life_Management_Platform_Scope.md).

### 5. RISKIEST ASSUMPTION — what could make this pointless

Atul may still capture thoughts in whichever tool is closest and never return to this app’s Unprocessed inbox and reflections. If that happens, the app becomes another abandoned repository rather than a life manager.

The first test is therefore not whether the schedule looks attractive. It is whether Atul can capture an interruption in seconds, return to it later, and complete one guided organization or reflection without being forced to decide immediately.
