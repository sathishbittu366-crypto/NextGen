"""Official attendance-register PDF — printable anytime (Boss's request),
not gated by the 24h faculty edit lock (viewing/printing isn't editing).

Layout follows Boss's mockup: VCET logo + header, session meta block,
S.No/Roll No/Name/Status table with a light-red background on Absent rows
so the state isn't communicated by colour alone (status text stays too).
"""

import io
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

LOGO_PATH = Path(__file__).parent.parent.parent / "webapp" / "static" / "img" / "vcet_logo.png"

RED_BG = colors.Color(0.99, 0.90, 0.91)   # matches app.css --red tint
GREEN_BG = colors.Color(0.91, 0.98, 0.94)


def build_attendance_pdf(session, roster) -> bytes:
    """session: sqlite Row from session_details(). roster: list of dicts with
    roll_no, name, present (bool) — same shape load_register() produces."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
                             leftMargin=16 * mm, rightMargin=16 * mm)
    story = []

    center = ParagraphStyle("center", alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=13, leading=16)
    sub = ParagraphStyle("sub", alignment=TA_CENTER, fontName="Helvetica", fontSize=9, leading=12, textColor=colors.HexColor("#475467"))
    title = ParagraphStyle("title", alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=12, spaceBefore=8, spaceAfter=10)

    if LOGO_PATH.exists():
        try:
            story.append(RLImage(str(LOGO_PATH), width=22 * mm, height=19 * mm))
        except Exception:
            pass
    story.append(Paragraph("Visvesvaraya College of Engineering &amp; Technology", center))
    story.append(Paragraph("An Autonomous Institution &middot; Affiliated to JNTU, Hyderabad", sub))
    story.append(Paragraph("Bongloor X Road, MP Patelguda (V), Ibrahimpatnam (M), Hyderabad-501510", sub))
    story.append(Paragraph("DEPARTMENT OF CSE (DATA SCIENCE)", sub))
    story.append(Paragraph("ATTENDANCE REGISTER", title))

    meta_rows = [
        ["Date", session["attendance_date"], "Semester", session["semester_code"]],
        ["Subject", f"{session['subject_name']} ({session['subject_code']})", "Faculty", session["faculty_name"] or session["faculty_username"]],
        ["Session", "Lab" if session["session_type"] == "LAB" else "Class", "Duration", f"{session['duration_hours']} Hour(s)"],
        ["Topic", session["topic"], "", ""],
    ]
    meta = Table(meta_rows, colWidths=[24 * mm, 68 * mm, 24 * mm, 62 * mm])
    meta.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("SPAN", (1, 3), (3, 3)),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#d0d5dd")),
    ]))
    story.append(meta)
    story.append(Spacer(1, 10))

    present_count = sum(1 for r in roster if r["present"])
    data = [["S.No", "Roll No", "Name", "Status"]]
    for i, r in enumerate(roster, 1):
        data.append([str(i), r["roll_no"], r["name"], "PRESENT" if r["present"] else "ABSENT"])

    table = Table(data, colWidths=[14 * mm, 32 * mm, 90 * mm, 22 * mm], repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f5f8")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"), ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e4e7ec")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]
    for i, r in enumerate(roster, start=1):
        style.append(("BACKGROUND", (0, i), (-1, i), GREEN_BG if r["present"] else RED_BG))
        style.append(("TEXTCOLOR", (3, i), (3, i), colors.HexColor("#067647") if r["present"] else colors.HexColor("#b42318")))
    table.setStyle(TableStyle(style))
    story.append(table)

    story.append(Spacer(1, 10))
    story.append(Paragraph(f"Present: {present_count} &nbsp;&nbsp; Absent: {len(roster) - present_count} &nbsp;&nbsp; Total: {len(roster)}",
                            ParagraphStyle("footer", fontName="Helvetica-Bold", fontSize=10)))

    doc.build(story)
    return buf.getvalue()



def build_monthly_attendance_pdf(data) -> bytes:
    """Build a clean, print-safe landscape A4 monthly attendance register.

    The monthly register deliberately follows the visual hierarchy of the
    Student List PDF: NextGen logo at left, institutional header centered,
    divider, document title, compact metadata, then the register table.

    The table width is calculated from the actual printable A4 width so every
    month (28/29/30/31 days) always keeps S.No, roll number, student name and
    every calendar day inside the page.  This prevents ReportLab from silently
    drawing an oversized table beyond the page edges.
    """
    from datetime import datetime
    from reportlab.lib.pagesizes import landscape
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfgen import canvas
    from reportlab.platypus import HRFlowable, PageBreak

    page_size = landscape(A4)
    page_w, page_h = page_size
    left_margin = 5 * mm
    right_margin = 5 * mm
    top_margin = 5 * mm
    bottom_margin = 10 * mm
    printable_w = page_w - left_margin - right_margin

    # Student List uses the same NextGen logo; keep the same fallback order so
    # the attendance export remains visually consistent with that document.
    logo_candidates = [
        Path(__file__).parent.parent.parent / "webapp" / "static" / "img" / "vcet_logo.png",
        Path(__file__).parent.parent.parent / "webapp" / "static" / "img" / "logo.png",
        Path(__file__).parent.parent.parent / "frontend" / "public" / "logo.png",
        Path(__file__).parent.parent.parent / "frontend" / "public" / "logo.jpg",
    ]
    logo_path = next((p for p in logo_candidates if p.exists()), None)

    class MonthlyNumberedCanvas(canvas.Canvas):
        """Two-pass canvas for a stable footer with Page X of Y."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            page_count = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_footer(page_count)
                super().showPage()
            super().save()

        def draw_footer(self, page_count):
            self.saveState()
            self.setStrokeColor(colors.HexColor("#94a3b8"))
            self.setLineWidth(0.45)
            self.line(left_margin, 6.5 * mm, page_w - right_margin, 6.5 * mm)
            self.setFillColor(colors.HexColor("#475569"))
            self.setFont("Helvetica", 7)
            self.drawCentredString(
                page_w / 2,
                3.0 * mm,
                "Generated by NextGen SMS - Student Management System",
            )
            self.drawRightString(
                page_w - right_margin,
                3.0 * mm,
                f"Page {self._pageNumber} of {page_count}",
            )
            self.restoreState()

    doc = SimpleDocTemplate(
        buf := io.BytesIO(),
        pagesize=page_size,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
        leftMargin=left_margin,
        rightMargin=right_margin,
        title=f"Attendance Register - {data.get('month_label', '')}",
        author="NextGen SMS",
    )

    center = ParagraphStyle(
        "MonthlyHeaderTitle",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=12.2,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
    )
    sub = ParagraphStyle(
        "MonthlyHeaderSub",
        alignment=TA_CENTER,
        fontName="Helvetica",
        fontSize=7.2,
        leading=8.4,
        textColor=colors.HexColor("#334155"),
    )
    dept = ParagraphStyle(
        "MonthlyHeaderDept",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=8.2,
        leading=9.5,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=1,
    )
    title = ParagraphStyle(
        "MonthlyDocTitle",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=11.2,
        leading=13,
        textColor=colors.HexColor("#000000"),
        spaceBefore=3,
        spaceAfter=3,
    )
    meta_label = ParagraphStyle(
        "MonthlyMetaLabel",
        fontName="Helvetica-Bold",
        fontSize=7.1,
        leading=8.5,
        textColor=colors.HexColor("#0f172a"),
    )
    meta_val = ParagraphStyle(
        "MonthlyMetaVal",
        fontName="Helvetica",
        fontSize=7.1,
        leading=8.5,
        textColor=colors.HexColor("#334155"),
    )
    sub_left = ParagraphStyle(
        "MonthlyLegend",
        alignment=TA_CENTER,
        fontName="Helvetica",
        fontSize=6.6,
        leading=8,
        textColor=colors.HexColor("#475569"),
    )

    story = []

    # ── Institution header: same composition as Student List PDF ──
    header_text = [
        Paragraph("<b>Visvesvaraya College of Engineering &amp; Technology</b>", center),
        Paragraph("An Autonomous Institution &middot; Affiliated to JNTU, Hyderabad", sub),
        Paragraph("Bongloor X Road, Mangalpally (V), Ibrahimpatnam (M), Hyderabad-501510", sub),
        Paragraph("<b>DEPARTMENT OF CSE (DATA SCIENCE)</b>", dept),
    ]

    if logo_path:
        try:
            logo_img = RLImage(str(logo_path), width=19 * mm, height=17 * mm)
            header_table = Table(
                [[logo_img, header_text]],
                colWidths=[22 * mm, printable_w - 22 * mm],
                rowHeights=[17 * mm],
                hAlign="LEFT",
            )
            header_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(header_table)
        except Exception:
            for item in header_text:
                story.append(item)
    else:
        for item in header_text:
            story.append(item)

    story.append(Spacer(1, 1.5 * mm))
    story.append(HRFlowable(
        width="100%", thickness=0.8,
        color=colors.HexColor("#0f172a"),
        spaceBefore=0, spaceAfter=2.5,
    ))

    month_label = xml_escape(str(data.get("month_label", "")))
    faculty_name = xml_escape(str(data.get("faculty_name") or data.get("faculty_username") or "-"))
    story.append(Paragraph(f"ATTENDANCE REGISTER - {month_label} - Faculty: {faculty_name}", title))

    semester_name = xml_escape(str((data.get("semester") or {}).get("name") or "-"))
    subject = data.get("subject") or {}
    subject_value = f"{xml_escape(str(subject.get('code') or ''))} - {xml_escape(str(subject.get('name') or ''))}".strip(" -")
    generated_on = datetime.now().strftime("%d-%m-%Y %I:%M %p")
    roster = data.get("roster") or []

    meta_data = [
        [
            Paragraph("<b>Semester / Year</b>", meta_label),
            Paragraph(f": &nbsp;{semester_name}", meta_val),
            Paragraph("<b>Generated On</b>", meta_label),
            Paragraph(f": &nbsp;{xml_escape(generated_on)}", meta_val),
        ],
        [
            Paragraph("<b>Subject</b>", meta_label),
            Paragraph(f": &nbsp;{subject_value or '-'}", meta_val),
            Paragraph("<b>Generated By</b>", meta_label),
            Paragraph(": &nbsp;NextGen SMS", meta_val),
        ],
        [
            Paragraph("<b>Faculty</b>", meta_label),
            Paragraph(f": &nbsp;{faculty_name}", meta_val),
            Paragraph("<b>Total Students</b>", meta_label),
            Paragraph(f": &nbsp;{len(roster)}", meta_val),
        ],
    ]
    meta_table = Table(
        meta_data,
        colWidths=[25 * mm, 108 * mm, 25 * mm, printable_w - 158 * mm],
        hAlign="LEFT",
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0.7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 2.2 * mm))

    days = data.get("days") or []

    # ── Print-safe table geometry ──
    # Keep identity columns readable, then allocate the remaining width to
    # the calendar. Day cells grow for shorter months but never exceed 6.8mm.
    sno_w = 8 * mm
    roll_w = 29 * mm
    name_w = 54 * mm
    identity_w = sno_w + roll_w + name_w
    day_w = min(6.8 * mm, (printable_w - identity_w) / max(1, len(days)))
    widths = [sno_w, roll_w, name_w] + [day_w] * len(days)

    header_day_style = ParagraphStyle(
        "MonthlyDayHeader",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=6.1,
        leading=6.8,
        textColor=colors.HexColor("#0f172a"),
    )
    body_sno_style = ParagraphStyle(
        "MonthlySno",
        alignment=TA_CENTER,
        fontName="Helvetica",
        fontSize=6.15,
        leading=7.0,
        textColor=colors.HexColor("#1e293b"),
    )
    body_roll_style = ParagraphStyle(
        "MonthlyRoll",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=6.05,
        leading=6.9,
        textColor=colors.HexColor("#0f172a"),
    )
    body_name_style = ParagraphStyle(
        "MonthlyName",
        alignment=TA_LEFT,
        fontName="Helvetica",
        fontSize=6.2,
        leading=7.0,
        textColor=colors.HexColor("#0f172a"),
    )
    attendance_style = ParagraphStyle(
        "MonthlyAttendanceCell",
        alignment=TA_CENTER,
        fontName="Helvetica",
        fontSize=6.05,
        leading=6.9,
    )

    rows = [
        [
            Paragraph("S.No", header_day_style),
            Paragraph("Hall Ticket No.", header_day_style),
            Paragraph("Student Name", header_day_style),
        ] + [Paragraph(f"{d['day']:02d}", header_day_style) for d in days],
        [
            "", "", "",
        ] + [Paragraph(xml_escape(str(d.get("weekday", ""))[:2]), header_day_style) for d in days],
    ]

    for idx, student in enumerate(roster, start=1):
        rows.append([
            Paragraph(str(idx), body_sno_style),
            Paragraph(xml_escape(str(student.get("roll_no") or "")), body_roll_style),
            Paragraph(xml_escape(str(student.get("name") or "")), body_name_style),
        ] + [
            Paragraph(xml_escape(str(cell.get("status") or "")), attendance_style)
            for cell in (student.get("cells") or [])
        ])

    # Keep pages balanced instead of letting the tiny calendar cells consume
    # almost the whole first page and leave only a handful of students on the
    # second. The official-style table header is repeated on every page.
    rows_per_page = 27

    def make_register_table(student_chunk, global_offset):
        chunk_rows = [rows[0], rows[1]]
        for local_idx, student in enumerate(student_chunk):
            chunk_rows.append([
                Paragraph(str(global_offset + local_idx + 1), body_sno_style),
                Paragraph(xml_escape(str(student.get("roll_no") or "")), body_roll_style),
                Paragraph(xml_escape(str(student.get("name") or "")), body_name_style),
            ] + [
                Paragraph(xml_escape(str(cell.get("status") or "")), attendance_style)
                for cell in (student.get("cells") or [])
            ])

        tbl = Table(
            chunk_rows,
            colWidths=widths,
            repeatRows=2,
            splitByRow=1,
            hAlign="LEFT",
        )
        style = [
            ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#94a3b8")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ALIGN", (2, 2), (2, -1), "LEFT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0.6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0.6),
            ("TOPPADDING", (0, 0), (-1, -1), 2.3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
        ]

        for cidx, day in enumerate(days, start=3):
            if day.get("holiday"):
                style.append(("BACKGROUND", (cidx, 0), (cidx, -1), colors.HexColor("#fff4d6")))

        for local_ridx, student in enumerate(student_chunk, start=2):
            for cidx, cell in enumerate(student.get("cells") or [], start=3):
                status = cell.get("status")
                if status == "H":
                    style.append(("BACKGROUND", (cidx, local_ridx), (cidx, local_ridx), colors.HexColor("#fff4d6")))
                    style.append(("TEXTCOLOR", (cidx, local_ridx), (cidx, local_ridx), colors.HexColor("#854d0e")))
                elif status == "P":
                    style.append(("TEXTCOLOR", (cidx, local_ridx), (cidx, local_ridx), colors.HexColor("#067647")))
                elif status == "A":
                    style.append(("TEXTCOLOR", (cidx, local_ridx), (cidx, local_ridx), colors.HexColor("#b42318")))

        tbl.setStyle(TableStyle(style))
        return tbl

    for chunk_index in range(0, len(roster), rows_per_page):
        chunk = roster[chunk_index:chunk_index + rows_per_page]
        if chunk_index:
            story.append(PageBreak())
        story.append(make_register_table(chunk, chunk_index))
        story.append(Spacer(1, 1.6 * mm))
        story.append(Paragraph(
            "P = Present &nbsp;&nbsp; A = Absent &nbsp;&nbsp; H = Central Holiday &nbsp;&nbsp; blank = no class/session recorded",
            sub_left,
        ))

    doc.build(story, canvasmaker=MonthlyNumberedCanvas)
    return buf.getvalue()

