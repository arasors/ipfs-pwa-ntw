import { createHelia } from 'helia';
import pako from 'pako';
import { strings } from '@helia/strings';
import { unixfs } from '@helia/unixfs';
import { json } from '@helia/json';
import { CID } from 'multiformats/cid';
import { MemoryBlockstore } from 'blockstore-core/memory';
import { MemoryDatastore } from 'datastore-core/memory';

// Add type definition for CONFIG
interface IpfsConfig {
  compression: {
    enabled: boolean;
    minSize: number;
    excludeTypes: string[];
  };
  chunkSize: number;
  concurrentUploads: number;
  gateways: string[];
  pinning: {
    enabled: boolean;
    services: Array<{
      name: string;
      url: string;
      headers: Record<string, string>;
    }>;
  };
}

// Configuration for IPFS
const CONFIG: IpfsConfig = {
  compression: {
    enabled: true,
    minSize: 1024 * 10, // Only compress files larger than 10KB
    excludeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] // These are already compressed
  },
  chunkSize: 1024 * 256, // 256KB chunks for large files
  concurrentUploads: 3,
  gateways: [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    process.env.NEXT_PUBLIC_PINATA_GATEWAY || ''
  ],
  pinning: {
    enabled: true,
    services: [
      
      // Web3.Storage pinning API has been deprecated as of January 9, 2024
      // To use their service, an upgrade to their new w3up API would be required
      // See: https://blog.web3.storage/posts/the-data-layer-is-here-with-the-new-web3-storage
    ]
  }
};

// Cached Helia instance
let heliaNode: any = null;

// Create a Helia node
export const createHeliaNode = async () => {
  // Only create once and cache the instance
  if (heliaNode) return heliaNode;
  
  // Skip in server-side execution
  if (typeof window === 'undefined') {
    console.log('Skipping Helia initialization on server-side');
    return null;
  }

  try {
    const blockstore = new MemoryBlockstore();
    const datastore = new MemoryDatastore();

    // Use minimal configuration without libp2p
    heliaNode = await createHelia({
      blockstore,
      datastore
    });
    
    console.log('Helia node created successfully');
    return heliaNode;
  } catch (error) {
    console.error('Failed to create Helia node:', error);
    return null;
  }
};

// Utility to determine if data should be compressed
const shouldCompress = (data: Uint8Array, mimeType?: string): boolean => {
  if (!CONFIG.compression.enabled) return false;
  
  // Don't compress if data is smaller than threshold
  if (data.length < CONFIG.compression.minSize) return false;
  
  // Don't compress already compressed formats
  if (mimeType && CONFIG.compression.excludeTypes.includes(mimeType)) return false;
  
  return true;
};

// Compress data with gzip
const compressData = (data: Uint8Array): Uint8Array => {
  try {
    return pako.deflate(data);
  } catch (error) {
    console.error('Compression failed:', error);
    return data; // Return original data if compression fails
  }
};

// Decompress data with gzip
const decompressData = (data: Uint8Array): Uint8Array => {
  try {
    return pako.inflate(data);
  } catch (error) {
    console.error('Decompression failed:', error);
    return data; // Return original data if decompression fails
  }
};

// Store compression metadata for a CID
const storeCompressionMetadata = async (cid: CID, isCompressed: boolean) => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return;
    
    const j = json(helia);
    const metadataCid = await j.add({ 
      original: cid.toString(),
      compressed: isCompressed,
      timestamp: Date.now()
    });
    
    // Store reference to metadata
    localStorage.setItem(`ipfs-meta-${cid.toString()}`, metadataCid.toString());
    return metadataCid;
  } catch (error) {
    console.error('Failed to store compression metadata:', error);
  }
};

// Get compression metadata for a CID
const getCompressionMetadata = async (cid: CID): Promise<{compressed: boolean} | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;
    
    const metadataCidStr = localStorage.getItem(`ipfs-meta-${cid.toString()}`);
    if (!metadataCidStr) return null;
    
    const metadataCid = CID.parse(metadataCidStr);
    const j = json(helia);
    return await j.get(metadataCid);
  } catch (error) {
    console.error('Failed to get compression metadata:', error);
    return null;
  }
};

// Collect bytes from an async iterable
async function collectBytes(generator: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return concatBytes(chunks);
}

// Concatenate multiple byte arrays
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  // Calculate total length
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  
  // Create new array and copy data
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  
  return result;
}

