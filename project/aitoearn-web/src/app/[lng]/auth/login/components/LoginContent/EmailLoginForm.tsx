/**
 * EmailLoginForm - 邮箱密码登录表单
 */

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { emailPasswordLoginApi } from '@/api/auth'
import { useTransClient } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { useUserStore } from '@/store/user'

interface EmailLoginFormProps {
  /** 弹框模式：登录成功回调，替代 router.push */
  onLoginSuccess?: () => void
  /** 覆盖 searchParams 的 redirect */
  redirectUrl?: string
  /** 覆盖 searchParams 的 inviteCode */
  inviteCode?: string
  /** @deprecated 密码登录模式不再显示 Google 登录 */
  showGoogleLogin?: boolean
}

interface EmailLoginFormData {
  email: string
  password: string
}

export function EmailLoginForm({
  onLoginSuccess,
  redirectUrl,
  inviteCode: _inviteCodeProp,
  showGoogleLogin: _showGoogleLogin = false,
}: EmailLoginFormProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ lng?: string }>()
  const lng = params.lng || 'en'
  const redirect = redirectUrl ?? searchParams.get('redirect')
  const { setToken, setUserInfo } = useUserStore()
  const { t } = useTransClient('login')

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
        password: z.string().min(1, t('passwordRequired')),
      }),
    [t],
  )

  const form = useForm<EmailLoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  /** 邮箱密码登录 */
  const handleSubmit = async (data: EmailLoginFormData) => {
    try {
      const res = await emailPasswordLoginApi({ mail: data.email, password: data.password })
      if (!res)
        return

      if (res.code === 0 && res.data.token) {
        setToken(res.data.token)
        if (res.data.userInfo) {
          setUserInfo(res.data.userInfo)
        }
        toast.success(t('loginSuccess'))
        if (onLoginSuccess) {
          onLoginSuccess()
        }
        else {
          router.push(redirect || `/${lng}`)
        }
      }
      else {
        toast.error(res.message || t('loginFailed'))
      }
    }
    catch {
      toast.error(t('loginError'))
    }
  }

  return (
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
        <Input
          type="password"
          autoComplete="current-password"
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

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="h-12 w-full cursor-pointer rounded-xl text-base font-medium"
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          t('login')
        )}
      </Button>
    </form>
  )
}
