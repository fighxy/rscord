import { useState, useRef, useCallback } from "react";
import { useAuth } from "../../auth/store";
import { uploadFile, getFileUrl } from "../api";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  channelId: string;
  onFileUploaded?: (file: UploadedFile) => void;
}

interface UploadedFile {
  id: string;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  url: string;
  uploaded_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

export function FileUpload({ channelId, onFileUploaded }: FileUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = async (files: File[]) => {
    if (!user?.id) return;

    for (const file of files) {
      if (!validateFile(file)) continue;
      
      try {
        setUploading(true);
        setUploadProgress(0);
        
        const uploadedFile = await uploadFile(channelId, user.id, file, (progress) => {
          setUploadProgress(progress);
        });
        
        onFileUploaded?.(uploadedFile);
        setUploadProgress(0);
      } catch (error) {
        console.error('File upload failed:', error);
        // Здесь можно показать уведомление об ошибке
      } finally {
        setUploading(false);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл ${file.name} слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return false;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert(`Тип файла ${file.name} не поддерживается`);
      return false;
    }

    return true;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType === 'text/plain') return '📄';
    return '📎';
  };

  if (!user) return null;

  return (
    <div className="file-upload">
      {/* Drag & Drop зона */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
          isDragging
            ? 'border-discord-blurple bg-blue-900/20'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-300 mb-2">
          Перетащите файлы сюда или <span className="text-discord-blurple">выберите файлы</span>
        </p>
        <p className="text-sm text-gray-400">
          Максимальный размер: {MAX_FILE_SIZE / 1024 / 1024}MB
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="mt-3 bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white"
        >
          Выбрать файлы
        </Button>
      </div>

      {/* Прогресс загрузки */}
      {uploading && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Загрузка...</span>
            <span className="text-sm text-gray-400">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className="bg-discord-blurple h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент для отображения загруженного файла
interface FilePreviewProps {
  file: UploadedFile;
  onDelete?: (fileId: string) => void;
}

export function FilePreview({ file, onDelete }: FilePreviewProps) {
  const isImage = file.mime_type.startsWith('image/');
  const isVideo = file.mime_type.startsWith('video/');
  const isAudio = file.mime_type.startsWith('audio/');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType === 'text/plain') return '📄';
    return '📎';
  };

  return (
    <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
      {/* Предварительный просмотр для изображений */}
      {isImage && (
        <div className="mb-2">
          <img
            src={file.url}
            alt={file.original_name}
            className="max-w-full max-h-48 rounded"
          />
        </div>
      )}

      {/* Предварительный просмотр для видео */}
      {isVideo && (
        <div className="mb-2">
          <video
            controls
            className="max-w-full max-h-48 rounded"
          >
            <source src={file.url} type={file.mime_type} />
            Ваш браузер не поддерживает видео.
          </video>
        </div>
      )}

      {/* Предварительный просмотр для аудио */}
      {isAudio && (
        <div className="mb-2">
          <audio controls className="w-full">
            <source src={file.url} type={file.mime_type} />
            Ваш браузер не поддерживает аудио.
          </audio>
        </div>
      )}

      {/* Информация о файле */}
      <div className="flex items-center gap-2">
        <div className="text-xl">
          {getFileIcon(file.mime_type)}
        </div>
        <div className="flex-1">
          <div className="text-gray-200 text-sm font-semibold mb-0.5">
            {file.original_name}
          </div>
          <div className="text-gray-400 text-xs">
            {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleDateString()}
          </div>
        </div>
        
        {/* Кнопки действий */}
        <div className="flex gap-1">
          <a
            href={file.url}
            download={file.original_name}
            className="px-2 py-1 bg-discord-blurple hover:bg-blue-600 text-white text-xs rounded no-underline"
          >
            Скачать
          </a>
          
          {onDelete && (
            <Button
              onClick={() => onDelete(file.id)}
              variant="destructive"
              size="sm"
              className="text-xs px-2 py-1 h-6"
            >
              Удалить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
