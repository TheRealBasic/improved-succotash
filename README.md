# Chaos Arena Sample Guide

This repository contains the C++ scaffolding for a small first-person "Chaos Arena" party game built for Unreal Engine 5. Use this guide to wire the provided classes into your project, configure Enhanced Input assets, and place the networked arena manager that rotates minigames such as the Ice Floor slide effect.

## Prerequisites
- Unreal Engine 5.3+ project that uses the Enhanced Input system.
- The C++ classes from `Source/ChaosArena/Public`/`Private` compiled into your project (see `AChaosPlayerCharacter` and `AChaosArenaManager`).
- A listen-server or dedicated server configuration for multiplayer testing.

## Code overview
- `AChaosPlayerCharacter` (`Source/ChaosArena/Public/ChaosPlayerCharacter.h`): First-person character with a camera attached to the capsule, Enhanced Input bindings for Move/Look/Jump/Sprint, replicated sprint speed toggling, and configurable WalkSpeed/SprintSpeed defaults.
- `AChaosArenaManager` (`Source/ChaosArena/Public/ChaosArenaManager.h`): Networked actor that randomly selects minigames (replicated `CurrentMinigame`, `TimeRemainingInRound`), triggers the Blueprint event `OnMinigameChanged`, and applies server-side movement changes for the Ice Floor minigame with safe restoration and late-join support through `ApplyCurrentMinigameToCharacter`.
- `EChaosMinigame` (`Source/ChaosArena/Public/ChaosMinigameTypes.h`): Enum listing available minigames (None, IceFloor, LowGravity, FallingTiles, DodgeBalls).

## Enhanced Input asset setup
1. Create the following `InputAction` assets:
   - **IA_Move (Value: 2D Axis)** – map W/S to Y ±1 and A/D to X ±1 in your `InputMappingContext`.
   - **IA_Look (Value: 2D Axis)** – map Mouse X to X and Mouse Y to Y; add controller look bindings if desired.
   - **IA_Jump (Value: Bool)** – map to Spacebar or controller face button.
   - **IA_Sprint (Value: Bool)** – map to Shift or controller shoulder button.
2. Create an `InputMappingContext` named **IMC_ChaosPlayer** and assign the actions above with your preferred scales.
3. In the `AChaosPlayerCharacter` Blueprint (derived from the C++ class), assign `IMC_ChaosPlayer`, `IA_Move`, `IA_Look`, `IA_Jump`, and `IA_Sprint` on the defaults panel so `BeginPlay` can add the mapping for locally controlled players and `SetupPlayerInputComponent` can bind actions.

## Character configuration
1. Create a Blueprint child of `AChaosPlayerCharacter`.
2. In the Blueprint defaults:
   - Set **WalkSpeed** and **SprintSpeed** to your desired values (e.g., 600 and 1000). Sprint toggles MaxWalkSpeed on press/release.
   - Ensure the **FirstPersonCamera** is positioned for your desired height/offset if adjusting the capsule.
3. Set your project GameMode to use this Blueprint as the **Default Pawn Class**. For listen-server tests, place at least one PlayerStart in the map.

## Arena manager placement and settings
1. Drag an instance of `AChaosArenaManager` into your persistent level. Only the server should spawn or manage this actor; placing one in the map is simplest.
2. In the Details panel:
   - Populate **AvailableMinigames** with entries (e.g., IceFloor, LowGravity, FallingTiles, DodgeBalls). The manager automatically ignores `None` when choosing a random minigame.
   - Set **MinRoundDuration** and **MaxRoundDuration** (defaults are 20–30 seconds) to control random round lengths.
3. The manager starts cycling minigames on `BeginPlay` when running on the server, replicates `CurrentMinigame` and `TimeRemainingInRound`, and fires `OnMinigameChanged` on clients for UI/audio hooks.

## Handling the Ice Floor minigame
- When **IceFloor** is selected, the manager reduces each `AChaosPlayerCharacter` movement component’s `GroundFriction` and `BrakingDecelerationWalking` to create a sliding effect. Default values per character are stored and restored when the minigame ends or switches.
- The effect is applied server-side; clients receive the replicated state for UI but do not author movement values.

## Late-joining players
- If a player spawns while a minigame is active, call `ApplyCurrentMinigameToCharacter` on the manager (from the character’s `BeginPlay` Blueprint or a spawn handler) to apply any active effects like Ice Floor. The manager safely ignores `nullptr` or characters that already have stored defaults.

## Blueprint hooks for UI/FX
- Implement the `OnMinigameChanged` event in a Blueprint derived from `AChaosArenaManager` to drive announcements, timers, or camera effects whenever the replicated `CurrentMinigame` changes on clients.
- Use `GetCurrentMinigame` and `TimeRemainingInRound` for UI widgets that display the current mode and countdown.

## Testing tips
1. Launch a **Listen Server** PIE session with at least one client.
2. Verify input: Move/Look/Jump/Sprint work and sprint toggles MaxWalkSpeed.
3. Watch minigames rotate every 20–30 seconds; confirm Ice Floor lowers friction and restores correctly when the round ends.
4. Connect an additional client mid-round and ensure they inherit the current minigame effect after `ApplyCurrentMinigameToCharacter` runs.
