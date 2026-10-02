// The logo for the customer screens and the admin: the light one, or the
// dark one when the phone is in dark mode. A <picture> downloads only the one
// that applies (and follows the system setting live, with no script).
export default function ThemedLogo({ className, draggable }: { className?: string; draggable?: boolean }) {
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark-720.webp" />
      <img
        src="/logo-720.webp"
        alt="Zoubou"
        width={900}
        height={300}
        draggable={draggable}
        fetchPriority="high"
        className={className}
      />
    </picture>
  );
}
