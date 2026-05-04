import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Build a PDF report for an application (residence + family members).
// Uses jsPDF with a Latin transliteration-free approach by relying on the
// browser's default font but rendering Arabic text via the standard font.
// Note: jsPDF's default font lacks proper Arabic shaping. To keep the file
// lightweight and dependency-free, we render labels in English/transliterated
// labels and the user data as-is (Arabic glyphs may render disconnected but
// will be readable when copied). The administration receives a printable
// summary suitable for archival.

type Residence = {
  original_residence: string;
  original_landmark: string;
  current_landmark: string;
  family_size: number;
  has_martyr: boolean;
  martyr_name?: string;
  martyr_relationship?: string;
};

type Member = {
  full_name: string;
  national_id?: string | null;
  birth_date: string;
  gender: string;
  relationship: string;
  relationship_other?: string | null;
  is_war_injured: boolean;
  chronic_diseases?: string | null;
  is_pregnant: boolean;
  is_breastfeeding: boolean;
  health_notes?: string | null;
};

type HeadProfile = {
  full_name: string;
  national_id: string;
  phone: string;
  alt_phone?: string | null;
  birth_date: string;
  gender: string;
  marital_status: string;
};

type AppMeta = {
  status: string;
  submitted_at?: string | null;
  application_id?: string | null;
};

