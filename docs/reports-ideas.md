# Useful makerspace reports

Most items below remain proposals. Active members by month now supports bars or a line chart with a data table. Busiest Times is implemented with weekday/hour and month/day heatmaps, exact counts, and remembered view choices. Prioritize decisions staff can act on, reliable source data, and clear date definitions. No equipment reports or automatic email features.

Check-in report dates, monthly visit totals, unique visitor counts and busiest-time cells use America/New_York calendar dates. Payment and billing dates retain their existing billing-calendar rules. Activity excludes denied and future events; repeated successful entries count as separate check-ins, not occupancy. Month/day cells outside the selected period or nonexistent calendar dates are marked unavailable rather than zero.

## Dashboard layout

Keep the date selector and 1 month / 3 months / 6 months / 1 year / 2 years presets at the top. A new Reports view defaults to the current month plus the previous two, starting on the first and ending today. Returning to a previously viewed report preserves its chosen dates.

Use two clearly labeled groups: **During this period** and **Current membership**. Payments and visits are period totals; current eligibility and waiver compliance are snapshots. Changing the date range must not imply that a current count is historical.

Use a compact row of summary numbers, followed by two-column charts, then a short actionable list. Keep charts a consistent height rather than one increasingly long row for every month. Every chart should have a readable data table and CSV equivalent. Clicking a chart segment should open the corresponding filtered list, with back navigation retaining the report range.

## Recommended reports

| Question | Data | Display | Readiness |
| --- | --- | --- | --- |
| Is membership growing? | Eligible members at each month-end | Line chart with month labels, point values and current count | Available as an estimate; historical manual holds and policy changes are not known |
| What money was actually received? | Recorded positive payments and negative refunds/reversals by period | Vertical monthly bars; separate received/refunded amounts, with a net total | Available from imported records; not profit or earned revenue; unmatched payments should be visible |
| Are members using the space? | Successful entry events and unique members checking in | Aligned charts for total entries and unique visitors; monthly/weekly choice | Available; entries are not occupancy or visit duration |
| When is the space busiest? | Successful entry timestamps in the makerspace's timezone | Day-of-week × hour heatmap, with counts on hover and a table alternative | Available; label it entry activity, not concurrent occupancy |
| Which plans do members use? | Current members grouped by their current plan | Sorted horizontal bars with counts | Useful after overlapping plans are reviewed; count people once or explicitly count memberships |
| Who might need staff follow-up? | Eligible members with no successful key use in 30/60/90 days; members near the grace limit | Small counts opening filtered member lists | Available; no entry log does not prove absence; staff contacts members manually |
| Are active members covered by waivers? | Current required waiver versions and signatures | Signed/missing progress bar, then a member list grouped by missing waiver | Requires configured real waivers/signatures; no templates should display “Not configured,” not 100% compliant |
| Are there access problems? | Denied attempts by reason, eligible members without enabled keys | Counts and a short exception table linking to profiles/logs | Available; group repeated attempts so one faulty key does not dominate the member count |
| What needs fixing before launch? | Unmatched payments, missing plans/end dates, overlapping plans, duplicate identities, review completion | Migration checklist with counts and drill-down queues | Flags identified in the export; review workflow is still proposed |
| How many members join, leave, or return? | Confirmed lifecycle transitions by month | Separate joined/ended/reactivated bars with net change | Needs reliable transition history; do not present inferred plan edits as confirmed cancellations |
| Do new members stay? | Join cohorts and active membership after 3/6/12 months | Cohort retention table | Later, after dates and historical status are trustworthy |

## Improve the existing reports first

1. Replace horizontal month lists for payments and activity with time-series charts; use a line for active membership.
2. Replace the current membership-status bar panel with compact counts linked to filtered lists, making room for plan distribution or waiver compliance.
3. Show an explicit “partial month” indicator for the current month. Compare partial periods to the equivalent elapsed part of the prior period; do not imply an unfinished month is a full-month decline.
4. Keep historical membership estimates visibly labeled. The imported data cannot reconstruct every staff hold, historical price change, or policy change.
5. Make balances a supporting operational view until migration review is complete. Do not use inflated historical arrears as a headline measure of the makerspace's finances.

Start with **membership trend, payments, usage, plan distribution, waiver compliance, and a compact staff follow-up list**. Add churn and cohort retention only when the underlying history supports them.
