import { ViewTransition } from "react";

// Wraps a page's content so navigating between admin tabs slides it in the
// direction of travel (tagged via `transitionTypes` on the Link/router.push
// that triggered the navigation — see adminNav.tsx). Untagged navigations
// (refresh, direct load) get no animation.
//
// The extra inner <div> matters: ViewTransition needs ONE element to treat
// as the transition boundary. Handing it several top-level siblings (an
// <h1> plus a handful of <div>s) left each one animating as its own
// independent participant, so mid-transition you'd see leftover pieces of
// the previous page's elements floating over the new ones instead of one
// clean swap.
export default function SlideTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <div>{children}</div>
    </ViewTransition>
  );
}
