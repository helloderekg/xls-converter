// XLS Converter Demo Application
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const fileInput = document.getElementById('file-input');
  const fileDetails = document.getElementById('file-details');
  const uploadForm = document.getElementById('upload-form');
  const convertButton = document.getElementById('convert-button');
  const statusMessage = document.getElementById('status-message');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const downloadContainer = document.getElementById('download-container');
  const downloadButton = document.getElementById('download-button');
  
  // API Configuration
  // Try multiple API endpoints in case the server is running on a different port
  // Prioritize port 4040 which is known to work with our simple test server
  const API_PORTS = [4040, 4002, 4000, 4001, 4003, 4004, 4005];
  const API_PATH = '/convert';
  let savedApiPort = localStorage.getItem('xlsConverterApiPort');
  
  // Initialize with the saved port if available, otherwise start with the default ports
  if (savedApiPort) {
    API_PORTS.unshift(parseInt(savedApiPort, 10));
  }
  
  // Function to get all possible API URLs to try
  const getApiUrls = () => {
    if (window.location.hostname === 'localhost') {
      // For local development, try multiple ports
      return API_PORTS.map(port => `http://localhost:${port}${API_PATH}`);
    } else {
      // For production, use the production URL
      return ['https://api.your-domain.com/convert']; // Production URL
    }
  };
  
  // Default to first API URL
  let currentApiUrlIndex = 0;
  let apiUrls = getApiUrls();
  let apiUrl = apiUrls[currentApiUrlIndex];
    
  // Token Management - In a real application, this would be securely obtained
  // For demo purposes, we're using a simulated token
  const getJwtToken = () => {
    // In a real application, this might involve a secure login flow
    // For the demo, we'll just return a dummy token
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.1Ig7aPUPZ1XM0lO_htzzwEZBACHhN_Z41DhfqQFbPYA';
  };
  
  // For the demo, we'll store the converted file in memory when received
  let convertedFile = null;
  
  // Handle file selection
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (file) {
      // Validate file extension
      const validExtensions = ['.xls', '.xlsx', '.csv', '.ods', '.json'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        fileDetails.innerHTML = `<p class="error">Error: Unsupported file type. Please use XLS, XLSX, CSV, ODS, or JSON.</p>`;
        convertButton.disabled = true;
        return;
      }
      
      // Validate file size (max 50MB for demo)
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (file.size > 50 * 1024 * 1024) {
        fileDetails.innerHTML = `<p class="error">Error: File too large (${fileSizeMB}MB). Maximum size is 50MB.</p>`;
        convertButton.disabled = true;
        return;
      }
      
      // Display file information
      fileDetails.innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Type:</strong> ${file.type || 'Unknown'}</p>
        <p><strong>Size:</strong> ${fileSizeMB} MB</p>
      `;
      
      // Enable the convert button
      convertButton.disabled = false;
    } else {
      fileDetails.innerHTML = `<p>No file selected</p>`;
      convertButton.disabled = true;
    }
  });
  
  // Handle form submission
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const file = fileInput.files[0];
    if (!file) return;
    
    try {
      // Update UI to show conversion in progress
      convertButton.disabled = true;
      statusMessage.textContent = 'Converting...';
      progressContainer.style.display = 'block';
      downloadContainer.style.display = 'none';
      
      // Simulate progress (in a real app, we might get progress updates from the server)
      simulateProgress();
      
      // Handle file conversion via API
      const convertFile = async (file) => {
        try {
          // Update status message to show uploading
          statusMessage.textContent = 'Uploading file...'; 
          
          // Prepare form data
          const formData = new FormData();
          formData.append('file', file);
          
          // Track errors to report if all attempts fail
          const errors = [];
          let lastError = null;
          
          // Try each API URL in sequence until one succeeds
          for (let i = 0; i < apiUrls.length; i++) {
            try {
              const currentApiUrl = apiUrls[i];
              console.log(`Trying API endpoint: ${currentApiUrl}`);
              
              // Make API request
              const response = await fetch(currentApiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${getJwtToken()}`
                },
                body: formData,
              });
              
              if (response.ok) {
                // If this URL worked, remember it for next time
                if (i !== currentApiUrlIndex) {
                  console.log(`API at port ${new URL(currentApiUrl).port} is working. Will use this port for future requests.`);
                  currentApiUrlIndex = i;
                  apiUrl = currentApiUrl;
                }
                
                // Return the successful response
                return response;
              } else {
                // If we got a response but it's not OK, throw an error with status
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
              }
            } catch (error) {
              lastError = error;
              errors.push(`${apiUrls[i]}: ${error.message}`);
              console.warn(`Failed to connect to ${apiUrls[i]}: ${error.message}`);
              // Continue to the next URL
            }
          }
          
          // If we got here, all attempts failed
          throw new Error(`All API endpoints failed. Errors: ${errors.join('; ')}`);
        } catch (error) {
          throw error;
        }
      };
      
      // Process the API response
      const processApiResponse = async (response) => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        // Get response data as blob
        const data = await response.blob();
        
        // Store the converted file
        convertedFile = new File([data], 'converted.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Clear the progress interval if it exists
        if (window.progressInterval) {
          clearInterval(window.progressInterval);
          window.progressInterval = null;
        }
        
        // Update UI to show conversion is complete
        statusMessage.textContent = 'Conversion completed successfully!';
        progressBar.style.width = '100%';
        downloadContainer.style.display = 'block';
      };
      
      // Call the convertFile function and process the response
      const response = await convertFile(file);
      await processApiResponse(response);
      
      // Update UI to show conversion is complete
      statusMessage.textContent = 'Conversion completed successfully!';
      progressBar.style.width = '100%';
      downloadContainer.style.display = 'block';
      
    } catch (error) {
      console.error('Conversion failed:', error);
      statusMessage.textContent = `Conversion failed: ${error.message}`;
      progressBar.style.width = '0%';
    }
  });
  
  // Handle download button click
  downloadButton.addEventListener('click', () => {
    if (!convertedFile) return;
    
    // Create download link
    const downloadUrl = URL.createObjectURL(convertedFile);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = 'converted.xlsx';
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    URL.revokeObjectURL(downloadUrl);
  });
  
  // Simulated progress bar for file conversion
  function simulateProgress() {
    let width = 0;
    progressBar.style.width = '0%';
    
    // Store interval ID in global variable so we can clear it when conversion completes
    window.progressInterval = setInterval(() => {
      if (width >= 80) {
        // Don't clear interval here - we'll clear it when conversion actually completes
        width = 80; // Cap at 80% until we get actual completion
      } else {
        width += Math.random() * 10;
        width = Math.min(width, 80);
      }
      progressBar.style.width = width + '%';
    }, 300);
    
    // Set a backup timeout to clear the interval if conversion takes too long (30 seconds)
    setTimeout(() => {
      if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
      }
    }, 30000);
  }
  
  // For demo purposes - allow using the demo without a server
  // In a real application, this would be removed
  if (window.location.search.includes('demo=true')) {
    // Client-side fallback using SheetJS for demo purposes
    convertButton.addEventListener('click', async (event) => {
      event.preventDefault();
      
      const file = fileInput.files[0];
      if (!file) return;
      
      try {
        // Load SheetJS from CDN for the demo
        await loadSheetJS();
        
        // Update UI
        convertButton.disabled = true;
        statusMessage.textContent = 'Converting (demo mode)...';
        progressContainer.style.display = 'block';
        downloadContainer.style.display = 'none';
        
        // Simulate progress
        simulateProgress();
        
        // Read the file
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // Parse the file using SheetJS
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Convert to XLSX
        const xlsxOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Create a Blob
        const blob = new Blob([xlsxOutput], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        convertedFile = new File([blob], 'converted.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Update UI
        statusMessage.textContent = 'Demo conversion completed successfully!';
        progressBar.style.width = '100%';
        downloadContainer.style.display = 'block';
        
      } catch (error) {
        console.error('Demo conversion failed:', error);
        statusMessage.textContent = `Demo conversion failed: ${error.message}`;
      }
    });
  }
  
  // Helper function to load SheetJS from CDN for the demo
  async function loadSheetJS() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load SheetJS library'));
      document.head.appendChild(script);
    });
  }
});
