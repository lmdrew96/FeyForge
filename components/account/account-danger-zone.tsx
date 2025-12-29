"use client"

import { useState } from "react"
import { AlertTriangle, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const CONFIRMATION_TEXT = "DELETE MY ACCOUNT"

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
  "feyforge-user-profile",
]

export function AccountDangerZone() {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [step, setStep] = useState<1 | 2>(1)

  const handleDeleteAccount = () => {
    // Clear all localStorage data
    STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key)
    })

    // Reset state
    setShowDeleteDialog(false)
    setConfirmText("")
    setStep(1)

    // In a real app, this would also:
    // - Call API to delete user account
    // - Clear auth tokens
    // - Redirect to login/home page
    window.location.href = "/"
  }

  const handleCloseDialog = () => {
    setShowDeleteDialog(false)
    setConfirmText("")
    setStep(1)
  }

  const canProceedToStep2 = confirmText === CONFIRMATION_TEXT

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-red-500/30">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-red-500/5 transition-colors pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg sm:text-xl text-red-500">
                    Danger Zone
                  </CardTitle>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <CardDescription className="text-muted-foreground pr-8">
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      Delete Account
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data. This action
                      cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full sm:w-auto flex-shrink-0"
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Multi-step Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              {step === 1 ? "Delete Account" : "Final Confirmation"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {step === 1 ? (
                  <>
                    <p>
                      This will permanently delete your account and all associated data,
                      including:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                      <li>All campaigns</li>
                      <li>All characters</li>
                      <li>All session logs</li>
                      <li>All NPCs</li>
                      <li>All saved settings</li>
                    </ul>
                    <p className="font-medium text-foreground">
                      This action is irreversible. Are you sure you want to continue?
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      To confirm deletion, please type{" "}
                      <span className="font-mono font-bold text-red-500">
                        {CONFIRMATION_TEXT}
                      </span>{" "}
                      below:
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-delete" className="sr-only">
                        Confirmation text
                      </Label>
                      <Input
                        id="confirm-delete"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={CONFIRMATION_TEXT}
                        className="bg-background border-red-500/30 focus:border-red-500"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCloseDialog}>Cancel</AlertDialogCancel>
            {step === 1 ? (
              <Button
                variant="destructive"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            ) : (
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={!canProceedToStep2}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete My Account Forever
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
