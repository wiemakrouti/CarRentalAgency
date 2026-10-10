import { useEffect, useState } from 'react';

// The live width of an element (from a callback ref), kept in sync with a
// ResizeObserver — for layouts that depend on the space a component actually
// gets (sidebar open or not), not on the window size.
export function useElementWidth(): [(element: HTMLElement | null) => void, number] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width];
}
