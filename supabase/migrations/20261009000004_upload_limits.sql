-- Storage buckets had no size or file-type limit. SVG and HTML stay out
-- because they can carry script.

UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ]
WHERE id IN ('chat-uploads', 'homework-uploads');

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id IN ('question-images', 'linktree-icons');

UPDATE storage.buckets
SET file_size_limit = 524288000,
    allowed_mime_types = ARRAY[
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
      'image/png', 'image/jpeg', 'image/webp'
    ]
WHERE id = 'lesson-uploads';
