"use client"

import { useState } from "react"
import { Lock, Eye, EyeOff } from "lucide-react"

type PasswordInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function PasswordInput({ value, onChange, placeholder = "••••••••" }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative mt-1">
      <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
      <input
        type={visible ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-10 outline-none transition-colors focus:border-brand-green"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute right-3 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  )
}
