# Build 373 — Development Battle Repeat / Enemy HP Multiplier

## Purpose
Improve Battle Core verification without changing formal game balance.

## Changes
- Added development-only enemy HP multiplier: x1 / x5 / x10 / x50.
- Default multiplier is x10 and is stored only in browser localStorage.
- Changing the multiplier resets the current test battle.
- Added a development-only "same conditions rematch" button to the result screen.
- Rematch resets units, HP, MP, Action Gauge, Cooldowns, BUFFs, Tick, action count, logs, result, and reward-applied state.
- Formal enemy data, Export format, Save Data Version 1, and reward values are unchanged.

## Scope
- Modified: formal-v03/index.html
- Not modified: Studio, Export schema, legacy versions, formal battle formulas.
