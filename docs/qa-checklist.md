# Roadtrip Pro QA Checklist

Use this checklist before releases and after changes that affect planning, navigation, persistence, maps, or imported trip data.

## Översikt

- App opens on Översikt without a white screen or console-blocking error.
- Trip Readiness shows ready, warning, and empty-trip states correctly.
- The primary next-step button opens the expected workspace.
- Each readiness issue action opens the expected workspace.
- Kartpreview renders with valid markers, and missing-marker copy appears when coordinates are absent.
- Overview metrics stay readable with long trip names, long stop names, and zero totals.

## Rutt

- Rutt opens from the top navigation, sidebar, mobile flow nav, and map rail.
- Route metrics show stop count, distance, and duration without `NaN` or broken labels.
- Markers render in route order when coordinates are valid.
- Stops without coordinates do not break marker numbering.
- The missing-coordinate action is disabled or unavailable when there is no connected trip or no missing coordinates.
- Empty routes show a useful empty/safe state instead of crashing.

## Dagar

- Dagar opens from nav, readiness actions, budget missing-cost actions, and day shortcuts.
- Day selectors update the selected day and keep the selected card highlighted.
- If the selected day is removed or filtered out, the first visible day becomes selected.
- If there are no visible days, the selected day clears and the view remains stable.
- Add, edit, delete, save, undo, and cancel flows preserve unrelated itinerary details.
- Unscheduled items appear safely and can be edited without invalid dates.
- Day warning chips cover missing lodging, missing cost, missing time, missing location, overlaps, large gaps, and daily budget warnings.

## Budget

- Budget opens from nav and readiness actions.
- Total, per-person, category, day, most-expensive-day, and most-expensive-category metrics handle zeroes.
- Missing-cost items list only cost-bearing item types.
- "Lägg till kostnad" opens Dagar for the target item and does nothing unsafe if the item no longer exists.
- Traveler count handles blank, invalid, zero, and positive values.
- Empty itinerary and no-registered-cost states show safe copy and no broken totals.

## Verktyg

- Verktyg opens from top navigation, sidebar, and mobile flow nav.
- Connected-trip tools show the correct enabled/disabled state.
- Import, AI assistant, coordinate update, share/save, and sign-in controls do not overlap at desktop or mobile widths.
- Error/status messages remain visible and understandable after failed tool actions.

## Map Behavior

- Web map renders without blocking the rest of the app.
- Missing, invalid, out-of-range, or deleted-node coordinates are ignored.
- A single marker centers the map on that marker.
- Multiple markers fit within route bounds.
- Dagar map context switches between the selected day and the full route as expected.
- Map fallback state remains usable if the provider cannot load.

## Connected Trip Save/Load

- Anonymous or signed-in user can connect to a trip without duplicate local data.
- Save persists add/edit/delete changes and updates status labels.
- Reload after save loads the connected trip and does not duplicate itinerary nodes.
- Share code creation/join flow handles success, invalid codes, and permission errors.
- Offline/local snapshot does not overwrite newer connected data unexpectedly.

## Mobile 375px

- At 375px width, there is no horizontal page overflow.
- Header actions wrap cleanly and remain tappable.
- Mobile flow nav fits and shows the current step count.
- Main content, map rail/context, day selectors, budget rows, and forms do not overlap.
- Buttons, text inputs, and inline edit controls remain reachable by touch.

## Reload Behavior

- Reload preserves local snapshot state when no connected trip is active.
- Reload restores connected trip data when a trip is active.
- In-progress edit mode does not leave the UI in a broken state after reload.
- Last save status and trip readiness recompute from current data.
- Browser refresh from each workspace opens without a blank screen.

## Empty/Missing Data States

- Empty itinerary is safe in Översikt, Rutt, Dagar, Budget, Verktyg, and map rail.
- Missing titles are flagged as planning gaps.
- Missing dates become unscheduled or missing-time states as appropriate.
- Invalid dates are flagged and do not crash sorting or labels.
- Missing booking references are counted for lodging and transport only.
- Missing coordinates are counted and excluded from map markers.

## Error States

- Failed save keeps local changes visible and shows a useful status message.
- Failed delete/move/edit does not remove unrelated nodes.
- Failed Google Places lookup leaves forms usable.
- Missing API keys show the intended message and no secret values.
- Supabase auth/session failures keep demo/local mode usable.
- Route/map provider failures do not white-screen the app.
