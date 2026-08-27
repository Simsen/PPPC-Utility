import { describe, it, expect } from 'vitest';
import { importMobileconfig } from './mobileconfigImport';
import { defaultCodeRequirement } from './codeRequirement';
import type { KnownApp } from './types';

function entryDict(fields: Record<string, string>): string {
  const kv = Object.entries(fields)
    .map(
      ([k, v]) =>
        `                        <key>${k}</key>\n                        <string>${v}</string>`,
    )
    .join('\n');
  return `                    <dict>\n${kv}\n                    </dict>`;
}

function serviceArray(service: string, entries: string[]): string {
  return `                <key>${service}</key>\n                <array>\n${entries.join('\n')}\n                </array>`;
}

function profileXml(servicesXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>Services</key>
            <dict>
${servicesXml}
            </dict>
        </dict>
    </array>
    <key>PayloadOrganization</key>
    <string>Acme Corp</string>
    <key>PayloadDisplayName</key>
    <string>Acme PPPC</string>
    <key>PayloadIdentifier</key>
    <string>acme.pppc.profile</string>
    <key>PayloadDescription</key>
    <string>Managed by Acme IT</string>
</dict>
</plist>`;
}

const NON_PPPC_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.wifi.managed</string>
        </dict>
    </array>
</dict>
</plist>`;

const KNOWN_APPS: KnownApp[] = [
  {
    bundleId: 'com.example.app',
    displayName: 'Example App',
    codeRequirement: defaultCodeRequirement('com.example.app'),
  },
];

describe('importMobileconfig', () => {
  it('throws when the profile has no PPPC payload', () => {
    expect(() => importMobileconfig(NON_PPPC_PROFILE, [], 1)).toThrow(
      'No PPPC payload found in this profile.',
    );
  });

  it('imports a single app with one enabled standard permission and profile settings', () => {
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
        }),
      ]),
    );

    const result = importMobileconfig(xml, KNOWN_APPS, 1);

    expect(result.warnings).toEqual([]);
    expect(result.apps).toHaveLength(1);
    const app = result.apps[0];
    expect(app.app.bundleId).toBe('com.example.app');
    expect(app.app.displayName).toBe('Example App');
    expect(app.app.codeRequirement).toBeNull();
    expect(app.isKnownApp).toBe(true);
    expect(app.permissions.camera.enabled).toBe(true);
    expect(app.permissions.camera.authorization).toBe('Deny');

    expect(result.settings).toEqual({
      organization: 'Acme Corp',
      payloadName: 'Acme PPPC',
      payloadIdentifier: 'acme.pppc.profile',
      payloadDescription: 'Managed by Acme IT',
      scopeTagIds: ['0'],
      deploymentChannel: 'deviceChannel',
    });
  });

  it('keeps an explicit non-default code requirement', () => {
    const customReq =
      'identifier "com.example.app" and anchor apple generic and certificate leaf[subject.CN] = "Example"';
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
          CodeRequirement: customReq,
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].app.codeRequirement).toBe(customReq);
  });

  it('falls back to the bundle ID as display name when the app is not known', () => {
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].app.displayName).toBe('com.example.app');
    expect(result.apps[0].isKnownApp).toBe(false);
  });

  it('skips an unsupported TCC service and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('SomeFutureService', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Allow',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('SomeFutureService'))).toBe(true);
  });

  it('skips a path-identified entry and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('Camera', [
          entryDict({
            Identifier: '/Applications/Foo.app',
            IdentifierType: 'path',
            Authorization: 'Deny',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('path identifier'))).toBe(true);
  });

  it('skips an entry with an unrecognized Authorization value and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('Camera', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Maybe',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('Maybe'))).toBe(true);
  });

  it('throws when every entry is skipped', () => {
    const xml = profileXml(
      serviceArray('SomeFutureService', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Allow',
        }),
      ]),
    );

    expect(() => importMobileconfig(xml, [], 1)).toThrow(
      'This profile has no importable PPPC entries.',
    );
  });

  it('throws when the only entry has a CodeRequirement but is otherwise unusable', () => {
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Maybe',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
        }),
      ]),
    );

    expect(() => importMobileconfig(xml, [], 1)).toThrow(
      'This profile has no importable PPPC entries.',
    );
  });

  it('throws when the only AppleEvents entry has a CodeRequirement but an invalid receiver', () => {
    const xml = profileXml(
      serviceArray('AppleEvents', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
          Authorization: 'Allow',
        }),
      ]),
    );

    expect(() => importMobileconfig(xml, [], 1)).toThrow(
      'This profile has no importable PPPC entries.',
    );
  });
});

describe('importMobileconfig — AppleEvents', () => {
  it('groups an AppleEvents entry into the automation permission receivers', () => {
    const xml = profileXml(
      serviceArray('AppleEvents', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
          AEReceiverIdentifier: 'com.example.target',
          AEReceiverIdentifierType: 'bundleID',
          AEReceiverCodeRequirement: defaultCodeRequirement('com.example.target'),
          Authorization: 'Allow',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    const automation = result.apps[0].permissions.automation;
    expect(automation.enabled).toBe(true);
    expect(automation.receivers).toEqual([
      {
        identifier: 'com.example.target',
        identifierType: 'bundleID',
        codeRequirement: defaultCodeRequirement('com.example.target'),
        authorization: 'Allow',
      },
    ]);
  });

  it('groups multiple receivers for the same sender', () => {
    const xml = profileXml(
      serviceArray('AppleEvents', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          AEReceiverIdentifier: 'com.example.target-a',
          AEReceiverIdentifierType: 'bundleID',
          Authorization: 'Allow',
        }),
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          AEReceiverIdentifier: 'com.example.target-b',
          AEReceiverIdentifierType: 'bundleID',
          Authorization: 'Deny',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].permissions.automation.receivers).toHaveLength(2);
  });

  it('skips an AppleEvents entry with an invalid receiver and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('AppleEvents', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Allow',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].permissions.automation.receivers).toEqual([]);
    expect(result.warnings.some((w) => w.includes('invalid receiver'))).toBe(true);
  });

  it('skips an AppleEvents entry with an unrecognized receiver authorization', () => {
    const xml = profileXml(
      [
        serviceArray('AppleEvents', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            AEReceiverIdentifier: 'com.example.target',
            AEReceiverIdentifierType: 'bundleID',
            Authorization: 'Maybe',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].permissions.automation.receivers).toEqual([]);
    expect(result.warnings.some((w) => w.includes('Maybe'))).toBe(true);
  });
});
