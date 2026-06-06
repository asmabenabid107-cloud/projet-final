from __future__ import annotations

import html
import os
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree


PIL_DIR = Path(os.environ.get("CODEX_PILLOW", Path(tempfile.gettempdir()) / "codex_pillow"))
if PIL_DIR.exists():
    sys.path.insert(0, str(PIL_DIR))

from PIL import Image, ImageDraw, ImageFont  # type: ignore


CANVAS_W = 3400
CANVAS_H = 2100
BOUNDARY_X = 430
BOUNDARY_Y = 60
BOUNDARY_W = 2150
BOUNDARY_H = 1850
FONT_FAMILY = "Arial"
STROKE = "#111827"
EDGE = "#4B5563"
BACKGROUND = "#FFFFFF"


@dataclass
class Shape:
    id: str
    label: str
    x: int
    y: int
    w: int
    h: int
    kind: str
    font_size: int = 26
    bold: bool = False

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclass
class Edge:
    id: str
    source: str
    target: str
    kind: str
    label: str = ""
    source_side: str = "right"
    target_side: str = "left"
    mid_x: int | None = None
    mid_y: int | None = None
    points: list[tuple[int, int]] = field(default_factory=list)


def make_shapes() -> list[Shape]:
    return [
        Shape("system", "", BOUNDARY_X, BOUNDARY_Y, BOUNDARY_W, BOUNDARY_H, "boundary"),
        Shape("title", "Diagramme use case sprint 2", 1000, 95, 900, 44, "title", font_size=30, bold=True),
        Shape("admin", "Administrateur", 110, 320, 90, 150, "actor"),
        Shape("expediteur", "Expediteur", 110, 860, 90, 150, "actor"),
        Shape("livreur", "Livreur", 110, 1390, 90, 150, "actor"),
        Shape("auth", "Authentification", 1060, 170, 460, 110, "usecase"),
        Shape("gerer_tournees", "Gerer tournees", 650, 390, 430, 110, "usecase"),
        Shape("consulter_cartographie", "Consulter cartographie\ndes tournees", 650, 650, 500, 120, "usecase"),
        Shape("tracking_gps", "Afficher tracking GPS du\nlivreur", 650, 930, 500, 120, "usecase"),
        Shape("historique_tournees", "Consulter historique des\ntournees", 650, 1210, 500, 120, "usecase"),
        Shape("consulter_tournees", "Consulter les tournees", 650, 1440, 430, 110, "usecase"),
        Shape("scanner_qr", "Scanner QR code du colis", 650, 1620, 430, 110, "usecase"),
        Shape("maj_etat_colis", "Mettre a jour l'etat du\ncolis", 1250, 1440, 500, 120, "usecase"),
        Shape("appeler_client", "Appeler client", 1250, 1620, 430, 110, "usecase"),
        Shape("optimisation", "Optimisation automatique\ndes tournees", 1930, 390, 520, 120, "usecase"),
        Shape("generer_itineraires", "Generer les itineraires", 1930, 650, 500, 110, "usecase"),
        Shape("suivi_gps_auto", "Suivi GPS automatique du\nlivreur", 1930, 920, 520, 120, "usecase"),
        Shape("systeme_tournee", "&lt;&lt;Actor &gt;&gt;<br/>Systeme Tournee", 2800, 375, 460, 150, "ext_actor"),
        Shape("service_cartographie", "&lt;&lt;Actor &gt;&gt;<br/>Service de cartographie", 2800, 630, 460, 150, "ext_actor"),
        Shape("service_gps_mobile", "&lt;&lt;Actor &gt;&gt;<br/>Service GPS mobile", 2800, 910, 460, 150, "ext_actor"),
    ]


