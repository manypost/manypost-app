'use client';

import { useSignIn } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useApiErrorMessage } from '@/lib/api/errors';
import { sessionTaskPath, signInAction } from './auth-flow';
import { useLogin } from './hooks';
import { PasswordInput } from './password-input';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function LoginForm(props: { nextPath?: string }) {
  return clerkEnabled ? <ClerkLoginForm {...props} /> : <LegacyLoginForm {...props} />;
}

function LegacyLoginForm({ nextPath }: { nextPath?: string }) {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const errorMessage = useApiErrorMessage();
  const login = useLogin(nextPath);

  const schema = z.object({
    email: z.string().email(tv('email')),
    password: z.string().min(12, tv('passwordMin')),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-4"
        noValidate
      >
        {login.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{errorMessage(login.error)}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={login.isPending}>
          {t('loginCta')}
        </Button>
      </form>
    </Form>
  );
}

function ClerkLoginForm({ nextPath }: { nextPath?: string }) {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().email(tv('email')),
    password: z.string().min(12, tv('passwordMin')),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const destination = nextPath ?? '/calendario';
  const finalize = async () => {
    await signIn.finalize({
      navigate: ({ decorateUrl, session }) => {
        const target =
          sessionTaskPath(session.currentTask?.key) ??
          `/auth/complete?de=${encodeURIComponent(destination)}`;
        const url = decorateUrl(target);
        if (url.startsWith('http')) window.location.href = url;
        else router.push(url);
      },
    });
  };

  const continueFromStatus = async () => {
    const action = signInAction(signIn.status);
    if (action === 'complete') {
      await finalize();
      return;
    }
    if (action === 'additional-verification') {
      const emailCode = signIn.supportedSecondFactors.some(
        (factor) => factor.strategy === 'email_code',
      );
      if (emailCode) {
        const { error } = await signIn.mfa.sendEmailCode();
        if (!error) {
          setNeedsMfa(true);
          setNotice(null);
          return;
        }
      }
      setNotice(t('additionalVerification'));
      return;
    }
    setNotice(t('authIncomplete'));
  };

  if (needsMfa) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setNotice(null);
          const { error } = await signIn.mfa.verifyEmailCode({ code: mfaCode.trim() });
          if (error) return;
          await continueFromStatus();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="clerk-mfa-code" className="text-[13px] font-medium text-ink">
            {t('verificationCode')}
          </label>
          <Input
            id="clerk-mfa-code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </div>
        {errors.fields.code || notice ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{errors.fields.code?.message ?? notice}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" className="w-full" isLoading={fetchStatus === 'fetching'}>
          {t('verifyCta')}
        </Button>
      </form>
    );
  }

  const clerkError =
    errors.fields.identifier?.message ??
    errors.fields.password?.message ??
    errors.global?.[0]?.message ??
    notice;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async ({ email, password }) => {
          setNotice(null);
          const { error } = await signIn.password({ emailAddress: email, password });
          if (!error) await continueFromStatus();
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        {clerkError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{clerkError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          isLoading={fetchStatus === 'fetching'}
        >
          {t('loginCta')}
        </Button>
      </form>
    </Form>
  );
}
