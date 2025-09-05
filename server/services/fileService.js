const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')
const logger = require('../utils/logger')

class FileService {
  constructor() {
    this.screenshotsDir = path.join(__dirname, '../screenshots')
    this.tempDir = path.join(__dirname, '../../temp')
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true })
        logger.info(`Created directory: ${dirPath}`)
      } else {
        throw error
      }
    }
  }

  async initializeDirectories() {
    await this.ensureDirectoryExists(this.screenshotsDir)
    await this.ensureDirectoryExists(this.tempDir)
  }

  async readFile(filePath) {
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      logger.error(`Error reading file ${filePath}:`, error)
      throw error
    }
  }

  async writeFile(filePath, data) {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath))
      await fs.writeFile(filePath, data)
      logger.debug(`File written: ${filePath}`)
    } catch (error) {
      logger.error(`Error writing file ${filePath}:`, error)
      throw error
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath)
      logger.debug(`File deleted: ${filePath}`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`File not found for deletion: ${filePath}`)
      } else {
        logger.error(`Error deleting file ${filePath}:`, error)
        throw error
      }
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath, fsSync.constants.F_OK)
      return true
    } catch (error) {
      return false
    }
  }

  async getFileStats(filePath) {
    try {
      return await fs.stat(filePath)
    } catch (error) {
      logger.error(`Error getting file stats for ${filePath}:`, error)
      throw error
    }
  }

  async copyFile(sourcePath, destinationPath) {
    try {
      await this.ensureDirectoryExists(path.dirname(destinationPath))
      await fs.copyFile(sourcePath, destinationPath)
      logger.debug(`File copied from ${sourcePath} to ${destinationPath}`)
    } catch (error) {
      logger.error(`Error copying file from ${sourcePath} to ${destinationPath}:`, error)
      throw error
    }
  }

  async listFiles(directoryPath, options = {}) {
    try {
      const files = await fs.readdir(directoryPath)
      
      if (options.filterExtensions) {
        const extensions = options.filterExtensions.map(ext => ext.toLowerCase())
        return files.filter(file => {
          const ext = path.extname(file).toLowerCase()
          return extensions.includes(ext)
        })
      }
      
      return files.filter(file => !file.startsWith('.'))
    } catch (error) {
      logger.error(`Error listing files in ${directoryPath}:`, error)
      throw error
    }
  }

  async getImageFiles(directoryPath = this.screenshotsDir) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    return await this.listFiles(directoryPath, { filterExtensions: imageExtensions })
  }

  async cleanupOrphanedFiles(validFilenames) {
    try {
      const allFiles = await this.getImageFiles()
      const orphanedFiles = allFiles.filter(file => !validFilenames.includes(file))
      
      if (orphanedFiles.length > 0) {
        logger.info(`Found ${orphanedFiles.length} orphaned files`)
        
        for (const file of orphanedFiles) {
          const filePath = path.join(this.screenshotsDir, file)
          await this.deleteFile(filePath)
          logger.info(`Deleted orphaned file: ${file}`)
        }
      } else {
        logger.info('No orphaned files found')
      }
      
      return orphanedFiles.length
    } catch (error) {
      logger.error('Error during orphaned files cleanup:', error)
      throw error
    }
  }

  async createTempFile(buffer, prefix = 'temp_', extension = '.png') {
    const filename = `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`
    const filePath = path.join(this.tempDir, filename)
    
    await this.writeFile(filePath, buffer)
    return filePath
  }

  async cleanupTempFiles(maxAge = 3600000) { // 1 hour default
    try {
      const files = await fs.readdir(this.tempDir)
      const now = Date.now()
      let cleanedCount = 0
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = await this.getFileStats(filePath)
        
        if (now - stats.mtime.getTime() > maxAge) {
          await this.deleteFile(filePath)
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} temporary files`)
      }
      
      return cleanedCount
    } catch (error) {
      logger.error('Error during temp files cleanup:', error)
      throw error
    }
  }

  // Utility method to get safe file path
  getSafeFilePath(basePath, filename) {
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename)
    return path.join(basePath, sanitizedFilename)
  }

  // Get screenshot file path
  getScreenshotPath(filename) {
    return this.getSafeFilePath(this.screenshotsDir, filename)
  }

  // Get temp file path
  getTempFilePath(filename) {
    return this.getSafeFilePath(this.tempDir, filename)
  }
}

// Create singleton instance
const fileService = new FileService()

module.exports = fileService