def make_edges() -> list[Edge]:
    return [
        Edge("e_admin_auth", "admin", "auth", "solid", source_side="right", target_side="left", mid_x=520),
        Edge("e_admin_gerer", "admin", "gerer_tournees", "solid", source_side="right", target_side="left", mid_x=480),
        Edge("e_admin_carto", "admin", "consulter_cartographie", "solid", source_side="right", target_side="left", mid_x=500),
        Edge("e_admin_tracking", "admin", "tracking_gps", "solid", source_side="right", target_side="left", mid_x=520),
        Edge("e_expediteur_auth", "expediteur", "auth", "solid", source_side="right", target_side="left", mid_x=560),
        Edge("e_expediteur_hist", "expediteur", "historique_tournees", "solid", source_side="right", target_side="left", mid_x=500),
        Edge("e_livreur_auth", "livreur", "auth", "solid", source_side="right", target_side="left", mid_x=600),
        Edge("e_livreur_consulter", "livreur", "consulter_tournees", "solid", source_side="right", target_side="left", mid_x=540),
        Edge("e_livreur_scan", "livreur", "scanner_qr", "solid", source_side="right", target_side="left", mid_x=560),
        Edge(
            "e_livreur_maj",
            "livreur",
            "maj_etat_colis",
            "solid",
            source_side="right",
            target_side="left",
            points=[(560, 1465), (560, 1575), (1190, 1575), (1190, 1500)],
        ),
        Edge(
            "e_livreur_appel",
            "livreur",
            "appeler_client",
            "solid",
            source_side="right",
            target_side="left",
            points=[(600, 1465), (600, 1760), (1190, 1760), (1190, 1675)],
        ),
        Edge("e_sys_opt", "systeme_tournee", "optimisation", "solid", source_side="left", target_side="right", mid_x=2700),
        Edge("e_map_itin", "service_cartographie", "generer_itineraires", "solid", source_side="left", target_side="right", mid_x=2700),
        Edge("e_gps_suivi", "service_gps_mobile", "suivi_gps_auto", "solid", source_side="left", target_side="right", mid_x=2700),
        Edge("e_inc_gerer_opt", "gerer_tournees", "optimisation", "include", "include", source_side="right", target_side="left", mid_x=1600),
        Edge("e_inc_opt_itin", "optimisation", "generer_itineraires", "include", "include", source_side="bottom", target_side="top", mid_y=575),
        Edge("e_inc_tracking_suivi", "tracking_gps", "suivi_gps_auto", "include", "include", source_side="right", target_side="left", mid_x=1550),
        Edge("e_ext_appel_maj", "appeler_client", "maj_etat_colis", "include", "extend", source_side="top", target_side="bottom", mid_y=1590),
    ]


def anchor(shape: Shape, side: str) -> tuple[int, int]:
    if side == "left":
        return shape.x, int(shape.cy)
    if side == "right":
        return shape.x + shape.w, int(shape.cy)
    if side == "top":
        return int(shape.cx), shape.y
    if side == "bottom":
        return int(shape.cx), shape.y + shape.h
    raise ValueError(f"Unsupported side: {side}")


def route_points(source: Shape, target: Shape, edge: Edge) -> list[tuple[int, int]]:
    if edge.points:
        return edge.points

    sx, sy = anchor(source, edge.source_side)
    tx, ty = anchor(target, edge.target_side)

    if edge.source_side in {"left", "right"} and edge.target_side in {"left", "right"}:
        if edge.mid_x is None:
            edge.mid_x = int((sx + tx) / 2)
        if sy == ty:
            return []
        return [(edge.mid_x, sy), (edge.mid_x, ty)]

    if edge.source_side in {"top", "bottom"} and edge.target_side in {"top", "bottom"}:
        if edge.mid_y is None:
            edge.mid_y = int((sy + ty) / 2)
        if sx == tx:
            return []
        return [(sx, edge.mid_y), (tx, edge.mid_y)]

    if edge.mid_x is not None:
        return [(edge.mid_x, sy), (edge.mid_x, ty)]
    if edge.mid_y is not None:
        return [(sx, edge.mid_y), (tx, edge.mid_y)]

    return []


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                Path("C:/Windows/Fonts/arialbd.ttf"),
                Path("C:/Windows/Fonts/segoeuib.ttf"),
            ]
        )
    candidates.extend(
        [
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/segoeui.ttf"),
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def html_to_plain(text: str) -> str:
    return html.unescape(text.replace("<br/>", "\n").replace("<br>", "\n"))


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, spacing: int = 8) -> tuple[int, int]:
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align="center")
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    *,
    font: ImageFont.ImageFont,
    fill: str = STROKE,
    spacing: int = 8,
) -> None:
    x1, y1, x2, y2 = box
    w, h = text_size(draw, text, font, spacing=spacing)
    draw.multiline_text(
        ((x1 + x2 - w) / 2, (y1 + y2 - h) / 2),
        text,
        font=font,
        fill=fill,
        spacing=spacing,
        align="center",
    )


