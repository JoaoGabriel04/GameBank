"use client";

import React, { createContext, useState, useCallback, ReactNode } from "react";
import { LiveSession } from "@/lib/admin/types";

interface AdminContextType {
  selectedSession: LiveSession | null;
  setSelectedSession: (session: LiveSession | null) => void;
  filter: {
    status: string;
    search: string;
    type?: string;
    dateRange?: { from: string; to: string };
  };
  setFilter: (filter: any) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [filter, setFilter] = useState({
    status: "all",
    search: "",
    type: "all",
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const value: AdminContextType = {
    selectedSession,
    setSelectedSession,
    filter,
    setFilter,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    sidebarOpen,
    setSidebarOpen,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
