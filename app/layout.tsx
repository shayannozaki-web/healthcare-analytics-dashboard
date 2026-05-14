import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Healthcare Analytics",
  description:
    "Internal analytics dashboard for healthcare operations. Synthetic data only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 overflow-x-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
