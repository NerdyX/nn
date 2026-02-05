// src/components/header/nav.config.ts
// (or place it wherever makes sense in your project structure)

export type NavItem = {
  id: string;
  label: string;
  href?: string; // optional - if not provided, can fall back to /${id}
  icon?: string; // optional - for future icon support (e.g. lucide icons)
  pages?: string[]; // routes or patterns where this item should appear
  min?: "mobile" | "md" | "lg"; // minimum breakpoint to show the item
};

export const NAV_ITEMS: NavItem[] = [
  // Always visible basics
  {
    id: "home",
    label: "Home",
    href: "/",
    pages: ["*"], // show everywhere
    min: "mobile",
  },
  {
    id: "explorer",
    label: "Explorer",
    href: "/explorer",
    pages: ["/explorer", "/explorer/*"],
    min: "mobile",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/marketplace",
    pages: ["/marketplace", "/marketplace/*"],
    min: "mobile",
  },

  // Marketplace-specific sub-features (visible on larger screens)
  {
    id: "featured",
    label: "Featured",
    pages: ["/marketplace", "/marketplace/*"],
    min: "lg",
  },
  {
    id: "trending",
    label: "Trending",
    pages: ["/marketplace", "/marketplace/*"],
    min: "lg",
  },
  {
    id: "stats",
    label: "Stats",
    pages: ["/marketplace", "/marketplace/*"],
    min: "lg",
  },

  // Dashboard / protected area items
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    pages: ["/dashboard", "/dashboard/*"],
    min: "md",
  },
  {
    id: "ledger",
    label: "Ledger",
    href: "/ledger",
    pages: ["/ledger", "/dashboard", "/dashboard/*"],
    min: "md",
  },

  // Optional: add more context-specific items later
  // Example:
  // {
  //   id: "analytics",
  //   label: "Analytics",
  //   pages: ["/dashboard/analytics", "/dashboard/*"],
  //   min: "lg",
  // },
];
