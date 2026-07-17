// Push the Gutly email templates to Supabase via the Management API.
//
// Run it yourself so your access token stays on your machine:
//
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node update_email_templates.js
//
// Get a token at: https://supabase.com/dashboard/account/tokens  (Generate new token)
// It never leaves your terminal — this script only sends it to api.supabase.com.

const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'fgpwifrdyhdigrqagnks';
const TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();

if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.\nRun:  SUPABASE_ACCESS_TOKEN=sbp_xxx node update_email_templates.js');
  process.exit(1);
}
if (!TOKEN.startsWith('sbp_')) {
  console.error('That is not a personal access token. It must start with "sbp_".');
  console.error('You likely used a project API key (anon / service_role, "eyJ...").');
  console.error('Get the right one at: https://supabase.com/dashboard/account/tokens → Generate new token');
  process.exit(1);
}

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const body = {
  // Confirm signup
  mailer_subjects_confirmation: 'Confirm your Gutly email',
  mailer_templates_confirmation_content: read('supabase_email_confirm_signup.html'),
  // Reset password
  mailer_subjects_recovery: 'Reset your Gutly password',
  mailer_templates_recovery_content: read('supabase_email_reset_password.html'),
};

fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      console.error(`Failed (HTTP ${res.status}):`, text);
      process.exit(1);
    }
    console.log('✅ Email templates updated (Confirm signup + Reset password).');
    console.log('   Check Authentication → Emails → Templates in your dashboard.');
  })
  .catch((e) => { console.error('Request error:', e.message); process.exit(1); });