def draw_actor(draw: ImageDraw.ImageDraw, shape: Shape) -> None:
    x = shape.x
    y = shape.y
    w = shape.w
    h = shape.h
    cx = x + w / 2
    head_r = 22
    head_y = y + 18
    draw.ellipse((cx - head_r, head_y, cx + head_r, head_y + head_r * 2), outline=STROKE, width=3)
    body_top = head_y + head_r * 2 + 8
    body_bottom = y + 100
    draw.line((cx, body_top, cx, body_bottom), fill=STROKE, width=3)
    draw.line((cx - 35, body_top + 25, cx + 35, body_top + 25), fill=STROKE, width=3)
    draw.line((cx, body_bottom, cx - 36, y + 145), fill=STROKE, width=3)
    draw.line((cx, body_bottom, cx + 36, y + 145), fill=STROKE, width=3)
    font = load_font(shape.font_size, bold=False)
    label_y = y + 152
    label = html_to_plain(shape.label)
    w_text, h_text = text_size(draw, label, font, spacing=6)
    draw.multiline_text((cx - w_text / 2, label_y), label, font=font, fill=STROKE, spacing=6, align="center")


def draw_ext_actor(draw: ImageDraw.ImageDraw, shape: Shape) -> None:
    draw.rectangle((shape.x, shape.y, shape.x + shape.w, shape.y + shape.h), outline=STROKE, width=3, fill=BACKGROUND)
    draw_centered_text(
        draw,
        (shape.x + 16, shape.y + 12, shape.x + shape.w - 16, shape.y + shape.h - 12),
        html_to_plain(shape.label),
        font=load_font(shape.font_size, bold=False),
        spacing=6,
    )


def draw_usecase(draw: ImageDraw.ImageDraw, shape: Shape) -> None:
    draw.ellipse((shape.x, shape.y, shape.x + shape.w, shape.y + shape.h), outline=STROKE, width=3, fill=BACKGROUND)
    draw_centered_text(
        draw,
        (shape.x + 16, shape.y + 12, shape.x + shape.w - 16, shape.y + shape.h - 12),
        html_to_plain(shape.label),
        font=load_font(shape.font_size, bold=False),
        spacing=6,
    )


def draw_title(draw: ImageDraw.ImageDraw, shape: Shape) -> None:
    draw_centered_text(
        draw,
        (shape.x, shape.y, shape.x + shape.w, shape.y + shape.h),
        html_to_plain(shape.label),
        font=load_font(shape.font_size, bold=True),
        spacing=4,
    )


def draw_boundary(draw: ImageDraw.ImageDraw, shape: Shape) -> None:
    draw.rectangle((shape.x, shape.y, shape.x + shape.w, shape.y + shape.h), outline=STROKE, width=3, fill=BACKGROUND)


def build_polyline(shape_map: dict[str, Shape], edge: Edge) -> list[tuple[int, int]]:
    source = shape_map[edge.source]
    target = shape_map[edge.target]
    start = anchor(source, edge.source_side)
    points = route_points(source, target, edge)
    end = anchor(target, edge.target_side)
    return [start, *points, end]


def draw_dashed_segment(draw: ImageDraw.ImageDraw, a: tuple[int, int], b: tuple[int, int], *, fill: str, width: int, dash: int = 16, gap: int = 10) -> None:
    x1, y1 = a
    x2, y2 = b
    if x1 == x2:
        step = dash + gap
        direction = 1 if y2 >= y1 else -1
        for start in range(y1, y2, direction * step):
            end = start + direction * dash
            if direction > 0:
                seg_end = min(end, y2)
            else:
                seg_end = max(end, y2)
            draw.line((x1, start, x2, seg_end), fill=fill, width=width)
        return
    if y1 == y2:
        step = dash + gap
        direction = 1 if x2 >= x1 else -1
        for start in range(x1, x2, direction * step):
            end = start + direction * dash
            if direction > 0:
                seg_end = min(end, x2)
            else:
                seg_end = max(end, x2)
            draw.line((start, y1, seg_end, y2), fill=fill, width=width)
        return
    draw.line((x1, y1, x2, y2), fill=fill, width=width)


