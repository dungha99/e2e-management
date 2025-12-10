"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ImageGalleryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: string[]
  initialIndex: number
  onIndexChange: (index: number) => void
}

export function ImageGalleryModal({
  open,
  onOpenChange,
  images,
  initialIndex,
  onIndexChange
}: ImageGalleryModalProps) {
  const currentIndex = initialIndex

  function handlePrevious() {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1)
    }
  }

  function handleNext() {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95">
        <div className="relative w-full h-[95vh] flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-4 z-50 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Main Image */}
          <div className="w-full h-full flex items-center justify-center p-16">
            <img
              src={images[currentIndex]}
              alt={`Car image ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23374151" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="20"%3EImage not available%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>

          {/* Next Button */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
