import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, action] = process.argv.slice(2);

if (!email || !['--grant', '--revoke'].includes(action)) {
  console.error('Usage: npm run set-admin -- <user-email> --grant|--revoke');
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error('Set GOOGLE_CLOUD_PROJECT to your Firebase project ID.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });

try {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const claims = { ...user.customClaims };
  if (action === '--grant') claims.admin = true;
  else delete claims.admin;

  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`Admin claim ${action === '--grant' ? 'granted to' : 'removed from'} ${user.email} (${user.uid}).`);
  console.log('The user must sign out and sign in again before the updated claim takes effect.');
} catch (error) {
  console.error(`Unable to ${action === '--grant' ? 'grant' : 'revoke'} admin access:`, error.message);
  process.exitCode = 1;
}
