import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Shown above the onboarding form to explain the two-password model. */
export function FirstRunExplainer() {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-base">Two passwords, two jobs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Account password</strong> signs
          you in. The server verifies it.
        </p>
        <p>
          <strong className="text-foreground">Master password</strong> encrypts
          your vault. It never leaves this device, and the server never sees it.
        </p>
        <p className="font-medium text-amber-700 dark:text-amber-400">
          If you forget your master password, your data cannot be recovered.
          There is no reset. Choose something strong that you will remember.
        </p>
      </CardContent>
    </Card>
  );
}
