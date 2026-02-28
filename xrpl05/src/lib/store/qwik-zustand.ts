import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { StoreApi } from 'zustand';

/**
 * A generic hook to connect a Zustand store to Qwik's reactivity system.
 *
 * @param store - The Zustand store (can be vanilla or bound)
 * @returns A Qwik signal containing the current state
 */
export function useZustand<TState>(store: StoreApi<TState>) {
  // Initialize with the current state (runs on server and client)
  const state = useSignal<TState>(store.getState());

  // Subscribe to changes on the client only
  useVisibleTask$(({ cleanup }) => {
    const unsubscribe = store.subscribe((newState) => {
      state.value = newState;
    });

    cleanup(() => unsubscribe());
  });

  return state;
}

/**
 * A generic hook to connect a specific slice of a Zustand store to Qwik's reactivity system.
 * This optimizes updates by only triggering when the selected slice changes.
 *
 * @param store - The Zustand store
 * @param selector - Function to extract a specific slice of state
 * @returns A Qwik signal containing the selected state slice
 */
export function useZustandSelector<TState, TSlice>(
  store: StoreApi<TState>,
  selector: (state: TState) => TSlice
) {
  // Initialize with the selected state (runs on server and client)
  const state = useSignal<TSlice>(selector(store.getState()));

  // Subscribe to changes on the client only
  useVisibleTask$(({ cleanup }) => {
    const unsubscribe = store.subscribe((newState) => {
      const newSlice = selector(newState);
      // Only update the signal if the selected value has actually changed
      if (state.value !== newSlice) {
        state.value = newSlice;
      }
    });

    cleanup(() => unsubscribe());
  });

  return state;
}
