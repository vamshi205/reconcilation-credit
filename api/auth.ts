// Vercel Serverless Function for Authentication
// This file should be in /api/auth.ts for Vercel serverless functions
// Password validation happens on the server, not in client code

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Password hash (use bcrypt in production)
// This should be set in Vercel environment variables as APP_PASSWORD_HASH
// Generate hash: bcrypt.hashSync('your_password', 10)
const PASSWORD_HASH = process.env.APP_PASSWORD_HASH || '';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  // Simple hash comparison (use bcrypt.compare in production)
  // For now, we'll use a simple check
  const expectedPassword = process.env.APP_PASSWORD;
  
  if (!expectedPassword) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Compare passwords
  if (password === expectedPassword) {
    // Generate a simple token (use JWT in production)
    const token = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
    
    // Set secure cookie (in production, use httpOnly, secure, sameSite)
    res.setHeader('Set-Cookie', `auth_token=${token}; Path=/; Max-Age=86400`); // 24 hours
    
    return res.status(200).json({ 
      success: true, 
      token,
      message: 'Authentication successful' 
    });
  }

  return res.status(401).json({ error: 'Invalid password' });
}