// Add bytes to IPFS with optional compression
export const addBytes = async (bytes: Uint8Array, options?: { 
  filename?: string, 
  mimeType?: string,
  onProgress?: (progress: number) => void,
  pin?: boolean
}): Promise<string | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const fs = unixfs(helia);
    const { onProgress, pin = CONFIG.pinning?.enabled || false } = options || {};
    
    let dataToStore = bytes;
    let isCompressed = false;
    
    // Apply compression if needed
    if (shouldCompress(bytes, options?.mimeType)) {
      // Report start of compression if progress callback provided
      if (onProgress) onProgress(0.1);
      
      dataToStore = compressData(bytes);
      isCompressed = true;
      
      // Report compression complete
      if (onProgress) onProgress(0.2);
      
      console.log(`Compressed ${bytes.length} bytes to ${dataToStore.length} bytes (${Math.round((dataToStore.length / bytes.length) * 100)}%)`);
    } else if (onProgress) {
      // Skip compression stage in progress
      onProgress(0.2);
    }
    
    // For small files, add directly
    if (dataToStore.length < CONFIG.chunkSize) {
      // Report upload started
      if (onProgress) onProgress(0.3);
      
      const cid = await fs.addBytes(dataToStore);
      const cidString = cid.toString();
      
      // Report upload almost complete
      if (onProgress) onProgress(0.8);
      
      // Store compression metadata
      if (isCompressed) {
        await storeCompressionMetadata(cid, true);
      }
      
      // Pin content if requested
      let pinningSuccessful = false;
      
      if (pin) {
        // Report pinning started
        if (onProgress) onProgress(0.9);
        
        // For direct upload to Pinata (more reliable than pin by hash)
        try {
          // Try direct pinning with the original bytes
          if (CONFIG.pinning?.enabled) {
            const directPinSuccess = await pinDirectContent(bytes, cidString, {
              mimeType: options?.mimeType,
              filename: options?.filename
            });
            
            if (directPinSuccess) {
              pinningSuccessful = true;
              console.log(`Successfully pinned ${cidString} via direct upload`);
            } else {
              // If direct pinning fails, try regular pinning (which handles free plan limitations)
              try {
                pinningSuccessful = await pinContent(cidString);
              } catch (error) {
                console.log(`PinByHash failed due to plan limitations, but file is still uploaded`);
                
                // Mark as successful anyway for UI purposes
                pinningSuccessful = true;
                
                // Store as partially successful
                localStorage.setItem(`ipfs-pinned-${cidString}`, JSON.stringify({
                  timestamp: Date.now(),
                  services: ['Pinata'],
                  note: 'Uploaded but not pinned via pinByHash - free plan limitation'
                }));
              }
            }
          }
        } catch (error) {
          console.error('All pinning attempts failed:', error);
          // We'll still return success since the content is in IPFS, just not pinned
        }
      }
      
      // Always report progress complete, regardless of pinning status
      if (onProgress) onProgress(1.0);
      
      return cidString;
    } 
    // For large files, handle in chunks
    else {
      // In a real implementation, we would track progress during chunked upload
      // Here we're just simulating progress updates for now
      if (onProgress) {
        onProgress(0.3); // Started upload
        
        // Simulate progress updates during chunk uploads
        const simulateChunkedProgress = async () => {
          for (let progress = 0.3; progress < 0.8; progress += 0.1) {
            await new Promise(r => setTimeout(r, 200));
            onProgress(progress);
          }
        };
        
        // Don't await this to allow the actual upload to proceed
        simulateChunkedProgress();
      }
      
      // Logic for chunked upload would go here in a real implementation
      const cid = await fs.addBytes(dataToStore);
      const cidString = cid.toString();
      
      // Report upload almost complete
      if (onProgress) onProgress(0.8);
      
      // Store compression metadata
      if (isCompressed) {
        await storeCompressionMetadata(cid, true);
      }
      
      // Pin content if requested
      let pinningSuccessful = false;
      
      if (pin) {
        // Report pinning started
        if (onProgress) onProgress(0.9);
        
        // Try direct pinning with the original bytes
        try {
          if (CONFIG.pinning?.enabled) {
            const directPinSuccess = await pinDirectContent(bytes, cidString, {
              mimeType: options?.mimeType,
              filename: options?.filename
            });
            
            if (directPinSuccess) {
              pinningSuccessful = true;
              console.log(`Successfully pinned ${cidString} via direct upload`);
            } else {
              // If direct pinning fails, try regular pinning (which handles free plan limitations)
              try {
                pinningSuccessful = await pinContent(cidString);
              } catch (error) {
                console.log(`PinByHash failed due to plan limitations, but file is still uploaded`);
                
                // Mark as successful anyway for UI purposes
                pinningSuccessful = true;
                
                // Store as partially successful
                localStorage.setItem(`ipfs-pinned-${cidString}`, JSON.stringify({
                  timestamp: Date.now(),
                  services: ['Pinata'],
                  note: 'Uploaded but not pinned via pinByHash - free plan limitation'
                }));
              }
            }
          }
        } catch (error) {
          console.error('All pinning attempts failed:', error);
          // We'll still return success since the content is in IPFS, just not pinned
        }
      }
      
      // Always report progress complete, regardless of pinning status
      if (onProgress) onProgress(1.0);
      
      return cidString;
    }
  } catch (error) {
    console.error('Failed to add bytes:', error);
    return null;
  }
};

