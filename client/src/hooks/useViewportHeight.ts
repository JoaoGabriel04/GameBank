'use client'
import { useEffect, useState } from "react"

export function useViewportHeight() {
  const [vh, setVh] = useState("100vh")

  useEffect(() => {
    const updateVh = () => {
      setVh(`${window.innerHeight}px`)
    }

    updateVh()
    window.addEventListener("resize", updateVh)

    return () => window.removeEventListener("resize", updateVh)
  }, [])

  return vh
}