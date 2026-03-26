'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: async () => false })

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((res) => {
      setOptions(opts)
      setResolve(() => res)
    })
  }, [])

  const handleConfirm = () => {
    resolve?.(true)
    setOptions(null)
    setResolve(null)
  }

  const handleCancel = () => {
    resolve?.(false)
    setOptions(null)
    setResolve(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[110]" onClick={handleCancel} />
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-scale-in">
              <h3 className="text-lg font-semibold text-gray-900">{options.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{options.message}</p>
              <div className="mt-5 flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                    options.variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  )
}