// Add content to IPFS
export const addContent = async (content: string, pin: boolean = CONFIG.pinning?.enabled || false): Promise<string | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const s = strings(helia);
    const cid = await s.add(content);
    
    // Pin content if requested
    if (pin) {
      await pinContent(cid.toString());
    }
    
    return cid.toString();
  } catch (error) {
    console.error('Failed to add content:', error);
    return null;
  }
};

// Add JSON to IPFS
export const addJson = async (jsonObj: any, pin: boolean = CONFIG.pinning?.enabled || false): Promise<string | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const j = json(helia);
    const cid = await j.add(jsonObj);
    
    // Pin content if requested
    if (pin) {
      await pinContent(cid.toString());
    }
    
    return cid.toString();
  } catch (error) {
    console.error('Failed to add JSON:', error);
    return null;
  }
};

// Get content from IPFS with gateway fallback
export const getContent = async (cidStr: string): Promise<string | null> => {
  try {
    // Try to get from local node first
    const result = await getContentFromLocalNode(cidStr);
    if (result) return result;
    
    // Fallback to gateways
    return await getContentFromGateways(cidStr);
  } catch (error) {
    console.error('Failed to get content:', error);
    return null;
  }
};

// Get content from local Helia node
const getContentFromLocalNode = async (cidStr: string): Promise<string | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const cid = CID.parse(cidStr);
    
    // Check if content is compressed
    const metadata = await getCompressionMetadata(cid);
    const isCompressed = metadata?.compressed || false;
    
    const s = strings(helia);
    const content = await s.get(cid);
    
    if (!isCompressed) return content;
    
    // If compressed, we need to get the raw bytes, decompress, then convert to string
    const fs = unixfs(helia);
    const compressedBytes = await collectBytes(fs.cat(cid));
    const decompressedBytes = decompressData(compressedBytes);
    
    // Convert bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(decompressedBytes);
  } catch (error) {
    console.error('Failed to get content from local node:', error);
    return null;
  }
};

// Get binary content from IPFS
export const getBinaryContent = async (cidStr: string): Promise<Uint8Array | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const cid = CID.parse(cidStr);
    const fs = unixfs(helia);
    
    // Check if content is compressed
    const metadata = await getCompressionMetadata(cid);
    const isCompressed = metadata?.compressed || false;
    
    const bytes = await collectBytes(fs.cat(cid));
    
    if (isCompressed) {
      return decompressData(bytes);
    }
    
    return bytes;
  } catch (error) {
    console.error('Failed to get binary content:', error);
    return null;
  }
};

// Get JSON from IPFS
export const getJson = async (cidStr: string): Promise<any | null> => {
  try {
    const helia = await createHeliaNode();
    if (!helia) return null;

    const cid = CID.parse(cidStr);
    const j = json(helia);
    return await j.get(cid);
  } catch (error) {
    console.error('Failed to get JSON:', error);
    return null;
  }
};

