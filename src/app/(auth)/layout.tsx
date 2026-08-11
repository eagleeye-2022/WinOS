export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="dsm-scope flex min-h-screen items-center justify-center bg-background text-foreground">
      {children}
    </main>
  );
}
