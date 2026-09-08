import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { LoginForm } from '@/components/auth/login-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? '/unlock' : '/onboard');

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Vaulty"
      description="Use your account password. Your master password comes next."
      footer={
        <>
          No account yet?{' '}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