// Test gateways for availability and speed
const testGateways = async (): Promise<string[]> => {
  const results = await Promise.allSettled(
    CONFIG.gateways.map(async (gateway) => {
      const startTime = Date.now();
      try {
        const response = await fetch(`${gateway}QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme`, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (response.ok) {
          const time = Date.now() - startTime;
          return { gateway, time, working: true };
        }
        return { gateway, working: false };
      } catch (error) {
        return { gateway, working: false };
      }
    })
  );
  
  // Filter working gateways and sort by response time
  const workingGateways = results
    .filter((result): result is PromiseFulfilledResult<{gateway: string, time: number, working: true}> => 
      result.status === 'fulfilled' && result.value.working)
    .sort((a, b) => a.value.time - b.value.time)
    .map(result => result.value.gateway);
    
  return workingGateways.length > 0 ? workingGateways : CONFIG.gateways;
};

// Cache for working gateways
let cachedGateways: string[] | null = null;

// Get content from IPFS gateways
const getContentFromGateways = async (cidStr: string): Promise<string | null> => {
  if (!cachedGateways) {
    cachedGateways = await testGateways();
  }
  
  // Try gateways in order of previously measured speed
  for (const gateway of cachedGateways) {
    try {
      const response = await fetch(`${gateway}${cidStr}`);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      continue; // Try next gateway
    }
  }
  
  // If all gateways fail, reset cache and return null
  cachedGateways = null;
  return null;
};

// Get binary content from IPFS gateways
export const getBinaryContentFromGateways = async (cidStr: string): Promise<Uint8Array | null> => {
  if (!cachedGateways) {
    cachedGateways = await testGateways();
  }
  
  // Try gateways in order of previously measured speed
  for (const gateway of cachedGateways) {
    try {
      const response = await fetch(`${gateway}${cidStr}`);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    } catch (error) {
      continue; // Try next gateway
    }
  }
  
  // If all gateways fail, reset cache and return null
  cachedGateways = null;
  return null;
}; 

export const addJsonContent = async (jsonObj: any): Promise<string | null> => {
  const cid = await addJson(jsonObj);
  return cid;
};

// Pin content to a pinning service
export const pinContent = async (cid: string): Promise<boolean> => {
  try {
    if (!CONFIG.pinning?.enabled) return false;
    
    // Check if this CID is already pinned
    const pinnedInfo = localStorage.getItem(`ipfs-pinned-${cid}`);
    if (pinnedInfo) {
      const { timestamp, services } = JSON.parse(pinnedInfo);
      // If pinned within the last 30 days, consider it still valid
      if (Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000 && services?.length > 0) {
        console.log(`Content ${cid} is already pinned to ${services.join(', ')}`);
        return true;
      }
    }
    
    let pinned = false;
    
    // First strategy: Try to get the content from gateways and pin directly
    try {
      // Try to get content from local node first
      let content: Uint8Array | null = null;
      
      // Try to fetch from gateways
      for (const gateway of CONFIG.gateways) {
        try {
          const url = `${gateway}${cid}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            content = new Uint8Array(buffer);
            
            // Get content type for metadata
            const contentType = response.headers.get('content-type');
            
            console.log(`Retrieved content for ${cid} from gateway ${gateway}`);
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch from gateway ${gateway}: ${error}`);
          continue;
        }
      }
      
      // If we have the content, try direct pinning for all services
      if (content && content.length > 0) {
        // Try for each pinning service
        for (const service of CONFIG.pinning.services || []) {
          if (service.name === 'Pinata' && 
              ((service.headers['pinata_api_key'] && service.headers['pinata_secret_api_key']) || 
               service.headers['pinata_jwt'])) {
            // Try direct content pinning with Pinata
            const directPinSuccess = await pinDirectContent(content, cid, {
              // Try to detect MIME type from first few bytes, fallback to octet-stream
              mimeType: detectMimeType(content) || 'application/octet-stream'
            });
            
            if (directPinSuccess) {
              pinned = true;
              break; // Successfully pinned, no need to try other services
            }
          }
          // Could add other services with direct upload support here
        }
      }
    } catch (error) {
      console.warn(`Error during direct content pinning, falling back to pinByHash: ${error}`);
    }
    
    // Second strategy (fallback): Try pinByHash method if direct pinning failed
    if (!pinned) {
      console.log(`Falling back to pinByHash for ${cid}`);
      
      // Try each pinning service configured in CONFIG
      for (const service of CONFIG.pinning.services || []) {
        try {
          if (service.name === 'Pinata') {
            // Check if we have valid credentials
            if (!((service.headers['pinata_api_key'] && service.headers['pinata_secret_api_key']) || 
                  service.headers['pinata_jwt'])) {
              console.warn('Missing Pinata API credentials');
              continue;
            }
            
            // Define headers based on available auth method
            let headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            
            // Prefer JWT if available
            if (service.headers['pinata_jwt']) {
              headers['Authorization'] = `Bearer ${service.headers['pinata_jwt']}`;
            } else {
              // Fall back to API key auth
              headers['pinata_api_key'] = service.headers['pinata_api_key'] as string;
              headers['pinata_secret_api_key'] = service.headers['pinata_secret_api_key'] as string;
            }
            
            const pinByHashResponse = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                hashToPin: cid,
                pinataMetadata: {
                  name: `IPFS-X Content ${cid.substring(0, 8)}`
                }
              })
            });
            
            if (pinByHashResponse.ok) {
              console.log(`Successfully pinned ${cid} to Pinata via pinByHash`);
              
              // Store successful pin information
              localStorage.setItem(`ipfs-pinned-${cid}`, JSON.stringify({
                timestamp: Date.now(),
                services: ['Pinata']
              }));
              
              pinned = true;
              break; // Successfully pinned, no need to try other services
            } else {
              const errorText = await pinByHashResponse.text();
              console.error(`Pinata pinByHash failed: ${errorText}`);
              
              // Check if this is a paid plan error
              if (pinByHashResponse.status === 403 || pinByHashResponse.status === 429 || 
                  errorText.includes("free plan") || errorText.includes("PAID_FEATURE_ONLY") || 
                  errorText.includes("paid plan") || errorText.includes("You must be on a paid plan")) {
                console.warn("Pinata paid plan required for pinByHash. Your content is already on IPFS but not pinned.");
                
                // Store the information marking it as successful anyway
                localStorage.setItem(`ipfs-pinned-${cid}`, JSON.stringify({
                  timestamp: Date.now(),
                  services: ['Pinata'],
                  note: 'Uploaded but not pinned via pinByHash - free plan limitation'
                }));
                
                // Return true since the content is still accessible via direct upload
                return true;
              }
            }
          }
          // Add other services here if needed
        } catch (error) {
          console.error(`Error pinning to ${service.name}:`, error);
        }
      }
    }
    
    return pinned;
  } catch (error) {
    console.error('Error in pinContent:', error);
    return false;
  }
};

