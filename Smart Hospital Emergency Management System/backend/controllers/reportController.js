import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import Driver from '../models/Driver.js';

export const exportPDFReport = async (req, res) => {
  try {
    const { reportType } = req.query; // 'occupancy', 'ambulance', 'emergencies'
    const doc = new PDFDocument({ margin: 50 });

    let filename = `report_${reportType || 'summary'}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#1E40AF').fontSize(22).text('SMART HOSPITAL EMERGENCY MANAGEMENT SYSTEM', { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#4B5563').fontSize(12).text(`Report Type: ${reportType ? reportType.toUpperCase() : 'GENERAL SUMMARY'}`, { align: 'center' });
    doc.text(`Generated On: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(50, 120).lineTo(562, 120).stroke();
    doc.moveDown(1.5);

    if (reportType === 'occupancy') {
      // Fetch Hospital details
      const hospitals = await Hospital.find().populate('user', 'name');
      doc.fillColor('#1F2937').fontSize(16).text('Hospital Bed Occupancy Report', { underline: true });
      doc.moveDown(1);

      hospitals.forEach((h, index) => {
        doc.fontSize(12).fillColor('#111827').text(`${index + 1}. ${h.name}`);
        doc.fontSize(10).fillColor('#4B5563')
           .text(`   Address: ${h.address}`)
           .text(`   General Beds: Total ${h.totalBeds} | Available ${h.availableBeds}`)
           .text(`   ICU Beds: Total ${h.icuBedsTotal} | Available ${h.icuBedsAvailable}`)
           .text(`   Oxygen Beds: Total ${h.oxygenBedsTotal} | Available ${h.oxygenBedsAvailable}`)
           .text(`   Admitted Patients (Calculated): ${h.totalBeds - h.availableBeds}`)
           .text(`   Available Doctors: ${h.doctorsAvailable}`);
        doc.moveDown(1);
      });
    } else if (reportType === 'ambulance') {
      // Fetch Ambulance Usage
      const ambulances = await Ambulance.find().populate('hospitalAssigned', 'name');
      doc.fillColor('#1F2937').fontSize(16).text('Ambulance Dispatch & Fleet Report', { underline: true });
      doc.moveDown(1);

      ambulances.forEach((a, index) => {
        doc.fontSize(12).fillColor('#111827').text(`${index + 1}. Vehicle: ${a.vehicleNumber}`);
        doc.fontSize(10).fillColor('#4B5563')
           .text(`   Assigned Hospital: ${a.hospitalAssigned ? a.hospitalAssigned.name : 'None'}`)
           .text(`   Driver Contact: ${a.driverContact}`)
           .text(`   Status: ${a.status.toUpperCase()}`)
           .text(`   Available for Dispatch: ${a.availability ? 'Yes' : 'No'}`);
        doc.moveDown(1);
      });
    } else {
      // Default: Emergency Requests logs
      const requests = await EmergencyRequest.find()
        .populate('hospital', 'name')
        .populate('patient', 'name')
        .sort({ createdAt: -1 })
        .limit(20);

      doc.fillColor('#1F2937').fontSize(16).text('Recent Emergency Requests Log (Top 20)', { underline: true });
      doc.moveDown(1);

      requests.forEach((r, index) => {
        doc.fontSize(11).fillColor('#111827').text(`${index + 1}. Request ID: ${r._id}`);
        doc.fontSize(9).fillColor('#4B5563')
           .text(`   Patient Name: ${r.patientName} | Phone: ${r.patientPhone}`)
           .text(`   Hospital: ${r.hospital ? r.hospital.name : 'Unknown'}`)
           .text(`   Priority: ${r.priority.toUpperCase()} | Status: ${r.status.toUpperCase()}`)
           .text(`   Complaint: ${r.complaint}`)
           .text(`   Date: ${r.createdAt.toLocaleString()}`);
        doc.moveDown(0.5);
      });
    }

    // --- Footer ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#9CA3AF').text(
        `Smart Hospital EMS - Page ${i + 1} of ${pages.count}`,
        50,
        720,
        { align: 'center', width: 512 }
      );
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: 'Error generating PDF report.', error: error.message });
  }
};

