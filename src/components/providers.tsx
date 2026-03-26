'use client'

import { ReactNode } from 'react'
import { ToastProvider } from './toast'
import { ConfirmProvider } from './confirm-modal'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
