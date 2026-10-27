'use client';

import { loginSchema, registerSchema } from '@evalpilot/shared';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { API_URL, ApiError } from '@/lib/api';
import { useLogin, useProviders, useRegister } from '@/lib/queries';
import { zodResolver } from '@/lib/zod-resolver';
import { GithubMark } from '../icons';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/field';

export const DEMO = { email: 'demo@evalpilot.dev', password: 'evalpilot-demo-2026' };

/** Only allow same-site paths as ?next= targets (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/app') && !next.startsWith('//') ? next : '/app';
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  return (
    <p
      role="alert"
      data-testid="auth-error"
      className="rounded-sm border border-[color-mix(in_oklab,var(--fail)_40%,transparent)] bg-[color-mix(in_oklab,var(--fail)_8%,transparent)] px-3 py-2 text-sm text-fail"
    >
      {message}
    </p>
  );
}

function GithubButton() {
  const providers = useProviders();
  if (!providers.data?.github) return null;
  return (
    <>
      <Button asChild className="w-full" data-testid="github-login">
        <a href={`${API_URL}/api/auth/github`}>
          <GithubMark className="size-4" /> Continue with GitHub
        </a>
      </Button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="label-mono">OR</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  useEffect(() => {
    if (params.get('demo') === '1') form.reset(DEMO);
  }, [params, form]);

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => router.push(safeNext(params.get('next'))) }),
  );

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="label-mono text-signal">SIGN IN</p>
        <h1 className="text-[32px] font-medium">Welcome back</h1>
        <p className="text-muted">Sign in to your flight deck.</p>
      </div>
      <GithubButton />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
        <Field id="login-email" label="Email" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            data-testid="login-email"
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
        </Field>
        <Field id="login-password" label="Password" error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            data-testid="login-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register('password')}
          />
        </Field>
        <FormError error={login.error} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={login.isPending}
          data-testid="login-submit"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'} <ArrowRight />
        </Button>
      </form>
      <div className="panel flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="label-mono">DEMO ACCOUNT</div>
          <div className="num truncate text-[12px] text-text">{DEMO.email}</div>
        </div>
        <Button size="sm" onClick={() => form.reset(DEMO)} data-testid="demo-fill">
          Use demo
        </Button>
      </div>
      <p className="text-sm text-muted">
        New here?{' '}
        <Link href="/register" className="text-signal underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, { onSuccess: () => router.push('/app') }),
  );

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="label-mono text-signal">CREATE ACCOUNT</p>
        <h1 className="text-[32px] font-medium">Start testing your AI</h1>
        <p className="text-muted">Free, local and in mock AI mode until you add a key.</p>
      </div>
      <GithubButton />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
        <Field id="register-name" label="Name" error={errors.name?.message}>
          <Input
            id="register-name"
            autoComplete="name"
            data-testid="register-name"
            aria-invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
        </Field>
        <Field id="register-email" label="Email" error={errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            data-testid="register-email"
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
        </Field>
        <Field
          id="register-password"
          label="Password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.password?.message}
        >
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            data-testid="register-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register('password')}
          />
        </Field>
        <FormError error={register.error} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={register.isPending}
          data-testid="register-submit"
        >
          {register.isPending ? 'Creating account…' : 'Create account'} <ArrowRight />
        </Button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-signal underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
