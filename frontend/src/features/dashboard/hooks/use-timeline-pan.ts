import { useEffect, useRef } from 'react';

// Movement before a press becomes a drag — below it, it stays a click (a bar,
// a free day, a car's action button).
const DRAG_THRESHOLD_PX = 6;
// Trackpad/wheel distance worth one day.
const WHEEL_PX_PER_DAY = 50;

type TimelinePanOptions = {
  // Width of the fixed column before the days (the "maintenant" column).
  leadingColumnWidth: number;
  dayCount: number;
  // Moves the window by `days` (negative = back in time).
  onShift: (days: number) => void;
};

// Lets the planning's days be moved like a timeline: drag it sideways with
// the mouse or a finger, or scroll horizontally (trackpad swipe, or
// Shift + mouse wheel). A plain vertical wheel still scrolls the page.
// Takes the element itself (from a callback ref) rather than a ref object:
// the planning only renders it once data has loaded, and the listeners must
// attach then, not on the first render.
export function useTimelinePan(container: HTMLElement | null, options: TimelinePanOptions) {
  // Read through a ref so the listeners below are attached once, not on
  // every render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!container) return;
    const el = container;

    const dayWidth = () => {
      const { leadingColumnWidth, dayCount } = optionsRef.current;
      return Math.max((el.scrollWidth - leadingColumnWidth) / dayCount, 1);
    };

    let wheelRemainder = 0;
    function handleWheel(event: WheelEvent) {
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (horizontal === 0) return;
      // When the planning is wider than its box (a narrow screen), let the
      // browser scroll it natively first.
      if (el.scrollWidth > el.clientWidth + 1) return;
      event.preventDefault();
      wheelRemainder += horizontal;
      const days = Math.trunc(wheelRemainder / WHEEL_PX_PER_DAY);
      if (days !== 0) {
        wheelRemainder -= days * WHEEL_PX_PER_DAY;
        optionsRef.current.onShift(days);
      }
    }

    let drag: { pointerId: number; startX: number; appliedDays: number; active: boolean } | null = null;
    let suppressClick = false;

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      drag = { pointerId: event.pointerId, startX: event.clientX, appliedDays: 0, active: false };
    }

    function handlePointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      if (!drag.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        el.setPointerCapture(event.pointerId);
        el.dataset.panning = 'true';
      }
      // Dragging right pulls the past into view, like any timeline.
      const days = -Math.round(dx / dayWidth());
      if (days !== drag.appliedDays) {
        optionsRef.current.onShift(days - drag.appliedDays);
        drag.appliedDays = days;
      }
    }

    function endDrag(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.active) {
        suppressClick = true;
        // The browser may not fire that click at all (pointer released
        // outside any element) — never let the flag swallow a later one.
        setTimeout(() => {
          suppressClick = false;
        }, 0);
        delete el.dataset.panning;
      }
      drag = null;
    }

    // The click that ends a drag must not also open a rental or a form.
    function handleClickCapture(event: MouseEvent) {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('click', handleClickCapture, true);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('click', handleClickCapture, true);
    };
  }, [container]);
}
