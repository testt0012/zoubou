// One-off seed script: creates the default settings doc and the shop's
// first service. Run once against a fresh Firestore project:
//   node --env-file=.env.local scripts/seed_firestore.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function main() {
  await db
    .collection("settings")
    .doc("config")
    .set(
      { slot_granularity_minutes: 30, buffer_minutes: 0 },
      { merge: true }
    );
  console.log("Settings ready.");

  const existing = await db.collection("services").limit(1).get();
  if (existing.empty) {
    await db.collection("services").add({
      name: "Κούρεμα",
      duration_minutes: 30,
      active: true,
      sort_order: 1,
      created_at: FieldValue.serverTimestamp(),
    });
    console.log('Seeded default service "Κούρεμα".');
  } else {
    console.log("Services collection already has data, skipping.");
  }

  const existingRules = await db.collection("availabilityRules").limit(1).get();
  if (existingRules.empty) {
    const batch = db.batch();
    for (let weekday = 0; weekday <= 6; weekday++) {
      const ref = db.collection("availabilityRules").doc();
      batch.set(ref, {
        weekday,
        start_time: "09:00",
        end_time: "17:00",
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log("Seeded test availability: every day 09:00–17:00.");
  } else {
    console.log("Availability rules already exist, skipping.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
