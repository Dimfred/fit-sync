/**
 * Abstract interface for file operations
 * Allows different implementations for Node.js (fs) and React Native
 */
export interface IFileHandler {
  /**
   * Check if path is a directory
   * @param dirPath - Directory path
   * @returns true if path is a directory
   */
  isDirectory(dirPath: string): Promise<boolean>;

  /**
   * Create a directory
   * @param dirPath - Directory path
   */
  createDirectory(dirPath: string): Promise<void>;

  /**
   * Write data to file
   * @param filePath - File path
   * @param data - Data to write (string or Buffer)
   */
  writeFile(filePath: string, data: string | Buffer): Promise<void>;

  /**
   * Read file contents
   * @param filePath - File path
   * @returns File contents as string
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Download file from blob/buffer
   * @param data - File data (Buffer or Blob)
   * @param fileName - Name of the file
   * @param fileType - File extension/type
   */
  downloadFile(data: any, fileName: string, fileType: string): Promise<void>;

  /**
   * Prepare file for upload from path
   * @param filePath - File path
   * @returns File data for upload
   */
  prepareFileForUpload(filePath: string): Promise<any>;

  /**
   * Get file extension from path
   * @param filePath - File path
   * @returns File extension
   */
  getFileExtension(filePath: string): string;

  /**
   * Join path segments
   * @param segments - Path segments
   * @returns Joined path
   */
  joinPath(...segments: string[]): string;
}
