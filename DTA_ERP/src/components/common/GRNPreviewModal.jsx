import React, { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const GRNPreviewModal = ({ isOpen, onClose, onConfirm, formData, items }) => {
  const pdfRef = useRef();

  if (!isOpen) return null;

  const downloadPDF = async () => {
    const element = pdfRef.current;
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`GRN_${formData.invoice_no}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-xl overflow-auto max-h-[95vh]">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Review & Final Submit</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* PDF CONTENT */}
        <div
          ref={pdfRef}
          className="p-8 text-[13px] text-black bg-white"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* COMPANY NAME */}
          <h1 className="text-center text-2xl font-bold tracking-wide">
            KALIKUND STEEL ENGG CO.
          </h1>
          <p className="text-center text-xs mb-2">
            Inventory Management System
          </p>

          {/* GRN TITLE */}
          <div className="border border-black text-center font-bold py-2 bg-gray-200">
            GOODS RECEIVED NOTE
          </div>

          {/* INFO TABLE */}
          <table className="w-full border border-black border-collapse mt-4">
            <tbody>
              <tr>
                <td className="border border-black p-2 font-semibold w-1/6">
                  GRN No:
                </td>
                <td className="border border-black p-2 w-1/3">Auto</td>
                <td className="border border-black p-2 font-semibold w-1/6">
                  Date:
                </td>
                <td className="border border-black p-2">
                  {formData.transaction_date}
                </td>
              </tr>

              <tr>
                <td className="border border-black p-2 font-semibold">
                  {formData.transaction_type === "IN"
                    ? "Vendor Name:"
                    : "Client Name:"}
                </td>
                <td className="border border-black p-2">
                  {formData.transaction_type === "IN"
                    ? formData.vendor_name
                    : formData.client_name}
                </td>
                <td className="border border-black p-2 font-semibold">
                  Inv. No:
                </td>
                <td className="border border-black p-2">
                  {formData.invoice_no}
                </td>
              </tr>
            </tbody>
          </table>

          {/* DETAILS HEADER */}
          <div className="border border-black border-t-0 text-center py-2 font-semibold">
            Details of consignment
          </div>

          {/* DETAILS TABLE */}
          <table className="w-full border border-black border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 w-[5%]">Sr. No.</th>
                <th className="border border-black p-2 w-[50%]">
                  Description
                  <div className="text-[10px] font-normal">
                    (Product, Desc, MOC, Grade, Size, Class, Sch, LessThk)
                  </div>
                </th>
                <th className="border border-black p-2 w-[15%]">Job No.</th>
                <th className="border border-black p-2 w-[10%]">Qty</th>
                <th className="border border-black p-2 w-[20%]">Remarks</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-black p-2 text-center">
                    {index + 1}
                  </td>

                  <td className="border border-black p-2">
                    {item.product}, {item.description}, {item.moc}, {item.grade}
                    , {item.size1} x {item.size2}, {item.class_sch}, {item.sch2}
                    , {item.less_thk}
                  </td>

                  <td className="border border-black p-2 text-center">
                    {formData.job_no}
                  </td>

                  <td className="border border-black p-2 text-center">
                    {item.qty}{item.unit}
                  </td>

                  <td className="border border-black p-2 text-center">
                    {formData.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* SIGNATURE SECTION */}
          <table className="w-full border border-black border-collapse mt-8">
            <tbody>
              <tr>
                <td className="border border-black p-4 w-1/2 font-semibold">
                  Received By :
                </td>
                <td className="border border-black p-4 w-1/2 font-semibold text-right">
                  Checked By :
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="flex gap-4 p-4 border-t bg-gray-100">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 text-white py-2 rounded"
          >
            Edit / Back
          </button>

          <button
            onClick={downloadPDF}
            className="flex-1 bg-blue-600 text-white py-2 rounded"
          >
            Download PDF
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 bg-green-600 text-white py-2 rounded"
          >
            Confirm & Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default GRNPreviewModal;
