
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { LeadData } from '../types';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCAUsBKyi0ZAiLyt8qM3GsHJh3dKAmK06s",
  authDomain: "ai-landing-todoo.firebaseapp.com",
  projectId: "ai-landing-todoo",
  storageBucket: "ai-landing-todoo.firebasestorage.app",
  messagingSenderId: "931468359054",
  appId: "1:931468359054:web:a6c3267d9d526b63cda0df",
  measurementId: "G-CNE6GCDQFQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics is optional but included since it was provided in the configuration snippet
const analytics = getAnalytics(app);
const db = getFirestore(app);

export async function saveLeadToFirestore(data: Partial<LeadData>): Promise<{ success: boolean; message: string }> {
  console.log("Intentando guardar Lead:", data);

  try {
    await addDoc(collection(db, "leads"), {
      ...data,
      createdAt: new Date()
    });
    return { success: true, message: "Lead guardado exitosamente en base de datos." };
  } catch (error: any) {
    console.error("Error guardando en Firestore:", error);
    return { success: false, message: "Error al guardar: " + error.message };
  }
}
