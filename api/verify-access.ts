// Vercel Serverless Function for Access Code Verification
// This provides better security than client-side validation
// File location: /api/verify-access.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessCode } = req.body;

    if (!accessCode) {
      return res.status(400).json({ error: 'Access code required' });
    }

    // Get access code from server-side environment variable
    // This is NOT exposed to the client!
    const validAccessCode = process.env.ACCESS_CODE;

    if (!validAccessCode) {
      // If no access code is configured, deny access
      console.error('ACCESS_CODE environment variable not set');
      return res.status(403).json({ error: 'Access denied. Server not configured.' });
    }

    // Compare access codes (trim to handle whitespace)
    const trimmedInput = String(accessCode).trim();
    const trimmedValid = String(validAccessCode).trim();

    if (trimmedInput === trimmedValid) {
      return res.status(200).json({ 
        success: true,
        message: 'Access granted' 
      });
    }

    return res.status(403).json({ error: 'Invalid access code' });
  } catch (error) {
    console.error('Error in verify-access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

