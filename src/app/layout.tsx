import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CompanyProvider } from "@/lib/company-context";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "StockFlow — Inventory Management",
  description: "Track products, stock levels, suppliers and orders in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <CompanyProvider>
            {children}
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          </CompanyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
