"use client"

import { useEffect } from "react"

export function ColorPaletteInit() {
  useEffect(() => {
    try {
      if (localStorage.getItem("color-palette") === "cool") {
        document.documentElement.classList.add("cool")
      }
    } catch {}
  }, [])

  return null
}
