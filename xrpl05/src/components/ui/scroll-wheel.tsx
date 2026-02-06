import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

interface ScrollWheelProps {
  items: string[];
  value: string;
  onChange$: (value: string) => void;
}

export const ScrollWheel = component$<ScrollWheelProps>(
  ({ items, value, onChange$ }) => {
    const containerRef = useSignal<HTMLDivElement>();
    const activeIndex = useSignal(items.indexOf(value));

    useVisibleTask$(() => {
      const el = containerRef.value;
      if (!el) return;

      const itemHeight = 48; // px
      el.scrollTop = activeIndex.value * itemHeight;
    });

    return (
      <div class="relative flex flex-col items-center">
        {/* Scrollable container */}
        <div
          ref={containerRef}
          class="overflow-y-auto h-48 w-32 rounded-xl border border-gray-300 shadow-inner"
          onScroll$={() => {
            const el = containerRef.value!;
            const index = Math.round(el.scrollTop / 48);

            if (index !== activeIndex.value) {
              activeIndex.value = index;
              onChange$(items[index]);

              if ("vibrate" in navigator) navigator.vibrate(8);
            }
          }}
        >
          {items.map((item, i) => (
            <div
              key={item}
              class={`h-12 flex items-center justify-center text-center ${
                i === activeIndex.value
                  ? "text-white font-semibold bg-gray-700"
                  : "text-gray-400"
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Highlight bar */}
        <div class="pointer-events-none absolute top-1/2 left-0 h-12 w-full -translate-y-1/2 border-t border-b border-gray-500" />
      </div>
    );
  },
);
