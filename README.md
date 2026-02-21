# PPPC Builder – Create macOS Privacy Policies for Intune

🌐 Webapp: https://www.simsenblog.dk/pppc-builder/

PPPC Builder is a simple web-based tool that helps you generate **Privacy Preferences Policy Control (PPPC)** `.mobileconfig` files for macOS.

The goal is straightforward:

> Make it easy to create macOS permission policies that can be deployed with Microsoft Intune.

No Jamf dependencies.  
No complex profile editors.  
Just generate the profile you need — and deploy it.

---

## 🚀 What Problem Does This Solve?

Managing macOS permissions in enterprise environments can be time-consuming and error-prone.

Permissions such as:

- Screen Recording  
- Full Disk Access  
- Camera  
- Microphone  
- Accessibility  
- Files & Folders  
- System Extensions  

require properly formatted configuration profiles (`.mobileconfig`).

Creating these manually can be:
- Tedious
- Easy to misconfigure
- Difficult to validate

PPPC Builder simplifies this by allowing you to:

1. Upload/select an application
2. Choose required permissions
3. Generate a ready-to-deploy `.mobileconfig` file

---

## ✨ Features

- 🌐 100% web-based – no installation required
- 📦 Generates standard `.mobileconfig` profiles
- 🎯 Focused on Microsoft Intune deployment
- 🔐 Supports common macOS privacy permissions
- ⚡ Lightweight and fast
- 🧩 No Jamf-specific configuration

---

## 🖥️ How It Works

1. Open the webapp  
   https://simsenblog.dk/PPPCBuilder/index.html  

2. Select your macOS application  
   - Choose a **pre-defined app** from the list  
   **or**  
   - Upload the app’s `Info.plist` file  

   To get the `Info.plist` file:
   - Locate the application in Finder (e.g. `/Applications`)
   - Right-click the app
   - Select **Show Package Contents**
   - Open the `Contents` folder
   - Find and upload `Info.plist`

3. Choose the required permissions  
   Example:
   - Screen Recording (Standard user can toggle)
   - Full Disk Access
   - Accessibility

4. Download the generated `.mobileconfig` file

5. Upload to Microsoft Intune:
   - Go to **Intune Admin Center**
   - Devices → macOS → Configuration profiles
   - Create profile → Templates → Custom
   - Upload the generated file

Done.

---

## 📦 Deployment with Microsoft Intune

This tool is built specifically with Intune in mind.

After generating the profile:

- Create a **macOS Custom Configuration Profile**
- Upload the `.mobileconfig`
- Assign to device or user groups

The profile will enforce the configured permissions on macOS devices.

---

## ⚠️ Important Notes

- Some permissions can only allow **user-approved toggling** (Apple limitation).
- Not all privacy services support forced enablement.
- Ensure your app is properly signed and identifiable (Bundle ID).

Always test in a pilot group before broad deployment.

---

## 🎯 Target Audience

- Microsoft Intune administrators
- macOS endpoint engineers
- Modern Workplace consultants
- Security teams managing macOS via MDM

If you're running macOS in an Intune-managed environment — this is for you.

---

## 🔍 Why This Tool?

There are existing tools in the ecosystem, but many are Jamf-focused.

This project is intentionally:
- Intune-first
- Lightweight
- Easy to use
- Focused only on app-level PPPC configuration

---

## 🤝 Contributing

If you have feature ideas, improvements, or feedback — feel free to reach out.

You can also connect via:
- LinkedIn
- SimsenBlog.dk

---

## 📄 License

Provided as-is.  
Test before production use.

---

Built for modern macOS management.  
Made simple for Intune.
