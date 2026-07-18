import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  chooseUserScoreLibraryFolder,
  clearStoredUserScoreLibrary,
  deleteUserScoreFile,
  emptyUserScoreLibraryIndex,
  importUserScoreFiles,
  isUserScoreLibrarySupported,
  loadStoredUserScoreLibrary,
  queryUserScoreLibraryPermission,
  requestUserScoreLibraryPermission,
  saveStoredUserScoreLibrary,
  scanUserScoreLibrary,
  updateUserScoreLibraryMetadata,
} from "./userScoreLibrary";
import type {
  UserScoreLibraryEntry,
  UserScoreLibraryImportResult,
  UserScoreLibraryIndex,
  UserScoreLibraryMetadata,
  UserScoreLibraryPermission,
  UserScoreLibraryScanSummary,
} from "./userScoreLibrary";

type UserScoreLibraryContextValue = {
  chooseFolder: () => Promise<void>;
  deleteFile: (entry: UserScoreLibraryEntry) => Promise<void>;
  directoryHandle: FileSystemDirectoryHandle | null;
  disconnect: () => Promise<void>;
  error: string | null;
  importFiles: (files: readonly File[]) => Promise<UserScoreLibraryImportResult>;
  index: UserScoreLibraryIndex;
  isInitializing: boolean;
  isScanning: boolean;
  permission: UserScoreLibraryPermission;
  reconnect: () => Promise<void>;
  rescan: () => Promise<UserScoreLibraryScanSummary | null>;
  scanSummary: UserScoreLibraryScanSummary | null;
  supported: boolean;
  updateMetadata: (entryId: string, metadata: UserScoreLibraryMetadata) => Promise<void>;
};

const UserScoreLibraryContext = createContext<UserScoreLibraryContextValue | null>(null);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The local library could not be updated.";

