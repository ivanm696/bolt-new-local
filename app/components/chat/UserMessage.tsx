import DOMPurify from 'dompurify';
function sanitizeUserMessage(content: string) {
  return DOMPurify.sanitize(content);
}