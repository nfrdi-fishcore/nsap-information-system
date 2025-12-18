/**
 * Report Export Utility - NSAP Information System
 * 
 * Handles export functionality for reports (PDF, Excel, CSV)
 * 
 * Dependencies:
 * - jsPDF (for PDF export) - https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js
 * - SheetJS (for Excel export) - https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.js
 */

class ReportExport {
    /**
     * Export data to CSV
     * @param {Array} data - Array of objects to export
     * @param {Array} headers - Array of header names
     * @param {string} filename - Output filename (without extension)
     */
    static exportToCSV(data, headers, filename = 'report') {
        try {
            if (!data || data.length === 0) {
                window.toast?.error('No data to export', 'Export Error');
                return;
            }

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...data.map(row => {
                    return headers.map(header => {
                        const value = row[header] !== undefined ? row[header] : '';
                        // Escape quotes and wrap in quotes
                        return `"${String(value).replace(/"/g, '""')}"`;
                    }).join(',');
                })
            ].join('\n');

            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            window.toast?.success('Report exported to CSV successfully!', 'Export Complete');
        } catch (error) {
            ErrorHandler?.handle(error, {
                context: 'ReportExport.exportToCSV',
                userMessage: 'Failed to export to CSV'
            });
        }
    }

    /**
     * Export data to Excel
     * @param {Array} data - Array of objects to export
     * @param {Array} headers - Array of header names
     * @param {string} filename - Output filename (without extension)
     * @param {string} sheetName - Sheet name (default: 'Report')
     */
    static exportToExcel(data, headers, filename = 'report', sheetName = 'Report') {
        try {
            if (typeof XLSX === 'undefined') {
                window.toast?.error('Excel export library not loaded. Please include SheetJS library.', 'Export Error');
                return;
            }

            if (!data || data.length === 0) {
                window.toast?.error('No data to export', 'Export Error');
                return;
            }

            // Prepare worksheet data
            const worksheetData = [
                headers,
                ...data.map(row => headers.map(header => row[header] !== undefined ? row[header] : ''))
            ];

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(worksheetData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Generate file and download
            XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);

            window.toast?.success('Report exported to Excel successfully!', 'Export Complete');
        } catch (error) {
            ErrorHandler?.handle(error, {
                context: 'ReportExport.exportToExcel',
                userMessage: 'Failed to export to Excel'
            });
        }
    }

    /**
     * Export data to PDF
     * @param {Object} reportData - Report data object
     * @param {string} title - Report title
     * @param {string} filename - Output filename (without extension)
     */
    static exportToPDF(reportData, title = 'Report', filename = 'report') {
        try {
            if (typeof window.jspdf === 'undefined' && typeof window.jspdf?.jsPDF === 'undefined') {
                window.toast?.error('PDF export library not loaded. Please include jsPDF library.', 'Export Error');
                return;
            }

            const { jsPDF } = window.jspdf || window;
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(18);
            doc.text(title, 14, 20);

            // Add date
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

            let yPosition = 40;

            // Add summary section
            if (reportData.summary) {
                doc.setFontSize(14);
                doc.text('Summary', 14, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                const summary = reportData.summary;
                yPosition += 5;
                doc.text(`Total Catch: ${summary.totalCatch?.toLocaleString() || 0} kg`, 20, yPosition);
                yPosition += 5;
                doc.text(`Sampling Days: ${summary.totalSamplingDays || 0}`, 20, yPosition);
                yPosition += 5;
                doc.text(`Vessels: ${summary.totalVessels || 0}`, 20, yPosition);
                yPosition += 5;
                doc.text(`Species: ${summary.totalSpecies || 0}`, 20, yPosition);
                yPosition += 10;
            }

            // Add monthly data table
            if (reportData.monthlyData && reportData.monthlyData.length > 0) {
                // Check if we need a new page
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }

                doc.setFontSize(14);
                doc.text('Monthly Data', 14, yPosition);
                yPosition += 10;

                // Table headers
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('Month', 14, yPosition);
                doc.text('Catch (kg)', 70, yPosition);
                doc.text('Sampling Days', 120, yPosition);
                doc.text('Vessels', 170, yPosition);
                yPosition += 5;

                // Table data
                doc.setFont(undefined, 'normal');
                reportData.monthlyData.forEach(month => {
                    if (yPosition > 280) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    doc.text(`${month.month} ${month.year}`, 14, yPosition);
                    doc.text((month.catch || 0).toLocaleString(), 70, yPosition);
                    doc.text((month.samplingDays || 0).toString(), 120, yPosition);
                    doc.text((month.vessels || 0).toString(), 170, yPosition);
                    yPosition += 5;
                });
                yPosition += 5;
            }

            // Add top species table
            if (reportData.topSpecies && reportData.topSpecies.length > 0) {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }

                doc.setFontSize(14);
                doc.text('Top Species', 14, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('Species', 14, yPosition);
                doc.text('Catch (kg)', 120, yPosition);
                yPosition += 5;

                doc.setFont(undefined, 'normal');
                reportData.topSpecies.forEach((species, index) => {
                    if (yPosition > 280) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    doc.text(`${index + 1}. ${species.speciesName}`, 14, yPosition);
                    doc.text((species.catch || 0).toLocaleString(), 120, yPosition);
                    yPosition += 5;
                });
            }

            // Save PDF
            doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);

            window.toast?.success('Report exported to PDF successfully!', 'Export Complete');
        } catch (error) {
            ErrorHandler?.handle(error, {
                context: 'ReportExport.exportToPDF',
                userMessage: 'Failed to export to PDF'
            });
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ReportExport = ReportExport;
}

