import { useEffect, useState } from 'react';

export function useLocalStorageState(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultValue : stored === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}
