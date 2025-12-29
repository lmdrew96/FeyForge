"use client"

import { useState, useEffect, useRef } from "react"
import { UserCircle, Mail, Camera, Calendar, Loader2, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserProfile {
  displayName: string
  email: string
  avatarUrl: string
  memberSince: string
}

const PROFILE_STORAGE_KEY = "feyforge-user-profile"

const defaultProfile: UserProfile = {
  displayName: "",
  email: "",
  avatarUrl: "",
  memberSince: new Date().toISOString(),
}

export function AccountProfile() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Ensure memberSince exists
        if (!parsed.memberSince) {
          parsed.memberSince = new Date().toISOString()
        }
        setProfile(parsed)
      } catch {
        // Use default profile if parsing fails
        setProfile({
          ...defaultProfile,
          memberSince: new Date().toISOString(),
        })
      }
    } else {
      // First time - set member since date
      const newProfile = {
        ...defaultProfile,
        memberSince: new Date().toISOString(),
      }
      setProfile(newProfile)
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile))
    }
  }, [])

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
      await new Promise((resolve) => setTimeout(resolve, 500))

      setSaveStatus({
        type: "success",
        message: "Profile saved successfully!",
      })
    } catch {
      setSaveStatus({
        type: "error",
        message: "Failed to save profile. Please try again.",
      })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      handleProfileChange("avatarUrl", base64)
    }
    reader.readAsDataURL(file)
  }

  const getInitials = (name: string) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatMemberSince = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return "Unknown"
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <UserCircle className="h-5 w-5 text-fey-cyan" />
          Profile
        </CardTitle>
        <CardDescription>Your personal information and account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-fey-cyan/20">
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName || "User"} />
              <AvatarFallback className="bg-fey-cyan/10 text-fey-cyan text-2xl">
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={handleAvatarClick}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
              aria-label="Change avatar"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Upload avatar image"
            />
          </div>

          <div className="flex-1 w-full text-center sm:text-left">
            <h3 className="text-xl font-semibold text-foreground">
              {profile.displayName || "Unnamed Adventurer"}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Mail className="h-4 w-4" />
              {profile.email || "No email set"}
            </p>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Calendar className="h-4 w-4" />
              Member since {formatMemberSince(profile.memberSince)}
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-1.5">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={profile.displayName}
                onChange={(e) => handleProfileChange("displayName", e.target.value)}
                placeholder="Enter your display name"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                placeholder="Enter your email"
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="w-full sm:w-auto bg-fey-cyan hover:bg-fey-cyan/90 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
            {saveStatus.type === "success" && (
              <p className="text-sm text-green-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {saveStatus.message}
              </p>
            )}
            {saveStatus.type === "error" && (
              <p className="text-sm text-red-500">{saveStatus.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
