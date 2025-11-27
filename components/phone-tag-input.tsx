"use client"

import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface PhoneTagInputProps {
  phones: string[]
  onChange: (phones: string[]) => void
  placeholder?: string
}

export function PhoneTagInput({ phones, onChange, placeholder }: PhoneTagInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  function validatePhone(phone: string): boolean {
    // Vietnamese phone format: starts with 0, 10 digits
    const phoneRegex = /^0\d{9}$/
    return phoneRegex.test(phone)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      addPhone()
    } else if (e.key === "Backspace" && inputValue === "" && phones.length > 0) {
      // Remove last phone when backspace is pressed on empty input
      removePhone(phones.length - 1)
    }
  }

  function addPhone() {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    if (!validatePhone(trimmed)) {
      setError("SĐT không hợp lệ (phải bắt đầu bằng 0 và có 10 số)")
      return
    }

    if (phones.includes(trimmed)) {
      setError("SĐT đã tồn tại")
      return
    }

    onChange([...phones, trimmed])
    setInputValue("")
    setError(null)
  }

  function removePhone(index: number) {
    onChange(phones.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-background min-h-[100px]">
        {phones.map((phone, index) => (
          <Badge key={index} variant="secondary" className="h-7 px-2 gap-1">
            <span className="font-mono text-xs">{phone}</span>
            <button type="button" onClick={() => removePhone(index)} className="ml-1 hover:bg-muted rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          onBlur={addPhone}
          placeholder={phones.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-7"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Nhấn Enter hoặc Tab để thêm SĐT. SĐT phải bắt đầu bằng 0 và có 10 số.
      </p>
    </div>
  )
}
