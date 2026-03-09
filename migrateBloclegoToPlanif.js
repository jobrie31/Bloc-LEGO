import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// ===== SOURCE = ancien projet bloc-lego =====
const sourceConfig = {
  apiKey: "AIzaSyCQxGJlYX-PHyX_QiLoVtYTlDiXln-9LaY",
  authDomain: "bloc-lego.firebaseapp.com",
  projectId: "bloc-lego",
  storageBucket: "bloc-lego.firebasestorage.app",
  messagingSenderId: "551752798435",
  appId: "1:551752798435:web:2848778b2bbe503b87b5d6",
  measurementId: "G-EP7LDMD2QB",
};

// ===== DEST = nouveau projet planification-styro =====
const destConfig = {
  apiKey: "AIzaSyANkJRYoCA1e2CsCoFslfnKJzgV-KlRHn8",
  authDomain: "planification-styro.firebaseapp.com",
  projectId: "planification-styro",
  storageBucket: "planification-styro.appspot.com", // ajuste si ton vrai bucket est .firebasestorage.app
  messagingSenderId: "387018358469",
  appId: "1:387018358469:web:bf4436c734a15f69c3aac",
};

async function copyCollection(sourceDb, destDb, sourcePath, destPath) {
  const snap = await getDocs(collection(sourceDb, ...sourcePath));
  let copied = 0;

  for (const d of snap.docs) {
    const data = d.data() || {};
    const destRef = doc(destDb, ...destPath, d.id);
    await setDoc(
      destRef,
      {
        ...data,
        migratedAt: serverTimestamp(),
        migratedFrom: sourcePath.join("/"),
      },
      { merge: true }
    );
    copied += 1;
  }

  return copied;
}

async function migrate() {
  const sourceApp = initializeApp(sourceConfig, "old-bloclego");
  const destApp = initializeApp(destConfig, "new-planif");

  const sourceDb = getFirestore(sourceApp);
  const destDb = getFirestore(destApp);

  try {
    console.log("Migration clients/bloc-lego...");
    const n1 = await copyCollection(
      sourceDb,
      destDb,
      ["clients", "bloc-lego", "trajets"],
      ["clients", "bloc-lego", "trajets"]
    );
    console.log(`trajets copiés: ${n1}`);

    console.log("Migration clients/bloc-lego/users...");
    const usersSnap = await getDocs(collection(sourceDb, "clients", "bloc-lego", "users"));
    let usersCopied = 0;
    let appCopied = 0;
    let runsCopied = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      usersCopied += 1;

      // app/v1
      const appSnap = await getDocs(collection(sourceDb, "clients", "bloc-lego", "users", uid, "app"));
      for (const d of appSnap.docs) {
        await setDoc(
          doc(destDb, "clients", "bloc-lego", "users", uid, "app", d.id),
          {
            ...(d.data() || {}),
            migratedAt: serverTimestamp(),
            migratedFrom: `clients/bloc-lego/users/${uid}/app/${d.id}`,
          },
          { merge: true }
        );
        appCopied += 1;
      }

      // runs
      const runsSnap = await getDocs(collection(sourceDb, "clients", "bloc-lego", "users", uid, "runs"));
      for (const d of runsSnap.docs) {
        await setDoc(
          doc(destDb, "clients", "bloc-lego", "users", uid, "runs", d.id),
          {
            ...(d.data() || {}),
            migratedAt: serverTimestamp(),
            migratedFrom: `clients/bloc-lego/users/${uid}/runs/${d.id}`,
          },
          { merge: true }
        );
        runsCopied += 1;
      }
    }

    console.log(`users trouvés: ${usersCopied}`);
    console.log(`app copiés: ${appCopied}`);
    console.log(`runs copiés: ${runsCopied}`);

    console.log("Migration clients/inventaire-styro/banquePanneaux...");
    const i1 = await copyCollection(
      sourceDb,
      destDb,
      ["clients", "inventaire-styro", "banquePanneaux"],
      ["clients", "inventaire-styro", "banquePanneaux"]
    );
    console.log(`banquePanneaux copiés: ${i1}`);

    console.log("Migration clients/inventaire-styro/banqueMoulures...");
    const i2 = await copyCollection(
      sourceDb,
      destDb,
      ["clients", "inventaire-styro", "banqueMoulures"],
      ["clients", "inventaire-styro", "banqueMoulures"]
    );
    console.log(`banqueMoulures copiés: ${i2}`);

    console.log("Migration clients/inventaire-styro/requisitionsMoulures...");
    const i3 = await copyCollection(
      sourceDb,
      destDb,
      ["clients", "inventaire-styro", "requisitionsMoulures"],
      ["clients", "inventaire-styro", "requisitionsMoulures"]
    );
    console.log(`requisitionsMoulures copiées: ${i3}`);

    console.log("Migration clients/inventaire-styro/reglages...");
    const i4 = await copyCollection(
      sourceDb,
      destDb,
      ["clients", "inventaire-styro", "reglages"],
      ["clients", "inventaire-styro", "reglages"]
    );
    console.log(`reglages copiés: ${i4}`);

    console.log("✅ Migration Firestore terminée.");
  } catch (e) {
    console.error("❌ Erreur migration:", e);
  } finally {
    await deleteApp(sourceApp);
    await deleteApp(destApp);
  }
}

migrate();