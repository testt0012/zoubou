import { ViewTransition } from "react";

// Wraps a page's content so navigating between admin tabs slides it in the
// direction of travel (tagged via `transitionTypes` on the Link/router.push
// that triggered the navigation — see adminNav.tsx). Untagged navigations
// (refresh, direct load) get no animation.
export default function SlideTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
