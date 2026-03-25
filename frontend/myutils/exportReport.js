import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates a multi-page PDF report from a specific HTML element.
 * Supports hidden containers and Plotly chart rendering stability.
 */
export const generatePDFReport = async (elementId, fileName = "AutoEDA_Report.pdf") => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Target element for PDF not found");
    return;
  }

  console.log("🚀 Generating High-Resolution Report...");

  // Backup original styles to restore later
  const originalStyle = element.style.cssText;

  try {
    // Step 1: Force the element to be visible and expanded for capturing
    element.style.position = "absolute";
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.width = "1000px"; // Fixed width for consistent PDF layout
    element.style.display = "block";
    element.style.visibility = "visible";
    element.style.overflow = "visible";
    element.style.height = "auto";
    element.style.zIndex = "-1"; // Hide behind other elements during process

    // Step 2: WAIT for Plotly. Since Plotly uses SVG/Canvas, 
    // it needs a moment to initialize in the "newly visible" div.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Step 3: Capture to Canvas
    const canvas = await html2canvas(element, {
      scale: 2,           // Retina/High-DPI quality
      useCORS: true,      // Essential for loading images from external URLs
      logging: false,     // Keep console clean
      backgroundColor: "#f9fafb", // Matches Zinc-50
      windowWidth: 1000,  // Forces layout width for consistent scaling
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Step 4: PDF Dimensions Setup (A4)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // ~210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // ~297mm
    
    const imgProps = pdf.getImageProperties(imgData);
    const scaledImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Step 5: Multi-page logic
    let heightLeft = scaledImgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight, '', 'FAST');
    heightLeft -= pdfHeight;

    // If content is longer than one A4 page, loop and add new pages
    while (heightLeft > 0) {
      position = heightLeft - scaledImgHeight; // Calculate offset
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight, '', 'FAST');
      heightLeft -= pdfHeight;
    }

    // Step 6: Trigger Browser Download
    pdf.save(fileName);
    console.log("✅ PDF Downloaded Successfully");

  } catch (error) {
    console.error("❌ PDF Generation Error:", error);
    alert("Could not generate report. Ensure all charts are loaded.");
  } finally {
    // Step 7: Restore original UI state
    element.style.cssText = originalStyle;
  }
};