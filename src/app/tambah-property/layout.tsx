import { ReactNode } from 'react';
import './hide-layout.css'; // ✅ Import custom CSS

export default function TambahPropertyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="hide-header-footer min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {children}
    </div>
  );
}
