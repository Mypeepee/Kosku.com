"use client";

import { usePathname } from "next/navigation";
import Footer from "./index";

export default function FooterWrapper() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  if (isDashboard) return null;
  return <Footer />;
}
