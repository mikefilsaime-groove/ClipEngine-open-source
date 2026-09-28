"use client"

import { useTheme } from "next-themes"
import Link from "next/link"
import { Settings, Sun, Moon, Palette, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"

export function SettingsDropdown() {
  const { setTheme, resolvedTheme } = useTheme()
  const [cool, setCool] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCool(document.documentElement.classList.contains("cool"))
  }, [])

  if (!mounted) return null

  function togglePalette(useCool: boolean) {
    setCool(useCool)
    if (useCool) {
      document.documentElement.classList.add("cool")
      localStorage.setItem("color-palette", "cool")
    } else {
      document.documentElement.classList.remove("cool")
      localStorage.setItem("color-palette", "warm")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <KeyRound className="mr-2 size-4" />
            App Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {resolvedTheme === "dark" ? <Moon className="mr-2 size-4" /> : <Sun className="mr-2 size-4" />}
            Mode
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 size-4" /> Light
              {resolvedTheme === "light" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 size-4" /> Dark
              {resolvedTheme === "dark" && " ✓"}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 size-4" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => togglePalette(false)}>
              <span className="mr-2 size-3 rounded-full bg-[oklch(0.555_0.163_48.998)]" /> Warm
              {!cool && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => togglePalette(true)}>
              <span className="mr-2 size-3 rounded-full bg-[oklch(0.546_0.215_262.872)]" /> Cool
              {cool && " ✓"}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
