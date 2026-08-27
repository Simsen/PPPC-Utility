# Import Existing PPPC mobileconfig → Settings Catalog

Status: Approved (design)
Date: 2026-08-27

## Problem

MacPPPC currently only "imports" app identity: uploading a `.zip`/`Info.plist`
extracts a bundle ID and display name, creating a blank app entry the user
then configures permissions for by hand (`src/lib/files.ts`,
`src/components/AppInput.tsx`).

There is no way to bring in an *existing* PPPC profile — e.g. one exported
from Jamf, or an older classic `.mobileconfig` this tool itself produced —
and convert it to the newer Intune Settings Catalog format
(`src/lib/settingsCatalog.ts`). Users who have legacy `.mobileconfig` PPPC
profiles must currently re-create them permission-by-permission.

## Goal

Add a distinct **"Import Existing Profile"** action that fully parses a
`.mobileconfig` PPPC profile — apps, permissions, authorizations, AppleEvents
receivers, and profile metadata — and loads it into the Build workspace as
fully editable state, ready to review and export as a Settings Catalog policy
(or classic mobileconfig, via the existing format toggle).

## Non-goals

- Importing a Settings Catalog JSON (reverse direction). Only `.mobileconfig`
  import is in scope.
- Preserving/round-tripping payload signing, certificates, or any non-PPPC
  payload types that might coexist in a multi-payload profile.
- A general-purpose plist/profile editor. This is one-shot: load a profile
  into the existing app/permission model, nothing more.

## UI

A new card, **"Import Existing Profile"**, on the Build step, positioned
alongside the existing "Select Application" card. Contains a drag-and-drop
zone + file picker, `accept=".mobileconfig"`, single file only.

Behavior on drop/select:

1. Parse immediately, entirely client-side (consistent with the app's
   "processes all data locally" guarantee).
2. If the current `selectedApps` list is non-empty, confirm before
   replacing, via `window.confirm()` (no styled modal component exists in
   this codebase today, and this is a low-frequency path — introducing one
   is out of scope): *"This will replace your current N apps and profile
   settings — continue?"*
3. On success: replace `selectedApps` and `settings` with the parsed
   result, switch `format` to `settingsCatalog`, scroll to the app list (same
   pattern as the existing `goToDeploy` scroll), and show a success toast:
   *"Imported N apps, M permissions from `<ProfileName>`."*
4. On **partial** success (some entries were skipped — see below): same as
   above, but the toast also lists what was skipped and uses a new
   non-auto-dismissing `'warn'` toast kind so the user doesn't miss it.
5. On total failure (no PPPC payload found, or the file isn't valid XML
   plist): error toast, workspace state is untouched.

### Toast component change

`src/components/Toast.tsx` currently supports `'ok'` (auto-dismiss after
3.5s) and `'err'` (persists until dismissed). Add a third kind, `'warn'`
(amber styling, persists like `'err'`), used for the partial-import case.

## Parsing (`src/lib/mobileconfigImport.ts`, new file)

### Shared plist parsing

`src/lib/plist.ts` today only exposes `parsePlist()`, built on an internal
`parsePlistXml`/`parseDict`/`parseValue` that assumes a root `dict`. A
mobileconfig's structure needs array traversal too (`PayloadContent` is an
array of payload dicts). Generalize this into an exported
`parsePlistDocument(xmlString): PlistValue` that returns the full nested
value tree (dicts and arrays alike, using the existing `PlistValue` union),
and have both the existing `parsePlist()` and the new importer build on it —
no duplicated XML-walking logic.

### Entry point

```ts
export interface MobileconfigImportResult {
  apps: SelectedApp[];
  settings: ProfileSettings;
  warnings: string[]; // human-readable, one per skipped entry
}

export function importMobileconfig(
  xmlString: string,
  knownApps: KnownApp[],
  nextIdStart: number,
): MobileconfigImportResult; // throws on total failure
```

### Locating the PPPC payload

Parse the root dict. Scan `PayloadContent` (array) for entries where
`PayloadType === 'com.apple.TCC.configuration-profile-policy'`. If
`PayloadContent` is missing/not an array, or no such entry exists, throw
`"No PPPC payload found in this profile."` — nothing is imported, no partial
state.

### Per-service entries

For each key in the inner payload's `Services` dict (value: array of
dicts):

- Look up the key against `PPPC_PERMISSIONS` by `tccService`. No match →
  skip this entry, warn: `Unsupported service "<key>" (bundle <id>) skipped`.
- `IdentifierType !== 'bundleID'` (i.e. `'path'`) → skip entry, warn:
  `"<id>" uses a path identifier, which this tool doesn't support — skipped`.
  (Only applies to the *sender* `Identifier`/`IdentifierType`, not
  AppleEvents receivers — see below.)
