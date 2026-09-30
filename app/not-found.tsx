import Link from "next/link";

// A page that doesn't exist, in Greek, with the way back.
export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col justify-center">
      <div className="w-full max-w-md mx-auto px-4 py-8 my-6 bg-white rounded-2xl shadow-lg shadow-black/20 text-center">
        <h1 className="text-lg font-semibold mb-2">Η σελίδα δεν βρέθηκε</h1>
        <p className="text-sm text-neutral-500 mb-6">Ο σύνδεσμος δεν ισχύει ή η σελίδα έχει αφαιρεθεί.</p>
        <Link href="/" className="w-full h-12 rounded-md bg-brand-purple text-white font-medium flex items-center justify-center">
          Κλείσε ραντεβού
        </Link>
      </div>
    </main>
  );
}
