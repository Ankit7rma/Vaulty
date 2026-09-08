import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { SignupForm } from '@/components/auth/signup-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? '/unlock' : '/onboard');

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your Vaulty account"
      description="Start with your account login. You will set a master password next."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
