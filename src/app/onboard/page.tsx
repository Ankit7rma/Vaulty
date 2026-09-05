import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { FirstRunExplainer } from '@/components/vault/first-run-explainer';
import { OnboardForm } from '@/components/vault/onboard-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function OnboardPage() {
  const user = await requireUser();
  if (user.onboarded) redirect('/unlock');

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <FirstRunExplainer />
        <Card>
          <CardHeader>
            <CardTitle>Set your master password</CardTitle>
            <CardDescription>
              This encrypts your vault and never leaves your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
