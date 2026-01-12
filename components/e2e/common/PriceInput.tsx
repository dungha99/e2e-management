"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { AlertTriangle } from "lucide-react"

interface PriceInputProps {
    id?: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    autoFocus?: boolean
    showDescription?: boolean
}

/**
 * Checks if the input contains more than 4 digits
 */
function hasExcessiveDigits(value: string): boolean {
    // Count only numeric digits
    const digitCount = (value.match(/\d/g) || []).length
    return digitCount > 4
}

export function PriceInput({
    id,
    value,
    onChange,
    placeholder = "VD: 500 = 500 triệu",
    className = "",
    autoFocus = false,
    showDescription = true,
}: PriceInputProps) {
    const [showWarning, setShowWarning] = useState(false)

    useEffect(() => {
        setShowWarning(hasExcessiveDigits(value))
    }, [value])

    return (
        <div className="flex flex-col gap-1">
            <div className="relative">
                <Input
                    id={id}
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${className} pr-14`}
                    autoFocus={autoFocus}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                    triệu
                </span>
            </div>
            {showDescription && (
                <p className="text-[11px] text-gray-500">
                    Chỉ cần nhập 3 hoặc 4 số không cần nhập đủ số 0. VD: nhập 500 sẽ = 500 triệu
                </p>
            )}
            {showWarning && (
                <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    <p className="text-[11px]">
                        Bạn chỉ cần nhập 3-4 số. VD: nhập 500 thay vì 500000000
                    </p>
                </div>
            )}
        </div>
    )
}
