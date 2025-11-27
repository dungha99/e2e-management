"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const CORRECT_PASSKEY = "Ilovedecoy2025"

interface PasskeyGateProps {
  onAuthenticated: () => void
}

export function PasskeyGate({ onAuthenticated }: PasskeyGateProps) {
  const [passkey, setPasskey] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsChecking(true)

    setTimeout(() => {
      if (passkey === CORRECT_PASSKEY) {
        localStorage.setItem("decoy_authenticated", "true")
        onAuthenticated()
      } else {
        toast({
          title: "Mật khẩu sai",
          description: "Vui lòng nhập lại",
          variant: "destructive",
        })
        setPasskey("")
      }
      setIsChecking(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Decoy Campaign Manager</CardTitle>
          <CardDescription>Vui lòng nhập passkey để truy cập hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập passkey..."
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  disabled={isChecking}
                  className="text-center pr-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isChecking}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isChecking || !passkey}>
              {isChecking ? "Đang kiểm tra..." : "Truy cập"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
