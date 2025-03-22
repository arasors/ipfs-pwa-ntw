"use client"

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export function Lightbox({ isOpen, onClose, src, alt }: LightboxProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen-lg p-0 bg-background/5 backdrop-blur-sm border-none">
        <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-8">
          
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={src}
              alt={alt || "Image"}
              className="max-h-[80vh] max-w-full object-contain rounded-md"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LightboxImage {
  src: string;
  alt?: string;
}

interface LightboxModalProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export function LightboxModal({ 
  images, 
  currentIndex, 
  onClose, 
  onChangeIndex 
}: LightboxModalProps) {
  const [loaded, setLoaded] = useState(false);
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      onChangeIndex(currentIndex - 1);
    } else {
      // Loop to the end
      onChangeIndex(images.length - 1);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onChangeIndex(currentIndex + 1);
    } else {
      // Loop to the beginning
      onChangeIndex(0);
    }
  };
  
  // Reset loaded state when changing images
  useEffect(() => {
    setLoaded(false);
  }, [currentIndex]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length]);
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-screen-lg p-0 bg-background/5 backdrop-blur-md border-none">
      <DialogTitle className='sr-only'>Lightbox</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center">
          
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 z-10 bg-background/50 p-2 rounded-full text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <button
                onClick={handleNext}
                className="absolute right-4 z-10 bg-background/50 p-2 rounded-full text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}
            
            <img
              src={currentImage.src}
              alt={currentImage.alt || "Image"}
              className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setLoaded(true)}
            />
          </div>
          
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => onChangeIndex(index)}
                  className={`h-2 w-2 rounded-full ${
                    index === currentIndex ? 'bg-primary' : 'bg-muted-foreground'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 