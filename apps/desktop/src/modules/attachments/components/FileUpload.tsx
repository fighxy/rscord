import { useState, useRef, useCallback } from "react";
import { useAuth } from "../../auth/store";
import { uploadFile, getFileUrl } from "../api";

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
    <div style={{ width: '100%' }}>
      {/* Область перетаскивания */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: '8px',
          padding: '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? 'var(--bg-700)' : 'var(--bg-800)',
          transition: 'all 0.2s',
          position: 'relative'
        }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📤</div>
            <div style={{ color: 'var(--text-100)', fontSize: '14px', marginBottom: '8px' }}>
              Загрузка файла...
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--bg-700)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: 'var(--brand)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ color: 'var(--text-500)', fontSize: '12px', marginTop: '4px' }}>
              {uploadProgress.toFixed(1)}%
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📎</div>
            <div style={{ color: 'var(--text-100)', fontSize: '16px', marginBottom: '8px' }}>
              Перетащите файлы сюда или кликните для выбора
            </div>
            <div style={{ color: 'var(--text-500)', fontSize: '12px' }}>
              Максимальный размер: {MAX_FILE_SIZE / 1024 / 1024}MB
            </div>
            <div style={{ color: 'var(--text-500)', fontSize: '12px' }}>
              Поддерживаемые форматы: изображения, видео, аудио, документы
            </div>
          </div>
        )}
      </div>

      {/* Скрытый input для выбора файлов */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept={ALLOWED_TYPES.join(',')}
      />
    </div>
  );
}

// Компонент для отображения загруженных файлов
interface FileDisplayProps {
  file: UploadedFile;
  onDelete?: (fileId: string) => void;
}

export function FileDisplay({ file, onDelete }: FileDisplayProps) {
  const [isImage, setIsImage] = useState(file.mime_type.startsWith('image/'));
  const [isVideo, setIsVideo] = useState(file.mime_type.startsWith('video/'));
  const [isAudio, setIsAudio] = useState(file.mime_type.startsWith('audio/'));

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
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '12px',
      backgroundColor: 'var(--bg-700)',
      marginBottom: '8px'
    }}>
      {/* Предварительный просмотр для изображений */}
      {isImage && (
        <div style={{ marginBottom: '8px' }}>
          <img
            src={file.url}
            alt={file.original_name}
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '4px'
            }}
          />
        </div>
      )}

      {/* Предварительный просмотр для видео */}
      {isVideo && (
        <div style={{ marginBottom: '8px' }}>
          <video
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '4px'
            }}
          >
            <source src={file.url} type={file.mime_type} />
            Ваш браузер не поддерживает видео.
          </video>
        </div>
      )}

      {/* Предварительный просмотр для аудио */}
      {isAudio && (
        <div style={{ marginBottom: '8px' }}>
          <audio controls style={{ width: '100%' }}>
            <source src={file.url} type={file.mime_type} />
            Ваш браузер не поддерживает аудио.
          </audio>
        </div>
      )}

      {/* Информация о файле */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ fontSize: '20px' }}>
          {getFileIcon(file.mime_type)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            color: 'var(--text-100)',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '2px'
          }}>
            {file.original_name}
          </div>
          <div style={{
            color: 'var(--text-500)',
            fontSize: '12px'
          }}>
            {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleDateString()}
          </div>
        </div>
        
        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <a
            href={file.url}
            download={file.original_name}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--brand)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            Скачать
          </a>
          
          {onDelete && (
            <button
              onClick={() => onDelete(file.id)}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--danger)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
