'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { emailPasswordRegisterApi, sendEmailRegisterCodeApi } from '@/api/auth'
import { useTransClient } from '@/app/i18n/client'
import logo from '@/assets/images/logo.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { useUserStore } from '@/store/user'

import { useCountdown } from '../../login/components/LoginContent/useCountdown'

const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

interface RegisterFormData {
  email: string
  code: string
  password: string
  confirmPassword: string
}

export default function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ lng?: string }>()
  const lng = params.lng || 'en'
  const redirect = searchParams.get('redirect')
  const { setToken, setUserInfo } = useUserStore()
  const { t } = useTransClient('login')
  const { countdown, isCounting, start } = useCountdown()
  const [isSendingCode, setIsSendingCode] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
        code: z.string().length(6, t('emailCodeLength')),
        password: z.string().min(1, t('passwordRequired')).min(8, t('passwordMinLength')),
        confirmPassword: z.string().min(1, t('confirmPasswordRequired')),
      }).refine(data => data.password === data.confirmPassword, {
        path: ['confirmPassword'],
        message: t('passwordMismatch'),
      }),
    [t],
  )

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      code: '',
      password: '',
      confirmPassword: '',
    },
  })

  const handleSendCode = async () => {
    const isEmailValid = await form.trigger('email')
    if (!isEmailValid)
      return

    setIsSendingCode(true)
    try {
      const res = await sendEmailRegisterCodeApi({ mail: form.getValues('email') })
      if (res?.code === 0) {
        start()
        toast.success(res.data ? `${t('codeSentSuccess')}: ${res.data}` : t('codeSentSuccess'))
      }
      else {
        toast.error(res?.message || t('codeSendFailed'))
      }
    }
    catch {
      toast.error(t('codeSendFailed'))
    }
    finally {
      setIsSendingCode(false)
    }
  }

  const handleSubmit = async (data: RegisterFormData) => {
    try {
      const res = await emailPasswordRegisterApi({
        mail: data.email,
        code: data.code,
        password: data.password,
      })
      if (!res)
        return

      if (res.code === 0 && res.data.token) {
        setToken(res.data.token)
        if (res.data.userInfo) {
          setUserInfo(res.data.userInfo)
        }
        toast.success(t('registerSuccess'))
        router.push(redirect || `/${lng}`)
      }
      else {
        toast.error(res.message || t('registerFailed'))
      }
    }
    catch {
      toast.error(t('registerError'))
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-muted">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute left-6 top-6 z-20">
        <Link
          href={`/${lng}`}
          className="flex items-center gap-2 text-foreground no-underline transition-opacity hover:opacity-80"
        >
          <Image src={logo} alt="AitoBee" width={28} height={28} />
          <span className="text-lg font-semibold tracking-tight">AitoBee</span>
        </Link>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.2 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 flex flex-col items-center">
            <Link
              href={`/${lng}`}
              className="mb-6 flex h-20 w-20 items-center justify-center transition-opacity hover:opacity-80"
            >
              <Image
                src={logo}
                alt="AitoBee"
                width={72}
                height={72}
                className="drop-shadow-md"
              />
            </Link>
            <p className="mt-2 text-muted-foreground">{t('registerSubtitle')}</p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Input
                type="email"
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                {...form.register('email')}
                className="h-12 rounded-xl border-input bg-background px-4 text-base placeholder:text-muted-foreground/70 focus:border-ring focus:ring-0"
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t('enterCode')}
                  maxLength={6}
                  {...form.register('code')}
                  className="h-12 flex-1 rounded-xl border-input bg-background px-4 text-base placeholder:text-muted-foreground/70 focus:border-ring focus:ring-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCounting || isSendingCode}
                  onClick={handleSendCode}
                  className="h-12 min-w-[112px] rounded-xl px-4 text-base"
                >
                  {isSendingCode && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCounting ? `${countdown}s` : t('sendCode')}
                </Button>
              </div>
              {form.formState.errors.code && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            <div>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t('passwordPlaceholder')}
                {...form.register('password')}
                className="h-12 rounded-xl border-input bg-background px-4 text-base placeholder:text-muted-foreground/70 focus:border-ring focus:ring-0"
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t('confirmPasswordPlaceholder')}
                {...form.register('confirmPassword')}
                className="h-12 rounded-xl border-input bg-background px-4 text-base placeholder:text-muted-foreground/70 focus:border-ring focus:ring-0"
              />
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-12 w-full rounded-xl text-base font-medium"
            >
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('register')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('loginLinkText')}
            {' '}
            <Link href={`/${lng}/auth/login`} className="font-medium text-primary hover:underline">
              {t('loginLinkAction')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
