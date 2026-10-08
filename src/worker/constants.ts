export const IMAGE_ID_PATTERN = /^[0-9a-z]{32}$/;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'If-None-Match',
};
