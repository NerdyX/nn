// XrplGlobe.tsx - Perfectly centered globe!
import { component$, useVisibleTask$, useSignal } from "@builder.io/qwik";

interface Props {
  width?: string | number;
  height?: string | number;
  class?: string;
}

export default component$((props: Props) => {
  const containerRef = useSignal<HTMLDivElement>();
  const globeRef = useSignal<any>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const container = containerRef.value;
    if (!container) return;

    if (!(window as any).Globe) {
      const script = document.createElement("script");
      script.src = "//cdn.jsdelivr.net/npm/globe.gl";
      document.head.appendChild(script);

      script.onload = () => initGlobe();
      return;
    }
    initGlobe();

    function initGlobe() {
      // GLOBE SIZED TO FIT PERFECTLY CENTERED
      const world = new (window as any).Globe(container)
        .backgroundColor("rgba(0,0,0,0.1)")
        .showGlobe(true)
        .showAtmosphere(true)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
        .atmosphereColor("lightblue")
        .atmosphereAltitude(0.2)
        .pointOfView({ altitude: 2.2 }, 1000); // Perfect center view

      globeRef.value = world;

      const arcsData = Array.from({ length: 12 }, () => ({
        startLat: (Math.random() - 0.5) * 180,
        startLng: (Math.random() - 0.5) * 360,
        endLat: (Math.random() - 0.5) * 180,
        endLng: (Math.random() - 0.5) * 360,
        color: ["#3b82f6", "#10b981"],
      }));

      world
        .arcsData(arcsData)
        .arcColor("color")
        .arcDashLength(0.12)
        .arcDashGap(0.04)
        .arcDashAnimateTime(() => Math.random() * 6000 + 2000);

      // XRPL Live
      const ws = new WebSocket("wss://s1.ripple.com:51234");
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            command: "subscribe",
            streams: ["transactions"],
          }),
        );

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.transaction?.TransactionType === "Payment") {
            arcsData.push({
              startLat: Math.random() * 180 - 90,
              startLng: Math.random() * 360 - 180,
              endLat: Math.random() * 180 - 90,
              endLng: Math.random() * 360 - 180,
              color: ["#ef4444", "#f59e0b"],
            });
            if (arcsData.length > 30) arcsData.shift();
            world.arcsData(arcsData);
          }
        } catch (e) {
          console.error("Error processing transaction:", e);
        }
      };
    }
  });

  return (
    <div
      class={`w-full h-full flex items-center justify-center p-4 bg-transparent rounded-2xl border border-white/10 overflow-hidden relative group`}
      style={{
        width:
          typeof props.width === "number" ? `${props.width}px` : props.width,
        height:
          typeof props.height === "number" ? `${props.height}px` : props.height,
      }}
    >
      {/* Glow border */}
      <div class="absolute inset-0 bg-linear-to-r from-blue-500/30 via-purple-500/30 to-cyan-500/30 rounded-2xl blur-xl animate-pulse -z-10" />

      {/* PERFECTLY CENTERED GLOBE CONTAINER */}
      <div
        ref={containerRef}
        class="w-11/12 h-11/12 max-w-full max-h-full flex items-center justify-center bg-transparent rounded-xl border border-white/20"
      />

      {/* Status */}
      <div class="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white/95 px-2.5 py-1 rounded-full text-xs font-medium border border-white/30 shadow-lg">
        🌐 Live XRPL
      </div>

      {/* Resize handle */}
      <div class="absolute bottom-2 right-2 w-5 h-5 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 rounded-full border-2 border-white/50 cursor-se-resize transition-all shadow-md hover:shadow-lg hover:scale-110" />
    </div>
  );
});
