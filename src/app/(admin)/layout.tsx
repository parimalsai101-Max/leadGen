import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10">{children}</div>
      </div>
    </div>
  );
}