- **`AppleEvents`**: group entries by sender `Identifier`. Each dict becomes
  one `AppleEventReceiver`:
  `{ identifier: AEReceiverIdentifier, identifierType: AEReceiverIdentifierType, codeRequirement: AEReceiverCodeRequirement, authorization: Authorization }`,
  appended to that sender app's `automation` permission's `receivers[]`
  (`automation.enabled = true`). Receiver `identifierType` may be either
  `bundleID` or `path` — both are valid per the existing
  `AppleEventReceiver` type, no skip needed here.
- **Standard services**: on that app's matching permission, set
  `enabled = true`, `authorization = <Authorization value>`. If the
  `Authorization` string isn't one of `Allow` / `Deny` /
  `AllowStandardUserToSetSystemService`, skip entry, warn:
  `Unrecognized authorization "<value>" for <service> (bundle <id>) skipped`.

### Building `SelectedApp[]`

Group all surviving entries by bundle ID (`Identifier`). For each app:

- `codeRequirement`: if the entry's `CodeRequirement` exactly equals
  `defaultCodeRequirement(bundleId)` (the same helper already used in
  `mobileconfig.ts`/`settingsCatalog.ts`), store `null` (treated as "auto",
  same as today's default-app behavior). Otherwise keep the explicit string.
  If different services disagree (shouldn't normally happen), the first
  non-default value encountered wins.
- `displayName`: look up `bundleId` in `knownApps`; use its `displayName` if
  found, else fall back to the bundle ID itself.
- `isKnownApp`: true iff found in `knownApps`.
- `permissions`: start from the same default-permissions shape
  `createDefaultPermissions()` produces (in `state.ts`), then overlay the
  parsed enabled/authorization/receivers per above.
- `profile.*` (per-app name/description/identifier/organization),
  `scopeTagIds`, `deploymentChannel`: same defaults `makeAppEntry` uses
  today (profile name `PPPC - <displayName>`, empty org/description, fresh
  UUID, `['0']`, `'deviceChannel'`).
- `id`: assigned sequentially starting at `nextIdStart` (caller passes the
  current `nextId` counter from `App.tsx`, same as `handleAppDetected`
  does).

### Profile settings

Read straight off the outer (root) payload dict:

- `organization` ← `PayloadOrganization`
- `payloadName` ← `PayloadDisplayName`
- `payloadIdentifier` ← `PayloadIdentifier`
- `payloadDescription` ← `PayloadDescription`
- `scopeTagIds`: default `['0']` (not present in a classic mobileconfig)
- `deploymentChannel`: default `'deviceChannel'`

Any of the four string fields missing/non-string falls back to the same
default `ProfileSettings` shape `App.tsx` seeds today.

## Wiring into `App.tsx`

- New handler `handleImportMobileconfig(file: File)`:
  1. Read file text, call `importMobileconfig(text, knownApps, nextId)`.
  2. On throw: `setToast({ kind: 'err', message: ... })`, return.
  3. If `selectedApps.length > 0` and `!window.confirm(...)`: return (no
     change).
  4. `setSelectedApps(result.apps)`, `setSettings(result.settings)`,
     `setFormat('settingsCatalog')`, `setNextId(<next available id>)`.
  5. Toast: `'ok'` if `result.warnings.length === 0`, else `'warn'` with the
     warnings appended.
  6. Scroll to top / to the app list, matching the existing `goToDeploy`
     scroll behavior.
- New component `ImportProfile.tsx` (mirrors `AppInput.tsx`'s drop-zone
  structure) rendered in the Build step, above or beside `AppInput`.

## Error handling summary

| Condition | Behavior |
|---|---|
| File isn't valid XML / no `plist` root | Throw → error toast, no state change |
| No `PayloadContent` array, or no PPPC payload inside it | Throw → error toast, no state change |
| Unsupported TCC service | Skip entry, collect warning |
| Non-bundleID sender identifier | Skip entry, collect warning |
| Unrecognized `Authorization` value | Skip entry, collect warning |
| AppleEvents entry with empty receiver identifier | Skip entry, collect warning (mirrors existing generation-side filtering in `mobileconfig.ts`/`settingsCatalog.ts`) |
| Everything skipped, zero apps produced | Throw → error toast (nothing to import), no state change |
| Non-empty workspace before import | `window.confirm()` gate before replacing |

## Testing

No existing test suite was found in this repo (no `*.test.*`/`*.spec.*`
files, no test runner in `package.json`) — this is a from-scratch addition,
so no existing test patterns to follow. The implementation plan should
decide whether to introduce one for this feature or verify manually via the
browser (build a profile, export classic `.mobileconfig`, re-import it,
confirm the round-tripped Settings Catalog JSON matches expectations) —
left to the planning step.
