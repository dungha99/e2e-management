"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Pencil, Check, X, Loader2 } from "lucide-react"

interface NoteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    leadId: string | null
    leadName: string | null
    carId: string | null
    initialNotes?: string
    onSave?: (notes: string) => Promise<void>
}

export function NoteDialog({
    open,
    onOpenChange,
    leadId,
    leadName,
    carId,
    initialNotes = "",
    onSave,
}: NoteDialogProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [notes, setNotes] = useState(initialNotes)
    const [editedNotes, setEditedNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)

    // Fetch notes when dialog opens
    useEffect(() => {
        if (open && leadId) {
            fetchNotes()
        }
    }, [open, leadId])

    const fetchNotes = async () => {
        if (!leadId) return

        setLoading(true)
        try {
            const response = await fetch(`/api/e2e/leads/${leadId}/notes`)
            if (response.ok) {
                const data = await response.json()
                setNotes(data.notes || "")
            }
        } catch (error) {
            console.error("Error fetching notes:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleStartEdit = () => {
        setEditedNotes(notes)
        setIsEditing(true)
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedNotes("")
    }

    const handleSave = async () => {
        if (!carId || !leadId) return

        setSaving(true)
        try {
            const response = await fetch("/api/e2e/update-sale-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    carId,
                    leadId,
                    notes: editedNotes,
                    previousValues: {
                        notes: notes,
                    }
                })
            })

            if (response.ok) {
                setNotes(editedNotes)
                setIsEditing(false)
                setEditedNotes("")
                onSave?.(editedNotes)
            }
        } catch (error) {
            console.error("Error saving notes:", error)
        } finally {
            setSaving(false)
        }
    }

    const handleClose = () => {
        setIsEditing(false)
        setEditedNotes("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Ghi chú - {leadName || "Lead"}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : isEditing ? (
                        <div className="space-y-4">
                            <Textarea
                                value={editedNotes}
                                onChange={(e) => setEditedNotes(e.target.value)}
                                placeholder="Nhập ghi chú..."
                                className="min-h-[200px] text-sm resize-none"
                                autoFocus
                            />
                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Hủy
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-1" />
                                            Lưu
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="min-h-[150px] max-h-[300px] overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
                                {notes ? (
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{notes}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Chưa có ghi chú</p>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleStartEdit}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Sửa ghi chú
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
