'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { useLogin } from './hooks';

export function LoginForm({ nextPath }: { nextPath?: string }) {
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
                <Input type="email" autoComplete="email" placeholder="nome@exemplo.com" {...field} />
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
<<<<<<< Updated upstream
                <Input type="password" autoComplete="current-password" {...field} />
=======
                <PasswordInput autoComplete="current-password" placeholder="Sua senha" {...field} />
>>>>>>> Stashed changes
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
