"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"

interface CreateThreadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fourDigitsInput: string
  setFourDigitsInput: (value: string) => void
  firstMessageInput: string
  setFirstMessageInput: (value: string) => void
  sendZns?: boolean
  setSendZns?: (value: boolean) => void
  handleCreateThread: () => void
  createThreadLoading: boolean
}

export function CreateThreadDialog({
  open,
  onOpenChange,
  fourDigitsInput,
  setFourDigitsInput,
  firstMessageInput,
  setFirstMessageInput,
  sendZns = false,
  setSendZns,
  handleCreateThread,
  createThreadLoading,
}: CreateThreadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo thread mới</DialogTitle>
          <DialogDescription>
            Nhập 4 số cuối điện thoại của khách hàng để tạo thread chat mới.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fourDigits" className="text-right">
              4 số cuối SĐT
            </Label>
            <Input
              id="fourDigits"
              value={fourDigitsInput}
              onChange={(e) => {
                // Only allow digits and max 4 characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                setFourDigitsInput(value)
              }}
              placeholder="1234"
              className="col-span-3"
              maxLength={4}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstMessage" className="text-right">
              Tin nhắn đầu
            </Label>
            <Input
              id="firstMessage"
              value={firstMessageInput}
              onChange={(e) => setFirstMessageInput(e.target.value)}
              placeholder="Hello"
              className="col-span-3"
            />
          </div>

          {setSendZns && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sendZns" className="text-right">
                Gửi ZNS
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="sendZns"
                  checked={sendZns}
                  onCheckedChange={setSendZns}
                />
                <Label htmlFor="sendZns" className="font-normal text-sm text-gray-500">
                  Gửi tin nhắn ZNS sau khi tạo
                </Label>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            Tên hiển thị: ******{fourDigitsInput || "XXXX"}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setFourDigitsInput("")
              setFirstMessageInput("Hello")
              if (setSendZns) setSendZns(false)
            }}
          >
            Hủy
          </Button>
          <Button
            onClick={handleCreateThread}
            disabled={createThreadLoading || fourDigitsInput.length !== 4}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {createThreadLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              "Bắt đầu"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
