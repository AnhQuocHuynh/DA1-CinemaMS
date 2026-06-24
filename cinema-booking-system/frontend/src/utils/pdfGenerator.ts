import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const downloadElementAsPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Use html2canvas to capture the element.
  // We use CORS to load external images (like Cloudinary posters).
  const canvas = await html2canvas(element, {
    scale: 2, // Higher scale for better print quality
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff', // Ensure white background
  });

  const imgData = canvas.toDataURL('image/png');

  // Create a PDF. A4 size is commonly used.
  // We will determine orientation based on canvas dimensions.
  const isLandscape = canvas.width > canvas.height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Calculate the aspect ratio
  const imgProps = pdf.getImageProperties(imgData);
  const ratio = imgProps.width / imgProps.height;
  
  let targetWidth = pdfWidth;
  let targetHeight = targetWidth / ratio;

  // If the calculated height exceeds page height, scale by height instead
  if (targetHeight > pdfHeight) {
    targetHeight = pdfHeight;
    targetWidth = targetHeight * ratio;
  }

  // Center the image horizontally
  const x = (pdfWidth - targetWidth) / 2;
  // Position a bit down from the top
  const y = 10; 

  pdf.addImage(imgData, 'PNG', x, y, targetWidth, targetHeight);
  pdf.save(filename);
};
