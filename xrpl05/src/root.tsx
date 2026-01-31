import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head/router-head";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <RouterHead />
      </head>
      <body lang="en" class="flex flex-col min-h-screen">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});

export const BackgroundVideo = component$(() => {
  return (
    <video
      id="bg-video"
      class="absolute inset-0 w-full h-full mx-auto object-cover"
      autoplay
      muted
      loop
      playsInline
      preload="metadata"
    >
      <source src="/media/bg_vid.mp4" type="video/mp4" />
    </video>
  );
});