export function generateApplicationPdf(opts: {
  head: HeadProfile;
  residence: Residence;
  members: Member[];
  meta: AppMeta;
}) {
  const { head, residence, members, meta } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(29, 78, 216); // primary-ish
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("BARAKA 2 CAMP — Family Application Report", pageW / 2, 30, { align: "center" });
  doc.setFontSize(11);
  doc.text("\u062a\u0642\u0631\u064a\u0631 \u0637\u0644\u0628 \u0639\u0627\u0626\u0644\u0629 \u2014 \u0645\u062e\u064a\u0645 \u0628\u0631\u0643\u0629 2", pageW / 2, 52, { align: "center" });

  // Meta box
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const today = new Date().toISOString().slice(0, 10);
  const submitted = meta.submitted_at ? new Date(meta.submitted_at).toISOString().slice(0, 10) : "-";
  const metaRows: [string, string][] = [
    ["Application ID / \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", meta.application_id?.slice(0, 8) || "-"],
    ["Status / \u0627\u0644\u062d\u0627\u0644\u0629", statusLabel(meta.status)],
    ["Submitted / \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0631\u0633\u0627\u0644", submitted],
    ["Generated / \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u0631\u064a\u0631", today],
  ];
  autoTable(doc, {
    startY: 85,
    head: [["Field", "Value"]],
    body: metaRows,
    theme: "grid",
    headStyles: { fillColor: [217, 119, 6] },
    styles: { fontSize: 9 },
  });

  // Head of family
  const headRows: [string, string][] = [
    ["Full Name / \u0627\u0644\u0627\u0633\u0645", head.full_name],
    ["National ID / \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629", head.national_id],
    ["Phone / \u0627\u0644\u062c\u0648\u0627\u0644", head.phone],
    ["Alt Phone / \u062c\u0648\u0627\u0644 \u0628\u062f\u064a\u0644", head.alt_phone || "-"],
    ["Birth Date / \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f", head.birth_date],
    ["Gender / \u0627\u0644\u062c\u0646\u0633", head.gender],
    ["Marital Status / \u0627\u0644\u062d\u0627\u0644\u0629", head.marital_status],
  ];
  doc.setFontSize(13);
  doc.setTextColor(29, 78, 216);
  doc.text("1) Head of Family / \u0631\u0628 \u0627\u0644\u0623\u0633\u0631\u0629", 40, (doc as any).lastAutoTable.finalY + 25);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 35,
    head: [["Field", "Value"]],
    body: headRows,
    theme: "striped",
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 9 },
  });

  // Residence
  const resRows: [string, string][] = [
    ["Original Residence / \u0627\u0644\u0633\u0643\u0646 \u0627\u0644\u0623\u0635\u0644\u064a", residence.original_residence],
    ["Original Landmark / \u0645\u0639\u0644\u0645 \u0627\u0644\u0633\u0643\u0646 \u0627\u0644\u0623\u0635\u0644\u064a", residence.original_landmark],
    ["Current Camp / \u0627\u0644\u0633\u0643\u0646 \u0627\u0644\u062d\u0627\u0644\u064a", "Baraka 2 / \u0628\u0631\u0643\u0629 2"],
    ["Current Landmark / \u0645\u0639\u0644\u0645 \u0627\u0644\u0633\u0643\u0646 \u0627\u0644\u062d\u0627\u0644\u064a", residence.current_landmark],
    ["Family Size / \u0639\u062f\u062f \u0627\u0644\u0623\u0641\u0631\u0627\u062f", String(residence.family_size)],
    ["Has Martyr / \u0644\u062f\u064a\u0647\u0645 \u0634\u0647\u064a\u062f", residence.has_martyr ? "Yes / \u0646\u0639\u0645" : "No / \u0644\u0627"],
  ];
  if (residence.has_martyr) {
    resRows.push(["Martyr Name / \u0627\u0633\u0645 \u0627\u0644\u0634\u0647\u064a\u062f", residence.martyr_name || "-"]);
    resRows.push(["Martyr Relationship / \u0635\u0644\u0629 \u0627\u0644\u0642\u0631\u0627\u0628\u0629", residence.martyr_relationship || "-"]);
  }
  doc.setFontSize(13);
  doc.setTextColor(29, 78, 216);
  doc.text("2) Residence / \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u0643\u0646", 40, (doc as any).lastAutoTable.finalY + 25);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 35,
    head: [["Field", "Value"]],
    body: resRows,
    theme: "striped",
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 9 },
  });

  // Family members
  doc.setFontSize(13);
  doc.setTextColor(29, 78, 216);
  doc.text(
    `3) Family Members / \u0623\u0641\u0631\u0627\u062f \u0627\u0644\u0623\u0633\u0631\u0629 (${members.length})`,
    40,
    (doc as any).lastAutoTable.finalY + 25
  );
  if (members.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("No additional members. / \u0644\u0627 \u064a\u0648\u062c\u062f \u0623\u0641\u0631\u0627\u062f \u0625\u0636\u0627\u0641\u064a\u0648\u0646.", 40, (doc as any).lastAutoTable.finalY + 45);
  } else {
    const memberRows = members.map((m, i) => [
      String(i + 1),
      m.full_name || "-",
      m.national_id || "-",
      m.birth_date || "-",
      m.gender === "male" ? "M" : "F",
      m.relationship === "other" ? (m.relationship_other || "other") : m.relationship,
      [
        m.is_war_injured ? "Injured" : "",
        m.is_pregnant ? "Pregnant" : "",
        m.is_breastfeeding ? "Breastfeeding" : "",
      ].filter(Boolean).join(", ") || "-",
      m.chronic_diseases || "-",
    ]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: [["#", "Name", "National ID", "Birth Date", "G", "Relation", "Tags", "Chronic"]],
      body: memberRows,
      theme: "grid",
      headStyles: { fillColor: [29, 78, 216] },
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 110 },
        2: { cellWidth: 65 },
        3: { cellWidth: 60 },
        4: { cellWidth: 18 },
        5: { cellWidth: 55 },
        6: { cellWidth: 80 },
      },
    });
  }

  // Footer with page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Baraka 2 Camp — Page ${i} / ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 15,
      { align: "center" }
    );
  }

  const filename = `Baraka2-Application-${(head.national_id || "report")}-${today}.pdf`;
  doc.save(filename);
}

function statusLabel(s: string): string {
  if (s === "approved") return "Approved / \u0645\u0642\u0628\u0648\u0644";
  if (s === "rejected") return "Rejected / \u0645\u0631\u0641\u0648\u0636";
  return "Pending / \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629";
}
