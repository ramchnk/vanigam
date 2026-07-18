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
      let formattedKey = rawPrivateKey;
      
      // If it is single-line (has no newlines), reconstruct the standard PEM formatting
      if (!formattedKey.includes('\n')) {
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        let body = formattedKey;
        
        if (body.startsWith(header)) body = body.substring(header.length);
        if (body.endsWith(footer)) body = body.substring(0, body.length - footer.length);
        
        body = body.replace(/\s+/g, ''); // strip any spaces
        
        const lines = [];
        for (let i = 0; i < body.length; i += 64) {
          lines.push(body.substring(i, i + 64));
        }
        formattedKey = `${header}\n${lines.join('\n')}\n${footer}\n`;
      } else {
        // Replace escaped newlines
        formattedKey = formattedKey.replace(/\\n/g, '\n');
      }

      return cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
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
