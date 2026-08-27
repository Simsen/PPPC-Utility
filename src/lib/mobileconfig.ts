import { PPPC_PERMISSIONS } from './permissions';
import { escapeXml } from './xml';
import { generateRandomUUID } from './uuid';
import { defaultCodeRequirement } from './codeRequirement';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';

interface StandardEntry {
  kind: 'standard';
  bundleId: string;
  codeRequirement: string | null;
  authorization: Authorization;
  authMode: AuthMode;
}

interface AppleEventsEntry {
  kind: 'appleEvents';
  bundleId: string;
  codeRequirement: string | null;
  receivers: AppleEventReceiver[];
}

type ServiceEntry = StandardEntry | AppleEventsEntry;

/**
 * Clamp the requested authorization to one that macOS actually honours for the
 * service's authMode. Mirrors Jamf PPPCServices.json (denyOnly + allowStandardUsers).
 */
function effectiveAuthorization(mode: AuthMode, requested: Authorization): Authorization {
  switch (mode) {
    case 'standard':
      return requested;
    case 'denyOrStandardUser':
      // Apple disallows force-Allow here; map anything non-Deny to standard-user grant.
      return requested === 'Deny' ? 'Deny' : 'AllowStandardUserToSetSystemService';
    case 'denyOnly':
      // Anything other than Deny is silently ignored by macOS for these services.
      return 'Deny';
  }
}

/**
 * Build the inner Services-dict XML body from the selected apps' enabled permissions.
 * Returns null when no service entries would be emitted.
 */
function buildServicesDict(selectedApps: SelectedApp[]): string | null {
  const serviceGroups: Record<string, ServiceEntry[]> = {};

  for (const item of selectedApps) {
    for (const [permId, state] of Object.entries(item.permissions)) {
      if (!state.enabled) continue;
      const perm = PPPC_PERMISSIONS.find((p) => p.id === permId);
      if (!perm) continue;
      const service = perm.tccService;

      if (perm.tccService === 'AppleEvents') {
        // Skip receivers with empty identifier — Apple Events without a target
        // app is structurally invalid (and macOS / Graph would reject it).
        const receivers = (state.receivers ?? []).filter((r) => r.identifier.trim() !== '');
        if (receivers.length === 0) continue;
        if (!serviceGroups[service]) serviceGroups[service] = [];
        serviceGroups[service].push({
          kind: 'appleEvents',
          bundleId: item.app.bundleId,
          codeRequirement: item.app.codeRequirement,
          receivers,
        });
        continue;
      }

      if (!serviceGroups[service]) serviceGroups[service] = [];
      serviceGroups[service].push({
        kind: 'standard',
        bundleId: item.app.bundleId,
        codeRequirement: item.app.codeRequirement,
        authorization: state.authorization,
        authMode: perm.authMode,
      });
    }
  }

  if (Object.keys(serviceGroups).length === 0) return null;

  return Object.entries(serviceGroups)
    .map(([service, entries]) => {
      const appsXml = entries
        .flatMap((entry) => {
          if (entry.kind === 'standard') {
            const codeReq = entry.codeRequirement || defaultCodeRequirement(entry.bundleId);
            const auth = effectiveAuthorization(entry.authMode, entry.authorization);
            return [
              `                    <dict>
                        <key>Authorization</key>
                        <string>${auth}</string>
                        <key>CodeRequirement</key>
                        <string>${escapeXml(codeReq)}</string>
                        <key>Comment</key>
                        <string></string>
                        <key>Identifier</key>
                        <string>${escapeXml(entry.bundleId)}</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                    </dict>`,
            ];
          }
          // AppleEvents: one dict per receiver, with AEReceiver* fields.
          const senderCodeReq =
            entry.codeRequirement || defaultCodeRequirement(entry.bundleId);
          return entry.receivers.map((r) => {
            const receiverCodeReq =
              r.codeRequirement || defaultCodeRequirement(r.identifier);
            return `                    <dict>
                        <key>AEReceiverCodeRequirement</key>
                        <string>${escapeXml(receiverCodeReq)}</string>
                        <key>AEReceiverIdentifier</key>
                        <string>${escapeXml(r.identifier)}</string>
                        <key>AEReceiverIdentifierType</key>
                        <string>${r.identifierType}</string>
                        <key>Authorization</key>
                        <string>${r.authorization}</string>
                        <key>CodeRequirement</key>
                        <string>${escapeXml(senderCodeReq)}</string>
                        <key>Comment</key>
                        <string></string>
                        <key>Identifier</key>
                        <string>${escapeXml(entry.bundleId)}</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                    </dict>`;
          });
        })
        .join('\n');

      return `                <key>${service}</key>
                <array>
${appsXml}
                </array>`;
    })
    .join('\n');
}

/**
 * Generate a complete .mobileconfig XML string, or null if no services would
 * be emitted. Returning null lets the caller skip the profile entirely instead
 * of generating an empty-but-deployable plist (which is misleading and, for
 * AppleEvents-with-no-receivers, surprising).
 */
export function generateMobileconfig(
  selectedApps: SelectedApp[],
  settings: ProfileSettings,
  innerPayloadUUID?: string,
): string | null {
  const profileName = settings.payloadName || 'PPPC Configuration';
  const organization = settings.organization || 'IT Department';
  const description = settings.payloadDescription || '';
  const profileUUID = settings.payloadIdentifier || generateRandomUUID();

  const servicesContent = buildServicesDict(selectedApps);
  if (!servicesContent) return null;

  const inner = innerPayloadUUID ?? generateRandomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDescription</key>
            <string>${escapeXml(profileName)}</string>
            <key>PayloadDisplayName</key>
            <string>${escapeXml(profileName)}</string>
            <key>PayloadIdentifier</key>
            <string>${escapeXml(inner)}</string>
            <key>PayloadOrganization</key>
            <string>${escapeXml(organization)}</string>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>PayloadUUID</key>
            <string>${escapeXml(inner)}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Services</key>
            <dict>
${servicesContent}
            </dict>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>${escapeXml(description)}</string>
    <key>PayloadDisplayName</key>
    <string>${escapeXml(profileName)}</string>
    <key>PayloadIdentifier</key>
    <string>${escapeXml(profileUUID)}</string>
    <key>PayloadOrganization</key>
    <string>${escapeXml(organization)}</string>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${escapeXml(profileUUID)}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;
}
