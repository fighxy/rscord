 = None;

        if content_type.starts_with("image/") {
            // Create thumbnail and optimized variants
            match ImageProcessor::process_image(&data, &file_id, extension).await {
                Ok(processed) => {
                    // Upload thumbnail to S3
                    if let Some(thumbnail_data) = processed.thumbnail {
                        let thumbnail_name = format!("{}_thumb.webp", file_id);
                        let _ = state
                            .s3_client
                            .put_object()
                            .bucket(&state.s3_bucket)
                            .key(&thumbnail_name)
                            .body(ByteStream::from(thumbnail_data.data))
                            .content_type("image/webp")
                            .send()
                            .await;

                        thumbnail_url = Some(generate_file_url(&state, &file_id, Some("thumb")));
                        
                        variants.push(FileVariant {
                            variant_type: "thumbnail".to_string(),
                            stored_name: thumbnail_name,
                            mime_type: "image/webp".to_string(),
                            size: thumbnail_data.size as u64,
                            dimensions: Some(ImageDimensions {
                                width: thumbnail_data.width,
                                height: thumbnail_data.height,
                            }),
                        });
                    }

                    // Upload optimized variant
                    if let Some(optimized_data) = processed.optimized {
                        let optimized_name = format!("{}_opt.webp", file_id);
                        let _ = state
                            .s3_client
                            .put_object()
                            .bucket(&state.s3_bucket)
                            .key(&optimized_name)
                            .body(ByteStream::from(optimized_data.data))
                            .content_type("image/webp")
                            .send()
                            .await;

                        variants.push(FileVariant {
                            variant_type: "optimized".to_string(),
                            stored_name: optimized_name,
                            mime_type: "image/webp".to_string(),
                            size: optimized_data.size as u64,
                            dimensions: Some(ImageDimensions {
                                width: optimized_data.width,
                                height: optimized_data.height,
                            }),
                        });
                    }
                }
                Err(e) => {
                    warn!("Failed to process image: {}", e);
                }
            }
        }

        // Upload original file to S3
        state
            .s3_client
            .put_object()
            .bucket(&state.s3_bucket)
            .key(&stored_name)
            .body(ByteStream::from(data.clone()))
            .content_type(&content_type)
            .send()
            .await
            .map_err(|e| {
                error!("Failed to upload to S3: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        // Save metadata to MongoDB
        let file_metadata = FileMetadata {
            id: file_id.clone(),
            original_name: file_name,
            stored_name: stored_name.clone(),
            mime_type: content_type.clone(),
            size: data.len() as u64,
            hash,
            user_id,
            guild_id: query.guild_id,
            channel_id: query.channel_id,
            message_id: query.message_id,
            uploaded_at: Utc::now(),
            expires_at: None,
            is_public: query.is_public.unwrap_or(false),
            thumbnail_url: thumbnail_url.clone(),
            variants,
        };

        files_collection
            .insert_one(&file_metadata)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let url = generate_file_url(&state, &file_id, None);

        return Ok(Json(UploadResponse {
            file_id,
            url,
            thumbnail_url,
            size: data.len() as u64,
            mime_type: content_type,
        }));
    }

    Err(StatusCode::BAD_REQUEST)
}

async fn get_file(
    State(state): State<Arc<FileServiceState>>,
    Path(file_id): Path<String>,
    Query(query): Query<GetFileQuery>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    // Get file metadata
    let files_collection: Collection<FileMetadata> = state.mongo_db.collection("files");
    let file_metadata = files_collection
        .find_one(doc! { "_id": &file_id })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check permissions if file is not public
    if !file_metadata.is_public {
        let user_id = extract_user_id(&headers)?;
        if user_id != file_metadata.user_id {
            // TODO: Check if user has access to the guild/channel
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // Determine which variant to serve
    let (object_key, mime_type) = match query.variant.as_deref() {
        Some("thumbnail") => {
            file_metadata
                .variants
                .iter()
                .find(|v| v.variant_type == "thumbnail")
                .map(|v| (v.stored_name.clone(), v.mime_type.clone()))
                .unwrap_or((file_metadata.stored_name.clone(), file_metadata.mime_type.clone()))
        }
        Some("optimized") => {
            file_metadata
                .variants
                .iter()
                .find(|v| v.variant_type == "optimized")
                .map(|v| (v.stored_name.clone(), v.mime_type.clone()))
                .unwrap_or((file_metadata.stored_name.clone(), file_metadata.mime_type.clone()))
        }
        _ => (file_metadata.stored_name.clone(), file_metadata.mime_type.clone()),
    };

    // Get file from S3
    let result = state
        .s3_client
        .get_object()
        .bucket(&state.s3_bucket)
        .key(&object_key)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to get file from S3: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let body = result.body.collect().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let bytes = body.into_bytes();

    // Build response
    let mut response = Response::builder()
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::CONTENT_LENGTH, bytes.len());

    // Add download header if requested
    if query.download.unwrap_or(false) {
        response = response.header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_metadata.original_name),
        );
    } else {
        response = response.header(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", file_metadata.original_name),
        );
    }

    response
        .body(bytes.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_file(
    State(state): State<Arc<FileServiceState>>,
    Path(file_id): Path<String>,
    headers: HeaderMap,
) -> Result<StatusCode, StatusCode> {
    let user_id = extract_user_id(&headers)?;

    // Get file metadata
    let files_collection: Collection<FileMetadata> = state.mongo_db.collection("files");
    let file_metadata = files_collection
        .find_one(doc! { "_id": &file_id })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check ownership
    if file_metadata.user_id != user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    // Delete from S3 (original and all variants)
    let mut keys_to_delete = vec![file_metadata.stored_name.clone()];
    for variant in &file_metadata.variants {
        keys_to_delete.push(variant.stored_name.clone());
    }

    for key in keys_to_delete {
        state
            .s3_client
            .delete_object()
            .bucket(&state.s3_bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| {
                error!("Failed to delete from S3: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

    // Delete from MongoDB
    files_collection
        .delete_one(doc! { "_id": &file_id })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn get_file_metadata(
    State(state): State<Arc<FileServiceState>>,
    Path(file_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<FileMetadata>, StatusCode> {
    let files_collection: Collection<FileMetadata> = state.mongo_db.collection("files");
    let file_metadata = files_collection
        .find_one(doc! { "_id": &file_id })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check permissions if file is not public
    if !file_metadata.is_public {
        let user_id = extract_user_id(&headers)?;
        if user_id != file_metadata.user_id {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    Ok(Json(file_metadata))
}

#[derive(Debug, Deserialize)]
struct PresignedUrlRequest {
    pub file_name: String,
    pub content_type: String,
    pub operation: String, // "upload" or "download"
}

#[derive(Debug, Serialize)]
struct PresignedUrlResponse {
    pub url: String,
    pub expires_in: u64,
}

async fn get_presigned_url(
    State(state): State<Arc<FileServiceState>>,
    headers: HeaderMap,
    Json(request): Json<PresignedUrlRequest>,
) -> Result<Json<PresignedUrlResponse>, StatusCode> {
    let user_id = extract_user_id(&headers)?;

    // Validate file extension
    if !FileValidator::is_allowed_extension(&request.file_name, &state.allowed_extensions) {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    let file_id = Uuid::new_v4().to_string();
    let extension = request.file_name.split('.').last().unwrap_or("bin");
    let object_key = format!("{}.{}", file_id, extension);

    let expires_in = Duration::from_secs(3600); // 1 hour

    let presigned_request = if request.operation == "upload" {
        state
            .s3_client
            .put_object()
            .bucket(&state.s3_bucket)
            .key(&object_key)
            .content_type(&request.content_type)
            .presigned(PresigningConfig::expires_in(expires_in).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        state
            .s3_client
            .get_object()
            .bucket(&state.s3_bucket)
            .key(&object_key)
            .presigned(PresigningConfig::expires_in(expires_in).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(PresignedUrlResponse {
        url: presigned_request.uri().to_string(),
        expires_in: expires_in.as_secs(),
    }))
}

fn extract_user_id(headers: &HeaderMap) -> Result<String, StatusCode> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .to_str()
        .map_err(|_| StatusCode::UNAUTHORIZED)?
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // TODO: Validate JWT and extract user_id
    // For now, return a dummy user_id
    Ok("user_123".to_string())
}

fn generate_file_url(state: &FileServiceState, file_id: &str, variant: Option<&str>) -> String {
    let base_url = state
        .cdn_url
        .as_ref()
        .map(|s| s.as_str())
        .unwrap_or("http://localhost:14708");

    match variant {
        Some(v) => format!("{}/api/files/{}?variant={}", base_url, file_id, v),
        None => format!("{}/api/files/{}", base_url, file_id),
    }
}