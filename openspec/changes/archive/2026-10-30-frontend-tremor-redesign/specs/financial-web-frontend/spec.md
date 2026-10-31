# Financial Web Frontend Specification (delta)

## Purpose

Add a visual system, deep-linkable navigation, per-field feedback, complete view states and financial value cues to the existing capability. The frontend currently ships with no styling layer at all (no CSS file, no Tailwind, no `className` anywhere), so every requirement below is ADDED. None of them replaces an existing requirement.

**Base note.** The `financial-web-frontend` capability has no file in `openspec/specs/` yet: its current text still lives as a delta inside the un-archived `financial-agent-modernization` change. Archive that change before this one, or the delta merges will conflict.

## ADDED Requirements

### Requirement: Visual system

The frontend MUST render every workspace through one styling system built on Tailwind CSS 4 and Tremor components copied into the repository, MUST NOT render interactive or data views as unstyled raw HTML, and MUST depend on exactly one Recharts major.

#### Scenario: Styled workspace

- GIVEN the frontend is running
- WHEN the user opens any workspace
- THEN it renders through the shared styling system
- AND no view falls back to unstyled raw HTML

#### Scenario: One chart major

- GIVEN the installed dependencies
- WHEN the bundle is built
- THEN exactly one Recharts major is present
- AND the market chart still renders its target line and its transaction markers

### Requirement: Deep-linkable navigation

Each workspace MUST have its own URL and MUST be restored when that URL is opened directly. The alerts view MUST be reachable without passing through the market workspace.

#### Scenario: Deep link restores the workspace

- GIVEN a URL identifying a workspace
- WHEN it is opened directly in the browser
- THEN that workspace renders with no manual navigation

#### Scenario: Alerts are a first-class destination

- GIVEN the user wants to monitor alerts
- WHEN the user navigates
- THEN alerts are reachable without opening the market workspace

### Requirement: Preserved workspace state

The frontend MUST NOT discard data the user has entered when navigating between workspaces.

#### Scenario: Entered data survives navigation

- GIVEN a workspace holding entered form data
- WHEN the user leaves it and returns
- THEN the entered data is still present

### Requirement: Per-field operation feedback

A validation error MUST be associated with the field that caused it and MUST be exposed to assistive technology. A rejected operation MUST NOT be presented as a success, and a query with missing required input MUST report what is missing instead of failing silently.

#### Scenario: Field error is announced

- GIVEN invalid input in an operation form
- WHEN the user submits it
- THEN the offending field displays its error
- AND that field is marked invalid
- AND the message is associated with the field for assistive technology

#### Scenario: Rejected operation is not success

- GIVEN the backend rejects an operation
- WHEN the rejection returns
- THEN an error is shown
- AND the entered data is preserved
- AND no success message is shown
- AND 409 and 404 responses are never presented as success

#### Scenario: Missing input is reported

- GIVEN a filtered query whose required value is missing
- WHEN the user triggers it
- THEN the frontend reports what is missing

### Requirement: Complete view states

Every data view MUST render loading, empty and error states that are distinguishable from each other, and every destructive action MUST require confirmation before its request is sent.

#### Scenario: Empty state is explicit

- GIVEN a data view with no records
- WHEN it renders
- THEN an empty state specific to that view is shown
- AND it is distinguishable from the loading state

#### Scenario: Destructive action is confirmed

- GIVEN a delete action on any record
- WHEN the user triggers it
- THEN confirmation is required before the request is sent
- AND cancelling sends no request

### Requirement: Financial value presentation

Monetary values MUST identify their currency, gains and losses MUST be distinguishable by more than colour alone, and success feedback MUST NOT outlive the action it describes.

#### Scenario: Gain and loss are distinguishable

- GIVEN a gain and a loss
- WHEN they are rendered
- THEN each carries a sign and a non-colour cue
- AND the distinction does not depend on colour alone

#### Scenario: Success feedback is scoped

- GIVEN a success message left by a previous action
- WHEN a new action starts or the user navigates
- THEN the stale message is gone
