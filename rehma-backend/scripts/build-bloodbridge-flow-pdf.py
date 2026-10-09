#!/usr/bin/env python3
"""Build a short non-technical BloodBridge flow PDF."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT = REPO_ROOT / "Rehma-BloodBridge-Flow-Simple-Guide.pdf"


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
        title="Rehma BloodBridge — Simple Flow Guide",
        author="Rehma",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=20,
        spaceAfter=6,
        textColor=colors.HexColor("#B71C1C"),
    )
    subtitle = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#555555"),
        spaceAfter=14,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=10,
        spaceAfter=6,
        textColor=colors.HexColor("#B71C1C"),
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=14,
        spaceAfter=6,
    )
    bullet = ParagraphStyle(
        "Bullet",
        parent=body,
        leftIndent=14,
        bulletIndent=0,
        spaceAfter=4,
    )

    story = []

    story.append(Paragraph("Rehma BloodBridge", title_style))
    story.append(
        Paragraph(
            "Simple flow guide — for requesters, donors, and admins (non-technical)",
            subtitle,
        )
    )

    story.append(Paragraph("Who does what?", h1))
    role_data = [
        ["Role", "Who", "Main job"],
        ["Requester", "Patient, family, or hospital staff", "Ask for blood and confirm receipt"],
        ["Donor", "Person who can give blood", "Respond to requests and donate"],
        ["Admin", "Rehma support", "Fix disputes and old records when needed"],
    ]
    t = Table(role_data, colWidths=[1.1 * inch, 2.2 * inch, 2.5 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFEBEE")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 8))

    steps = [
        (
            "1. Someone needs blood",
            "The requester creates a request with blood group, <b>how many units</b>, "
            "<b>hospital</b>, <b>location</b>, <b>contact phone</b>, <b>deadline</b>, and notes. "
            "They can track progress anytime.",
        ),
        (
            "2. Matching donors",
            "The system invites suitable donors in small batches. If someone does not answer in time, "
            "others may be invited. Matching stops when the request is filled, cancelled, expired, or paused.",
        ),
        (
            "3. Donor decides",
            "<b>Accept</b> (say how many units if more than one is needed), "
            "<b>Decline</b>, or <b>Available later</b>. "
            "Managed donors show who is acting on their behalf.",
        ),
        (
            "4. Current commitment",
            "After accepting, the donor sees <b>My Current Commitment</b> on the home screen with next steps.",
        ),
        (
            "5. Report donation",
            "After donating at the hospital, the donor reports <b>how many units</b> they gave. "
            "Partial reports keep the rest of their promise until updated.",
        ),
        (
            "6. Confirm receipt",
            "The requester confirms how many units the hospital actually received. "
            "They can confirm in parts, without exceeding what was reported.",
        ),
        (
            "7. Dispute (if needed)",
            "If something is wrong, the requester can dispute. Admin reviews and decides with a recorded reason.",
        ),
        (
            "8. Cancel or withdraw",
            "Requesters can cancel open requests. Donors can withdraw from a commitment. "
            "No new invites go out after cancel or expiry.",
        ),
    ]
    story.append(Paragraph("The journey in 8 steps", h1))
    for title, text in steps:
        story.append(Paragraph(f"<b>{title}</b>", body))
        story.append(Paragraph(text, bullet))

    story.append(Paragraph("Units (bags of blood) — quick reference", h1))
    unit_data = [
        ["Term", "Meaning"],
        ["Required", "Still needed for the patient"],
        ["Reserved", "Promised by donors, not yet reported donated"],
        ["Reported", "Donor says they donated; waiting for confirmation"],
        ["Confirmed", "Requester says the hospital received them"],
        ["Remaining", "Still needed after confirmations"],
    ]
    t2 = Table(unit_data, colWidths=[1.3 * inch, 4.5 * inch])
    t2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFEBEE")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(t2)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Notifications", h1))
    story.append(
        Paragraph(
            "Donors and requesters get alerts for invites, acceptances, donations reported, "
            "receipt confirmed, disputes, and cancellations. Tapping opens the right request "
            "(sign in first if the session expired).",
            body,
        )
    )

    story.append(Paragraph("One-line summary", h1))
    story.append(
        Paragraph(
            "Request → invite donors → accept → donate & report → confirm receipt → "
            "dispute only if wrong → done when enough units are confirmed or request is cancelled.",
            ParagraphStyle("Sum", parent=body, fontName="Helvetica-Oblique", alignment=TA_LEFT),
        )
    )

    doc.build(story)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
