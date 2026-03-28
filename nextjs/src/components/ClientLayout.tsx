"use client";

import { StoreProvider } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import { ReactNode } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 md:ml-0">
          <div className="max-w-2xl mx-auto">{children}</div>
        </main>
      </div>
    </StoreProvider>
  );
}
