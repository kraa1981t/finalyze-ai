export const initDB = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open('FinalyzeDB', 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('audio')) {
      db.createObjectStore('audio');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const saveAudioBlob = async (key: string, blob: Blob) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    const store = tx.objectStore('audio');
    const req = store.put(blob, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getAudioBlob = async (key: string) => {
  const db = await initDB();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction('audio', 'readonly');
    const store = tx.objectStore('audio');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const deleteAudioBlob = async (key: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    const store = tx.objectStore('audio');
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
