"use client"

import * as React from "react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subWeeks, subMonths, subYears } from "date-fns"
import { vi } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePreset {
    label: string
    getValue: () => DateRange
}

const datePresets: DatePreset[] = [
    {
        label: "Hôm nay",
        getValue: () => {
            const today = new Date()
            return { from: today, to: today }
        },
    },
    {
        label: "Hôm qua",
        getValue: () => {
            const yesterday = subDays(new Date(), 1)
            return { from: yesterday, to: yesterday }
        },
    },
    {
        label: "Tuần này",
        getValue: () => {
            const today = new Date()
            return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) }
        },
    },
    {
        label: "Tuần trước",
        getValue: () => {
            const lastWeek = subWeeks(new Date(), 1)
            return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
        },
    },
    {
        label: "7 ngày qua",
        getValue: () => {
            const today = new Date()
            return { from: subDays(today, 6), to: today }
        },
    },
    {
        label: "Tháng này",
        getValue: () => {
            const today = new Date()
            return { from: startOfMonth(today), to: endOfMonth(today) }
        },
    },
    {
        label: "Tháng trước",
        getValue: () => {
            const lastMonth = subMonths(new Date(), 1)
            return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
        },
    },
    {
        label: "Năm nay",
        getValue: () => {
            const today = new Date()
            return { from: startOfYear(today), to: today }
        },
    },
    {
        label: "Năm trước",
        getValue: () => {
            const lastYear = subYears(new Date(), 1)
            return { from: startOfYear(lastYear), to: new Date(lastYear.getFullYear(), 11, 31) }
        },
    },
]

interface DateRangePickerWithPresetsProps {
    className?: string
    dateRange: DateRange | undefined
    onDateRangeChange: (dateRange: DateRange | undefined) => void
    placeholder?: string
}

export function DateRangePickerWithPresets({
    className,
    dateRange,
    onDateRangeChange,
    placeholder = "Chọn khoảng thời gian",
}: DateRangePickerWithPresetsProps) {
    const [open, setOpen] = React.useState(false)
    const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null)

    const handlePresetClick = (preset: DatePreset) => {
        setSelectedPreset(preset.label)
        onDateRangeChange(preset.getValue())
    }

    const handleClear = () => {
        onDateRangeChange(undefined)
        setSelectedPreset(null)
    }

    const handleSave = () => {
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                                {format(dateRange.from, "dd/MM/yyyy", { locale: vi })} -{" "}
                                {format(dateRange.to, "dd/MM/yyyy", { locale: vi })}
                            </>
                        ) : (
                            format(dateRange.from, "dd/MM/yyyy", { locale: vi })
                        )
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                    {/* Preset section on the left */}
                    <div className="border-r p-2 flex flex-col gap-1 min-w-[140px]">
                        {datePresets.map((preset) => (
                            <Button
                                key={preset.label}
                                variant={selectedPreset === preset.label ? "secondary" : "ghost"}
                                size="sm"
                                className="justify-start h-8 text-sm"
                                onClick={() => handlePresetClick(preset)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>

                    {/* Calendar section on the right */}
                    <div className="p-2">
                        <Calendar
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={(range) => {
                                onDateRangeChange(range)
                                setSelectedPreset(null) // Clear preset when manually selecting
                            }}
                            numberOfMonths={2}
                            locale={vi}
                        />

                        {/* Footer with Clear and Save buttons */}
                        <div className="flex items-center justify-between border-t pt-3 mt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                className="h-8 text-muted-foreground"
                            >
                                <X className="mr-1 h-3 w-3" />
                                Bỏ lọc
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                className="h-8 bg-primary hover:bg-primary/90"
                                disabled={!dateRange?.from}
                            >
                                Lưu
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
