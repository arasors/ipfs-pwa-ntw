import { useState, useEffect, useRef } from 'react';
import { getContent, getBinaryContentFromGateways } from '../utils/ipfs';
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack } from 'lucide-react';
import Slider from '@mui/material/Slider';

interface MediaPreviewProps {
  cid?: string;
  dataUrl?: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

// CSS sınıfları yerine satır içi stil kullanılacak
const styles = {
  container: {
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingIcon: {
    height: '2rem',
    width: '2rem',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  sourceIndicator: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: 'black',
    color: 'white',
    fontSize: '12px',
    padding: '2px 4px',
    borderRadius: '4px',
  },
  audioContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audio: {
    width: '100%',
  },
  audioSource: {
    marginTop: '4px',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  textContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    overflow: 'auto',
  },
  preText: {
    fontSize: '0.75rem',
    padding: '0.5rem',
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
  },
  downloadContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  downloadText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    padding: '1rem',
    textAlign: 'center',
  },
  downloadLink: {
    color: '#3b82f6',
    textDecoration: 'underline',
  },
  // Video oynatıcı stilleri
  videoPlayer: {
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    borderRadius: '0.375rem',
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '0.5rem 1rem',
    borderBottomLeftRadius: '0.375rem',
    borderBottomRightRadius: '0.375rem',
    transition: 'opacity 0.3s',
  },
  videoControlsHidden: {
    opacity: 0,
  },
  videoControlsVisible: {
    opacity: 1,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  timeText: {
    color: 'white',
    fontSize: '0.75rem',
    marginLeft: '0.5rem',
  },
  controlButtons: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  controlButton: {
    color: 'white',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  controlButtonHover: {
    color: '#3b82f6',
  },
  volumeControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginLeft: '0.5rem',
  },
  sliderContainer: {
    width: '5rem',
  },
  videoSourceIndicator: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: '0.75rem',
    padding: '0.125rem 0.25rem',
    borderRadius: '0.25rem',
  }
};

export function MediaPreview({ 
  cid, 
  dataUrl,
  alt = 'Media content', 
  className = '', 
  width = 300, 
  height = 300,
  mimeType
}: MediaPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackGateway, setFallbackGateway] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('https://ipfs.io/ipfs/');
  const [useApiEndpoint, setUseApiEndpoint] = useState(true);

