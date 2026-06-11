import type { ReactNode } from "react";

export const metadata = {
  title: "Project Receipt",
  description: "See exactly where your tax dollars went.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
