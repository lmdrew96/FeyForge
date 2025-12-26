"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Search, Sword, Shield, Coins, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { open5eApi, type Open5eMagicItem } from "@/lib/open5e-api"
import useSWR from "swr"

export function EquipmentReference() {
  const [weaponSearch, setWeaponSearch] = useState("")
  const [armorSearch, setArmorSearch] = useState("")
  const [magicSearch, setMagicSearch] = useState("")
  const [debouncedWeaponSearch, setDebouncedWeaponSearch] = useState("")
  const [debouncedArmorSearch, setDebouncedArmorSearch] = useState("")
  const [debouncedMagicSearch, setDebouncedMagicSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedWeaponSearch(weaponSearch), 300)
    return () => clearTimeout(timer)
  }, [weaponSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedArmorSearch(armorSearch), 300)
    return () => clearTimeout(timer)
  }, [armorSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMagicSearch(magicSearch), 300)
    return () => clearTimeout(timer)
  }, [magicSearch])

  const {
    data: weapons,
    error: weaponsError,
    isLoading: weaponsLoading,
    mutate: mutateWeapons,
  } = useSWR(["weapons", debouncedWeaponSearch], () => open5eApi.getWeapons(debouncedWeaponSearch || undefined), {
    revalidateOnFocus: false,
  })

  const {
    data: armor,
    error: armorError,
    isLoading: armorLoading,
    mutate: mutateArmor,
  } = useSWR(["armor", debouncedArmorSearch], () => open5eApi.getArmor(debouncedArmorSearch || undefined), {
    revalidateOnFocus: false,
  })

  const {
    data: magicItems,
    error: magicError,
    isLoading: magicLoading,
    mutate: mutateMagic,
  } = useSWR(
    ["magicitems", debouncedMagicSearch],
    () => open5eApi.getMagicItems({ search: debouncedMagicSearch || undefined }),
    { revalidateOnFocus: false },
  )

  const categoryColors: Record<string, string> = {
    "Simple Melee Weapons": "bg-green-500/20 text-green-400",
    "Simple Ranged Weapons": "bg-blue-500/20 text-blue-400",
    "Martial Melee Weapons": "bg-orange-500/20 text-orange-400",
    "Martial Ranged Weapons": "bg-red-500/20 text-red-400",
    "Light Armor": "bg-green-500/20 text-green-400",
    "Medium Armor": "bg-yellow-500/20 text-yellow-400",
    "Heavy Armor": "bg-red-500/20 text-red-400",
    Shield: "bg-blue-500/20 text-blue-400",
  }

  const rarityColors: Record<string, string> = {
    common: "bg-gray-500/20 text-gray-400",
    uncommon: "bg-green-500/20 text-green-400",
    rare: "bg-blue-500/20 text-blue-400",
    "very rare": "bg-purple-500/20 text-purple-400",
    legendary: "bg-orange-500/20 text-orange-400",
    artifact: "bg-red-500/20 text-red-400",
  }

  const [selectedMagicItem, setSelectedMagicItem] = useState<Open5eMagicItem | null>(null)

  return (
    <Tabs defaultValue="weapons" className="h-full">
      <TabsList className="bg-card/50">
        <TabsTrigger value="weapons" className="gap-2">
          <Sword className="h-4 w-4" />
          Weapons
        </TabsTrigger>
        <TabsTrigger value="armor" className="gap-2">
          <Shield className="h-4 w-4" />
          Armor
        </TabsTrigger>
        <TabsTrigger value="magic" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Magic Items
        </TabsTrigger>
      </TabsList>

      <TabsContent value="weapons" className="mt-4 h-[calc(100%-60px)]">
        <div className="mb-4 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search weapons..."
              value={weaponSearch}
              onChange={(e) => setWeaponSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => mutateWeapons()} disabled={weaponsLoading}>
            <RefreshCw className={`h-4 w-4 ${weaponsLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          {weaponsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading weapons...</span>
            </div>
          ) : weaponsError ? (
            <div className="py-8 text-center text-destructive">
              <p>Failed to load weapons.</p>
              <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutateWeapons()}>
                Retry
              </Button>
            </div>
          ) : (
            <Card className="border-border/50 bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Damage</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(weapons || []).map((weapon) => (
                    <TableRow key={weapon.slug}>
                      <TableCell className="font-medium">{weapon.name}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[weapon.category] || ""}>{weapon.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {weapon.damage_dice} {weapon.damage_type}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {weapon.properties.length > 0 ? weapon.properties.join(", ") : "—"}
                      </TableCell>
                      <TableCell>{weapon.weight}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Coins className="h-3 w-3 text-yellow-500" />
                        {weapon.cost}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="armor" className="mt-4 h-[calc(100%-60px)]">
        <div className="mb-4 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search armor..."
              value={armorSearch}
              onChange={(e) => setArmorSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => mutateArmor()} disabled={armorLoading}>
            <RefreshCw className={`h-4 w-4 ${armorLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          {armorLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading armor...</span>
            </div>
          ) : armorError ? (
            <div className="py-8 text-center text-destructive">
              <p>Failed to load armor.</p>
              <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutateArmor()}>
                Retry
              </Button>
            </div>
          ) : (
            <Card className="border-border/50 bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>AC</TableHead>
                    <TableHead>Stealth</TableHead>
                    <TableHead>Str Req</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(armor || []).map((item) => (
                    <TableRow key={item.slug}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[item.category] || ""}>{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.ac_string}</TableCell>
                      <TableCell>
                        {item.stealth_disadvantage ? (
                          <Badge variant="outline" className="text-red-400 border-red-500/30">
                            Disadvantage
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{item.strength_requirement ? `Str ${item.strength_requirement}` : "—"}</TableCell>
                      <TableCell>{item.weight}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Coins className="h-3 w-3 text-yellow-500" />
                        {item.cost}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="magic" className="mt-4 h-[calc(100%-60px)]">
        <div className="mb-4 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search magic items..."
              value={magicSearch}
              onChange={(e) => setMagicSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => mutateMagic()} disabled={magicLoading}>
            <RefreshCw className={`h-4 w-4 ${magicLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex h-[calc(100%-60px)] gap-4">
          <ScrollArea className="flex-1">
            {magicLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading magic items...</span>
              </div>
            ) : magicError ? (
              <div className="py-8 text-center text-destructive">
                <p>Failed to load magic items.</p>
                <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutateMagic()}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {(magicItems || []).map((item) => (
                  <Card
                    key={item.slug}
                    className={`cursor-pointer border-border/50 bg-card/50 transition-colors hover:bg-card ${
                      selectedMagicItem?.slug === item.slug ? "border-primary bg-card" : ""
                    }`}
                    onClick={() => setSelectedMagicItem(item)}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.name}</span>
                        <Badge className={rarityColors[item.rarity.toLowerCase()] || ""}>{item.rarity}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.type}</span>
                        {item.requires_attunement && (
                          <Badge variant="outline" className="text-xs">
                            Attunement
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {(magicItems || []).length === 0 && !magicLoading && (
                  <p className="py-8 text-center text-muted-foreground">No magic items found</p>
                )}
              </div>
            )}
          </ScrollArea>
          <div className="w-1/2">
            {selectedMagicItem ? (
              <Card className="h-full border-border/50 bg-card/50 p-4">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-4">
                    <div>
                      <h3 className="text-xl font-bold">{selectedMagicItem.name}</h3>
                      <p className="text-sm italic text-muted-foreground">
                        {selectedMagicItem.type}, {selectedMagicItem.rarity}
                        {selectedMagicItem.requires_attunement &&
                          ` (requires attunement${selectedMagicItem.requires_attunement !== "requires attunement" ? ` ${selectedMagicItem.requires_attunement}` : ""})`}
                      </p>
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
                      {selectedMagicItem.desc}
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            ) : (
              <Card className="flex h-full items-center justify-center border-border/50 bg-card/50">
                <div className="text-center">
                  <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">Select an item to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
