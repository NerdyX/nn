import { component$ } from "@builder.io/qwik";

export default component$(() => {
  return (
    <div class="container">
      <video src="/media/bg_vid.mp4" autoplay loop muted />
      <h1>
        The <span class="highlight text-teal-500">Fastest</span>{" "}
        <span class="highlight text-teal-500">Safest</span> Terminal <br /> for
        the XRPL &amp; Xahau Network.
      </h1>
      <p>A sovereign interface for sovereign transactions.</p>
      <div class="button-group">
        <button
          onClick$={() => console.log("It works!")}
          class="button button-dark"
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
});
