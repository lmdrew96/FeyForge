"use client"

import { useState, useRef } from "react"
import { Upload, Image as ImageIcon, Loader2, X, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useWorldMapStore, type WorldMapData } from "@/lib/world-map-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"

interface UploadMapDialogProps {
  trigger?: React.ReactNode
}

export function UploadMapDialog({ trigger }: UploadMapDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { addMap, updateMap, getMapByCampaign } = useWorldMapStore()
  const activeCampaignId = useActiveCampaignId()
  
  // Form state
  const [mapName, setMapName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const currentMap = activeCampaignId ? getMapByCampaign(activeCampaignId) : undefined
  
  const resetForm = () => {
    setMapName("")
    setImageUrl("")
    setPreviewUrl(null)
    setUploadError(null)
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file")
      return
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be smaller than 10MB")
      return
    }
    
    setUploadError(null)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setPreviewUrl(dataUrl)
      setImageUrl(dataUrl) // For local storage, we'll use the data URL
    }
    reader.readAsDataURL(file)
  }
  
  const handleUrlChange = (url: string) => {
    setImageUrl(url)
    setPreviewUrl(url)
    setUploadError(null)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!activeCampaignId) return
    if (!imageUrl && !previewUrl) {
      setUploadError("Please provide an image")
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const finalImageUrl = imageUrl || previewUrl || ""
      
      if (currentMap) {
        // Update existing map
        updateMap(currentMap.id, {
          name: mapName.trim() || "World Map",
          imageUrl: finalImageUrl,
        })
      } else {
        // Create new map
        const newMap: WorldMapData = {
          id: `map-${Date.now()}`,
          campaignId: activeCampaignId,
          name: mapName.trim() || "World Map",
          imageUrl: finalImageUrl,
          fogOfWarEnabled: false,
          fogMask: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        addMap(newMap)
      }
      
      resetForm()
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleRemoveImage = () => {
    setPreviewUrl(null)
    setImageUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value)
      if (!value) resetForm()
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Map</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {currentMap?.imageUrl ? "Replace Map Image" : "Upload World Map"}
          </DialogTitle>
          <DialogDescription>
            Upload a custom image for your campaign world map. Supported formats: PNG, JPG, GIF, WebP.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Map Name */}
          <div className="space-y-2">
            <Label htmlFor="map-name">Map Name</Label>
            <Input
              id="map-name"
              placeholder="e.g., The Verdant Realm"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            />
          </div>
          
          {/* Image Source Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Image URL
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="map-file">Image File</Label>
                <Input
                  ref={fileInputRef}
                  id="map-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 10MB. The image will be stored locally in your browser.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="map-url">Image URL</Label>
                <Input
                  id="map-url"
                  type="url"
                  placeholder="https://example.com/my-map.jpg"
                  value={activeTab === "url" ? imageUrl : ""}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a direct link to an image file. Make sure the URL is publicly accessible.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Error Message */}
          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
          
          {/* Image Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
                <img
                  src={previewUrl}
                  alt="Map preview"
                  className="w-full h-48 object-contain"
                  onError={() => {
                    setUploadError("Failed to load image. Please check the URL.")
                    setPreviewUrl(null)
                  }}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={(!imageUrl && !previewUrl) || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {currentMap?.imageUrl ? "Update Map" : "Upload Map"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
