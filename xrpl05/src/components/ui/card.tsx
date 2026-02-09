import { component$, Slot } from "@builder.io/qwik";
import { cn } from "~/lib/utils";

export const Card = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div
    class={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  >
    <Slot />
  </div>
));

export const CardHeader = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div class={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
    <Slot />
  </div>
));

export const CardTitle = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div
    class={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  >
    <Slot />
  </div>
));

export const CardDescription = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div class={cn("text-sm text-muted-foreground", className)} {...props}>
    <Slot />
  </div>
));

export const CardContent = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div class={cn("p-6 pt-0", className)} {...props}>
    <Slot />
  </div>
));

export const CardFooter = component$<{
  class?: string;
  [key: string]: any;
}>(({ class: className, ...props }) => (
  <div class={cn("flex items-center p-6 pt-0", className)} {...props}>
    <Slot />
  </div>
));
