export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-black/80 px-6 py-24 text-center text-zinc-200">
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">404</p>
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">Page not found</h1>
      <p className="max-w-md text-base text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved. Head back to the homepage to continue exploring Medclara.
      </p>
      <a
        href="#home"
        className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20"
      >
        Return home
      </a>
    </main>
  );
}
