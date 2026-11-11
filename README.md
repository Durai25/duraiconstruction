# Durai Construction

Responsive civil construction website with EmailJS-delivered project and careers forms, plus optional Firestore archiving.

Business contact details are centralized in `contact-config.js`. Add the confirmed phone number, WhatsApp number in international digits, business email, office address, and optional Google Maps place URL before publishing. The map embed is generated from the office address.

## Run locally

Serve this directory over HTTP (ES modules and Firebase require a local web server):

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Connect Firebase

1. Create a Firebase project and register a Web app.
2. Copy the Web app configuration into `firebase-config.js`, replacing each `YOUR_...` value.
3. Create a Cloud Firestore database.
4. Deploy the included rules and Hosting site with the Firebase CLI:

```sh
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules,storage
```

When configured, project enquiries are archived in `inquiries` and career applications in `applications`. Public reads, updates and deletes are denied. An authenticated admin can read enquiries and update only their CRM follow-up status and internal note; career applications remain write-only. Before production, enable Firebase App Check and monitor the collections for abuse.

## Plan and visualize a project

The homepage includes an illustrative INR cost estimator and an interactive isometric building concept viewer. The estimator's per-square-foot rate ranges and finish multipliers are in `project-tools.js`; replace them with verified company rates before publishing. The displayed range is for early planning only, not a quotation. The viewer is a conceptual massing illustration, not a construction drawing.

## Set up the customer and admin portal

1. Enable **Email/Password** and **Google** in Firebase Authentication. Add the deployed site domain under Authentication's authorized domains. Customers can sign in to `portal.html` with either provider; Google sign-in may create a new account. Customer access is read-only and limited to project records assigned to that account's UID, so make sure the project uses the UID of the account the customer signs in with. Admins continue to use email/password.
2. Set `GOOGLE_CLOUD_PROJECT` to the Firebase project ID and authenticate a trusted administrator machine with Application Default Credentials. The authenticated identity needs Firebase Authentication user-management privileges.
3. Grant an admin claim to an existing account with `npm install`, `gcloud auth application-default login`, and `GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID npm run set-admin -- admin@example.com --grant`. Use `--revoke` to remove it. Never grant this claim from browser code. Admins must sign out and back in after a claim change.
4. Open `admin.html`, sign in as the claimed admin, create a project with the customer's Auth UID, and maintain its work status, payment figures, progress percentage, handover estimate and progress notes. Review website enquiries and save CRM follow-up statuses and internal notes in the admin desk. New project data appears in `portal.html`.
5. Configure bucket CORS using `storage-cors.json`: replace `YOUR_HOSTING_DOMAIN` with the deployed site origin, then run `gcloud storage buckets update gs://YOUR_STORAGE_BUCKET --cors-file=storage-cors.json` using the exact bucket name from Firebase project settings.

Project images and videos are stored under `projects/{projectId}/` in Firebase Storage. Admins can upload images up to 20 MB and videos under 100 MB. Storage rules restrict uploads to admins and reads to the admin or the customer assigned to that project.

The admin desk opens to six section tiles for attendance, finance, projects, customers, site updates and enquiries; select a tile to view that section, then return to the tiles to switch sections. Attendance includes a month-by-month employee book showing each employee's daily present/leave marks and monthly totals, plus a daily register to add records. Select a date and record each employee's name, work section, location, attendance status and daily wage. The daily overview shows present headcount by location, leave count and wage spend for employees marked present. Records are stored in the admin-only `employeeAttendance` Firestore collection; deploy the included Firestore rules before using the register.

Run the Firestore and Storage permission tests with `npm run test:rules` after installing the Firebase CLI and npm dependencies.

## Seed temporary admin and customer data

If you are using the Spark plan and do not have local Cloud credentials, use the browser-based Firestore seeder instead of the Admin SDK route.

1. Open the app in a browser.
2. Load the seed page at `http://localhost:5173/seed-demo-firestore.html` via a local web server.
3. Click the button to create temporary admin and customer data.
4. Use these demo details for sign-in:
   - Admin: `admin@durai-demo.com`
   - Customer: `customer@durai-demo.com`

The seed creates sample records in `admins`, `customers`, `projects`, `projects/{projectId}/updates`, and `inquiries`.

> If Firestore rules block the writes, temporarily allow `create` for testing or use the Firebase console in test mode before running the seed again.

## Connect EmailJS

1. Create an EmailJS service and two email templates, one for project enquiries and one for careers applications.
2. Set the project template variables to `from_name`, `reply_to`, `phone`, `request_type`, `project_type`, `site_location`, `preferred_date`, and `message`.
3. Set the careers template variables to `from_name`, `reply_to`, `phone`, `experience_area`, `portfolio_url`, and `message`.
4. Add the EmailJS public key, service ID, and both template IDs to `emailjs-config.js`.
5. Restrict allowed origins in EmailJS to the deployed site domain and configure appropriate spam protection in the EmailJS dashboard.

The form sends email through EmailJS first. If Firebase is configured, it then attempts to archive the submission; an archive failure does not invalidate a successfully sent email.

## Before publishing

- Replace the representative project imagery and project types with verified company portfolio details.
- Update the business description and service area to match the company.
- Fill in the confirmed business contact values in `contact-config.js`.
- Firebase and EmailJS configuration are intentionally left as placeholders.
