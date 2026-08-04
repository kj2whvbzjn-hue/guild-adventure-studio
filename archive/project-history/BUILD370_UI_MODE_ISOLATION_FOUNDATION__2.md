# Build 370 — UI Mode Isolation Foundation

## Goal
Keep system implementation moving while preventing the temporary portrait developer interface from inheriting the official 1600×900 landscape canvas rules.

## Confirmed product direction
- Official release UI: landscape.
- Development UI: portrait, temporary, for iPhone development visibility.
- Game logic, Battle Core, Save and Export remain shared.
- Final landscape layout remains adjustable; no permanent resolution decision is forced in this build.

## Changes
- Added an explicit `data-ui-mode` boundary:
  - `official-landscape`
  - `developer-portrait`
- The mode is selected before first paint when possible and synchronized after rotation/resize.
- Developer portrait mode now fully neutralizes the fixed 1600×900 canvas geometry and uses normal document flow.
- Official landscape mode retains the existing 1600×900 logical canvas and scale-to-fit behavior.
- Orientation guides cannot intercept taps in developer portrait mode.
- No Battle Core rules, BUFF rules, Save schema, Export schema, Studio data, or legacy versions were changed.

## Notes
This is an isolation foundation, not a final landscape visual redesign. It removes cross-mode CSS ownership so later system work does not require repeated layout patches.
