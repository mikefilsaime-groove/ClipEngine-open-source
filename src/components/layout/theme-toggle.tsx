"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

export function ColorToggle() {
  const [cool, setCool] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCool(document.documentElement.classList.contains("cool"))
  }, [])

  if (!mounted) return null

  function toggle() {
    const next = !cool
    setCool(next)
    if (next) {
      document.documentElement.classList.add("cool")
      localStorage.setItem("color-palette", "cool")
    } else {
      document.documentElement.classList.remove("cool")
      localStorage.setItem("color-palette", "warm")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle color palette"
      title={cool ? "Switch to warm (brown)" : "Switch to cool (blue)"}
    >
      <Palette className="size-4" />
    </Button>
  )
}
