// src/components/ui/network-toggle.tsx
import { component$, $ } from "@builder.io/qwik";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { networkActions } from "~/lib/store/network";

export default component$(() => {
  const ctx = useNetworkContext();

  const toggle$ = $(() => {
    const next = ctx.activeNetwork.value === "xrpl" ? "xahau" : "xrpl";
    
    networkActions.setActiveNetwork(next);
    
  });

  const isXahau = ctx.activeNetwork.value === "xahau";
  const config = NETWORK_CONFIG[ctx.activeNetwork.value];

  return (
    <div class="flex items-center gap-3 rounded-2xl bg-transparent px-3 py-1.5">
      {/* Toggle */}
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          class="sr-only peer"
          checked={isXahau}
          onChange$={toggle$}
        />

        <div
          class={[
            "group relative h-9 w-[4.5rem] rounded-full shadow ring-0 duration-300",
            "after:absolute after:left-1 after:top-0.5 after:flex after:h-8 after:w-8",
            "after:items-center after:justify-center after:rounded-full after:bg-gray-50",
            "after:content-[''] after:duration-300 peer-hover:after:scale-95",
            isXahau
              ? "bg-yellow-400 after:translate-x-9"
              : "bg-purple-500 after:translate-x-0",
          ].join(" ")}
        >
          {/* Xahau icon (right side) */}
          <svg
            class="absolute right-1 top-0.5 h-8 w-8 stroke-gray-900"
            viewBox="0 0 100 100"
          >
            <path d="M50,18A19.9,19.9,0,0,0,30,38v8a8,8,0,0,0-8,8V74a8,8,0,0,0,8,8H70a8,8,0,0,0,8-8V54a8,8,0,0,0-8-8H38V38a12,12,0,0,1,23.6-3,4,4,0,1,0,7.8-2A20.1,20.1,0,0,0,50,18Z" />
          </svg>

          {/* XRPL icon (left side) */}
          <svg
            class="absolute left-1 top-0.5 h-8 w-8 stroke-gray-900"
            viewBox="0 0 100 100"
          >
            <path
              fill-rule="evenodd"
              d="M30,46V38a20,20,0,0,1,40,0v8a8,8,0,0,1,8,8V74a8,8,0,0,1-8,8H30a8,8,0,0,1-8-8V54A8,8,0,0,1,30,46Zm32-8v8H38V38a12,12,0,0,1,24,0Z"
            />
          </svg>
        </div>
      </label>

      {/* Divider */}
      <div class="h-7 w-px bg-neutral-800/30" />

      {/* Network Info */}
      <div class="flex flex-col text-xs leading-tight">
        <span class="font-semibold text-black">{config.label}</span>
        <code class="mt-0.5 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] text-emerald-400">
          {ctx.wsUrl.value}
        </code>
      </div>
    </div>
  );
});
