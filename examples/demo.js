/**
 * Browser Demo for XLS Converter
 * This script demonstrates browser-to-API conversion of spreadsheet files to XLSX.
 * 
 * It uses the Python conversion service through the Express.js API,
 * leveraging Python's superior XLS parsing capabilities.
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const convertForm = document.getElementById('convert-form');
  const convertBtn = document.getElementById('convert-btn');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const downloadContainer = document.getElementById('download-container');
  const downloadBtn = document.getElementById('download-btn');
  
  // Track the converted file
  let convertedFile = null;
  
  // API endpoint for conversion
  const API_ENDPOINT = '/convert'; // Adjust if the API is hosted elsewhere
  
  // File size formatter
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Handle file selection
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    
    if (!file) {
      fileInfo.innerHTML = '<p>No file selected</p>';
      convertBtn.disabled = true;
      return;
    }
    
    // Check file type
    const extension = file.name.split('.').pop().toLowerCase();
    const supportedTypes = ['xls', 'xlsx', 'csv', 'ods', 'json'];
    
    if (!supportedTypes.includes(extension)) {
      fileInfo.innerHTML = `
        <p class="error">Unsupported file type: .${extension}</p>
        <p>Please select a XLS, XLSX, CSV, ODS, or JSON file.</p>
      `;
      convertBtn.disabled = true;
      return;
    }
    
    // Check file size (limit to 30MB for browser-side conversion)
    if (file.size > 30 * 1024 * 1024) {
      fileInfo.innerHTML = `
        <p class="error">File is too large: ${formatFileSize(file.size)}</p>
        <p>Browser-side conversion is limited to 30MB files. Please use the server API for larger files.</p>
      `;
      convertBtn.disabled = true;
      return;
    }
    
    // Display file information
    fileInfo.innerHTML = `
      <p><strong>File:</strong> ${file.name}</p>
      <p><strong>Type:</strong> .${extension} (${file.type || 'unknown'})</p>
      <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
    
    convertBtn.disabled = false;
  });
  
  // Function to check server health
  const checkServerHealth = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        status.textContent = 'Server connected';
        status.className = 'success';
        return true;
      } else {
        status.textContent = 'Server issue detected';
        status.className = 'warning';
        return false;
      }
    } catch (error) {
      status.textContent = 'Cannot connect to server';
      status.className = 'error';
      return false;
    }
  };
  
  // Check server health on page load
  checkServerHealth();
  
  // Convert file to XLSX when form is submitted
  convertForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Converting...';
    status.className = 'processing';
    progress.style.width = '0%';
    progress.style.display = 'block';
    downloadContainer.style.display = 'none';
    convertBtn.disabled = true;
    
    try {
      const file = fileInput.files[0];
      
      // Prepare form data for API call
      const formData = new FormData();
      formData.append('file', file);
      
      // Animate progress
      let width = 0;
      const progressInterval = setInterval(() => {
        width = Math.min(width + 5, 80);  // Cap at 80% until complete
        progress.style.width = width + '%';
      }, 100);
      
      // Send to API for conversion
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      // Clear interval and complete progress
      clearInterval(progressInterval);
      progress.style.width = '100%';
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }
      
      // Get the converted file
      const result = await response.blob();
      convertedFile = result;
      
      // Determine filename for download
      let convertedFileName = 'converted.xlsx';
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/i);
        if (match && match[1]) {
          convertedFileName = match[1];
        }
      }
      
      // Prepare download
      downloadBtn.setAttribute('download', convertedFileName);
      downloadBtn.href = URL.createObjectURL(result);
      
      status.textContent = 'Conversion Complete!';
      status.className = 'success';
      downloadContainer.style.display = 'block';
    } catch (error) {
      console.error('Conversion error:', error);
      status.textContent = `Error: ${error.message}`;
      status.className = 'error';
      progress.style.width = '100%';
      progress.classList.add('error-progress');
    } finally {
      convertBtn.disabled = false;
    }
  });
  
  // Handle download button click
  downloadBtn.addEventListener('click', () => {
    if (!convertedFile) return;
    
    const url = URL.createObjectURL(convertedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  
  // Note: All actual file processing is now done by the Python service via API.
  // The demo now simply uploads files to the API and receives converted XLSX files.
});
