"use client";

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, X, File, FileText, FileImage, Video, Music } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MediaPickerProps {
  onClose: () => void;
  onSubmit: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
}

// Helper function to get file type icon based on MIME type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <FileImage className="h-5 w-5" />;
  } else if (mimeType.startsWith('video/')) {
    return <Video className="h-5 w-5" />;
  } else if (mimeType.startsWith('audio/')) {
    return <Music className="h-5 w-5" />;
  } else if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5" />;
  } else {
    return <File className="h-5 w-5" />;
  }
}

// Helper function to get preview component based on file type
function FilePreview({ file }: { file: File }) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isPdf = file.type === 'application/pdf';
  const isAudio = file.type.startsWith('audio/');
  const isGif = file.type === 'image/gif';
  
  // For images (including GIFs)
  if (isImage) {
    return (
      <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0 relative">
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className={`h-full w-full object-cover ${isGif ? 'animate-pulse' : ''}`}
        />
        {isGif && (
          <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-1">
            GIF
          </span>
        )}
      </div>
    );
  }
  
  // For videos
  if (isVideo) {
    return (
      <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0 relative">
        <video
          src={URL.createObjectURL(file)}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Video className="h-4 w-4 text-white" />
        </div>
      </div>
    );
  }
  
  // For PDFs
  if (isPdf) {
    return (
      <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0 bg-red-50 flex items-center justify-center">
        <FileText className="h-6 w-6 text-red-500" />
      </div>
    );
  }
  
  // For audio
  if (isAudio) {
    return (
      <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0 bg-purple-50 flex items-center justify-center">
        <Music className="h-6 w-6 text-purple-500" />
      </div>
    );
  }
  
  // Default for other file types
  return (
    <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
      {getFileIcon(file.type)}
    </div>
  );
}

export function MediaPicker({ 
  onClose, 
  onSubmit, 
  maxFiles = 10,
  accept = "image/*,video/*,audio/*,application/pdf" 
}: MediaPickerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<string>("images");
  
  // Define accept string based on active tab
  const getAcceptString = (tab: string) => {
    switch(tab) {
      case "images":
        return "image/*";
      case "videos":
        return "video/*";
      case "documents":
        return "application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "audio":
        return "audio/*";
      default:
        return accept;
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > maxFiles) {
      setError(`You can only upload a maximum of ${maxFiles} files at once.`);
      return;
    }
    
    if (selectedFiles.length + files.length > maxFiles) {
      setError(`You can only upload a maximum of ${maxFiles} files at once.`);
      return;
    }
    
    // Validate file types based on the active tab
    const invalidFiles = files.filter(file => {
      switch(activeTab) {
        case "images":
          return !file.type.startsWith('image/');
        case "videos":
          return !file.type.startsWith('video/');
        case "documents":
          return !(file.type === 'application/pdf' || 
                  file.type === 'text/plain' || 
                  file.type.includes('word') ||
                  file.type.includes('document'));
        case "audio":
          return !file.type.startsWith('audio/');
        default:
          return false;
      }
    });
    
    if (invalidFiles.length > 0) {
      setError(`One or more files are not valid for the selected category.`);
      return;
    }
    
    // File size validation (max 10MB per file)
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`One or more files exceed the maximum size of 10MB.`);
      return;
    }
    
    setError(null);
    setSelectedFiles(prev => [...prev, ...files]);
    
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };
  
  const handleSubmit = () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file.');
      return;
    }
    
    onSubmit(selectedFiles);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (fileInputRef.current) {
      fileInputRef.current.accept = getAcceptString(value);
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue="images" value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="images" className="m-0">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptString(activeTab)}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  id="media-upload"
                />
                <label 
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="rounded-full bg-primary/10 p-2 mb-2">
                    <FileImage className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">Click to upload images</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </label>
              </div>
            </TabsContent>
            
            <TabsContent value="videos" className="m-0">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  type="file"
                  accept={getAcceptString(activeTab)}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  id="media-upload"
                />
                <label 
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="rounded-full bg-primary/10 p-2 mb-2">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">Click to upload videos</p>
                  <p className="text-xs text-muted-foreground">
                    MP4, WebM, AVI up to 10MB
                  </p>
                </label>
              </div>
            </TabsContent>
            
            <TabsContent value="audio" className="m-0">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  type="file"
                  accept={getAcceptString(activeTab)}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  id="media-upload"
                />
                <label 
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="rounded-full bg-primary/10 p-2 mb-2">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">Click to upload audio</p>
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, AAC up to 10MB
                  </p>
                </label>
              </div>
            </TabsContent>
            
            <TabsContent value="documents" className="m-0">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  type="file"
                  accept={getAcceptString(activeTab)}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  id="media-upload"
                />
                <label 
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="rounded-full bg-primary/10 p-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">Click to upload documents</p>
                  <p className="text-xs text-muted-foreground">
                    PDF, TXT, DOC, DOCX up to 10MB
                  </p>
                </label>
              </div>
            </TabsContent>
          </Tabs>
          
          {selectedFiles.length > 0 && (
            <div className="space-y-2 w-full">
              <h3 className="text-sm font-medium">Selected files ({selectedFiles.length})</h3>
              <div className="max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2 truncate">
                      <FilePreview file={file} />
                      <div className="truncate">
                        <p className="font-medium text-sm truncate line-clamp-1 max-w-24">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedFiles.length === 0}
            >
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 