def draw_arrow_head(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], *, fill: str) -> None:
    x1, y1 = start
    x2, y2 = end
    size = 16
    if x2 > x1:
        pts = [(x2, y2), (x2 - size, y2 - 8), (x2 - size, y2 + 8)]
    elif x2 < x1:
        pts = [(x2, y2), (x2 + size, y2 - 8), (x2 + size, y2 + 8)]
    elif y2 > y1:
        pts = [(x2, y2), (x2 - 8, y2 - size), (x2 + 8, y2 - size)]
    else:
        pts = [(x2, y2), (x2 - 8, y2 + size), (x2 + 8, y2 + size)]
    draw.polygon(pts, outline=fill, fill=BACKGROUND)


def draw_label_box(draw: ImageDraw.ImageDraw, position: tuple[int, int], text: str) -> None:
    font = load_font(26, bold=False)
    plain = html_to_plain(text)
    tw, th = text_size(draw, plain, font, spacing=4)
    x = position[0] - tw / 2 - 8
    y = position[1] - th / 2 - 4
    draw.rectangle((x, y, x + tw + 16, y + th + 8), fill=BACKGROUND, outline=None)
    draw.multiline_text((x + 8, y + 4), plain, font=font, fill=EDGE, spacing=4, align="center")


def draw_edge(draw: ImageDraw.ImageDraw, shape_map: dict[str, Shape], edge: Edge) -> None:
    polyline = build_polyline(shape_map, edge)
    color = EDGE if edge.kind == "include" else STROKE
    for a, b in zip(polyline, polyline[1:]):
        if edge.kind == "include":
            draw_dashed_segment(draw, a, b, fill=color, width=3)
        else:
            draw.line((a[0], a[1], b[0], b[1]), fill=color, width=3)

    if edge.kind == "include":
        draw_arrow_head(draw, polyline[-2], polyline[-1], fill=color)
        if edge.label:
            if edge.mid_x is not None:
                label_pos = (edge.mid_x, int((polyline[0][1] + polyline[-1][1]) / 2))
            elif edge.mid_y is not None:
                label_pos = (int((polyline[0][0] + polyline[-1][0]) / 2), edge.mid_y)
            else:
                label_pos = (int((polyline[0][0] + polyline[-1][0]) / 2), int((polyline[0][1] + polyline[-1][1]) / 2))
            draw_label_box(draw, label_pos, edge.label)


def draw_png(output_path: Path, shapes: list[Shape], edges: list[Edge]) -> None:
    image = Image.new("RGB", (CANVAS_W, CANVAS_H), BACKGROUND)
    draw = ImageDraw.Draw(image)
    shape_map = {shape.id: shape for shape in shapes}

    for shape in shapes:
        if shape.kind == "boundary":
            draw_boundary(draw, shape)
    for edge in edges:
        if edge.kind == "solid":
            draw_edge(draw, shape_map, edge)
    for edge in edges:
        if edge.kind == "include":
            draw_edge(draw, shape_map, edge)
    for shape in shapes:
        if shape.kind == "usecase":
            draw_usecase(draw, shape)
        elif shape.kind == "actor":
            draw_actor(draw, shape)
        elif shape.kind == "ext_actor":
            draw_ext_actor(draw, shape)
        elif shape.kind == "title":
            draw_title(draw, shape)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG")


def escape_attr(value: str) -> str:
    return html.escape(value, quote=True)


def html_label(value: str) -> str:
    if "<br" in value or "&lt;" in value:
        return value
    return escape_attr(value).replace("\n", "<br/>")


def edge_style(edge: Edge) -> str:
    source_map = {"left": (0, 0.5), "right": (1, 0.5), "top": (0.5, 0), "bottom": (0.5, 1)}
    target_map = source_map
    exit_x, exit_y = source_map[edge.source_side]
    entry_x, entry_y = target_map[edge.target_side]
    base = [
        "edgeStyle=orthogonalEdgeStyle",
        "rounded=0",
        "orthogonalLoop=1",
        "jettySize=auto",
        "html=1",
        f"strokeColor={EDGE if edge.kind == 'include' else STROKE}",
        "strokeWidth=2",
        f"exitX={exit_x}",
        f"exitY={exit_y}",
        "exitDx=0",
        "exitDy=0",
        f"entryX={entry_x}",
        f"entryY={entry_y}",
        "entryDx=0",
        "entryDy=0",
    ]
    if edge.kind == "include":
        base.extend(["dashed=1", "dashPattern=8 8", "endArrow=block", "endFill=0", "fontSize=26", f"fontFamily={FONT_FAMILY}", f"fontColor={EDGE}"])
    else:
        base.extend(["endArrow=none"])
    return ";".join(base) + ";"


