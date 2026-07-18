import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

let db = null;
let isMock = false;

function getFirebaseCredentials() {
  // 1. Try Service Account Path
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    // Check in root first (original logic)
    let resolvedPath = path.resolve(__dirname, '..', saPath);
    if (!fs.existsSync(resolvedPath)) {
      // Fallback to checking in the backend folder directly
      resolvedPath = path.resolve(__dirname, saPath);
    }

    if (fs.existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        return cert(serviceAccount);
      } catch (e) {
        console.error('Error parsing service account file:', e);
      }
    }
  }

  // Helper to clean wrapping quotes
  const cleanEnvVar = (val) => {
    if (!val) return '';
    let cleaned = val.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned;
  };

  const projectId = cleanEnvVar(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnvVar(process.env.FIREBASE_CLIENT_EMAIL);
  const rawPrivateKey = cleanEnvVar(process.env.FIREBASE_PRIVATE_KEY);

  // 2. Try individual environment variables (only if actual client email is provided)
  if (
    projectId &&
    clientEmail &&
    clientEmail !== 'your_firebase_client_email@your_project_id.iam.gserviceaccount.com' &&
    rawPrivateKey &&
    !rawPrivateKey.includes('YOUR_PRIVATE_KEY_HERE')
  ) {
    try {
      // Replace escaped newlines
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      return cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } catch (e) {
      console.error('Error constructing credentials from env variables:', e);
    }
  }

  return null;
}

try {
  const credential = getFirebaseCredentials();
  if (credential) {
    initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || undefined
    });
    db = getFirestore();
    console.log('✅ Firebase Admin: Connected to Firestore database');
  } else {
    console.warn('⚠️ Firebase Admin: Credentials not found in .env or serviceAccountKey.json. Server will fall back to local db.json database.');
    isMock = true;
  }
} catch (err) {
  console.error('❌ Firebase Admin: Failed to initialize. Falling back to db.json:', err);
  isMock = true;
}

export { db, isMock };

