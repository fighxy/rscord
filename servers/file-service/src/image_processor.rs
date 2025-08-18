use image::{DynamicImage, ImageFormat};
use std::io::Cursor;
use webp::Encoder;

pub struct ProcessedImage {
    pub thumbnail: Option<ImageData>,
    pub optimized: Option<ImageData>,
}

pub struct ImageData {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub size: usize,
}

pub struct ImageProcessor;

impl ImageProcessor {
    pub async fn process_image(
        data: &[u8],
        file_id: &str,
        extension: &str,
    ) -> Result<ProcessedImage, Box<dyn std::error::Error + Send + Sync>> {
        let img = image::load_from_memory(data)?;
        
        let mut result = ProcessedImage {
            thumbnail: None,
            optimized: None,
        };

        // Create thumbnail (256x256 max)
        let thumbnail = Self::create_thumbnail(&img, 256);
        let thumb_data = Self::encode_webp(&thumbnail, 85)?;
        result.thumbnail = Some(ImageData {
            data: thumb_data.clone(),
            width: thumbnail.width(),
            height: thumbnail.height(),
            size: thumb_data.len(),
        });

        // Create optimized version if original is large
        if img.width() > 1920 || img.height() > 1080 {
            let optimized = Self::resize_to_fit(&img, 1920, 1080);
            let opt_data = Self::encode_webp(&optimized, 90)?;
            result.optimized = Some(ImageData {
                data: opt_data.clone(),
                width: optimized.width(),
                height: optimized.height(),
                size: opt_data.len(),
            });
        }

        Ok(result)
    }

    fn create_thumbnail(img: &DynamicImage, max_size: u32) -> DynamicImage {
        img.thumbnail(max_size, max_size)
    }

    fn resize_to_fit(img: &DynamicImage, max_width: u32, max_height: u32) -> DynamicImage {
        let (width, height) = img.dimensions();
        
        let width_ratio = width as f32 / max_width as f32;
        let height_ratio = height as f32 / max_height as f32;
        
        if width_ratio > 1.0 || height_ratio > 1.0 {
            let ratio = width_ratio.max(height_ratio);
            let new_width = (width as f32 / ratio) as u32;
            let new_height = (height as f32 / ratio) as u32;
            img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
        } else {
            img.clone()
        }
    }

    fn encode_webp(img: &DynamicImage, quality: f32) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        let encoder = Encoder::from_image(img)?;
        Ok(encoder.encode(quality).to_vec())
    }
}