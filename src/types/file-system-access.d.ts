interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}

interface FileSystemDirectoryHandle {
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface Window {
  showDirectoryPicker(options?: FileSystemDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemObserverRecord {
  type: string;
}

interface FileSystemObserver {
  disconnect(): void;
  observe(handle: FileSystemHandle, options?: { recursive?: boolean }): Promise<void>;
}

interface FileSystemObserverConstructor {
  new (callback: (records: readonly FileSystemObserverRecord[]) => void): FileSystemObserver;
}

interface Window {
  FileSystemObserver?: FileSystemObserverConstructor;
}
