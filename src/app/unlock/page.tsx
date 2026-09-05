import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { UnlockForm } from '@/components/vault/unlock-form';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function UnlockPage() {
  const user = await requireUser();
  if (!user.onboarded) redirect('/onboard');

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Unlock your vault</CardTitle>
          <CardDescription>
            Enter the master password for {user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UnlockForm />
          <div className="flex justify-center">
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
