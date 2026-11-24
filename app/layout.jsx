import "./globals.css";

export const metadata = {
  title: "ZayFind — Search your Google Sheet",
  description: "Search any word across your Google Sheet — every tab, every column — and see matching rows instantly.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
