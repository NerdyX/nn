// src/routes/dashboard/layout.tsx
import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { useXamanSession } from "~/routes/layout"; // from root layout

export const useProtectedSession = routeLoader$(
  async ({ resolveValue, redirect }) => {
    const session = await resolveValue(useXamanSession);

    if (!session.connected) {
      throw redirect(302, "/?error=auth_required"); // or to a dedicated login page
    }

    return session;
  },
);

export default component$(() => {
  //const session = useProtectedSession(); // this will redirect if not connected

  return (
    <div class="min-h-screen bg-gray-50">
      {/* You can show a small banner or something if you want */}
      <div class="container mx-auto px-4 py-6">
        <Slot /> {/* The actual dashboard page content goes here */}
      </div>
    </div>
  );
});
