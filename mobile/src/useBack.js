import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// Android hardware back: while `enabled`, run `fn` instead of letting the OS close the app.
// RN calls listeners newest-first, so a sheet/search opened on top of a screen is dismissed before the screen itself.
export function useBack(enabled, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current(); return true; });
    return () => sub.remove();
  }, [enabled]);
}
