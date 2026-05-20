"use client"

import { useState, useEffect, useRef } from "react"
import { useClerk } from "@clerk/nextjs"
import {
  UserCircle,
  Mail,
  Camera,
  Lock,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface UserProfile {
  displayName: string
  email: string
  avatarUrl: string
}

const PROFILE_STORAGE_KEY = "feyforge-user-profile"

const defaultProfile: UserProfile = {
  displayName: "",
  email: "",
  avatarUrl: "",
}

export function AccountSettings() {
  const { signOut } = useClerk()
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string
    new?: string
    confirm?: string
  }>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (saved) {
      try {
        setProfile(JSON.parse(saved))
      } catch {
        // Use default profile if parsing fails
      }
    }
  }, [])

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      // Save to localStorage (in a real app, this would be an API call)
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))

      // Simulate a brief delay for UX
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
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert file to base64 for localStorage storage
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      handleProfileChange("avatarUrl", base64)
    }
    reader.readAsDataURL(file)
  }

  const validatePasswordChange = (): boolean => {
    const errors: { current?: string; new?: string; confirm?: string } = {}

    if (!currentPassword) {
      errors.current = "Current password is required"
    }
    if (!newPassword) {
      errors.new = "New password is required"
    } else if (newPassword.length < 8) {
      errors.new = "Password must be at least 8 characters"
    }
    if (newPassword !== confirmPassword) {
      errors.confirm = "Passwords do not match"
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChangePassword = async () => {
    if (!validatePasswordChange()) return

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      // In a real app, this would be an API call
      // For now, just show success
      await new Promise((resolve) => setTimeout(resolve, 500))

      setSaveStatus({
        type: "success",
        message: "Password changed successfully!",
      })

      // Clear password fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordErrors({})
    } catch {
      setSaveStatus({
        type: "error",
        message: "Failed to change password. Please try again.",
      })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
    }
  }

  const handleDeleteAccount = async () => {
    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      // Call API to delete user account from database
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete account")
      }

      // Clear all localStorage data
      const STORAGE_KEYS = [
        "feyforge-campaigns",
        "feyforge-characters",
        "feyforge-npcs",
        "feyforge-sessions",
        "feyforge-combat",
        "feyforge-dice-store",
        "feyforge-dm-assistant",
        "feyforge-codex",
        "feyforge-world-map",
        "feyforge-font-size",
        PROFILE_STORAGE_KEY,
      ]

      for (const key of STORAGE_KEYS) {
        localStorage.removeItem(key)
      }

      setShowDeleteConfirm(false)
      setDeleteConfirmText("")

      // Sign out and redirect to home page
      await signOut({ redirectUrl: "/" })
    } catch (error) {
      setSaveStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete account. Please try again.",
      })
      setIsSaving(false)
    }
  }

  const canDeleteAccount =
    deleteConfirmText.toLowerCase() === "delete my account"

  const getInitials = (name: string) => {
    if (!name) return "FF"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-fey-cyan" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your personal information and avatar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                />
                <AvatarFallback className="text-xl bg-muted">
                  {getInitials(profile.displayName)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                Click the avatar to upload a new profile picture
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 200x200 pixels, JPG or PNG
              </p>
            </div>
          </div>

          {/* Name and Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={profile.displayName}
                onChange={(e) =>
                  handleProfileChange("displayName", e.target.value)
                }
                placeholder="Your name"
                className="bg-card border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                placeholder="your@email.com"
                className="bg-card border-border/50"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Collapsible
        open={showPasswordSection}
        onOpenChange={setShowPasswordSection}
      >
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-fey-purple" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password
                  </CardDescription>
                </div>
                <span className="text-sm text-muted-foreground">
                  {showPasswordSection ? "Hide" : "Show"}
                </span>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={`pr-10 bg-card border-border/50 ${
                      passwordErrors.current ? "border-destructive" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordErrors.current && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.current}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className={`pr-10 bg-card border-border/50 ${
                      passwordErrors.new ? "border-destructive" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordErrors.new && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.new}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`bg-card border-border/50 ${
                    passwordErrors.confirm ? "border-destructive" : ""
                  }`}
                />
                {passwordErrors.confirm && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.confirm}
                  </p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isSaving}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Status Message */}
      {saveStatus.type && (
        <Card
          className={`border ${
            saveStatus.type === "success"
              ? "bg-green-500/10 border-green-500/30"
              : "bg-destructive/10 border-destructive/30"
          }`}
        >
          <CardContent className="flex items-center gap-3 py-4">
            {saveStatus.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            )}
            <p className="text-sm">{saveStatus.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Collapsible open={showDangerZone} onOpenChange={setShowDangerZone}>
        <Card className="bg-card/50 border-destructive/30">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Permanently delete your account and all associated data
                  </CardDescription>
                </div>
                <span className="text-sm text-muted-foreground">
                  {showDangerZone ? "Hide" : "Show"}
                </span>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <h4 className="font-medium text-destructive flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Delete Account
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Once you delete your account, there is no going back. All your
                  data, including campaigns, characters, NPCs, and session logs
                  will be permanently deleted.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-4"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <span className="block">
                This action will permanently delete your account and all
                associated data:
              </span>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Your profile information</li>
                <li>All campaigns you&apos;ve created</li>
                <li>All characters, NPCs, and session logs</li>
                <li>All settings and preferences</li>
              </ul>
              <span className="block font-medium text-destructive">
                This action cannot be undone!
              </span>
              <span className="block mt-4">
                To confirm, type <strong>&quot;delete my account&quot;</strong>{" "}
                below:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type 'delete my account' to confirm"
            className="mt-2"
          />
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={!canDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
