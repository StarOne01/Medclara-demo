/**
 * PDF Export utility for clinical notes
 * Uses html2pdf library to generate PDF from HTML content
 */

interface ExportNoteOptions {
  patientName: string;
  mrn?: string;
  noteSections: Record<string, string>;
  timestamp?: Date;
}

/**
 * Load html2pdf library from CDN
 */
async function loadHtml2Pdf(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).html2pdf) {
      resolve((window as any).html2pdf);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      resolve((window as any).html2pdf);
    };
    script.onerror = () => {
      reject(new Error('Failed to load html2pdf library'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Export clinical notes as PDF
 */
export async function exportNotesAsPdf(options: ExportNoteOptions): Promise<void> {
  try {
    const html2pdf = await loadHtml2Pdf();
    
    // Create HTML content
    const htmlContent = generatePdfHtml(options);
    
    // PDF options
    const pdfOptions = {
      margin: 10,
      filename: `clinical-note-${options.patientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    // Create temporary container
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm';
    document.body.appendChild(container);

    try {
      // Generate PDF
      await html2pdf().set(pdfOptions).from(container).save();
    } finally {
      // Clean up
      document.body.removeChild(container);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Generate HTML content for PDF
 */
function generatePdfHtml(options: ExportNoteOptions): string {
  const { patientName, mrn, noteSections, timestamp } = options;
  const exportDate = timestamp ? timestamp.toLocaleDateString() : new Date().toLocaleDateString();
  const exportTime = timestamp ? timestamp.toLocaleTimeString() : new Date().toLocaleTimeString();

  let sectionsHtml = '';
  for (const [key, content] of Object.entries(noteSections)) {
    if (content && content.trim().length > 0) {
      const title = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      sectionsHtml += `
        <div class="section">
          <h3 class="section-title">${title}</h3>
          <p class="section-content">${content.replace(/\n/g, '<br>')}</p>
        </div>
      `;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Clinical Note</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: white;
          padding: 20px;
        }
        
        .header {
          border-bottom: 2px solid #e5e5e5;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        
        .hospital-name {
          font-size: 16px;
          font-weight: 600;
          color: #0066cc;
          margin-bottom: 8px;
        }
        
        .document-title {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 12px;
        }
        
        .header-info {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          font-size: 12px;
          color: #666;
          gap: 16px;
        }
        
        .header-item {
          flex: 1;
          min-width: 200px;
        }
        
        .header-label {
          font-weight: 600;
          color: #333;
        }
        
        .header-value {
          margin-top: 4px;
        }
        
        .section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #0066cc;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e5e5e5;
        }
        
        .section-content {
          font-size: 12px;
          line-height: 1.6;
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          font-size: 10px;
          color: #999;
          text-align: center;
        }
        
        @media print {
          body {
            padding: 0;
          }
          .section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="hospital-name">Medclara Clinical System</div>
        <div class="document-title">Clinical Note</div>
        <div class="header-info">
          <div class="header-item">
            <div class="header-label">Patient Name:</div>
            <div class="header-value">${patientName}</div>
          </div>
          ${mrn ? `
            <div class="header-item">
              <div class="header-label">MRN:</div>
              <div class="header-value">${mrn}</div>
            </div>
          ` : ''}
          <div class="header-item">
            <div class="header-label">Date:</div>
            <div class="header-value">${exportDate}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Time:</div>
            <div class="header-value">${exportTime}</div>
          </div>
        </div>
      </div>
      
      <div class="content">
        ${sectionsHtml}
      </div>
      
      <div class="footer">
        <p>This document was generated by Medclara Clinical Scribe System</p>
        <p style="margin-top: 8px;">Generated on ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}
