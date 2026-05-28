"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { X, ArrowLeft } from "lucide-react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onBack?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  onBack,
  size = "md",
  children,
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && boxRef.current && overlayRef.current) {
      gsap.fromTo(
        boxRef.current,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1, scale: 1, duration: 0.4, ease: "power3.out",
        }
      );

      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4 }
      );
    }
  }, [isOpen]);

  function handleClose() {
    if (!boxRef.current || !overlayRef.current) {
      onClose()
      return
    }

    gsap.to(boxRef.current, {
      opacity: 0,
      scale: 0.9,
      duration: 0.3,
      ease: "power3.in",
    });

    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.3,
      onComplete: onClose,
    });
  }

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={boxRef}
        className={`relative w-full ${sizeClasses[size]} bg-zinc-900 border-2 border-zinc-700 rounded-xl shadow-2xl z-10 flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-700 shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {title && (
              <h3 className="text-lg font-jaro text-zinc-100">
                {title}
              </h3>
            )}
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>

      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm -z-10"
        onClick={handleClose}
      />
    </div>
  );
}