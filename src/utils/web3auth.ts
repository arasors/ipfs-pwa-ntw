// Extending global window interface for TypeScript definitions
declare global {
  interface Window {
    ethereum?: any;
  }
}

import { ethers } from 'ethers';
import { createWalletClient, custom } from 'viem';

// Create Ethereum provider
export async function createEthereumProvider() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (window.ethereum) {
    try {
      // MetaMask or another Web3 provider exists
      const provider = new ethers.BrowserProvider(window.ethereum);
      return provider;
    } catch (error) {
      console.error('Error creating Ethereum provider:', error);
      return null;
    }
  } else {
    console.log('Web3 provider not found. Please install MetaMask or another wallet.');
    return null;
  }
}

// Authenticate with wallet
export async function connectWallet() {
  try {
    const provider = await createEthereumProvider();
    if (!provider) {
      throw new Error('Web3 provider not found');
    }
    
    // Request permission to access user accounts
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Get connected account
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    return address;
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    throw error;
  }
}

// Authenticate with signature
export async function signMessage(message: string) {
  try {
    const provider = await createEthereumProvider();
    if (!provider) {
      throw new Error('Web3 provider not found');
    }
    
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(message);
    return signature;
  } catch (error) {
    console.error('Error signing message:', error);
    throw error;
  }
}

// Verify user identity
export async function verifySignature(message: string, signature: string, address: string): Promise<boolean> {
  try {
    const signerAddress = ethers.verifyMessage(message, signature);
    return signerAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Create wallet client with viem (for ConnectKit and other libraries)
export function createViemWalletClient() {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  
  return createWalletClient({
    transport: custom(window.ethereum)
  });
} 