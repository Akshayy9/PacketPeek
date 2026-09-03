import { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin only once
if (!getApps().length) {
  // Option 1: Use a service account JSON file if available
  // const serviceAccount = require('../../firebase-admin.json');
  // initializeApp({
  //   credential: credential.cert(serviceAccount)
  // });

  // Option 2: Default initialization (requires GOOGLE_APPLICATION_CREDENTIALS env var)
  try {
    initializeApp({ projectId: 'packetpeek-adc7b' });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }
};
