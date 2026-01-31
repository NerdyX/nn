// src/components/NetworkToggle.tsx
import { $, component$, useContext, useSignal } from "@builder.io/qwik";
import { NetworkContext } from "~/routes/layout"; // adjust path if needed

export const NetworkToggle = component$(() => {
  const { activeNetwork } = useContext(NetworkContext);

  // Checkbox checked = Xahau, unchecked = XRPL
  const isXahau = useSignal(activeNetwork.value === "xahau");

  // Sync signal with checkbox
  const handleToggle = $((event: InputEvent) => {
    const checked = (event.target as HTMLInputElement).checked;
    activeNetwork.value = checked ? "xahau" : "xrpl";
    isXahau.value = checked;
  });

  // Initial sync
  if (typeof window !== "undefined") {
    isXahau.value = activeNetwork.value === "xahau";
  }

  return (
    <div class="network-toggle-wrapper">
      <span class="network-toggle-label">
        {isXahau.value ? "Xahau" : "XRPL"}
      </span>

      <label class="toggle-switch">
        <input
          type="checkbox"
          checked={isXahau.value}
          onInput$={handleToggle}
        />
        <div class="toggle-switch-background">
          <div class="toggle-switch-handle"></div>
        </div>
      </label>
    </div>
  );
});
