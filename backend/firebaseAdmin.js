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
let initError = null;
let credentialSource = 'none';
let debugInfo = {};

// Clean wrapping quotes and spaces from env vars
const cleanEnvVar = (val) => {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
};

// Robust PEM private key formatter
const cleanPrivateKey = (key) => {
  if (!key) return '';
  
  let cleaned = cleanEnvVar(key);
  
  // Replace literal '\n' sequences (two characters: '\' and 'n') with real newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Strip out any Windows carriage return characters
  cleaned = cleaned.replace(/\r/g, '');
  
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  
  // Isolate the base64 body of the key
  let body = cleaned;
  if (body.includes(header)) {
    body = body.split(header)[1];
  }
  if (body.includes(footer)) {
    body = body.split(footer)[0];
  }
  
  // Strip all non-base64 characters (spaces, line breaks, tabs, etc.)
  body = body.replace(/[^A-Za-z0-9+/=]/g, '');
  
  // Re-wrap the body text every 64 characters (standard PEM encoding format)
  const lines = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64));
  }
  
  return `${header}\n${lines.join('\n')}\n${footer}\n`;
};

function getFirebaseCredentials() {
  // 1. Try Service Account Path
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  debugInfo.saPath = saPath || 'undefined/empty';
  
  if (saPath) {
    // Check in root first (original logic)
    let resolvedPath = path.resolve(__dirname, '..', saPath);
    if (!fs.existsSync(resolvedPath)) {
      // Fallback to checking in the backend folder directly
      resolvedPath = path.resolve(__dirname, saPath);
    }
    
    debugInfo.resolvedSaPath = resolvedPath;
    debugInfo.saFileExists = fs.existsSync(resolvedPath);

    if (fs.existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        return cert(serviceAccount);
      } catch (e) {
        console.error('Error parsing service account file:', e);
        debugInfo.saFileError = e.message || e.toString();
      }
    }
  }

  const projectId = cleanEnvVar(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnvVar(process.env.FIREBASE_CLIENT_EMAIL);
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY; // Keep raw for cleanPrivateKey helper

  debugInfo.projectId = projectId;
  debugInfo.clientEmail = clientEmail;
  debugInfo.hasPrivateKey = !!rawPrivateKey;
  debugInfo.cond1 = !!projectId;
  debugInfo.cond2 = !!clientEmail;
  debugInfo.cond3 = (clientEmail !== 'your_firebase_client_email@your_project_id.iam.gserviceaccount.com');
  debugInfo.cond4 = !!rawPrivateKey;
  debugInfo.cond5 = !rawPrivateKey.includes('YOUR_PRIVATE_KEY_HERE');

  // 2. Try individual environment variables (only if actual client email is provided)
  if (
    projectId &&
    clientEmail &&
    clientEmail !== 'your_firebase_client_email@your_project_id.iam.gserviceaccount.com' &&
    rawPrivateKey &&
    !rawPrivateKey.includes('YOUR_PRIVATE_KEY_HERE')
  ) {
    try {
      const privateKey = cleanPrivateKey(rawPrivateKey);
      return cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } catch (e) {
      debugInfo.certError = e.message || e.toString();
      throw new Error(`Failed to parse certificate: ${e.message || e}`);
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
    credentialSource = 'env-or-file';
    console.log('✅ Firebase Admin: Connected to Firestore database');
  } else {
    console.warn('⚠️ Firebase Admin: Credentials not found in .env or serviceAccountKey.json. Server will fall back to local db.json database.');
    isMock = true;
    credentialSource = 'none-fallback';
  }
} catch (err) {
  console.error('❌ Firebase Admin: Failed to initialize. Falling back to db.json:', err);
  initError = err.message || err.toString();
  isMock = true;
  credentialSource = 'error-fallback';
}

export { db, isMock, initError, credentialSource, debugInfo };
