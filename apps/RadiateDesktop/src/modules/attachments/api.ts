import API_CONFIG from '../../config/api';

export interface FileUploadResponse {
  id: string;
  filename: string;
  original_name: string;
  url: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
}

export const attachmentsAPI = {
  async uploadFile(file: File, channelId: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channel_id', channelId);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILES.UPLOAD}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return await response.json();
  },

  async deleteFile(fileId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILES.DELETE(fileId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
  }
};

// Экспортируем функции для совместимости с компонентами
export const uploadFile = async (channelId: string, userId: string, file: File, onProgress?: (progress: number) => void): Promise<FileUploadResponse> => {
  // Игнорируем onProgress для упрощения
  return await attachmentsAPI.uploadFile(file, channelId);
};
export const deleteFile = attachmentsAPI.deleteFile;

// Заглушка для getFileUrl
export const getFileUrl = async (fileId: string): Promise<string> => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILES.DOWNLOAD(fileId)}`;
};
