export type RequestErrorCode =
  | 'bad_json'
  | 'content_length_required'
  | 'payload_too_large'
  | 'rate_limited'
  | 'not_found';
