import Image from "next/image";

// The logo for the customer screens: the light one, or the dark one when the
// phone is in dark mode (which one shows is decided in app/globals.css, so
// it follows the system setting live, with no script).
export default function ThemedLogo({ className, draggable }: { className?: string; draggable?: boolean }) {
  return (
    <>
      <Image
        src="/logo-720.webp"
        unoptimized
        alt="Zoubou"
        width={900}
        height={300}
        priority
        draggable={draggable}
        className={`logo-light ${className ?? ""}`}
      />
      <Image
        src="/logo-dark-720.webp"
        unoptimized
        alt=""
        aria-hidden="true"
        width={900}
        height={300}
        priority
        draggable={draggable}
        className={`logo-dark ${className ?? ""}`}
      />
    </>
  );
}
