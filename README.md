# MacPPPC

**[macpppc.com](https://macpppc.com)** — a browser-based builder for macOS
**Privacy Preferences Policy Control (PPPC)** profiles that deploys them
straight to **Microsoft Intune**. No Jamf, no hand-written XML, no
per-admin downloads, no backend.

MacPPPC is a 100% client-side React app served from GitHub Pages. Profiles
are generated in your browser. Intune deployment happens directly between
your browser and Microsoft Graph using your own Entra ID sign-in — nothing
is proxied through a server we control, because there is no server.

> Open [macpppc.com](https://macpppc.com), sign in with Entra ID, build
> your profile, and click Deploy.

📖 **Full write-up of how it works and why it exists:**
[macpppc — deploy macOS PPPC profiles to Intune](https://rksolutions.nl/posts/macpppc-deploy-macos-pppc-profiles-to-intune/)

---

## What it does

- **Builds** a TCC payload that grants or denies any of the
  [24 PPPC services Apple exposes to MDM][apple-pppc] — Accessibility, Full
  Disk Access (and the granular Desktop/Documents/Downloads/Network/
  Removable/Admin folder variants), Camera, Microphone, Screen Recording,
  Input Monitoring, Post Event, Bluetooth, Contacts, Calendars, Reminders,
  Photos, Media Library, Speech Recognition, Apple Events/Automation (with
  full receiver-app pairing), File Provider Presence, App Bundles, and App
  Data — for one or more apps in a single policy.
- **Auto-fills designated code requirements** for a curated list of known
  apps. Need something unlisted? Drop in an `Info.plist`, or upload a
  zipped `.app` bundle and MacPPPC will extract the bundle identifier.
- **Enforces Apple's MDM rules** automatically. Camera and Microphone are
  restricted to *Deny* (Apple ignores everything else for these). Screen
  Recording and Input Monitoring are restricted to *Deny* or *Allow
  standard user to enable* — force-Allow is not permitted via profile.

[apple-pppc]: https://developer.apple.com/documentation/devicemanagement/privacypreferencespolicycontrol/services-data.dictionary

### Two deployment formats

| Format | Intune surface | Why pick it |
|---|---|---|
| **Templates › Custom** | `macOSCustomConfiguration` — raw `.mobileconfig` plist | The classic format. Works everywhere. Editing requires re-uploading the file. |
| **Settings Catalog** | `configurationPolicies` — Microsoft's modern JSON format | Editable per-setting in the Intune portal after deployment; settings are reusable across policies. Re-importable via Intune's *Import policy* button. |

Both formats produce **identical macOS behavior** — they deploy the same
24 services. The choice is purely about how the policy looks and edits in
the Intune portal.

### Bundled or separate

- **Single bundle** — every app in one policy. Easy to deploy, easy to
  scope.
- **Separate profiles** — one policy per app. Downloaded as a ZIP if you
  prefer manual upload, or deployed as N separate Intune policies if you
  want per-app assignments.

---

## How it works

The whole app is one page in two steps.

### Step 1 — Build profiles

1. **Add apps.** Drag-and-drop a `.zip` of an `.app` bundle, drop an
   `Info.plist` directly, or pick from the built-in known-apps list.
2. **Toggle permissions** per app. The authorization dropdown
   (Allow / Allow standard user / Deny) is constrained by Apple's rules
   per service.
3. **Pick output mode** — *Single bundle* (default) or *Separate
   profiles*.
4. **Pick deployment format** — *Templates › Custom* or *Settings
   Catalog*.
5. The right rail shows a **live preview** (XML for Custom, JSON for
   Settings Catalog) with syntax highlighting and optional word-wrap.
   Multiple profiles appear as collapsible accordions, collapsed by
   default so the Deploy step is one scroll away.

### Step 2 — Deploy to Intune

1. **Sign in** with Entra ID (top-right button). MSAL handles the
   redirect; tokens stay in your browser.
2. **Name each policy** — bundle mode = one row, separate mode = one row
   per app plus an optional bulk-rename pattern (`{appName}`,
   `{bundleId}`).
3. Pick the **deployment channel** (device or user) per policy.
4. *Optional:* pick **scope tags** (multi-select; defaults to *Default*)
   if your tenant uses RBAC scoping.
5. *Optional:* configure **assignment per policy** — leave as *none* to
   create the policy unassigned, or pick all users, all devices, or
   groups (include/exclude). Each include group can have its own
   assignment filter. *Copy to all* mirrors one policy's assignment onto
   every other.
6. Click **Deploy.** Each policy is created via Microsoft Graph, and
   assigned in a follow-up call if you configured an assignment. Results
   appear in-line with deep links to the Intune portal.

### Or just download

If you don't want to grant the tool any tenant access, the Download
button gives you the same `.mobileconfig` (or Settings Catalog JSON, or a
ZIP for separate mode) ready for manual upload to Intune.

---

## Security & privacy

- **100% client-side.** The Vite-built static bundle runs entirely in
  your browser. No backend, no proxy, no analytics, no telemetry.
- **MSAL tokens** live in `localStorage` so they survive the Microsoft
  redirect round-trip and persist across tabs and reloads. Sign out
  clears them. They are never sent to any server other than Microsoft.
- **Graph calls go direct** from your browser to `graph.microsoft.com`.
- **No client secret.** MacPPPC uses the SPA + PKCE OAuth flow.

---

## Required Entra permissions

The app requests these **delegated** scopes on sign-in:

| Scope | Why |
|---|---|
| `DeviceManagementConfiguration.ReadWrite.All` | Create / update device configuration profiles |
| `DeviceManagementRBAC.Read.All` | Read the scope tag list |
| `Group.Read.All` | Search security groups for assignment |
| `User.Read` | Show your name in the top bar |

All four require admin consent at first use in your tenant.

---

## Caveats

- Some macOS permissions cannot be force-granted from MDM (Apple
  limitation): Camera and Microphone honour only *Deny*; Screen Recording
  and Input Monitoring honour *Deny* or *Allow standard user to enable*.
  Every other service gets the full dropdown.
- Generated profiles are **unsigned.** Intune doesn't require signing for
  custom configuration profiles.
- The Intune portal's per-policy deep links sometimes don't render
  assignment filters on first load — refresh once and they appear. Not a
  MacPPPC bug.

---

## License

Provided as-is. Test in a pilot group before broad deployment.