def vertex_style(shape: Shape) -> str:
    if shape.kind == "boundary":
        return f"rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor={STROKE};strokeWidth=2;"
    if shape.kind == "title":
        return f"text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize={shape.font_size};fontStyle=1;fontFamily={FONT_FAMILY};fontColor={STROKE};"
    if shape.kind == "actor":
        return f"shape=umlActor;whiteSpace=wrap;html=1;outlineConnect=0;strokeColor={STROKE};fillColor={BACKGROUND};fontSize={shape.font_size};fontFamily={FONT_FAMILY};align=center;verticalLabelPosition=bottom;verticalAlign=top;"
    if shape.kind == "ext_actor":
        return f"rounded=0;whiteSpace=wrap;html=1;fillColor={BACKGROUND};strokeColor={STROKE};strokeWidth=2;fontSize={shape.font_size};fontFamily={FONT_FAMILY};fontColor={STROKE};align=center;verticalAlign=middle;spacing=10;"
    return f"ellipse;whiteSpace=wrap;html=1;fillColor={BACKGROUND};strokeColor={STROKE};strokeWidth=2;fontSize={shape.font_size};fontFamily={FONT_FAMILY};fontColor={STROKE};align=center;verticalAlign=middle;spacing=12;"


def write_drawio(output_path: Path, shapes: list[Shape], edges: list[Edge]) -> None:
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    mxfile = Element(
        "mxfile",
        {
            "host": "app.diagrams.net",
            "modified": modified,
            "agent": "Codex Drawio Skill",
            "version": "24.7.17",
            "type": "device",
        },
    )
    diagram = SubElement(mxfile, "diagram", {"id": "usecase-sprint2-simple", "name": "Page-1"})
    graph = SubElement(
        diagram,
        "mxGraphModel",
        {
            "dx": "1600",
            "dy": "1200",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": str(CANVAS_W),
            "pageHeight": str(CANVAS_H),
            "math": "0",
            "shadow": "0",
        },
    )
    root = SubElement(graph, "root")
    SubElement(root, "mxCell", {"id": "0"})
    SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    for shape in shapes:
        if shape.id == "system":
            parent = "1"
        else:
            parent = "1"
        cell = SubElement(
            root,
            "mxCell",
            {
                "id": shape.id,
                "value": html_label(shape.label),
                "style": vertex_style(shape),
                "vertex": "1",
                "parent": parent,
            },
        )
        SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(shape.x),
                "y": str(shape.y),
                "width": str(shape.w),
                "height": str(shape.h),
                "as": "geometry",
            },
        )

    shape_map = {shape.id: shape for shape in shapes}
    for edge in edges:
        cell = SubElement(
            root,
            "mxCell",
            {
                "id": edge.id,
                "value": html_label(edge.label),
                "style": edge_style(edge),
                "edge": "1",
                "parent": "1",
                "source": edge.source,
                "target": edge.target,
            },
        )
        geometry = SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        points = route_points(shape_map[edge.source], shape_map[edge.target], edge)
        if points:
            arr = SubElement(geometry, "Array", {"as": "points"})
            for x, y in points:
                SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})

    output_path.parent.mkdir(parents=True, exist_ok=True)
    ElementTree(mxfile).write(output_path, encoding="utf-8", xml_declaration=False)


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    stem = "diagramme-usecase-sprint2-simple"
    drawio_path = base_dir / f"{stem}.drawio"
    png_path = base_dir / f"{stem}.png"
    shapes = make_shapes()
    edges = make_edges()
    write_drawio(drawio_path, shapes, edges)
    draw_png(png_path, shapes, edges)
    print(drawio_path)
    print(png_path)


if __name__ == "__main__":
    main()
