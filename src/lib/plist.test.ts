import { describe, it, expect } from 'vitest';
import { parsePlist, parsePlistDocument } from './plist';

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.example.app</string>
    <key>CFBundleDisplayName</key>
    <string>Example App</string>
</dict>
</plist>`;

const NESTED_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
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
                <key>Camera</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.example.app</string>
                        <key>Authorization</key>
                        <string>Deny</string>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Example Profile</string>
</dict>
</plist>`;

describe('parsePlist', () => {
  it('extracts bundle ID and display name from a flat Info.plist', () => {
    const info = parsePlist(INFO_PLIST, []);
    expect(info.bundleId).toBe('com.example.app');
    expect(info.displayName).toBe('Example App');
  });
});

describe('parsePlistDocument', () => {
  it('parses nested arrays of dicts, e.g. a mobileconfig PayloadContent tree', () => {
    const doc = parsePlistDocument(NESTED_PLIST);
    expect(doc.PayloadDisplayName).toBe('Example Profile');

    const content = doc.PayloadContent;
    expect(Array.isArray(content)).toBe(true);
    const payload = (content as unknown[])[0] as Record<string, unknown>;
    expect(payload.PayloadType).toBe('com.apple.TCC.configuration-profile-policy');

    const services = payload.Services as Record<string, unknown>;
    const cameraEntries = services.Camera as unknown[];
    expect(cameraEntries).toHaveLength(1);
    expect((cameraEntries[0] as Record<string, unknown>).Authorization).toBe('Deny');
  });
});
