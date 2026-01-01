// Vercel Serverless Function for User Authentication
// Validates USER_ID and PASSWORD from environment variables
// File location: /api/authenticate.ts

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
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password required' });
    }

    // Get credentials from server-side environment variables
    // These are NOT exposed to the client!
    const validUserId = process.env.USER_ID;
    const validPassword = process.env.APP_PASSWORD;

    if (!validUserId || !validPassword) {
      console.error('USER_ID or APP_PASSWORD environment variable not set');
      return res.status(403).json({ error: 'Access denied. Server not configured.' });
    }

    // Compare credentials (trim to handle whitespace)
    const trimmedInputUserId = String(userId).trim();
    const trimmedInputPassword = String(password).trim();
    const trimmedValidUserId = String(validUserId).trim();
    const trimmedValidPassword = String(validPassword).trim();

    if (trimmedInputUserId === trimmedValidUserId && trimmedInputPassword === trimmedValidPassword) {
      // Generate a simple session token
      const sessionToken = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
      
      return res.status(200).json({ 
        success: true,
        message: 'Authentication successful',
        token: sessionToken
      });
    }

    return res.status(403).json({ error: 'Invalid user ID or password' });
  } catch (error) {
    console.error('Error in authenticate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

