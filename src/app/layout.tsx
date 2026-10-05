import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Costing — Cost, Price & Profit Calculator",
  description:
    "A generic costing calculator for products, services, projects, and everything in between.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
