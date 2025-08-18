use mime::Mime;
use std::str::FromStr;

pub struct FileValidator;

impl FileValidator {
    pub fn is_allowed_extension(filename: &str, allowed_extensions: &[String]) -> bool {
        if let Some(extension) = filename.split('.').last() {
            allowed_extensions.iter().any(|ext| ext.eq_ignore_ascii_case(extension))
        } else {
            false
        }
    }

    pub fn validate_mime_type(content_type: &str) -> bool {
        let allowed_mime_types = [
            "image/",
            "video/",
            "audio/",
            "application/pdf",
            "application/zip",
            "application/x-rar",
            "application/x-7z-compressed",
            "text/plain",
            "text/markdown",
        ];

        allowed_mime_types.iter().any(|&mime| content_type.starts_with(mime))
    }

    pub fn is_image(content_type: &str) -> bool {
        content_type.starts_with("image/")
    }

    pub fn is_video(content_type: &str) -> bool {
        content_type.starts_with("video/")
    }

    pub fn is_audio(content_type: &str) -> bool {
        content_type.starts_with("audio/")
    }

    pub fn get_file_category(content_type: &str) -> &'static str {
        if Self::is_image(content_type) {
            "image"
        } else if Self::is_video(content_type) {
            "video"
        } else if Self::is_audio(content_type) {
            "audio"
        } else if content_type.starts_with("text/") {
            "text"
        } else if content_type == "application/pdf" {
            "document"
        } else if content_type.contains("zip") || content_type.contains("rar") || content_type.contains("7z") {
            "archive"
        } else {
            "other"
        }
    }
}