"use client";

import { ThemeControl } from "@/app/components/theme-control";
import { LearningShell } from "@/app/components/learning-shell";

export default function SettingsPage() {
  return <LearningShell>
    <header className="dashboard-intro"><div><p className="eyebrow">Settings</p><h1>Your Learning space.</h1><p>Only appearance is saved locally during Phase 1A. Account controls are intentionally visual shell states.</p></div></header>
    <div className="settings-stack">
      <section className="settings-card" aria-labelledby="profile-title"><div><p className="eyebrow">Profile</p><h2 id="profile-title">How you appear in Learning</h2><p>Profile editing will become available when authenticated accounts are connected.</p></div><span className="settings-status">Available after secure sign-in</span></section>
      <section className="settings-card" aria-labelledby="account-title"><div><p className="eyebrow">Account</p><h2 id="account-title">Your Growvelt Learning account</h2><p>Sign-in and account details are intentionally deferred to the auth foundation.</p></div><span className="settings-status">Account connection pending</span></section>
      <section className="settings-card" aria-labelledby="appearance-title"><div><p className="eyebrow">Appearance</p><h2 id="appearance-title">Choose your preferred view</h2><p>Saved locally on this device.</p></div><ThemeControl /></section>
      <section className="settings-card" aria-labelledby="security-title"><div><p className="eyebrow">Security</p><h2 id="security-title">Protect your account</h2><p>Password and sign-in management will be available after authentication is connected.</p></div><span className="settings-status">Security controls arrive with auth</span></section>
    </div>
  </LearningShell>;
}