  // Determine initial media type from mimeType prop
  const getInitialMediaType = (): 'image' | 'video' | 'audio' | 'other' => {
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType?.startsWith('video/')) return 'video';
    if (mimeType?.startsWith('audio/')) return 'audio';
    return 'other';
  };

  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'other'>(getInitialMediaType());

  // Detect media type from data URL if available
  useEffect(() => {
    if (dataUrl) {
      if (dataUrl.startsWith('data:image/')) {
        setMediaType('image');
      } else if (dataUrl.startsWith('data:video/')) {
        setMediaType('video');
      } else if (dataUrl.startsWith('data:audio/')) {
        setMediaType('audio');
      }
      
      setSrc(dataUrl);
      setLoading(false);
    }
  }, [dataUrl]);

  useEffect(() => {
    async function loadContent() {
      // Skip loading if we already have a data URL
      if (dataUrl || !cid) {
        return;
      }
      
      try {
        setLoading(true);
        setError(null);

        if (!cid) {
          setError('CID not found');
          setLoading(false);
          return;
        }

        // Optimize by checking current media type
        const isImageType = mediaType === 'image';
        const isVideoType = mediaType === 'video';
        const isAudioType = mediaType === 'audio';
        const isOtherType = mediaType === 'other';

        // Use direct gateway for known image types (faster loading)
        if (isImageType) {
          // Try Pinata gateway directly for images
          const apiUrl = '/api/ipfs/direct/';
          setSrc(`${apiUrl}?cid=${cid}`);
          setFallbackGateway(true);
          setLoading(false);
          return;
        }

        // For other types, check metadata if needed
        if (isOtherType) {
          try {
            // Check Pinata metadata
            const pinataMetadataUrl = `/api/ipfs/pinata?cid=${cid}&metadata=true`;
            const metadataResponse = await fetch(pinataMetadataUrl);
            
            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json();
              
              // Update media type based on metadata
              if (metadata?.MimeType) {
                if (metadata.MimeType.startsWith('image/')) {
                  setMediaType('image');
                  // Try gateway for image after type detection
                  const gatewayUrl = 'https://gateway.pinata.cloud/ipfs/';
                  setSrc(`${gatewayUrl}${cid}`);
                  setFallbackGateway(true);
                  setLoading(false);
                  return;
                } else if (metadata.MimeType.startsWith('video/')) {
                  setMediaType('video');
                } else if (metadata.MimeType.startsWith('audio/')) {
                  setMediaType('audio');
                }
              }
            }
          } catch (e) {
            console.log('Metadata check failed, continuing with direct content');
          }
        }

        // Try API endpoints for media types
        if (isImageType || isVideoType || isAudioType || isOtherType) {
          // Use direct API endpoint
          try {
            const directApiUrl = `/api/ipfs/direct/${cid}`;
            setSrc(directApiUrl);
            setUseApiEndpoint(true);
            setLoading(false);
            return;
          } catch (e) {
            console.log('Direct API endpoint error', e);
          }
          
          // Try Pinata endpoint
          try {
            const pinataApiUrl = `/api/ipfs/pinata?cid=${cid}`;
            const pinataResponse = await fetch(pinataApiUrl, { method: 'HEAD' });
            
            if (pinataResponse.ok) {
              setSrc(pinataApiUrl);
              setUseApiEndpoint(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.log('Pinata API endpoint failed');
          }
          
          // Try generic endpoint
          try {
            const genericApiUrl = `/api/ipfs/preview?cid=${cid}`;
            const genericResponse = await fetch(genericApiUrl, { method: 'HEAD' });
            
            if (genericResponse.ok) {
              setSrc(genericApiUrl);
              setUseApiEndpoint(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.log('All API endpoints failed');
          }
        }

        // Try getting content from local node
        const content = await getContent(cid);
        
        if (content) {
          // Handle based on media type
          if (isImageType || isVideoType || isAudioType) {
            // For media types, get binary content
            const binaryContent = await getBinaryContentFromGateways(cid);
            
            if (binaryContent) {
              // Create blob URL
              const blob = new Blob([binaryContent], { type: mimeType || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              setSrc(url);
              
              // Update media type if needed
              if (isOtherType && binaryContent.length > 2) {
                const signature = binaryContent.slice(0, 4);
                
                if (signature[0] === 0xFF && signature[1] === 0xD8) {
                  setMediaType('image'); // JPEG
                } else if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
                  setMediaType('image'); // PNG
                } else if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46) {
                  setMediaType('image'); // GIF
                } else if (signature[0] === 0x66 && signature[1] === 0x74 && signature[2] === 0x79 && signature[3] === 0x70) {
                  setMediaType('video'); // MP4
                }
              }
            } else {
              throw new Error('Could not retrieve media content');
            }
          } else {
            // For text content
            setSrc(`data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
          }
        } else {
          // Use gateway as fallback
          setFallbackGateway(true);
          
          // Try gateways
          const gateways = [
            'https://azure-central-bobolink-99.mypinata.cloud/ipfs/'
          ];
          
          for (const gateway of gateways) {
            try {
              const response = await fetch(`${gateway}${cid}`, { 
                method: 'HEAD', 
                signal: AbortSignal.timeout(2000) 
              });
              
              if (response.ok) {
                setGatewayUrl(gateway);
                setSrc(`${gateway}${cid}`);
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          // Use default gateway if all failed
          if (!src) {
            setGatewayUrl('https://ipfs.io/ipfs/');
            setSrc(`https://ipfs.io/ipfs/${cid}`);
          }
        }
      } catch (err) {
        console.error('Error loading IPFS content:', err);
        setError('Failed to load content');
        // Fallback to gateway
        setFallbackGateway(true);
        setSrc(`https://ipfs.io/ipfs/${cid}`);
      } finally {
        setLoading(false);
      }
    }

    loadContent();

    // Cleanup blob URLs
    return () => {
      if (src && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [cid, mediaType, mimeType, dataUrl]);

  const handleImageError = () => {
    // Handle error for images
    if (src && src.startsWith('data:')) {
      const isTextUrl = src.includes('data:text/plain') || 
                      src.includes('charset=utf-8') ||
                      src.includes('%');
      
      if (isTextUrl) {
        setMediaType('other');
      }
    } else if (src && (
      src.startsWith('/api/ipfs/preview') || 
      src.startsWith('/api/ipfs/pinata') || 
      src.startsWith('/api/ipfs/direct/')
    )) {
      // Fall back to gateway for API errors
      console.log('API endpoint failed, using gateway');
      setFallbackGateway(true);
      setSrc(`https://ipfs.io/ipfs/${cid}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        ...styles.loadingContainer,
        width,
        height
      }}>
        <Loader2 style={{
          ...styles.loadingIcon,
          animation: 'spin 2s linear infinite'
        }} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        ...styles.errorContainer,
        width,
        height
      }}>
        <p style={styles.errorText}>
          {error} {fallbackGateway && '(Using gateway)'}
        </p>
      </div>
    );
  }

  // No source state
  if (!src) {
    return (
      <div style={{
        ...styles.errorContainer,
        width,
        height
      }}>
        <p style={styles.errorText}>No preview available</p>
      </div>
    );
  }

  // Render based on media type
  switch (mediaType) {
    case 'image':
      return (
        <div style={{
            ...(styles.container as any),
            width: width + 'px',
            height: height + 'px'
        }}>
          <img 
            src={src} 
            alt={alt} 
            style={styles.image as any}
            onError={handleImageError}
          />
          {(fallbackGateway || useApiEndpoint) && (
            <div style={styles.sourceIndicator as any}>
              {useApiEndpoint ? 'API' : 'Gateway'}
            </div>
          )}
        </div>
      );
    
    case 'video':
      return (
        <VideoPlayer 
          src={src} 
          width={width} 
          height={height} 
          className={className}
          cid={cid}
          fallbackGateway={fallbackGateway}
          useApiEndpoint={useApiEndpoint}
        />
      );
    
    case 'audio':
      return (
        <div style={{
          ...(styles.audioContainer as any),
          width,
          height: 'auto'
        }}>
          <audio 
            src={src} 
            controls 
            style={styles.audio as any}
            onError={() => {
              if (src && (src.startsWith('/api/ipfs/preview') || src.startsWith('/api/ipfs/pinata') || src.startsWith('/api/ipfs/direct/'))) {
                setFallbackGateway(true);
                setSrc(`https://ipfs.io/ipfs/${cid}`);
              }
            }}
          />
          {(fallbackGateway || useApiEndpoint) && (
            <div style={styles.audioSource as any}>
              Loaded through {useApiEndpoint ? 'API' : 'gateway'}
            </div>
          )}
        </div>
      );
    
    default:
      // Handle text content
      if (src.startsWith('data:text/plain') || src.includes('charset=utf-8')) {
        let content = "Cannot decode content";
        try {
          if (src.includes(',')) {
            content = decodeURIComponent(src.split(',')[1]);
          }
        } catch (e) {
          console.error('Failed to decode data URL:', e);
        }
        
        return (
          <div style={{
            ...styles.textContent,
            width,
            height
          }}>
            <pre style={styles.preText}>{content}</pre>
          </div>
        );
      }
      
      // Fall back to download link
      return (
        <div style={{
          ...styles.downloadContainer,
          width,
          height
        }}>
          <p style={styles.downloadText as any}>
            Content cannot be displayed. <a href={src} download target="_blank" rel="noopener noreferrer" style={styles.downloadLink}>Click to download</a>
          </p>
        </div>
      );
  }
}

function VideoPlayer({ 
  src, 
  width, 
  height, 
  className,
  cid,
  fallbackGateway,
  useApiEndpoint
}: { 
  src: string; 
  width: number; 
  height: number; 
  className: string;
  cid?: string;
  fallbackGateway: boolean;
  useApiEndpoint: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleError = () => {
      setError('Failed to load video');
      if (src && (src.startsWith('/api/ipfs/preview') || 
                 src.startsWith('/api/ipfs/pinata') || 
                 src.startsWith('/api/ipfs/direct/'))) {
        if (cid) {
          setFallbackError(true);
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, [src, cid]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
    } else {
      video.play();
    }

    setPlaying(!playing);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    const newMutedState = !muted;
    setMuted(newMutedState);
    
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  const handleShowControls = () => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const [fallbackError, setFallbackError] = useState(false);

  if (fallbackError) {
    return (
      <div style={{
        ...(styles.container as any),
        width,
        height
      }}>
        <video 
          src={`https://ipfs.io/ipfs/${cid}`}
          controls 
          style={styles.video as any}
        />
        <div style={styles.videoSourceIndicator as any}>
          Gateway fallback
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        ...styles.loadingContainer,
        width,
        height
      }}>
        <Loader2 style={{
          ...styles.loadingIcon,
          animation: 'spin 2s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...styles.errorContainer,
        width,
        height
      }}>
        <p style={styles.errorText}>
          {error}
        </p>
      </div>
    );
  }

  // Define keyframes for spinner animation
  const keyframes = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  return (
    <div 
      style={{
        ...(styles.videoPlayer as any),
        width,
        height
      }}
      onMouseEnter={handleShowControls}
      onMouseMove={handleShowControls}
      onMouseLeave={() => setShowControls(false)}
    >
      <style>{keyframes}</style>
      <video 
        ref={videoRef}
        src={src} 
        style={styles.video as any}
        onClick={handlePlayPause}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      
      {/* Custom video controls */}
      <div 
        style={{
          ...(styles.videoControls as any),
          ...(showControls ? styles.videoControlsVisible : styles.videoControlsHidden)
        }}
      >
        <div style={styles.controlsRow}>
          <Slider 
            value={[currentTime]} 
            max={duration} 
            step={0.1} 
            onChange={(e, value) => handleSeek(value as number[])}
            style={{ flexGrow: 1 } as any}
          />
          <span style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        <div style={styles.controlButtons}>
          <div style={styles.buttonGroup}>
            <button 
              onClick={() => skip(-10)} 
              style={styles.controlButton}
              aria-label="Skip back 10 seconds"
            >
              <SkipBack style={{ height: '1rem', width: '1rem' }} />
            </button>
            
            <button 
              onClick={handlePlayPause} 
              style={styles.controlButton}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? 
                <Pause style={{ height: '1.25rem', width: '1.25rem' }} /> : 
                <Play style={{ height: '1.25rem', width: '1.25rem' }} />
              }
            </button>
            
            <button 
              onClick={() => skip(10)} 
              style={styles.controlButton}
              aria-label="Skip forward 10 seconds"
            >
              <SkipForward style={{ height: '1rem', width: '1rem' }} />
            </button>
            
            <div style={styles.volumeControls}>
              <button 
                onClick={toggleMute} 
                style={styles.controlButton}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? 
                  <VolumeX style={{ height: '1rem', width: '1rem' }} /> : 
                  <Volume2 style={{ height: '1rem', width: '1rem' }} />
                }
              </button>
              
              <div style={styles.sliderContainer}>
                <Slider 
                  value={[volume]} 
                  max={1} 
                  step={0.1} 
                  onChange={(e, value) => handleVolumeChange(value as number[])} 
                />
              </div>
            </div>
          </div>
          
          <div style={styles.buttonGroup}>
            <button 
              onClick={handleFullscreen} 
              style={styles.controlButton}
              aria-label="Fullscreen"
            >
              <Maximize style={{ height: '1rem', width: '1rem' }} />
            </button>
          </div>
        </div>
      </div>
      
      {(fallbackGateway || useApiEndpoint) && (
        <div style={styles.videoSourceIndicator as any}>
          {useApiEndpoint ? 'API' : 'Gateway'}
        </div>
      )}
    </div>
  );
}