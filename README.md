# Inventory MS

A store/inventory management system: Dashboard, Products, Stock In, Stock Out, Sales,
Customers, Analytics (with charts + PDF export), Reports (PDF/Excel export), and Settings
(theme, low-stock thresholds, branches/departments, item history lookup, staff accounts).

Data is stored in **Firebase Firestore** (free Spark plan) and login uses **Firebase
Authentication** (email/password). Everything below is free.

## How the login/permissions work

- The **first person** to sign in on a brand-new Firebase project automatically becomes
  the **admin** and owns the store's data.
- The admin creates staff logins from **Settings → Users** (name, email, temporary password).
  Only accounts created there can sign in and see this store's data.
- Firestore security rules (`firestore.rules`) enforce this on the server side — a random
  person who signs up on their own just gets an empty, separate store; they can never see
  the admin's data. Suspending a staff account (also in Settings → Users) instantly blocks
  their access.

## 1. Create your free Firebase project

1. Go to https://console.firebase.google.com → **Add project** → give it a name → finish.
2. In the project, go to **Build → Authentication → Get started → Email/Password → Enable**.
3. Go to **Build → Firestore Database → Create database** → start in **production mode** →
   pick a region close to you.
4. Go to **Project settings (gear icon) → General → Your apps → Web (</>)** → register an app
   (no need for Firebase Hosting here) → copy the `firebaseConfig` values shown.

## 2. Configure the project on your computer

Open a terminal / command prompt in this folder:

```
npm install
```

Copy `.env.example` to `.env` and fill in the values you copied from Firebase:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Deploy the security rules (protects your data — don't skip this):

```
npm install -g firebase-tools
firebase login
firebase init firestore
```
When it asks for a rules file, point it at the existing `firestore.rules` in this folder
(don't let it overwrite it), then:
```
firebase deploy --only firestore:rules
```

## 3. Run it locally

```
npm run dev
```
Open the printed local address, sign in with any email/password you like the first time —
that account becomes your admin.

## 4. Publish it for free (Vercel)

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com → sign in with GitHub → **Add New Project** → pick the repo.
3. In the Vercel project's **Environment Variables**, add the same six `VITE_FIREBASE_...`
   values from your `.env`.
4. Click **Deploy**. Vercel gives you a free `your-project.vercel.app` URL — that's your
   published site.

## Project structure

- `src/pages/` — one file per page (Dashboard, Products, Stock In, Stock Out, Sales,
  Customers, Analytics, Reports, Settings, Branches, Users)
- `src/context/AuthContext.jsx` — login state and role/tenant info
- `src/hooks/useTenantCollection.js` — real-time Firestore data scoped to your store
- `src/utils/analytics.js` — fast/medium/slow movement classification logic
- `firestore.rules` — server-side data access rules (the actual security boundary)
- `src/index.css` — the Teal & Gold theme

## Notes / next steps

- Analytics and Reports classify "movement" from real Stock Out quantities over the last
  30 days (tercile ranking) — no placeholder data.
- The searchable "Select Product" and "Branch/Destination" fields are live typeahead
  (`src/components/SearchSelect.jsx`), used in Stock In, Stock Out, and Sales.
- If you want real Google (Gmail) sign-in later instead of email/password, that requires
  enabling the Google provider in Firebase Authentication and a small change to
  `AuthContext.jsx` — ask and it can be added.
