// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Generic API request wrapper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Content API
export const contentApi = {
  // Upload new content
  async upload(data: FormData): Promise<{
    contentId: string;
    ipfsHash: string;
    encryptionKey: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/content/upload`, {
      method: 'POST',
      body: data, // FormData handles its own Content-Type
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Get content by ID
  async getById(contentId: string): Promise<{
    id: string;
    title: string;
    creator: string;
    price: number;
    discountedPrice: number;
    credentialType: string;
    category: string;
    description: string;
    createdAt: string;
    tags: string[];
    contentHash: string;
    encrypted: boolean;
  }> {
    return apiRequest(`/api/content/${contentId}`);
  },

  // List all content (marketplace)
  async list(filters?: {
    category?: string;
    credentialType?: string;
    search?: string;
  }): Promise<Array<{
    id: string;
    title: string;
    creator: string;
    price: number;
    discountedPrice: number;
    credentialType: string;
    category: string;
    description: string;
    createdAt: string;
    tags: string[];
  }>> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.credentialType) params.append('credentialType', filters.credentialType);
    if (filters?.search) params.append('search', filters.search);

    return apiRequest(`/api/content?${params.toString()}`);
  },

  // Get creator's content
  async getByCreator(creatorAddress: string): Promise<Array<{
    id: string;
    title: string;
    category: string;
    price: number;
    views: number;
    purchases: number;
    earnings: number;
    createdAt: string;
    status: string;
  }>> {
    return apiRequest(`/api/content/creator/${creatorAddress}`);
  },

  // Decrypt content with key
  async decrypt(contentId: string, decryptionKey: string): Promise<{
    content: string;
    ipfsHash: string;
  }> {
    return apiRequest(`/api/content/${contentId}/decrypt`, {
      method: 'POST',
      body: JSON.stringify({ decryptionKey }),
    });
  },
};

// Payment API (matching backend routes)
export const paymentApi = {
  // Get payment quote
  async getQuote(contentIdHash: string, hasJournalistCredential: boolean = false): Promise<{
    contentId: string;
    price: string;
    tokenMint: string;
    sessionUuid: string;
    expiresAt: number;
  }> {
    return apiRequest('/api/quote', {
      method: 'POST',
      body: JSON.stringify({ 
        contentIdHash,
        hasJournalistCredential 
      }),
    });
  },

  // Submit payment with ZK proof
  async submitPayment(data: {
    sessionUuid: string;
    nullifierHash: string;
    amount: string;
    proof: {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
    };
    publicSignals: string[];
    txSignature?: string;
  }): Promise<{
    success: boolean;
    txSignature?: string;
    decryptionKey?: string;
    error?: string;
  }> {
    return apiRequest('/api/pay', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Poll payment status
  async checkStatus(sessionUuid: string): Promise<{
    status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
    decryptionKey?: string;
    txSignature?: string;
  }> {
    return apiRequest(`/api/status/${sessionUuid}`);
  },

  // Verify Wormhole VAA
  async verifyVAA(vaaBytes: string): Promise<{
    valid: boolean;
    decryptionKey?: string;
  }> {
    return apiRequest('/api/verify-vaa', {
      method: 'POST',
      body: JSON.stringify({ vaaBytes }),
    });
  },
};

// Credential API
export const credentialApi = {
  // Verify user credential
  async verify(userAddress: string, credentialType: string): Promise<{
    verified: boolean;
    proofHash?: string;
  }> {
    return apiRequest('/api/credentials/verify', {
      method: 'POST',
      body: JSON.stringify({ userAddress, credentialType }),
    });
  },
};

// IPFS API
export const ipfsApi = {
  // Get content from IPFS
  async get(hash: string): Promise<Blob> {
    const response = await fetch(`https://ipfs.io/ipfs/${hash}`);
    if (!response.ok) {
      throw new Error('Failed to fetch from IPFS');
    }
    return response.blob();
  },
};
