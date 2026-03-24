import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatAmount = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const generateInvoice = (policy: any) => {
  const doc = new jsPDF();

  // Colors
  const primaryColor = [79, 70, 229]; // Indigo 600
  const textColor = [51, 65, 85]; // Slate 700
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Miss_Carr Assur', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('Gestion d\'assurance automobile', 14, 30);
  
  // Invoice Details
  doc.setFontSize(16);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('FACTURE / ATTESTATION', 14, 45);
  
  doc.setFontSize(10);
  doc.text(`Date d'émission : ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`, 14, 53);
  doc.text(`Référence : ${policy.id.substring(0, 8).toUpperCase()}`, 14, 58);
  
  // Client Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations du Souscripteur', 14, 75);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nom : ${policy.ownerName}`, 14, 83);
  
  // Vehicle Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations du Véhicule', 14, 98);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Marque : ${policy.carBrand}`, 14, 106);
  doc.text(`Modèle : ${policy.carModel}`, 14, 111);
  doc.text(`Immatriculation : ${policy.licensePlate}`, 14, 116);
  
  // Contract Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Détails du Contrat', 14, 131);
  
  const startDate = format(parseISO(policy.startDate), 'dd MMMM yyyy', { locale: fr });
  const endDate = format(parseISO(policy.endDate), 'dd MMMM yyyy', { locale: fr });
  
  const formattedAmount = `${formatAmount(policy.amount ?? 0)} FCFA`;

  autoTable(doc, {
    startY: 139,
    head: [['Description', 'Date de début', 'Date de fin', 'Montant']],
    body: [
      ['Assurance Automobile', startDate, endDate, formattedAmount],
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor as [number, number, number] },
    styles: { font: 'helvetica', fontSize: 10 },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Total :', 140, finalY);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(formattedAmount, 196, finalY, { align: 'right' });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Merci de votre confiance.', 14, pageHeight - 20);
  doc.text('Ce document sert de justificatif de souscription à votre contrat d\'assurance.', 14, pageHeight - 15);
  
  // Save the PDF
  doc.save(`Facture_Miss_Carr_Assur_${policy.licensePlate}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
