import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { LoginForm } from '@/components/auth/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? '/unlock' : '/onboard');

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Vaulty</CardTitle>
          <CardDescription>
            Use your account password. Your master password comes next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-sm text-muted-foreground">
            No account yet?{' '}
            <Link href="/signup" className="font-medium underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
