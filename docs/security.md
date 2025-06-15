# Security Guide

This document outlines the security features and best practices implemented in the XLS to XLSX Converter.

## Security Features

### 1. Formula Stripping

Excel formula injections can pose security risks when processing spreadsheets from untrusted sources. Our converter automatically detects and removes all formulas from cells during conversion.

// Example of how formulas are stripped
function stripFormulas(worksheet) {
  if (!worksheet) return worksheet;

  Object.keys(worksheet).forEach(cell => {
    // Skip cell references that aren't actually cells (like '!ref')
    if (cell.charAt(0) === '!') return;
    
    const cellValue = worksheet[cell];
    
    // Check if the cell value is a string that starts with '='
    if (cellValue && cellValue.t === 's' && 
        typeof cellValue.v === 'string' && 
        cellValue.v.toString().trim().startsWith('=')) {
      // Remove the formula
      cellValue.v = '';
      if (cellValue.f) delete cellValue.f;
    }
  });

  return worksheet;
}

### 2. File Size Limits

To prevent denial-of-service attacks and resource exhaustion, the converter enforces a 50MB file size limit by default.

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  // Other configurations...
});

### 3. MIME Type Validation

The converter performs strict validation of file MIME types to ensure only legitimate spreadsheet files are processed.

const allowedMimeTypes = {
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ods': ['application/vnd.oasis.opendocument.spreadsheet'],
  '.json': ['application/json', 'text/json']
};

### 4. JWT Authentication

API endpoints are protected with JWT-based authentication, requiring valid tokens for access.

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

### 5. Temporary File Handling

Uploaded and converted files are stored in temporary locations and automatically cleaned up after processing.
res.download(outputPath, 'converted.xlsx', (err) => {
  // Clean up temporary files after sending
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  
  if (err) {
    console.error('Error sending file:', err);
  }
});

### 6. Input Sanitization

Filenames and paths are sanitized to prevent path traversal attacks and other injection vulnerabilities.
const filename = secure_filename(file.filename);

## Security Risks with Excel Files

### Formula Injection Attacks

Excel formulas can be used to:
- Execute arbitrary commands (e.g., `=EXEC("calc.exe")`)
- Access sensitive data via DDE (Dynamic Data Exchange)
- Leak information through remote content loading
- Perform CSV injection attacks

### Common Excel Security Vulnerabilities

1. **Dynamic Data Exchange (DDE)**: Can be used to execute system commands
2. **Remote Content Loading**: Formulas can load external resources like images or HTML
3. **Macro Execution**: VBA macros can contain malicious code
4. **Hidden Data**: Metadata, hidden sheets, or cells can contain sensitive information

## Best Practices When Using the Converter

1. **Environment Variables**: Store JWT secrets and other sensitive configuration in environment variables, not in code
2. **HTTPS**: Always use HTTPS for API communication
3. **Token Expiry**: Set reasonable expiration times for JWT tokens
4. **Rate Limiting**: Implement rate limiting in production environments
5. **Input Validation**: Validate all inputs before passing to the converter
6. **Output Validation**: Scan converted files for any unexpected content

## Production Security Checklist

- [ ] Set strong JWT secrets using environment variables
- [ ] Configure appropriate CORS policies
- [ ] Implement rate limiting
- [ ] Use HTTPS with valid SSL certificates
- [ ] Implement proper error handling that doesn't expose sensitive information
- [ ] Regularly update dependencies to address security vulnerabilities
- [ ] Monitor logs for suspicious activity
- [ ] Set up alerts for unusual file conversion patterns

## Reporting Security Issues

If you discover a security vulnerability in the XLS to XLSX Converter, please do not disclose it publicly until we've had a chance to address it. Send details to:

security@example.com

We appreciate your help in keeping our project secure!