export const UserScoreLibraryProvider = ({ children }: { children: ReactNode }) => {
  const supported = isUserScoreLibrarySupported();
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [index, setIndex] = useState<UserScoreLibraryIndex>(emptyUserScoreLibraryIndex);
  const [permission, setPermission] = useState<UserScoreLibraryPermission>(
    supported ? "prompt" : "unsupported",
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<UserScoreLibraryScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const indexRef = useRef(index);
  const scanPromiseRef = useRef<Promise<UserScoreLibraryScanSummary | null> | null>(null);

  useEffect(() => {
    handleRef.current = directoryHandle;
  }, [directoryHandle]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const rescan = useCallback((): Promise<UserScoreLibraryScanSummary | null> => {
    if (scanPromiseRef.current) return scanPromiseRef.current;
    const handle = handleRef.current;
    if (!handle) return Promise.resolve(null);

    const scan = (async () => {
      const currentPermission = await queryUserScoreLibraryPermission(handle);
      setPermission(currentPermission);
      if (currentPermission !== "granted") return null;
      setIsScanning(true);
      setError(null);
      try {
        const result = await scanUserScoreLibrary(handle, indexRef.current);
        const nextIndex = {
          entries: result.entries,
          issues: result.issues,
          lastScanAt: result.lastScanAt,
        };
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        setScanSummary(result.summary);
        await saveStoredUserScoreLibrary({ directoryHandle: handle, index: nextIndex });
        return result.summary;
      } catch (scanError) {
        setError(errorMessage(scanError));
        return null;
      } finally {
        setIsScanning(false);
      }
    })().finally(() => {
      scanPromiseRef.current = null;
    });
    scanPromiseRef.current = scan;
    return scan;
  }, []);

  useEffect(() => {
    let active = true;
    if (!supported) {
      setIsInitializing(false);
      return;
    }
    void loadStoredUserScoreLibrary()
      .then(async (stored) => {
        if (!active) return;
        const storedHandle = stored.directoryHandle ?? null;
        const storedIndex = stored.index ?? emptyUserScoreLibraryIndex();
        handleRef.current = storedHandle;
        indexRef.current = storedIndex;
        setDirectoryHandle(storedHandle);
        setIndex(storedIndex);
        const storedPermission = await queryUserScoreLibraryPermission(storedHandle);
        if (!active) return;
        setPermission(storedPermission);
        setIsInitializing(false);
        if (storedHandle && storedPermission === "granted") void rescan();
      })
      .catch((storageError) => {
        if (!active) return;
        setError(errorMessage(storageError));
        setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [rescan, supported]);

  const chooseFolder = useCallback(async () => {
    setError(null);
    try {
      const handle = await chooseUserScoreLibraryFolder();
      const nextIndex = emptyUserScoreLibraryIndex();
      handleRef.current = handle;
      indexRef.current = nextIndex;
      setDirectoryHandle(handle);
      setIndex(nextIndex);
      setPermission("granted");
      await saveStoredUserScoreLibrary({ directoryHandle: handle, index: nextIndex });
      await rescan();
    } catch (chooseError) {
      if (chooseError instanceof DOMException && chooseError.name === "AbortError") return;
      setError(errorMessage(chooseError));
    }
  }, [rescan]);

  const reconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    setError(null);
    try {
      const nextPermission = await requestUserScoreLibraryPermission(handle);
      setPermission(nextPermission);
      if (nextPermission === "granted") await rescan();
    } catch (permissionError) {
      setError(errorMessage(permissionError));
    }
  }, [rescan]);

  const disconnect = useCallback(async () => {
    handleRef.current = null;
    indexRef.current = emptyUserScoreLibraryIndex();
    setDirectoryHandle(null);
    setIndex(indexRef.current);
    setPermission(supported ? "prompt" : "unsupported");
    setScanSummary(null);
    setError(null);
    await clearStoredUserScoreLibrary();
  }, [supported]);

  const importFiles = useCallback(async (files: readonly File[]) => {
    const handle = handleRef.current;
    if (!handle || permission !== "granted") {
      throw new Error("Connect a writable local library folder first.");
    }
    setError(null);
    const result = await importUserScoreFiles(handle, files, indexRef.current.entries);
    await rescan();
    return result;
  }, [permission, rescan]);

  const deleteFile = useCallback(async (entry: UserScoreLibraryEntry) => {
    const handle = handleRef.current;
    if (!handle) throw new Error("Connect the local library folder first.");
    await scanPromiseRef.current;
    const currentPermission = await queryUserScoreLibraryPermission(handle);
    setPermission(currentPermission);
    if (currentPermission !== "granted") {
      throw new Error("Reconnect the local library folder before deleting files.");
    }

    setError(null);
    try {
      await deleteUserScoreFile(handle, entry);
      const currentIndex = indexRef.current;
      const nextIndex: UserScoreLibraryIndex = {
        entries: currentIndex.entries.filter((candidate) => candidate.id !== entry.id),
        issues: currentIndex.issues.filter((issue) => issue.relativePath !== entry.relativePath),
        lastScanAt: new Date().toISOString(),
      };
      indexRef.current = nextIndex;
      setIndex(nextIndex);
      await saveStoredUserScoreLibrary({ directoryHandle: handle, index: nextIndex });
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      throw deleteError;
    }
  }, []);

  const updateMetadata = useCallback(async (
    entryId: string,
    metadata: UserScoreLibraryMetadata,
  ) => {
    const handle = handleRef.current;
    if (!handle) throw new Error("Connect the local library folder first.");
    await scanPromiseRef.current;
    setError(null);
    try {
      const nextIndex = updateUserScoreLibraryMetadata(indexRef.current, entryId, metadata);
      indexRef.current = nextIndex;
      setIndex(nextIndex);
      await saveStoredUserScoreLibrary({ directoryHandle: handle, index: nextIndex });
    } catch (metadataError) {
      setError(errorMessage(metadataError));
      throw metadataError;
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && handleRef.current) void rescan();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [rescan]);

  useEffect(() => {
    const handle = directoryHandle;
    const Observer = window.FileSystemObserver;
    if (!handle || permission !== "granted" || !Observer) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new Observer(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void rescan(), 400);
    });
    void observer.observe(handle, { recursive: true }).catch(() => observer.disconnect());
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [directoryHandle, permission, rescan]);

  const value = useMemo<UserScoreLibraryContextValue>(() => ({
    chooseFolder,
    deleteFile,
    directoryHandle,
    disconnect,
    error,
    importFiles,
    index,
    isInitializing,
    isScanning,
    permission,
    reconnect,
    rescan,
    scanSummary,
    supported,
    updateMetadata,
  }), [
    chooseFolder,
    deleteFile,
    directoryHandle,
    disconnect,
    error,
    importFiles,
    index,
    isInitializing,
    isScanning,
    permission,
    reconnect,
    rescan,
    scanSummary,
    supported,
    updateMetadata,
  ]);

  return <UserScoreLibraryContext.Provider value={value}>{children}</UserScoreLibraryContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUserScoreLibrary = () => {
  const value = useContext(UserScoreLibraryContext);
  if (!value) throw new Error("useUserScoreLibrary must be used inside UserScoreLibraryProvider.");
  return value;
};
