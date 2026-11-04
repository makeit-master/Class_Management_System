import { useEffect } from "react";

const blockers = new Set<() => boolean>();

// The app uses state-based navigation; call before replacing the active view.
export function confirmAttendanceNavigation(): boolean {
  return [...blockers].every((allow) => allow());
}

export function useAttendanceNavigationGuard(dirty: boolean, saving: boolean) {
  useEffect(() => {
    if (!dirty && !saving) return;
    const allow = () => {
      if (saving) {
        window.alert("Attendance is saving. Please wait before leaving.");
        return false;
      }
      return window.confirm(
        "You have unsaved attendance changes. Discard changes and leave?",
      );
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    blockers.add(allow);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      blockers.delete(allow);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, saving]);
}
