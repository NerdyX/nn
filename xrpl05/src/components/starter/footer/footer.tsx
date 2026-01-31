import { component$ } from "@builder.io/qwik";

import styles from "./footer.module.css";

export default component$(() => {
  return (
    <footer>
      <div class="container">
        <a
          href="https://www.nrdxlab.com/"
          target="_blank"
          class={styles.anchor}
        >
          <span>Made with ♡ by {"{NRDX}"}Labs</span>
          <span class={styles.spacer}>|</span>
        </a>
      </div>
    </footer>
  );
});
