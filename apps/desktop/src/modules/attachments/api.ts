import httpClient from "../../shared/api/http";
import { AxiosProgressEvent } from "axios";

export interface UploadedFile {
  id: string;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  url: string;
  uploaded_at: string;
}

export interface FileUploadResponse {
  file: UploadedFile;
}

// Загрузка файла
export async function uploadFile(
  channelId: string, 
  userId: string, 
  file: File, 
  onProgress?: (progress: number) => void
): Promise<UploadedFile> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('channel_id', channelId);

    const response = await httpClient.post<FileUploadResponse>(
      `/channels/${channelId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress?.(progress);
          }
        },
      }
    );

    return response.data.file;
  } catch (error: any) {
    if (error.response?.status === 413) {
      throw new Error('Файл слишком большой');
    }
    if (error.response?.status === 400) {
      throw new Error('Неподдерживаемый тип файла');
    }
    throw new Error('Ошибка при загрузке файла');
  }
}

// Получение списка файлов канала
export async function getChannelFiles(channelId: string): Promise<UploadedFile[]> {
  try {
    const response = await httpClient.get<UploadedFile[]>(`/channels/${channelId}/attachments`);
    return response.data;
  } catch (error) {
    console.error('Failed to get channel files:', error);
    return [];
  }
}

// Получение информации о файле
export async function getFileInfo(fileId: string): Promise<UploadedFile> {
  try {
    const response = await httpClient.get<UploadedFile>(`/attachments/${fileId}`);
    return response.data;
  } catch (error: any) {
    throw new Error('Ошибка при получении информации о файле');
  }
}

// Получение URL для скачивания файла
export async function getFileUrl(fileId: string): Promise<string> {
  try {
    const response = await httpClient.get<{ url: string }>(`/attachments/${fileId}/download`);
    return response.data.url;
  } catch (error: any) {
    throw new Error('Ошибка при получении ссылки на файл');
  }
}

// Удаление файла
export async function deleteFile(fileId: string, userId: string): Promise<void> {
  try {
    await httpClient.delete(`/attachments/${fileId}`, {
      data: { user_id: userId }
    });
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для удаления этого файла');
    }
    throw new Error('Ошибка при удалении файла');
  }
}

// Получение статистики файлов
export async function getFileStats(channelId: string): Promise<{
  total_files: number;
  total_size: number;
  file_types: Record<string, number>;
}> {
  try {
    const response = await httpClient.get(`/channels/${channelId}/attachments/stats`);
    return response.data;
  } catch (error) {
    console.error('Failed to get file stats:', error);
    return {
      total_files: 0,
      total_size: 0,
      file_types: {}
    };
  }
}
