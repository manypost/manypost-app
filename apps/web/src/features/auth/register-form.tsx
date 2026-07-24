'use client';

import { useSignUp } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { sessionTaskPath, signUpAction } from './auth-flow';
import { ClerkCaptcha } from './clerk-captcha';
import { PasswordInput } from './password-input';
import { PasswordStrength } from './password-strength';

export function RegisterForm() {
  return <ClerkRegisterForm />;
}

function ClerkRegisterForm() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().email(tv('email')),
    password: z.string().min(12, tv('passwordMin')),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const passwordValue = form.watch('password');

  const finalize = async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl, session }) => {
        const url = decorateUrl(
          sessionTaskPath(session.currentTask?.key) ??
            '/auth/complete?de=%2Fboas-vindas',
        );
        if (url.startsWith('http')) window.location.href = url;
        else router.push(url);
      },
    });
  };

  if (verifying) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setNotice(null);
          const { error } = await signUp.verifications.verifyEmailCode({
            code: verificationCode.trim(),
          });
          if (error) return;
          if (
            signUpAction({
              status: signUp.status,
              missingFields: signUp.missingFields,
              unverifiedFields: signUp.unverifiedFields,
            }) === 'complete'
          ) {
            await finalize();
          } else {
            setNotice(t('authIncomplete'));
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="clerk-signup-code" className="text-[13px] font-medium text-ink">
            {t('verificationCode')}
          </label>
          <Input
            id="clerk-signup-code"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
          <p className="text-xs leading-relaxed text-graphite">{t('verificationHint')}</p>
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => signUp.verifications.sendEmailCode()}
          disabled={fetchStatus === 'fetching'}
        >
          {t('resendCode')}
        </Button>
      </form>
    );
  }

  const clerkError =
    errors.fields.emailAddress?.message ??
    errors.fields.password?.message ??
    errors.global?.[0]?.message ??
    notice;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async ({ email, password }) => {
          setNotice(null);
          const { error } = await signUp.password({ emailAddress: email, password });
          if (error) return;
          const action = signUpAction({
            status: signUp.status,
            missingFields: signUp.missingFields,
            unverifiedFields: signUp.unverifiedFields,
          });
          if (action === 'complete') {
            await finalize();
            return;
          }
          if (action === 'verify-email') {
            const sent = await signUp.verifications.sendEmailCode();
            if (!sent.error) {
              setVerifying(true);
              return;
            }
          }
          setNotice(t('authIncomplete'));
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrength value={passwordValue} />
              <FormDescription>{t('passwordHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <ClerkCaptcha />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          isLoading={fetchStatus === 'fetching'}
        >
          {t('registerCta')}
        </Button>
      </form>
    </Form>
  );
}
