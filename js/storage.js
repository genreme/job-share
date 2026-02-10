/**
 * Storage Module - localStorage wrapper and IndexedDB document storage
 */

// ============================================
// STORAGE POLYFILL - localStorage wrapper
// ============================================
window.storage = window.storage || {
    async get(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? { value } : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },
    async set(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            if (e.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please export your data and clear old backups.');
            }
            throw e;
        }
    },
    async remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            throw e;
        }
    }
};

// ============================================
// INDEXEDDB DOCUMENT STORAGE
// ============================================
const DocStore = {
    dbName: 'JobSearchDocuments',
    dbVersion: 1,
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('documents')) {
                    const docStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
                    docStore.createIndex('jobId', 'jobId', { unique: false });
                    docStore.createIndex('type', 'type', { unique: false });
                    docStore.createIndex('name', 'name', { unique: false });
                }

                if (!db.objectStoreNames.contains('fileRefs')) {
                    const refStore = db.createObjectStore('fileRefs', { keyPath: 'id', autoIncrement: true });
                    refStore.createIndex('jobId', 'jobId', { unique: false });
                    refStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    },

    async saveDocument(jobId, file, type = 'general') {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const tx = this.db.transaction(['documents'], 'readwrite');
                const store = tx.objectStore('documents');

                const doc = {
                    jobId: jobId,
                    name: file.name,
                    type: type,
                    mimeType: file.type,
                    size: file.size,
                    data: reader.result,
                    uploadedAt: new Date().toISOString()
                };

                const request = store.add(doc);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    },

    async saveFileRef(jobId, path, name, type = 'general') {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['fileRefs'], 'readwrite');
            const store = tx.objectStore('fileRefs');

            const ref = {
                jobId: jobId,
                path: path,
                name: name,
                type: type,
                addedAt: new Date().toISOString()
            };

            const request = store.add(ref);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getDocumentsForJob(jobId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['documents', 'fileRefs'], 'readonly');

            const docs = [];
            const refs = [];

            const docStore = tx.objectStore('documents');
            const docIndex = docStore.index('jobId');
            const docRequest = docIndex.getAll(jobId);

            docRequest.onsuccess = () => {
                docs.push(...docRequest.result);
            };

            const refStore = tx.objectStore('fileRefs');
            const refIndex = refStore.index('jobId');
            const refRequest = refIndex.getAll(jobId);

            refRequest.onsuccess = () => {
                refs.push(...refRequest.result);
            };

            tx.oncomplete = () => {
                resolve({
                    documents: docs,
                    fileRefs: refs
                });
            };

            tx.onerror = () => reject(tx.error);
        });
    },

    async getAllDocuments() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['documents', 'fileRefs'], 'readonly');

            const docs = [];
            const refs = [];

            const docRequest = tx.objectStore('documents').getAll();
            docRequest.onsuccess = () => docs.push(...docRequest.result);

            const refRequest = tx.objectStore('fileRefs').getAll();
            refRequest.onsuccess = () => refs.push(...refRequest.result);

            tx.oncomplete = () => resolve({ documents: docs, fileRefs: refs });
            tx.onerror = () => reject(tx.error);
        });
    },

    async deleteDocument(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['documents'], 'readwrite');
            const request = tx.objectStore('documents').delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deleteFileRef(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['fileRefs'], 'readwrite');
            const request = tx.objectStore('fileRefs').delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getStorageUsage() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['documents'], 'readonly');
            const request = tx.objectStore('documents').getAll();

            request.onsuccess = () => {
                const docs = request.result;
                const totalSize = docs.reduce((sum, doc) => sum + (doc.size || 0), 0);
                resolve({
                    count: docs.length,
                    totalSize: totalSize,
                    formattedSize: formatFileSize(totalSize)
                });
            };
            request.onerror = () => reject(request.error);
        });
    }
};

// Initialize DocStore on page load
DocStore.init().catch(err => console.error('Failed to init DocStore:', err));
