import { ThemeControl } from "@/app/components/theme-control";

export default function SettingsPage() {
  return <>
    <header className="dashboard-intro"><div><p className="eyebrow">Settings</p><h1>Your Learning space.</h1><p>Only appearance is saved locally during Phase 1A. Account controls are intentionally visual shell states.</p></div></header>
    <div className="settings-stack">
      <section className="settings-card" aria-labelledby="profile-title"><div><p className="eyebrow">Profile</p><h2 id="profile-title">How you appear in Learning</h2><p>Your authenticated account is connected. Profile editing will arrive with a later learner-data phase.</p></div><span className="settings-status">Coming later</span></section>
      <section className="settings-card" aria-labelledby="account-title"><div><p className="eyebrow">Account</p><h2 id="account-title">Your Growvelt Learning account</h2><p>Your account is securely connected. Profile editing arrives with the next learner-data phase.</p></div><span className="settings-status">Signed in</span></section>
      <section className="settings-card" aria-labelledby="appearance-title"><div><p className="eyebrow">Appearance</p><h2 id="appearance-title">Choose your preferred view</h2><p>Saved locally on this device.</p></div><ThemeControl /></section>
      <section className="settings-card" aria-labelledby="security-title"><div><p className="eyebrow">Security</p><h2 id="security-title">Protect your account</h2><p>Use the account-recovery flow to securely reset a password when needed.</p></div><a className="settings-status settings-link" href="/forgot-password">Reset password</a></section>
    </div>
  </>;
}
