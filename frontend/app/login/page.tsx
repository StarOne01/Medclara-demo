import { Suspense } from "react";
import { Nav } from "@/components/nav";
import LoginFormContent from "@/app/login/login-form-content";

function LoginPageFallback() {
  return (
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.35),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(63,63,70,0.25),transparent_60%)]">
      <Nav />
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-20 sm:py-24">
        <div className="text-center">Loading...</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginFormContent />
    </Suspense>
  );
}