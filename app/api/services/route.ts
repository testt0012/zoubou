import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("services")
      .where("active", "==", true)
      .orderBy("sort_order", "asc")
      .get();

    const services = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        duration_minutes: data.duration_minutes,
      };
    });

    return NextResponse.json({ services });
  } catch {
    return NextResponse.json(
      { error: "Σφάλμα φόρτωσης υπηρεσιών." },
      { status: 500 }
    );
  }
}