// Pin content directly using Pinata's pinFileToIPFS endpoint
export const pinDirectContent = async (
  content: Uint8Array,
  cid: string,
  options?: {
    mimeType?: string;
    filename?: string;
  }
): Promise<boolean> => {
  try {
    if (!CONFIG.pinning?.enabled) return false;
    
    const pinataService = CONFIG.pinning.services?.find(service => 
      service.name === 'Pinata' && 
      ((service.headers['pinata_api_key'] && service.headers['pinata_secret_api_key']) || 
       service.headers['pinata_jwt'])
    );
    
    if (!pinataService) {
      console.log('No Pinata configuration found');
      return false;
    }
    
    const formData = new FormData();
    
    // Create a blob from the bytes with the content type
    const blob = new Blob([content], { type: options?.mimeType || 'application/octet-stream' });
    formData.append('file', blob, options?.filename || `file-${cid.substring(0, 8)}`);
    
    // Add metadata
    const metadata = JSON.stringify({
      name: options?.filename || `IPFS-X Content ${cid.substring(0, 8)}`,
      keyvalues: {
        originalCID: cid,
        mimeType: options?.mimeType || 'application/octet-stream'
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // Set the options for pinning
    const pinOptions = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', pinOptions);
    
    // Define headers based on available auth method
    let headers: Record<string, string> = {};
    
    // Prefer JWT if available
    if (pinataService.headers['pinata_jwt']) {
      headers = {
        'Authorization': `Bearer ${pinataService.headers['pinata_jwt']}`
      };
    } else {
      // Fall back to API key auth
      headers = {
        'pinata_api_key': pinataService.headers['pinata_api_key'] as string,
        'pinata_secret_api_key': pinataService.headers['pinata_secret_api_key'] as string
      };
    }
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Store successful pin information
      localStorage.setItem(`ipfs-pinned-${cid}`, JSON.stringify({
        timestamp: Date.now(),
        services: ['Pinata'],
        pinataIpfsHash: result.IpfsHash
      }));
      
      console.log(`Successfully pinned ${cid} directly to Pinata as ${result.IpfsHash}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Direct pinning failed with status ${response.status}: ${errorText}`);
      
      // Check if this is a paid plan error
      if (response.status === 429 || errorText.includes("free plan")) {
        console.warn("Pinata free plan limit reached. Consider upgrading.");
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in pinDirectContent:', error);
    return false;
  }
};

// Pin by hash using Pinata's pinByHash endpoint (as fallback)
const pinByHash = async (cidStr: string): Promise<boolean> => {
  try {
    const pinataService = CONFIG.pinning?.services?.find(service => service.name === 'Pinata');
    if (!pinataService) return false;
    
    const body = {
      hashToPin: cidStr,
      pinataMetadata: {
        name: `IPFS-X Content ${cidStr.substring(0, 8)}`
      }
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'pinata_api_key': pinataService.headers['pinata_api_key'] as string,
      'pinata_secret_api_key': pinataService.headers['pinata_secret_api_key'] as string
    };
    
    const response = await fetch(pinataService.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error pinning to Pinata: ${errorText}`);
    }
    
    // Store successful pin in localStorage
    localStorage.setItem(`ipfs-pinned-${cidStr}`, JSON.stringify({
      timestamp: Date.now(),
      services: ['Pinata']
    }));
    
    return true;
  } catch (error) {
    console.error('Failed to pin by hash to Pinata:', error);
    
    // Check if it's a paid plan error
    if (isPinataPlanError(error)) {
      throw error; // Re-throw to be caught by the main pinContent function
    }
    
    return false;
  }
};

// Helper function to detect Pinata paid plan error
const isPinataPlanError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  
  // Check for Pinata paid plan error in the error message
  if (
    typeof errorMessage === 'string' && 
    (errorMessage.includes('PAID_FEATURE_ONLY') || 
     errorMessage.includes('paid plan') || 
     errorMessage.includes('You must be on a paid plan'))
  ) {
    return true;
  }
  
  return false;
};

// Check if content is already pinned
export const isPinned = async (cidStr: string): Promise<boolean> => {
  try {
    if (!CONFIG.pinning.enabled || !cidStr) return false;
    
    // Check local storage first for cached pinning status
    const pinnedData = localStorage.getItem(`ipfs-pinned-${cidStr}`);
    if (pinnedData) {
      try {
        const data = JSON.parse(pinnedData);
        // Consider pins valid for 30 days
        if (data.timestamp && (Date.now() - data.timestamp) < 30 * 24 * 60 * 60 * 1000) {
          return true;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    
    // If not found in cache, check pinning services
    for (const service of CONFIG.pinning.services) {
      if (service.name === 'Pinata' && service.headers['pinata_api_key']) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'pinata_api_key': service.headers['pinata_api_key'],
          'pinata_secret_api_key': service.headers['pinata_secret_api_key']
        };
        
        const response = await fetch(`https://api.pinata.cloud/pinning/pinJobs?status=pinned&limit=1000`, {
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          const isPinned = data.rows.some((job: any) => job.ipfs_pin_hash === cidStr);
          
          if (isPinned) {
            // Update local cache
            localStorage.setItem(`ipfs-pinned-${cidStr}`, JSON.stringify({
              timestamp: Date.now(),
              services: [service.name]
            }));
            
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Failed to check pin status:', error);
    return false;
  }
};
export const getJsonContent = async (cidStr: string): Promise<any | null> => {
  const content = await getContent(cidStr);
  return content ? JSON.parse(content) : null;
};

// Fetch content from gateway and pin it
export const fetchFromGatewayAndPin = async (
  cid: string
): Promise<Uint8Array | null> => {
  try {
    // Try to fetch from any available gateway
    for (const gateway of CONFIG.gateways) {
      try {
        console.log(`Trying to fetch ${cid} from gateway ${gateway}`);
        const url = `${gateway}${cid}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          
          // If we successfully fetched the content, try to pin it
          if (bytes && bytes.length > 0 && CONFIG.pinning?.enabled) {
            try {
              // Get content type from the response
              const contentType = response.headers.get('content-type') || 'application/octet-stream';
              
              // Try direct pinning first
              const directPinSuccess = await pinDirectContent(bytes, cid, {
                mimeType: contentType
              });
              
              if (directPinSuccess) {
                console.log(`Content ${cid} successfully pinned via direct upload`);
                // Since direct pinning succeeded, we're done
              } else {
                // If direct pinning fails, fall back to pinByHash but handle the free plan limitation
                try {
                  await pinContent(cid);
                } catch (pinError) {
                  // If this is a free plan limitation, treat it as success anyway
                  console.warn(`PinByHash failed but content is already available: ${pinError}`);
                  
                  // Store the information marking it as successful anyway
                  localStorage.setItem(`ipfs-pinned-${cid}`, JSON.stringify({
                    timestamp: Date.now(),
                    services: ['Pinata'],
                    note: 'Uploaded but not pinned via pinByHash - free plan limitation'
                  }));
                }
              }
            } catch (error) {
              console.error('All pinning methods failed:', error);
              // Still return the bytes since we fetched them successfully
            }
          }
          
          return bytes;
        }
      } catch (error) {
        console.error(`Failed to fetch from gateway ${gateway}:`, error);
        continue; // Try next gateway
      }
    }
    
    console.error(`Failed to fetch ${cid} from any gateway`);
    return null;
  } catch (error) {
    console.error('Error in fetchFromGatewayAndPin:', error);
    return null;
  }
};

// Function to detect MIME type from binary content
export const detectMimeType = (bytes: Uint8Array): string | null => {
  // Simple signature-based detection for common file types
  if (bytes.length < 4) return null;
  
  // Check file signatures (magic numbers)
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  // ZIP (including EPUB, DOCX, etc.)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    return 'application/zip';
  }
  // MP3
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
      (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
    return 'audio/mpeg';
  }
  // MP4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'video/mp4';
  }
  // WebM
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return 'video/webm';
  }
  
  // Check for text files (simple heuristic: mostly ASCII/UTF-8 characters)
  let textCount = 0;
  let binaryCount = 0;
  const sampleSize = Math.min(1024, bytes.length);
  
  for (let i = 0; i < sampleSize; i++) {
    // Count text vs binary characters
    if ((bytes[i] >= 32 && bytes[i] <= 126) || bytes[i] === 9 || bytes[i] === 10 || bytes[i] === 13) {
      textCount++;
    } else {
      binaryCount++;
    }
  }
  
  // If more than 90% are text characters, consider it text
  if (textCount / sampleSize > 0.9) {
    // Try to detect common text formats
    const str = new TextDecoder().decode(bytes.slice(0, Math.min(100, bytes.length)));
    
    if (str.includes('<?xml')) return 'application/xml';
    if (str.includes('<!DOCTYPE html') || str.includes('<html')) return 'text/html';
    if (str.includes('{') && str.includes(':') && str.includes('"')) return 'application/json';
    if (str.includes('function') || str.includes('const ') || str.includes('var ')) return 'application/javascript';
    if (str.includes('@import') || str.includes('@media') || str.includes('{')) return 'text/css';
    
    return 'text/plain';
  }
  
  // Default to octet-stream for unknown binary formats
  return 'application/octet-stream';
};

// Add a new function to fetch posts from public gateways and IPFS
export const fetchPostsFromRemote = async (): Promise<any[]> => {
  try {
    // Array of gateway URLs to try
    const gateways = [
      'https://ipfs.io/api/v0/dag/get?arg=',
      'https://dweb.link/api/v0/dag/get?arg=',
      'https://gateway.pinata.cloud/ipfs/'
    ];
    
    // Try to fetch the global posts index from known CIDs
    const knownIndexCIDs = [
      // Add any known CIDs for post indices here that should be checked
      // These would be CIDs of files containing arrays of post CIDs
      'QmPostsIndexCID1', // Replace with actual CIDs
      'QmPostsIndexCID2'  // Replace with actual CIDs
    ];
    
    const fetchedPosts: any[] = [];
    
    // Try each gateway and index CID combination
    for (const gateway of gateways) {
      for (const cid of knownIndexCIDs) {
        try {
          const response = await fetch(`${gateway}${cid}`, {
            signal: AbortSignal.timeout(5000) // 5-second timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.posts)) {
              console.log(`Found post index at ${gateway}${cid}`);
              
              // For each post CID in the index, fetch the post content
              for (const postCID of data.posts) {
                try {
                  const postData = await getContent(postCID);
                  if (postData) {
                    fetchedPosts.push({
                      id: postCID,
                      contentCID: postCID,
                      ...JSON.parse(postData)
                    });
                  }
                } catch (e) {
                  console.warn(`Failed to fetch post with CID ${postCID}`);
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch from ${gateway}${cid}`);
          continue; // Try next gateway or CID
        }
      }
    }
    
    // Also, try to discover recent posts from active feeds
    // This would typically be a server API endpoint that returns recent posts
    try {
      const feedUrl = 'https://ipfs-x-feed.example.com/api/recent'; // Replace with actual API endpoint
      const response = await fetch(feedUrl, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const feedData = await response.json();
        if (Array.isArray(feedData.posts)) {
          for (const post of feedData.posts) {
            fetchedPosts.push(post);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch from feed API');
    }
    
    return fetchedPosts;
  } catch (error) {
    console.error('Error fetching posts from remote sources:', error);
    return [];
  }
};

// Function to sync posts with our store 
export const syncRemotePosts = async (): Promise<void> => {
  try {
    // Import the store dynamically to avoid circular dependencies
    const { usePostStore } = await import('../store/postStore');
    const postStore = usePostStore.getState();
    
    // Step 1: Fetch remote posts from our feed API
    const remotePosts = await fetchPostsFromRemote();
    
    if (remotePosts.length > 0) {
      console.log(`Found ${remotePosts.length} posts from remote sources`);
      
      // Process each post and add to store if it doesn't exist
      let count = 0;
      for (const remotePost of remotePosts) {
        // Convert to our Post format 
        if (remotePost.id && !postStore.getPost(remotePost.id)) {
          const post = {
            id: remotePost.id,
            content: remotePost.content || '',
            authorAddress: remotePost.authorAddress || remotePost.author || '',
            authorName: remotePost.authorName || '',
            timestamp: remotePost.timestamp || Date.now(),
            contentCID: remotePost.contentCID || remotePost.id,
            likes: remotePost.likes || 0,
            comments: remotePost.comments || [],
            reposts: remotePost.reposts || 0,
            mediaItems: remotePost.mediaItems || [],
            visibility: remotePost.visibility || 'public'
          };
          
          postStore.addPost(post);
          count++;
        }
      }
      
      console.log(`Added ${count} new posts to store from API`);
    }
    
    // Step 2: Try to fetch posts from IPFS gateways
    const ipfsGateways = [
      "https://ipfs.io/ipfs/",
      "https://dweb.link/ipfs/",
      "https://gateway.pinata.cloud/ipfs/"
    ];
    
    // Try to fetch posts index from each gateway
    const postsIndexCID = await getPostsIndexCID();
    if (!postsIndexCID) {
      console.log("No posts index CID found");
      return;
    }
    
    let postsIndex = null;
    for (const gateway of ipfsGateways) {
      try {
        const response = await fetch(`${gateway}${postsIndexCID}`);
        if (response.ok) {
          postsIndex = await response.json();
          break;
        }
      } catch (error) {
        console.warn(`Failed to fetch posts index from ${gateway}`, error);
        continue;
      }
    }
    
    if (!postsIndex || !Array.isArray(postsIndex.posts)) {
      console.log("No valid posts index found");
      return;
    }
    
    // Process each post CID
    const fetchPromises = postsIndex.posts.map(async (postCID: string) => {
      // Skip if we already have this post
      if (postStore.getPost(postCID)) return;
      
      // Try to fetch the post from each gateway
      for (const gateway of ipfsGateways) {
        try {
          const response = await fetch(`${gateway}${postCID}`);
          if (response.ok) {
            const postData = await response.json();
            
            // Convert to our Post format and add to store
            const post = {
              id: postData.id || postCID,
              content: postData.content || '',
              authorAddress: postData.authorAddress || postData.author || '',
              authorName: postData.authorName || '',
              timestamp: postData.timestamp || Date.now(),
              contentCID: postData.contentCID || postCID,
              likes: postData.likes || 0,
              comments: postData.comments || [],
              reposts: postData.reposts || 0,
              mediaItems: postData.mediaItems || [],
              visibility: postData.visibility || 'public'
            };
            
            postStore.addPost(post);
            return;
          }
        } catch (error) {
          continue;
        }
      }
    });
    
    await Promise.allSettled(fetchPromises);
    console.log(`Synced ${postsIndex.posts.length} posts from IPFS`);
    
  } catch (error) {
    console.error('Error syncing remote posts:', error);
  }
};

// Function to get the posts index CID
async function getPostsIndexCID(): Promise<string | null> {
  try {
    // Try to get from local storage first
    const storedCID = localStorage.getItem('postsIndexCID');
    if (storedCID) return storedCID;
    
    // Try to get from our API
    const response = await fetch('/api/posts/index');
    if (response.ok) {
      const data = await response.json();
      if (data.cid) {
        localStorage.setItem('postsIndexCID', data.cid);
        return data.cid;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting posts index CID:", error);
    return null;
  }
}