export const exportExcelReport = async (req, res) => {
  try {
    const { reportType } = req.query; // 'occupancy', 'ambulance', 'emergencies'
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportType ? reportType.toUpperCase() : 'Summary');

    let filename = `report_${reportType || 'summary'}.xlsx`;

    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    if (reportType === 'occupancy') {
      worksheet.columns = [
        { header: 'Hospital Name', key: 'name', width: 30 },
        { header: 'Address', key: 'address', width: 40 },
        { header: 'Total Beds', key: 'totalBeds', width: 12 },
        { header: 'Available Beds', key: 'availableBeds', width: 15 },
        { header: 'Total ICU Beds', key: 'icuBedsTotal', width: 15 },
        { header: 'Available ICU Beds', key: 'icuBedsAvailable', width: 18 },
        { header: 'Total Oxygen Beds', key: 'oxygenBedsTotal', width: 18 },
        { header: 'Available Oxygen Beds', key: 'oxygenBedsAvailable', width: 22 },
        { header: 'Doctors Available', key: 'doctorsAvailable', width: 18 },
      ];

      const hospitals = await Hospital.find();
      hospitals.forEach(h => {
        worksheet.addRow({
          name: h.name,
          address: h.address,
          totalBeds: h.totalBeds,
          availableBeds: h.availableBeds,
          icuBedsTotal: h.icuBedsTotal,
          icuBedsAvailable: h.icuBedsAvailable,
          oxygenBedsTotal: h.oxygenBedsTotal,
          oxygenBedsAvailable: h.oxygenBedsAvailable,
          doctorsAvailable: h.doctorsAvailable,
        });
      });
    } else if (reportType === 'ambulance') {
      worksheet.columns = [
        { header: 'Vehicle Number', key: 'vehicleNumber', width: 20 },
        { header: 'Assigned Hospital', key: 'hospital', width: 30 },
        { header: 'Driver Contact', key: 'contact', width: 18 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Availability', key: 'availability', width: 15 },
      ];

      const ambulances = await Ambulance.find().populate('hospitalAssigned', 'name');
      ambulances.forEach(a => {
        worksheet.addRow({
          vehicleNumber: a.vehicleNumber,
          hospital: a.hospitalAssigned ? a.hospitalAssigned.name : 'N/A',
          contact: a.driverContact,
          status: a.status.toUpperCase(),
          availability: a.availability ? 'ONLINE' : 'OFFLINE',
        });
      });
    } else {
      worksheet.columns = [
        { header: 'Request ID', key: 'id', width: 25 },
        { header: 'Patient Name', key: 'patientName', width: 20 },
        { header: 'Patient Phone', key: 'patientPhone', width: 15 },
        { header: 'Pickup Address', key: 'address', width: 40 },
        { header: 'Hospital Name', key: 'hospitalName', width: 30 },
        { header: 'Priority', key: 'priority', width: 12 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Complaint', key: 'complaint', width: 30 },
        { header: 'Date Created', key: 'date', width: 22 },
      ];

      const requests = await EmergencyRequest.find().populate('hospital', 'name');
      requests.forEach(r => {
        worksheet.addRow({
          id: r._id.toString(),
          patientName: r.patientName,
          patientPhone: r.patientPhone,
          address: r.pickupAddress,
          hospitalName: r.hospital ? r.hospital.name : 'Unknown',
          priority: r.priority.toUpperCase(),
          status: r.status.toUpperCase(),
          complaint: r.complaint,
          date: r.createdAt.toLocaleString(),
        });
      });
    }

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' } // Dark Blue matching theme
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Error generating Excel report.', error: error.message });
  }
};
